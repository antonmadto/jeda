-- Seed katalog nyata dari kuesioner Aiman (docs/analisis-kuesioner.md).
-- Fresh: harga 500 ml / 250 ml. Creamy & ramu: harga yang diketahui untuk 250 ml.
-- Varian ukuran lain (100 ml, 1 liter) ditambah pemilik lewat UI.

do $$
declare
  pid uuid;
  vid uuid;
  ing_susu uuid;
  ing_kurma uuid;
  ing_air uuid;
  ing_botol uuid;
begin
  -- fresh juice: 2 ukuran
  insert into public.products (name, category) values ('Immune', 'fresh') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 500, 38000), (pid, 250, 18000);

  insert into public.products (name, category) values ('Anti Virus', 'fresh') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 500, 38000), (pid, 250, 18000);

  insert into public.products (name, category) values ('Retinol', 'fresh') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 500, 40000), (pid, 250, 20000);

  insert into public.products (name, category) values ('Hydrate', 'fresh') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 500, 38000), (pid, 250, 18000);

  insert into public.products (name, category) values ('Power', 'fresh') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 500, 38000), (pid, 250, 18000);

  insert into public.products (name, category) values ('Weight Loss', 'fresh') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 500, 38000), (pid, 250, 18000);

  insert into public.products (name, category) values ('Pure', 'fresh') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 500, 30000), (pid, 250, 15000);

  -- creamy: harga diketahui untuk 250 ml
  insert into public.products (name, category) values ('Susu Kurma', 'creamy') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 250, 15000);

  insert into public.products (name, category) values ('Susu Kurma Almond', 'creamy') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 250, 18000);

  insert into public.products (name, category) values ('Strawberry Almond', 'creamy') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 250, 18000);

  insert into public.products (name, category) values ('Strawberry Pisang Susu', 'creamy') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 250, 18000);

  insert into public.products (name, category) values ('Naga Pisang Susu', 'creamy') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 250, 18000);

  insert into public.products (name, category) values ('BerUbi Ubi', 'creamy') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 250, 20000);

  -- ramu
  insert into public.products (name, category) values ('Kunyit Asem', 'ramu') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 250, 15000);

  insert into public.products (name, category) values ('Jahe Merah', 'ramu') returning id into pid;
  insert into public.product_variants (product_id, size_ml, price) values (pid, 250, 15000);

  -- bahan contoh untuk resep Susu Kurma 250 ml (validasi HPP 7.750 dari kuesioner):
  -- susu 167 ml = 3.000, kurma 42 g = 2.500, air galon 500 ml = 1.050, botol+stiker = 1.200
  insert into public.ingredients (name, unit, cost_per_unit)
    values ('Susu', 'ml', 17.9641) returning id into ing_susu;
  insert into public.ingredients (name, unit, cost_per_unit)
    values ('Kurma', 'gram', 59.5238) returning id into ing_kurma;
  insert into public.ingredients (name, unit, cost_per_unit)
    values ('Air galon', 'ml', 2.1) returning id into ing_air;
  insert into public.ingredients (name, unit, cost_per_unit)
    values ('Botol + stiker 250 ml', 'pcs', 1200) returning id into ing_botol;

  select pv.id into strict vid
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
   where p.name = 'Susu Kurma' and pv.size_ml = 250;

  insert into public.recipes (variant_id, ingredient_id, qty) values
    (vid, ing_susu, 167),
    (vid, ing_kurma, 42),
    (vid, ing_air, 500),
    (vid, ing_botol, 1);

  -- baris stok jadi 0 untuk semua varian
  insert into public.finished_stock (variant_id, qty)
    select id, 0 from public.product_variants;
end;
$$;
