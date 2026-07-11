-- Fungsi produksi dan penyesuaian stok (Fase 3).
-- Batch produksi: menambah stok jadi, mengurangi stok bahan sesuai resep,
-- semuanya atomik dan tercatat di stock_movements.
-- SECURITY INVOKER: RLS tetap berlaku.

-- Catat batch produksi. p_items: [{variant_id, qty}].
-- Stok bahan boleh minus (tidak memblokir), dikembalikan sebagai ingredient_warnings.
create or replace function public.record_production(
  p_batch_date date,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_item record;
  v_need record;
  v_new_qty int;
  v_warnings jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Batch produksi tidak boleh kosong';
  end if;

  insert into public.production_batches (batch_date, note)
    values (p_batch_date, p_note)
    returning id into v_batch_id;

  -- stok jadi bertambah per varian
  for v_item in
    select (e ->> 'variant_id')::uuid as variant_id, (e ->> 'qty')::int as qty
      from jsonb_array_elements(p_items) e
  loop
    insert into public.production_items (batch_id, variant_id, qty)
      values (v_batch_id, v_item.variant_id, v_item.qty);

    insert into public.stock_movements (kind, ref_id, variant_id, qty_delta)
      values ('production', v_batch_id, v_item.variant_id, v_item.qty);

    insert into public.finished_stock (variant_id, qty)
      values (v_item.variant_id, v_item.qty)
      on conflict (variant_id) do update set qty = public.finished_stock.qty + excluded.qty;
  end loop;

  -- stok bahan berkurang sesuai resep, diagregasi per bahan
  for v_need in
    select r.ingredient_id, sum(r.qty * i.qty)::int as needed
      from jsonb_to_recordset(p_items) as i(variant_id uuid, qty int)
      join public.recipes r on r.variant_id = i.variant_id
     group by r.ingredient_id
  loop
    update public.ingredients
       set stock_qty = stock_qty - v_need.needed
     where id = v_need.ingredient_id
     returning stock_qty into v_new_qty;

    insert into public.stock_movements (kind, ref_id, ingredient_id, qty_delta)
      values ('production', v_batch_id, v_need.ingredient_id, -v_need.needed);

    if v_new_qty < 0 then
      v_warnings := v_warnings || (
        select jsonb_build_object('name', ing.name, 'unit', ing.unit, 'qty_after', v_new_qty)
          from public.ingredients ing
         where ing.id = v_need.ingredient_id
      );
    end if;
  end loop;

  return jsonb_build_object('batch_id', v_batch_id, 'ingredient_warnings', v_warnings);
end;
$$;

-- Koreksi stok bahan ke nilai baru (kind 'adjustment').
create or replace function public.adjust_ingredient_stock(
  p_ingredient_id uuid,
  p_new_qty int
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old int;
begin
  select stock_qty into v_old from public.ingredients where id = p_ingredient_id for update;
  if not found then
    raise exception 'Bahan tidak ditemukan';
  end if;
  if p_new_qty = v_old then
    return;
  end if;

  update public.ingredients set stock_qty = p_new_qty where id = p_ingredient_id;

  insert into public.stock_movements (kind, ingredient_id, qty_delta)
    values ('adjustment', p_ingredient_id, p_new_qty - v_old);
end;
$$;

-- Tandai botol jadi rusak (spoilage) atau dibagikan (giveaway).
create or replace function public.write_off_finished(
  p_variant_id uuid,
  p_qty int,
  p_kind text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_kind not in ('spoilage', 'giveaway') then
    raise exception 'Jenis pencatatan sisa tidak dikenal: %', p_kind;
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah harus lebih dari 0';
  end if;

  insert into public.finished_stock (variant_id, qty)
    values (p_variant_id, -p_qty)
    on conflict (variant_id) do update set qty = public.finished_stock.qty + excluded.qty;

  insert into public.stock_movements (kind, variant_id, qty_delta)
    values (p_kind, p_variant_id, -p_qty);
end;
$$;

-- Hanya user login yang boleh memanggil.
revoke all on function public.record_production(date, text, jsonb) from public, anon;
revoke all on function public.adjust_ingredient_stock(uuid, int) from public, anon;
revoke all on function public.write_off_finished(uuid, int, text) from public, anon;
grant execute on function public.record_production(date, text, jsonb) to authenticated;
grant execute on function public.adjust_ingredient_stock(uuid, int) to authenticated;
grant execute on function public.write_off_finished(uuid, int, text) to authenticated;
