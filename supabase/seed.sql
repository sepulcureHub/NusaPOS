-- NusaPOS · Seed demo LIVE. Jalankan SETELAH membuat 2 user di Authentication.
-- Idempoten: aman dijalankan ulang.

insert into public.stores (id, name, settings) values
('a0000000-0000-4000-8000-000000000001', 'NusaPOS Demo', '{
  "storeName": "NusaPOS Demo",
  "taxPct": 10, "servicePct": 0,
  "memberEnabled": true, "memberPointRate": 1000,
  "memberDiscountPct": 5, "memberBirthdayPct": 10, "memberWelcomePoints": 50,
  "memberTierSilver": 1500000, "memberTierGold": 5000000, "memberTierPlatinum": 15000000,
  "memberBonusBronze": 0, "memberBonusSilver": 2, "memberBonusGold": 4, "memberBonusPlatinum": 6,
  "timezone": "Asia/Jakarta",
  "maxDiscountKasirPct": 20,
  "adminSalesAsTest": false
}'::jsonb)
on conflict (id) do nothing;

insert into public.products
  (id, store_id, sku, name, category, kind, price, cost, stock, emoji, description,
   discount, day_promos, sort_order) values
('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
 'KOP-001','Kopi Susu Gula Aren','Kopi','single',18000,9000,100,'☕','Signature',
 '{"type":"pct","value":10}'::jsonb, '[{"day":4,"type":"pct","value":20}]'::jsonb, 1),
('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001',
 'KOP-002','Americano','Kopi','single',15000,7000,80,'☕','', null, '[]'::jsonb, 2),
('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001',
 'NKP-001','Matcha Latte','Non-Kopi','single',22000,11000,60,'🍵','', null, '[]'::jsonb, 3),
('b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001',
 'MKN-001','Nasi Goreng Kampung','Makanan','single',25000,12000,40,'🍛','', null, '[]'::jsonb, 4),
('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001',
 'CML-001','Pisang Goreng Keju','Cemilan','single',12000,5000,50,'🍌','', null, '[]'::jsonb, 5),
('b0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001',
 'RTL-001','Air Mineral 600ml','Ritel','single',5000,2500,200,'💧','', null, '[]'::jsonb, 6),
('b0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000001',
 'PKT-001','Paket Ngopi Berdua','Kopi','bundle',30000,18000,0,'🎁','2 Kopi Susu Gula Aren',
 null, '[]'::jsonb, 7)
on conflict (id) do nothing;

update public.products
  set bundle_items = '[{"productId":"b0000000-0000-4000-8000-000000000001","qty":2}]'::jsonb
  where id = 'b0000000-0000-4000-8000-000000000007';

insert into public.customers
  (id, store_id, name, phone, member, member_no, username, spend, points, visits) values
('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',
 'Siti Rahma','081234567801',true,'NUSA-0001','siti',2260000,2260,42),
('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001',
 'Dewi Lestari','081234567802',true,'NUSA-0002','dewi',5140000,5140,88),
('c0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001',
 'Budi Santoso','081234567803',false,null,null,0,0,3)
on conflict (id) do nothing;

insert into public.dining_tables (id, store_id, label, seats, area) values
('d0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','T1',2,'Indoor'),
('d0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','T2',4,'Indoor'),
('d0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','T3',4,'Outdoor'),
('d0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','T4',6,'Outdoor')
on conflict (id) do nothing;

-- Profil nge-link ke auth.users via email (buat user-nya dulu di Authentication!)
do $$
begin
  insert into public.profiles (id, store_id, role, name, is_root)
  select id, 'a0000000-0000-4000-8000-000000000001', 'admin', 'Rani Pramesti', true
    from auth.users where email = 'admin@nusapos.demo'
  on conflict (id) do nothing;
  insert into public.profiles (id, store_id, role, name)
  select id, 'a0000000-0000-4000-8000-000000000001', 'kasir', 'Dimas Saputra'
    from auth.users where email = 'kasir@nusapos.demo'
  on conflict (id) do nothing;
  if not exists (select 1 from public.profiles) then
    raise notice 'BELUM ADA PROFIL: buat user admin@nusapos.demo & kasir@nusapos.demo di Authentication, lalu jalankan ulang seed.sql';
  end if;
end $$;