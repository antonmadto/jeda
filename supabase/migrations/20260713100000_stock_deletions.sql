-- Hapus/koreksi data stok (perbaikan kesalahan input).
-- Semua atomik, tercatat di stock_movements, SECURITY INVOKER (RLS berlaku).

-- Batalkan batch produksi: kembalikan stok bahan & stok jadi ke keadaan sebelum batch.
-- Membalik pergerakan asli (bukan menghitung ulang dari resep), jadi kebal walau
-- resep sudah berubah sejak batch dicatat.
create or replace function public.undo_production(p_batch_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.production_batches where id = p_batch_id) then
    raise exception 'Batch tidak ditemukan';
  end if;

  -- kembalikan stok jadi (kurangi qty yang tadinya ditambah produksi)
  update public.finished_stock fs
     set qty = fs.qty - agg.d
    from (
      select variant_id, sum(qty_delta) as d
        from public.stock_movements
       where ref_id = p_batch_id and variant_id is not null
       group by variant_id
    ) agg
   where fs.variant_id = agg.variant_id;

  -- kembalikan stok bahan (tambah lagi qty yang tadinya dikurangi produksi)
  update public.ingredients i
     set stock_qty = i.stock_qty - agg.d
    from (
      select ingredient_id, sum(qty_delta) as d
        from public.stock_movements
       where ref_id = p_batch_id and ingredient_id is not null
       group by ingredient_id
    ) agg
   where i.id = agg.ingredient_id;

  -- jejak pembalikan (negasi movement asli). INSERT..SELECT tidak melihat baris
  -- yang di-insert-nya sendiri, jadi hanya movement asli yang dibalik.
  insert into public.stock_movements (kind, ref_id, variant_id, ingredient_id, qty_delta)
  select 'production', p_batch_id, variant_id, ingredient_id, -qty_delta
    from public.stock_movements
   where ref_id = p_batch_id;

  delete from public.production_batches where id = p_batch_id; -- production_items ikut lewat cascade
end;
$$;

-- Hapus bahan yang salah ditambah. Hanya boleh bila belum dipakai di resep mana pun.
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
  if exists (select 1 from public.recipes where ingredient_id = p_ingredient_id) then
    raise exception 'Bahan masih dipakai di resep. Hapus dari resep dulu.';
  end if;
  -- bahan tanpa resep hanya mungkin punya movement jenis adjustment
  delete from public.stock_movements where ingredient_id = p_ingredient_id;
  delete from public.ingredients where id = p_ingredient_id;
end;
$$;

-- Koreksi jumlah stok jadi ke nilai baru (kind 'adjustment').
create or replace function public.adjust_finished_stock(p_variant_id uuid, p_new_qty int)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old int;
begin
  select qty into v_old from public.finished_stock where variant_id = p_variant_id for update;
  if not found then
    insert into public.finished_stock (variant_id, qty) values (p_variant_id, 0);
    v_old := 0;
  end if;
  if p_new_qty = v_old then
    return;
  end if;
  update public.finished_stock set qty = p_new_qty where variant_id = p_variant_id;
  insert into public.stock_movements (kind, variant_id, qty_delta)
    values ('adjustment', p_variant_id, p_new_qty - v_old);
end;
$$;

revoke all on function public.undo_production(uuid) from public, anon;
revoke all on function public.delete_ingredient(uuid) from public, anon;
revoke all on function public.adjust_finished_stock(uuid, int) from public, anon;
grant execute on function public.undo_production(uuid) to authenticated;
grant execute on function public.delete_ingredient(uuid) to authenticated;
grant execute on function public.adjust_finished_stock(uuid, int) to authenticated;
