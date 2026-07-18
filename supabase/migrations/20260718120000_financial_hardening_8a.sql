-- Fase 8a. Pengerasan Data Keuangan.
-- Semua perubahan ADITIF: tidak mengubah/menghapus kolom atau signature fungsi
-- yang dipakai versi app yang sedang terpasang. App lama tetap jalan.
--   - belanja bahan tercatat dengan harga historis (ingredient_purchases)
--   - cost_per_unit di-update rata-rata bergerak saat belanja
--   - belanja otomatis jadi expenses (tertaut, tidak dobel catat)
--   - HPP per botol dibekukan di sale_items.hpp_at_sale saat transaksi
--   - aset/modal usaha (assets)
-- SECURITY INVOKER di semua fungsi: RLS tetap berlaku, hanya user login.

-- tabel baru: belanja bahan --------------------------------------------------

create table public.ingredient_purchases (
  id uuid primary key default gen_random_uuid(),
  -- restrict: belanja adalah catatan keuangan; bahan dengan riwayat belanja
  -- tidak boleh dihapus diam-diam (delete_ingredient akan gagal bila ada belanja).
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  purchased_at date not null,
  qty int not null check (qty > 0), -- satuan terkecil (gram/ml/pcs)
  total_cost int not null check (total_cost >= 0), -- integer rupiah, total nota
  note text,
  created_at timestamptz not null default now()
);

create index ingredient_purchases_ingredient_id_idx on public.ingredient_purchases (ingredient_id);
create index ingredient_purchases_purchased_at_idx on public.ingredient_purchases (purchased_at);

-- tabel baru: aset / modal usaha ---------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  purchased_at date not null,
  cost int not null check (cost >= 0), -- integer rupiah
  useful_life_months int check (useful_life_months > 0), -- null = tanpa depresiasi (8b)
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- perluasan constraint yang ada (aditif: hanya menambah nilai yang sah) --------

-- stock_movements.kind ditambah 'purchase'
alter table public.stock_movements drop constraint if exists stock_movements_kind_check;
alter table public.stock_movements add constraint stock_movements_kind_check
  check (kind in ('production', 'sale', 'adjustment', 'spoilage', 'giveaway', 'purchase'));

-- expenses.category ditambah 'sewa','gaji','promosi'
alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in ('bahan', 'kemasan', 'listrik', 'bensin', 'galon', 'es', 'lainnya', 'sewa', 'gaji', 'promosi'));

-- expenses tertaut belanja: satu belanja = satu pengeluaran (tidak dobel catat).
-- on delete cascade: undo_purchase menghapus belanja, expense tertaut ikut hilang.
alter table public.expenses
  add column if not exists purchase_id uuid unique references public.ingredient_purchases (id) on delete cascade;

-- HPP per botol dibekukan saat transaksi. null bila varian tak punya resep.
alter table public.sale_items
  add column if not exists hpp_at_sale int;

-- RLS untuk tabel baru: hanya authenticated (gaya sama dengan skema awal) -------

do $$
declare
  t text;
begin
  foreach t in array array['ingredient_purchases', 'assets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "authenticated select %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format(
      'create policy "authenticated insert %1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format(
      'create policy "authenticated update %1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format(
      'create policy "authenticated delete %1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end;
$$;

-- RPC record_purchase --------------------------------------------------------
-- Atomik: catat belanja, tambah stok bahan, update cost_per_unit (rata-rata
-- bergerak), catat stock_movements kind 'purchase', dan insert expenses tertaut.
create or replace function public.record_purchase(
  p_ingredient_id uuid,
  p_qty int,
  p_total_cost int,
  p_purchased_at date,
  p_expense_category text,
  p_note text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_stock int;
  v_old_cost numeric;
  v_name text;
  v_new_cost numeric;
  v_purchase_id uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Kuantitas belanja harus lebih dari 0';
  end if;
  if p_total_cost is null or p_total_cost < 0 then
    raise exception 'Total belanja tidak boleh negatif';
  end if;
  -- belanja bahan hanya boleh jadi pengeluaran kategori bahan atau kemasan
  if p_expense_category not in ('bahan', 'kemasan') then
    raise exception 'Kategori pengeluaran belanja harus bahan atau kemasan, bukan %', p_expense_category;
  end if;

  select stock_qty, cost_per_unit, name
    into v_old_stock, v_old_cost, v_name
    from public.ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Bahan tidak ditemukan';
  end if;

  -- rata-rata bergerak: (stok_lama*biaya_lama + total_cost) / (stok_lama + qty).
  -- Kalau stok lama <= 0, biaya lama tidak bermakna: pakai total_cost/qty.
  if v_old_stock > 0 then
    v_new_cost := (v_old_stock * v_old_cost + p_total_cost) / (v_old_stock + p_qty);
  else
    v_new_cost := p_total_cost::numeric / p_qty;
  end if;

  insert into public.ingredient_purchases (ingredient_id, purchased_at, qty, total_cost, note)
    values (p_ingredient_id, p_purchased_at, p_qty, p_total_cost, p_note)
    returning id into v_purchase_id;

  update public.ingredients
     set stock_qty = stock_qty + p_qty,
         cost_per_unit = v_new_cost
   where id = p_ingredient_id;

  insert into public.stock_movements (kind, ref_id, ingredient_id, qty_delta)
    values ('purchase', v_purchase_id, p_ingredient_id, p_qty);

  -- pengeluaran tertaut: tidak perlu input dobel di Rekap
  insert into public.expenses (spent_at, category, amount, note, purchase_id)
    values (
      p_purchased_at,
      p_expense_category,
      p_total_cost,
      'Belanja ' || v_name || coalesce(' — ' || nullif(p_note, ''), ''),
      v_purchase_id
    );

  return jsonb_build_object(
    'purchase_id', v_purchase_id,
    'stock_qty', v_old_stock + p_qty,
    'cost_per_unit', v_new_cost
  );
end;
$$;

-- RPC undo_purchase ----------------------------------------------------------
-- Hanya untuk belanja yang dicatat di hari yang sama (WIB), mirip undo_sale.
-- Membalik penambahan stok (movement pembalikan kind 'purchase' qty negatif) dan
-- menghapus baris belanja; expenses tertaut ikut terhapus lewat cascade.
-- CATATAN: cost_per_unit SENGAJA DIBIARKAN. Rata-rata bergerak tidak bisa
-- dibalik tepat tanpa menyimpan biaya lama, dan biaya terkini tetap perkiraan
-- terbaik. Koreksi biaya dilakukan lewat belanja berikutnya.
create or replace function public.undo_purchase(p_purchase_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_created_at timestamptz;
  v_ingredient_id uuid;
  v_qty int;
begin
  select created_at, ingredient_id, qty
    into v_created_at, v_ingredient_id, v_qty
    from public.ingredient_purchases where id = p_purchase_id;
  if not found then
    raise exception 'Belanja tidak ditemukan';
  end if;
  if (v_created_at at time zone 'Asia/Jakarta')::date <> (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Belanja hanya bisa dibatalkan di hari yang sama';
  end if;

  update public.ingredients
     set stock_qty = stock_qty - v_qty
   where id = v_ingredient_id;

  insert into public.stock_movements (kind, ref_id, ingredient_id, qty_delta)
    values ('purchase', p_purchase_id, v_ingredient_id, -v_qty); -- pembalikan

  delete from public.ingredient_purchases where id = p_purchase_id; -- expense tertaut ikut cascade
end;
$$;

-- record_sale: bekukan hpp_at_sale per botol (signature tidak berubah) ---------
-- Definisi terbaru berbasis 20260711130000_sale_functions.sql (satu-satunya
-- definisi sebelum ini) + penambahan hpp_at_sale. hpp_at_sale = jumlah per baris
-- resep round(qty * cost_per_unit) untuk 1 botol; null bila varian tak punya resep.
create or replace function public.record_sale(
  p_channel text,
  p_payment text,
  p_status text,
  p_customer_id uuid,
  p_promo_applied text,
  p_subtotal int,
  p_discount int,
  p_total int,
  p_items jsonb,
  p_replace_sale_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_item record;
  v_new_qty int;
  v_warnings jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Transaksi tidak boleh kosong';
  end if;

  if p_replace_sale_id is not null then
    perform public.undo_sale(p_replace_sale_id);
  end if;

  insert into public.sales (channel, payment, status, customer_id, promo_applied, subtotal, discount, total)
    values (p_channel, p_payment, p_status, p_customer_id, p_promo_applied, p_subtotal, p_discount, p_total)
    returning id into v_sale_id;

  for v_item in
    select (e ->> 'variant_id')::uuid as variant_id,
           (e ->> 'qty')::int as qty,
           (e ->> 'unit_price')::int as unit_price,
           (e ->> 'line_total')::int as line_total
      from jsonb_array_elements(p_items) e
  loop
    insert into public.sale_items (sale_id, variant_id, qty, unit_price, line_total, hpp_at_sale)
      values (
        v_sale_id, v_item.variant_id, v_item.qty, v_item.unit_price, v_item.line_total,
        (select sum(round(r.qty * ing.cost_per_unit))::int
           from public.recipes r
           join public.ingredients ing on ing.id = r.ingredient_id
          where r.variant_id = v_item.variant_id) -- null bila tak ada resep
      );

    insert into public.stock_movements (kind, ref_id, variant_id, qty_delta)
      values ('sale', v_sale_id, v_item.variant_id, -v_item.qty);

    insert into public.finished_stock (variant_id, qty)
      values (v_item.variant_id, -v_item.qty)
      on conflict (variant_id) do update set qty = public.finished_stock.qty + excluded.qty;

    select fs.qty into v_new_qty from public.finished_stock fs where fs.variant_id = v_item.variant_id;
    if v_new_qty < 0 then
      v_warnings := v_warnings || (
        select jsonb_build_object('name', p.name, 'size_ml', pv.size_ml, 'qty_after', v_new_qty)
          from public.product_variants pv
          join public.products p on p.id = pv.product_id
         where pv.id = v_item.variant_id
      );
    end if;
  end loop;

  return jsonb_build_object('sale_id', v_sale_id, 'stock_warnings', v_warnings);
end;
$$;

-- Backfill hpp_at_sale untuk penjualan lama, pakai biaya resep terkini
-- (pendekatan terbaik yang ada). Hanya baris yang variannya punya resep.
update public.sale_items si
   set hpp_at_sale = sub.hpp
  from (
    select r.variant_id, sum(round(r.qty * ing.cost_per_unit))::int as hpp
      from public.recipes r
      join public.ingredients ing on ing.id = r.ingredient_id
     group by r.variant_id
  ) sub
 where si.variant_id = sub.variant_id
   and si.hpp_at_sale is null;

-- Hak akses: hanya user login yang boleh memanggil fungsi baru -----------------
revoke all on function public.record_purchase(uuid, int, int, date, text, text) from public, anon;
revoke all on function public.undo_purchase(uuid) from public, anon;
grant execute on function public.record_purchase(uuid, int, int, date, text, text) to authenticated;
grant execute on function public.undo_purchase(uuid) to authenticated;
