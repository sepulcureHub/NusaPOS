-- NusaPOS · Fase 2.2 — RLS: isolasi tenant + role. Tanpa policy = tolak semua.

-- Helper identitas. SECURITY DEFINER supaya nggak rekursif kena RLS profiles.
create or replace function public.auth_store_id() returns uuid
language sql stable security definer set search_path = public as
$$ select store_id from public.profiles where id = auth.uid() and active $$;

create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and active $$;

revoke all on function public.auth_store_id(), public.auth_role() from public, anon;
grant execute on function public.auth_store_id(), public.auth_role() to authenticated;

alter table public.stores         enable row level security;
alter table public.profiles       enable row level security;
alter table public.products       enable row level security;
alter table public.customers      enable row level security;
alter table public.dining_tables  enable row level security;
alter table public.shift_sessions enable row level security;
alter table public.transactions   enable row level security;
alter table public.tx_counters    enable row level security; -- tanpa policy: hanya RPC definer

-- stores: baca toko sendiri; ubah hanya admin
create policy stores_select on public.stores for select to authenticated
  using (id = public.auth_store_id());
create policy stores_update on public.stores for update to authenticated
  using (id = public.auth_store_id() and public.auth_role() = 'admin')
  with check (id = public.auth_store_id());

-- profiles: baca diri sendiri; admin baca/kelola satu toko
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_admin_all on public.profiles for all to authenticated
  using (store_id = public.auth_store_id() and public.auth_role() = 'admin')
  with check (store_id = public.auth_store_id() and public.auth_role() = 'admin');

-- products: semua staf baca; tulis hanya admin
create policy products_read on public.products for select to authenticated
  using (store_id = public.auth_store_id());
create policy products_admin_write on public.products for all to authenticated
  using (store_id = public.auth_store_id() and public.auth_role() = 'admin')
  with check (store_id = public.auth_store_id() and public.auth_role() = 'admin');

-- customers: kasir boleh daftar/edit member (members.manage); hapus hanya admin
create policy customers_read on public.customers for select to authenticated
  using (store_id = public.auth_store_id());
create policy customers_staff_write on public.customers for insert to authenticated
  with check (store_id = public.auth_store_id() and public.auth_role() in ('admin','kasir'));
create policy customers_staff_update on public.customers for update to authenticated
  using (store_id = public.auth_store_id() and public.auth_role() in ('admin','kasir'))
  with check (store_id = public.auth_store_id());
create policy customers_admin_delete on public.customers for delete to authenticated
  using (store_id = public.auth_store_id() and public.auth_role() = 'admin');

-- dining_tables: baca semua staf; tulis langsung hanya admin.
-- Perubahan status/tx_id saat jual HANYA lewat RPC record_sale (definer).
create policy tables_read on public.dining_tables for select to authenticated
  using (store_id = public.auth_store_id());
create policy tables_admin_write on public.dining_tables for all to authenticated
  using (store_id = public.auth_store_id() and public.auth_role() = 'admin')
  with check (store_id = public.auth_store_id() and public.auth_role() = 'admin');

-- shift_sessions: kasir lihat miliknya, admin lihat semua. Tulis HANYA via RPC.
create policy shifts_read on public.shift_sessions for select to authenticated
  using (user_id = auth.uid()
         or (store_id = public.auth_store_id() and public.auth_role() = 'admin'));

-- transactions: admin semua, kasir hanya miliknya (tx.view vs tx.all). Tulis HANYA via RPC.
create policy tx_read on public.transactions for select to authenticated
  using (store_id = public.auth_store_id()
         and (public.auth_role() = 'admin' or cashier_id = auth.uid()));