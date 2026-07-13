-- Foto produk (thumbnail di grid Jual).
-- Bucket publik-baca (foto produk tidak sensitif); tulis hanya untuk user login.
-- products.image_path menyimpan path relatif bucket (bukan URL penuh) supaya
-- portabel antar project (produksi/test).

alter table public.products add column if not exists image_path text;

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "public read product photos"
  on storage.objects for select
  using (bucket_id = 'product-photos');

create policy "authenticated insert product photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos');

create policy "authenticated update product photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-photos')
  with check (bucket_id = 'product-photos');

create policy "authenticated delete product photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos');
