-- Update menu dari Aiman (WhatsApp, 13 Juli 2026).
-- Aman untuk DB berisi data nyata: hanya upsert harga/varian/produk baru,
-- produk yang hilang dari menu di-nonaktifkan (bukan dihapus — riwayat penjualan utuh).
--
-- Ringkasan perubahan:
-- 1. Fresh juice kini 3 ukuran: 1 L 70rb, 500 ml 35rb (turun dari 38/40rb), 250 ml 18rb.
-- 2. Produk fresh baru: Detox (seledri nanas timun), Metabolisme (naga nanas).
-- 3. Pure: + 1 L 60rb dan 200 ml 12rb.
-- 4. Creamy kini 3 ukuran (1 L / 500 / 250). Baru: Strawberry Alpukat Susu, Ubi Almond.
-- 5. Ramu kini 4 ukuran: 1 L 50rb, 500 ml 25rb, 250 ml 15rb, 200 ml 10rb.
-- 6. Nonaktif: Weight Loss (digantikan Metabolisme), BerUbi Ubi (digantikan Ubi Almond).

do $$
declare
  r record;
  v_product_id uuid;
begin
  create temp table menu_baru (name text, category text, size_ml int, price int) on commit drop;
  insert into menu_baru values
    -- FRESH JUICE: 1L 70rb, 500ml 35rb, 250ml 18rb
    ('Retinol',      'fresh', 1000, 70000), ('Retinol',      'fresh', 500, 35000), ('Retinol',      'fresh', 250, 18000),
    ('Power',        'fresh', 1000, 70000), ('Power',        'fresh', 500, 35000), ('Power',        'fresh', 250, 18000),
    ('Immune',       'fresh', 1000, 70000), ('Immune',       'fresh', 500, 35000), ('Immune',       'fresh', 250, 18000),
    ('Anti Virus',   'fresh', 1000, 70000), ('Anti Virus',   'fresh', 500, 35000), ('Anti Virus',   'fresh', 250, 18000),
    ('Hydrate',      'fresh', 1000, 70000), ('Hydrate',      'fresh', 500, 35000), ('Hydrate',      'fresh', 250, 18000),
    ('Detox',        'fresh', 1000, 70000), ('Detox',        'fresh', 500, 35000), ('Detox',        'fresh', 250, 18000),
    ('Metabolisme',  'fresh', 1000, 70000), ('Metabolisme',  'fresh', 500, 35000), ('Metabolisme',  'fresh', 250, 18000),
    -- PURE: 1L 60rb, 500ml 30rb, 250ml 15rb, 200ml 12rb
    ('Pure', 'fresh', 1000, 60000), ('Pure', 'fresh', 500, 30000), ('Pure', 'fresh', 250, 15000), ('Pure', 'fresh', 200, 12000),
    -- CREAMY
    ('Susu Kurma',             'creamy', 1000, 60000), ('Susu Kurma',             'creamy', 500, 30000), ('Susu Kurma',             'creamy', 250, 15000),
    ('Susu Kurma Almond',      'creamy', 1000, 70000), ('Susu Kurma Almond',      'creamy', 500, 35000), ('Susu Kurma Almond',      'creamy', 250, 18000),
    ('Naga Pisang Susu',       'creamy', 1000, 70000), ('Naga Pisang Susu',       'creamy', 500, 35000), ('Naga Pisang Susu',       'creamy', 250, 18000),
    ('Strawberry Pisang Susu', 'creamy', 1000, 70000), ('Strawberry Pisang Susu', 'creamy', 500, 35000), ('Strawberry Pisang Susu', 'creamy', 250, 18000),
    ('Strawberry Almond',      'creamy', 1000, 70000), ('Strawberry Almond',      'creamy', 500, 35000), ('Strawberry Almond',      'creamy', 250, 18000),
    ('Strawberry Alpukat Susu','creamy', 1000, 70000), ('Strawberry Alpukat Susu','creamy', 500, 35000), ('Strawberry Alpukat Susu','creamy', 250, 18000),
    ('Ubi Almond',             'creamy', 1000, 70000), ('Ubi Almond',             'creamy', 500, 35000), ('Ubi Almond',             'creamy', 250, 18000),
    -- RAMU: 1L 50rb, 500ml 25rb, 250ml 15rb, 200ml 10rb
    ('Kunyit Asem', 'ramu', 1000, 50000), ('Kunyit Asem', 'ramu', 500, 25000), ('Kunyit Asem', 'ramu', 250, 15000), ('Kunyit Asem', 'ramu', 200, 10000),
    ('Jahe Merah',  'ramu', 1000, 50000), ('Jahe Merah',  'ramu', 500, 25000), ('Jahe Merah',  'ramu', 250, 15000), ('Jahe Merah',  'ramu', 200, 10000);

  -- produk baru + pastikan produk menu aktif
  for r in select distinct name, category from menu_baru loop
    select id into v_product_id from public.products where name = r.name;
    if not found then
      insert into public.products (name, category) values (r.name, r.category);
    else
      update public.products set is_active = true, category = r.category where id = v_product_id;
    end if;
  end loop;

  -- upsert varian: ukuran baru ditambah, harga lama diperbarui
  insert into public.product_variants (product_id, size_ml, price)
  select p.id, m.size_ml, m.price
    from menu_baru m
    join public.products p on p.name = m.name
  on conflict (product_id, size_ml) do update set price = excluded.price;

  -- baris stok jadi 0 untuk varian baru
  insert into public.finished_stock (variant_id, qty)
  select pv.id, 0
    from public.product_variants pv
   where not exists (select 1 from public.finished_stock fs where fs.variant_id = pv.id);

  -- tidak ada di menu baru: nonaktifkan (riwayat penjualan tetap utuh)
  update public.products set is_active = false where name in ('Weight Loss', 'BerUbi Ubi');
end;
$$;
