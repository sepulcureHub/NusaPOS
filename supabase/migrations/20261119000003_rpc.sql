-- NusaPOS · Fase 2.2 — RPC atomik. Semua aturan uang dijaga DI SINI, bukan di klien.

create or replace function public.record_sale(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_settings jsonb;
  v_tz text;
  v_now timestamptz := now();
  v_dow int; v_day date;
  v_is_test boolean; v_max_disc numeric;
  v_shift uuid := null;
  v_items jsonb := '[]'::jsonb;
  v_need jsonb := '{}'::jsonb;
  v_subtotal numeric := 0;
  v_di jsonb; v_dval numeric; v_disc numeric; v_after numeric;
  v_mdisc numeric; v_base numeric; v_tax numeric; v_service numeric; v_total numeric;
  v_points int; v_method text; v_tendered numeric; v_change numeric := 0;
  v_customer public.customers%rowtype; v_has_customer boolean := false;
  v_table public.dining_tables%rowtype;
  v_seq int; v_number text; v_tx uuid;
  it jsonb; comp jsonb; v_d jsonb; v_val numeric; v_eff numeric;
  v_comps jsonb; v_key text; v_qty int;
  prod public.products%rowtype; cprod public.products%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Belum login');
  end if;
  select * into v_profile from public.profiles where id = v_uid and active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Akun tidak terdaftar / nonaktif');
  end if;

  select settings into v_settings from public.stores where id = v_profile.store_id;
  v_tz := coalesce(v_settings->>'timezone', 'Asia/Jakarta');
  v_dow := extract(dow from v_now at time zone v_tz)::int;
  v_day := (v_now at time zone v_tz)::date;
  -- is_test DITENTUKAN SERVER (bukan dari klien). Default: admin jual beneran di live.
  v_is_test := v_profile.role = 'admin'
               and coalesce((v_settings->>'adminSalesAsTest')::boolean, false);
  v_max_disc := least(100, greatest(0, coalesce((v_settings->>'maxDiscountKasirPct')::numeric, 20)));

  -- Kasir WAJIB punya shift terbuka (dijamin DB, bukan klien)
  if v_profile.role = 'kasir' then
    select id into v_shift from public.shift_sessions
      where user_id = v_uid and closed_at is null;
    if v_shift is null then
      return jsonb_build_object('ok', false, 'error', 'Buka shift dulu sebelum berjualan');
    end if;
  end if;

  if jsonb_typeof(p->'items') <> 'array'
     or jsonb_array_length(p->'items') = 0
     or jsonb_array_length(p->'items') > 50 then
    return jsonb_build_object('ok', false, 'error', 'Item tidak valid');
  end if;

  -- Kunci SEMUA produk toko berurutan id → anti race stok & anti deadlock.
  -- Skala UMKM (puluhan produk) kunci kasar ini murah dan benar.
  perform 1 from public.products where store_id = v_profile.store_id order by id for update;

  -- Bangun item OTORITATIF dari DB: harga efektif (promo harian > diskon dasar),
  -- komponen bundle dari DB, ketersediaan hari ikut timezone toko.
  for it in select * from jsonb_array_elements(p->'items') loop
    v_qty := coalesce((it->>'qty')::int, 0);
    if v_qty < 1 or v_qty > 999 then
      return jsonb_build_object('ok', false, 'error', 'Qty tidak valid');
    end if;
    select * into prod from public.products
      where id = (it->>'product_id')::uuid and store_id = v_profile.store_id;
    if not found or not prod.active then
      return jsonb_build_object('ok', false, 'error', 'Produk tidak ditemukan / nonaktif');
    end if;
    if not (prod.available_days @> to_jsonb(v_dow)) then
      return jsonb_build_object('ok', false, 'error', prod.name || ' tidak tersedia hari ini');
    end if;

    v_d := null;
    select elem into v_d
      from jsonb_array_elements(coalesce(prod.day_promos, '[]'::jsonb)) as elem
      where (elem->>'day')::int = v_dow and (elem->>'value')::numeric > 0
      limit 1;
    if v_d is null then v_d := prod.discount; end if;
    v_val := greatest(0, coalesce((v_d->>'value')::numeric, 0));
    if coalesce(v_d->>'type', 'pct') = 'pct' then
      v_eff := greatest(0, prod.price - round(prod.price * least(100, v_val) / 100));
    else
      v_eff := greatest(0, prod.price - least(prod.price, v_val));
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
             'product_id', c->>'productId',
             'name', coalesce(cp.name, ''),
             'qty', (c->>'qty')::int)), '[]'::jsonb)
      into v_comps
      from jsonb_array_elements(prod.bundle_items) as c
      left join public.products cp on cp.id = (c->>'productId')::uuid;

    if prod.kind = 'bundle' then
      for comp in select * from jsonb_array_elements(prod.bundle_items) loop
        select * into cprod from public.products
          where id = (comp->>'productId')::uuid and store_id = v_profile.store_id;
        if not found or not cprod.active then
          return jsonb_build_object('ok', false, 'error', 'Komponen paket hilang / nonaktif');
        end if;
        v_key := cprod.id::text;
        v_need := jsonb_set(v_need, array[v_key],
          to_jsonb(coalesce((v_need->>v_key)::int, 0) + (comp->>'qty')::int * v_qty));
      end loop;
    else
      v_key := prod.id::text;
      v_need := jsonb_set(v_need, array[v_key],
        to_jsonb(coalesce((v_need->>v_key)::int, 0) + v_qty));
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id', prod.id, 'name', prod.name, 'emoji', prod.emoji,
      'category', prod.category, 'price', v_eff, 'base_price', prod.price,
      'qty', v_qty, 'kind', prod.kind, 'components', v_comps));
    v_subtotal := v_subtotal + v_eff * v_qty;
    update public.products set popularity = popularity + v_qty where id = prod.id;
  end loop;

  -- Cek & potong stok (baris sudah terkunci)
  for v_key in select jsonb_object_keys(v_need) loop
    select * into prod from public.products where id = v_key::uuid;
    if prod.stock < (v_need->>v_key)::int then
      return jsonb_build_object('ok', false, 'error',
        'Stok ' || prod.name || ' tidak cukup (sisa ' || prod.stock || ')');
    end if;
  end loop;
  for v_key in select jsonb_object_keys(v_need) loop
    update public.products set stock = stock - (v_need->>v_key)::int where id = v_key::uuid;
  end loop;

  -- Member (opsional) — kunci barisnya juga
  if coalesce(p->>'customer_id', '') <> '' then
    select * into v_customer from public.customers
      where id = (p->>'customer_id')::uuid and store_id = v_profile.store_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Member tidak ditemukan');
    end if;
    v_has_customer := true;
  end if;

  -- Diskon order: batas kasir dari settings (admin bebas)
  v_di := coalesce(p->'discount_input', '{"type":"pct","value":0}'::jsonb);
  v_dval := greatest(0, coalesce((v_di->>'value')::numeric, 0));
  if v_profile.role = 'kasir' then
    if v_di->>'type' = 'pct' and v_dval > v_max_disc then
      return jsonb_build_object('ok', false, 'error',
        'Diskon kasir maksimal ' || v_max_disc || '%');
    end if;
    if v_di->>'type' = 'rp' and v_dval > round(v_subtotal * v_max_disc / 100) then
      return jsonb_build_object('ok', false, 'error',
        'Diskon kasir maksimal ' || v_max_disc || '% dari subtotal');
    end if;
  end if;
  if v_di->>'type' = 'pct' then
    v_disc := round(v_subtotal * least(100, v_dval) / 100);
  else
    v_disc := least(v_subtotal, v_dval);
  end if;
  v_disc := least(v_subtotal, greatest(0, v_disc));
  v_after := v_subtotal - v_disc;

  -- Diskon member dihitung action dari DB; RPC pagar kewajaran (clamp 40% ala lib/member)
  v_mdisc := greatest(0, coalesce((p->>'member_discount')::numeric, 0));
  if v_mdisc > 0 and not v_has_customer then
    return jsonb_build_object('ok', false, 'error', 'Diskon member tanpa member');
  end if;
  if v_mdisc > round(v_after * 0.4) then
    return jsonb_build_object('ok', false, 'error', 'Diskon member melebihi batas');
  end if;
  v_mdisc := least(v_after, v_mdisc);
  v_base := v_after - v_mdisc;

  -- Pajak & service DIHITUNG ULANG di DB dari settings (payload klien tidak dipercaya)
  v_tax := round(v_base * coalesce((v_settings->>'taxPct')::numeric, 0) / 100);
  v_service := round(v_base * coalesce((v_settings->>'servicePct')::numeric, 0) / 100);
  v_total := v_base + v_tax + v_service;

  v_points := greatest(0, coalesce((p->>'member_points')::int, 0));
  if v_is_test or not v_has_customer or not v_customer.member then
    v_points := 0;
  elsif v_points > floor(v_total / greatest(100, coalesce((v_settings->>'memberPointRate')::numeric, 1000))) then
    return jsonb_build_object('ok', false, 'error', 'Poin tidak wajar');
  end if;

  v_method := coalesce(p->>'method', '');
  if v_method not in ('Tunai','QRIS','Kartu') then
    return jsonb_build_object('ok', false, 'error', 'Metode bayar tidak valid');
  end if;
  if v_method = 'Tunai' then
    v_tendered := coalesce((p->>'tendered')::numeric, 0);
    if v_tendered < v_total then
      return jsonb_build_object('ok', false, 'error', 'Uang diterima kurang dari total');
    end if;
    v_change := v_tendered - v_total;
  else
    v_tendered := v_total; v_change := 0;
  end if;

  -- Meja dine-in: cek DI BAWAH KUNCI (anti rebutan dua kasir)
  if p->>'order_type' = 'dinein' then
    if coalesce(p->>'table_id', '') = '' then
      return jsonb_build_object('ok', false, 'error', 'Dine-in wajib pilih meja');
    end if;
    select * into v_table from public.dining_tables
      where id = (p->>'table_id')::uuid and store_id = v_profile.store_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Meja tidak ditemukan');
    end if;
    if v_table.status <> 'kosong' then
      return jsonb_build_object('ok', false, 'error', 'Meja sudah terisi');
    end if;
  end if;

  -- Nomor harian atomik
  insert into public.tx_counters (store_id, day, seq)
    values (v_profile.store_id, v_day, 1)
  on conflict (store_id, day) do update set seq = tx_counters.seq + 1
  returning seq into v_seq;
  v_number := 'NP-' || to_char(v_day, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');

  insert into public.transactions (
    store_id, number, cashier_id, cashier_name,
    customer_id, customer_name, member_no, member_tier, items,
    subtotal, discount, member_discount, member_points, tax, service, total,
    method, tendered, change, order_type, table_id, table_label, shift_id, is_test
  ) values (
    v_profile.store_id, v_number, v_uid, v_profile.name,
    case when v_has_customer then v_customer.id end,
    case when v_has_customer then v_customer.name else 'Pelanggan Umum' end,
    case when v_has_customer then coalesce(v_customer.member_no, '') else '' end,
    coalesce(p->>'member_tier', ''), v_items,
    v_subtotal, v_disc, v_mdisc, v_points, v_tax, v_service, v_total,
    v_method, v_tendered, v_change,
    coalesce(p->>'order_type', 'takeaway'),
    case when p->>'order_type' = 'dinein' then v_table.id end,
    case when p->>'order_type' = 'dinein' then v_table.label else '' end,
    v_shift, v_is_test
  ) returning id into v_tx;

  if v_has_customer and v_customer.member and not v_is_test then
    update public.customers
      set spend = spend + v_total, points = points + v_points, visits = visits + 1
      where id = v_customer.id;
  end if;

  if p->>'order_type' = 'dinein' then
    update public.dining_tables
      set status = 'terisi', tx_id = v_tx,
          customer_name = case when v_has_customer then v_customer.name else 'Pelanggan Umum' end,
          occupied_at = v_now
      where id = v_table.id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_tx, 'tx_number', v_number,
    'total', v_total, 'is_test', v_is_test, 'shift_id', v_shift);
exception when others then
  raise warning 'record_sale gagal: %', sqlerrm; -- detail ke log server, BUKAN ke klien
  return jsonb_build_object('ok', false, 'error', 'Transaksi gagal diproses server — coba lagi');
end $$;

-- ═══ Shift: buka/tutup hanya lewat RPC ═══
create or replace function public.open_shift(p_opening_cash numeric default 0)
returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid; v_opened timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'Belum login'); end if;
  select * into v_profile from public.profiles where id = v_uid and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'Akun nonaktif'); end if;
  if v_profile.role <> 'kasir' then
    return jsonb_build_object('ok', false, 'error', 'Hanya kasir yang membuka shift');
  end if;
  if p_opening_cash is null or p_opening_cash < 0 then
    return jsonb_build_object('ok', false, 'error', 'Modal awal tidak valid');
  end if;
  select id, opened_at into v_id, v_opened from public.shift_sessions
    where user_id = v_uid and closed_at is null;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'opened_at', v_opened, 'already_open', true);
  end if;
  insert into public.shift_sessions (store_id, user_id, user_name, opening_cash)
    values (v_profile.store_id, v_uid, v_profile.name, p_opening_cash)
    returning id, opened_at into v_id, v_opened;
  return jsonb_build_object('ok', true, 'id', v_id, 'opened_at', v_opened);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Shift sudah terbuka');
end $$;

create or replace function public.close_shift(
  p_session_id uuid, p_closing_cash numeric, p_note text default ''
)
returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_s public.shift_sessions%rowtype;
  v_expected numeric;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'Belum login'); end if;
  select * into v_profile from public.profiles where id = v_uid and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'Akun nonaktif'); end if;
  select * into v_s from public.shift_sessions where id = p_session_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Shift tidak ditemukan'); end if;
  if v_s.closed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Shift sudah ditutup');
  end if;
  if v_s.user_id <> v_uid and v_profile.role <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Bukan shift Anda');
  end if;
  if p_closing_cash is null or p_closing_cash < 0 then
    return jsonb_build_object('ok', false, 'error', 'Kas penutupan tidak valid');
  end if;
  select v_s.opening_cash + coalesce(sum(total), 0) into v_expected
    from public.transactions
    where shift_id = p_session_id and method = 'Tunai'
      and status = 'Selesai' and not is_test;
  update public.shift_sessions
    set closed_at = now(), closing_cash = p_closing_cash, expected_cash = v_expected,
        close_note = coalesce(p_note, ''),
        closed_by = case when v_profile.role = 'admin' and v_s.user_id <> v_uid
                         then 'admin' else 'manual' end
    where id = p_session_id;
  return jsonb_build_object('ok', true, 'expected_cash', v_expected,
    'variance', p_closing_cash - v_expected);
end $$;

revoke all on function public.record_sale(jsonb), public.open_shift(numeric),
  public.close_shift(uuid, numeric, text) from public, anon;
grant execute on function public.record_sale(jsonb), public.open_shift(numeric),
  public.close_shift(uuid, numeric, text) to authenticated;