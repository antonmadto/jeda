-- Skema awal aplikasi JE&DA.
-- Workspace bersama 2 akun: semua data milik usaha, bukan per user,
-- jadi policy cukup membedakan authenticated vs anon.

-- katalog -------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('fresh', 'creamy', 'ramu')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size_ml int not null check (size_ml > 0),
  price int not null check (price >= 0), -- integer rupiah
  created_at timestamptz not null default now(),
  unique (product_id, size_ml)
);

-- bahan & resep --------------------------------------------------------------

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null check (unit in ('gram', 'ml', 'pcs')),
  cost_per_unit numeric not null default 0 check (cost_per_unit >= 0),
  stock_qty int not null default 0,
  reorder_point int not null default 0,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  qty int not null check (qty > 0), -- kebutuhan per 1 botol, satuan terkecil
  created_at timestamptz not null default now(),
  unique (variant_id, ingredient_id)
);

-- produksi & stok -------------------------------------------------------------

create table public.production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.production_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.production_batches (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id),
  qty int not null check (qty > 0),
  created_at timestamptz not null default now()
);

create table public.finished_stock (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  qty int not null default 0
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('production', 'sale', 'adjustment', 'spoilage', 'giveaway')),
  ref_id uuid,
  variant_id uuid references public.product_variants (id),
  ingredient_id uuid references public.ingredients (id),
  qty_delta int not null,
  created_at timestamptz not null default now(),
  -- satu baris pergerakan menunjuk tepat satu target: stok jadi atau stok bahan
  check (num_nonnulls(variant_id, ingredient_id) = 1)
);

-- penjualan -------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  note text,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sold_at timestamptz not null default now(),
  channel text not null check (channel in ('lapak', 'cfd', 'online', 'bulk')),
  payment text not null check (payment in ('cash', 'qris')),
  status text not null default 'lunas' check (status in ('lunas', 'belum_lunas')),
  customer_id uuid references public.customers (id),
  promo_applied text,
  subtotal int not null check (subtotal >= 0),
  discount int not null default 0 check (discount >= 0),
  total int not null check (total >= 0),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id),
  qty int not null check (qty > 0),
  unit_price int not null check (unit_price >= 0),
  line_total int not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

-- pengeluaran -----------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_at date not null,
  category text not null check (category in ('bahan', 'kemasan', 'listrik', 'bensin', 'galon', 'es', 'lainnya')),
  amount int not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

-- index kolom foreign key & kolom filter laporan -------------------------------

create index product_variants_product_id_idx on public.product_variants (product_id);
create index recipes_variant_id_idx on public.recipes (variant_id);
create index recipes_ingredient_id_idx on public.recipes (ingredient_id);
create index production_items_batch_id_idx on public.production_items (batch_id);
create index production_items_variant_id_idx on public.production_items (variant_id);
create index stock_movements_variant_id_idx on public.stock_movements (variant_id);
create index stock_movements_ingredient_id_idx on public.stock_movements (ingredient_id);
create index stock_movements_created_at_idx on public.stock_movements (created_at);
create index sales_sold_at_idx on public.sales (sold_at);
create index sales_customer_id_idx on public.sales (customer_id);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_variant_id_idx on public.sale_items (variant_id);
create index expenses_spent_at_idx on public.expenses (spent_at);

-- RLS: aktif di semua tabel, akses penuh hanya untuk user login ----------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'products', 'product_variants', 'ingredients', 'recipes',
    'production_batches', 'production_items', 'finished_stock', 'stock_movements',
    'customers', 'sales', 'sale_items', 'expenses'
  ] loop
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
