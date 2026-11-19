-- NusaPOS · Fase 2.2 — Skema inti. Sumber kebenaran sekarang DI REPO.
create extension if not exists pgcrypto;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  role text not null check (role in ('admin','kasir')),
  name text not null,
  username text,
  is_root boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_store_idx on public.profiles(store_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  sku text not null,
  name text not null,
  category text not null check (category in ('Kopi','Non-Kopi','Makanan','Cemilan','Ritel')),
  kind text not null default 'single' check (kind in ('single','bundle')),
  price numeric(12,2) not null check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  emoji text not null default '',
  active boolean not null default true,
  description text not null default '',
  photo_url text,
  discount jsonb,
  day_promos jsonb not null default '[]'::jsonb,
  available_days jsonb not null default '[0,1,2,3,4,5,6]'::jsonb,
  bundle_items jsonb not null default '[]'::jsonb,
  popularity integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, sku)
);
create index products_store_idx on public.products(store_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  name text not null,
  phone text not null default '-',
  member boolean not null default false,
  member_no text,
  username text,
  email text,
  points integer not null default 0 check (points >= 0),
  visits integer not null default 0,
  spend numeric(14,2) not null default 0 check (spend >= 0),
  notes text not null default '',
  member_active boolean not null default true,
  portal boolean not null default false,
  birth_date date,
  joined_at timestamptz not null default now(),
  pin_hash text,
  created_at timestamptz not null default now()
);
create index customers_store_idx on public.customers(store_id);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  label text not null,
  seats integer not null default 2 check (seats between 1 and 20),
  area text not null default 'Indoor',
  status text not null default 'kosong' check (status in ('kosong','terisi')),
  active boolean not null default true,
  tx_id uuid,
  customer_name text,
  occupied_at timestamptz,
  note text not null default '',
  unique (store_id, label)
);

create table public.shift_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  user_id uuid not null references public.profiles(id),
  user_name text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cash numeric(12,2) not null default 0 check (opening_cash >= 0),
  closing_cash numeric(12,2),
  expected_cash numeric(12,2),
  note text not null default '',
  close_note text not null default '',
  closed_by text check (closed_by in ('manual','admin','auto'))
);
-- Satu kasir maksimal SATU shift terbuka (dijamin DB, bukan klien)
create unique index one_open_shift_per_user
  on public.shift_sessions(user_id) where closed_at is null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  number text not null,
  ts timestamptz not null default now(),
  cashier_id uuid references public.profiles(id),
  cashier_name text not null,
  customer_id uuid references public.customers(id),
  customer_name text not null default 'Pelanggan Umum',
  member_no text not null default '',
  member_tier text not null default '',
  items jsonb not null,
  subtotal numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  member_discount numeric(14,2) not null default 0,
  member_points integer not null default 0,
  tax numeric(14,2) not null default 0,
  service numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  method text not null check (method in ('Tunai','QRIS','Kartu')),
  tendered numeric(14,2) not null,
  change numeric(14,2) not null default 0,
  order_type text not null default 'takeaway' check (order_type in ('dinein','takeaway')),
  table_id uuid references public.dining_tables(id),
  table_label text not null default '',
  shift_id uuid references public.shift_sessions(id),
  status text not null default 'Selesai' check (status in ('Selesai','Refund')),
  is_test boolean not null default false,
  unique (store_id, number)
);
create index tx_store_ts_idx on public.transactions(store_id, ts desc);
create index tx_shift_idx on public.transactions(shift_id);

-- Nomor transaksi harian atomik (NP-YYMMDD-###, sama dengan demo)
create table public.tx_counters (
  store_id uuid not null references public.stores(id),
  day date not null,
  seq integer not null default 0,
  primary key (store_id, day)
);