-- Hapus bahan tanpa harus menghapus resep dulu (permintaan pemilik).
-- Baris resep yang memakai bahan itu ikut terhapus dalam transaksi yang sama;
-- HPP varian terdampak otomatis berubah. UI menampilkan jumlah resep terdampak
-- sebelum konfirmasi.

create or replace function public.delete_ingredient(p_ingredient_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.ingredients where id = p_ingredient_id) then
    raise exception 'Bahan tidak ditemukan';
  end if;
  -- cabut dari semua resep yang memakainya
  delete from public.recipes where ingredient_id = p_ingredient_id;
  -- jejak stok bahan ini ikut dihapus
  delete from public.stock_movements where ingredient_id = p_ingredient_id;
  delete from public.ingredients where id = p_ingredient_id;
end;
$$;

revoke all on function public.delete_ingredient(uuid) from public, anon;
grant execute on function public.delete_ingredient(uuid) to authenticated;
