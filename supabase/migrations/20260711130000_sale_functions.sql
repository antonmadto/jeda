-- Fungsi transaksi penjualan.
-- Semua perubahan stok jadi lewat fungsi ini (dipanggil dari src/lib/stock.ts),
-- atomik dalam satu transaksi DB, tercatat di stock_movements.
-- SECURITY INVOKER: RLS tetap berlaku, hanya user login yang bisa memakai.

-- Membatalkan penjualan: kembalikan stok jadi (movement pembalikan), hapus transaksi.
-- Hanya boleh untuk transaksi hari yang sama (WIB).
create or replace function public.undo_sale(p_sale_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sold_at timestamptz;
  r record;
begin
  select sold_at into v_sold_at from public.sales where id = p_sale_id;
  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;
  if (v_sold_at at time zone 'Asia/Jakarta')::date <> (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Transaksi hanya bisa dikoreksi atau dihapus di hari yang sama';
  end if;

  for r in select variant_id, qty from public.sale_items where sale_id = p_sale_id loop
    insert into public.stock_movements (kind, ref_id, variant_id, qty_delta)
      values ('sale', p_sale_id, r.variant_id, r.qty); -- pembalikan
    insert into public.finished_stock (variant_id, qty)
      values (r.variant_id, r.qty)
      on conflict (variant_id) do update set qty = public.finished_stock.qty + excluded.qty;
  end loop;

  delete from public.sales where id = p_sale_id; -- sale_items ikut lewat cascade
end;
$$;

-- Menyimpan penjualan. p_items: [{variant_id, qty, unit_price, line_total}].
-- p_replace_sale_id terisi = koreksi: transaksi lama dibatalkan dulu dalam transaksi yang sama.
-- Stok boleh minus (tidak memblokir), tapi dikembalikan sebagai stock_warnings.
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
    insert into public.sale_items (sale_id, variant_id, qty, unit_price, line_total)
      values (v_sale_id, v_item.variant_id, v_item.qty, v_item.unit_price, v_item.line_total);

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

-- Hanya user login yang boleh memanggil.
revoke all on function public.undo_sale(uuid) from public, anon;
revoke all on function public.record_sale(text, text, text, uuid, text, int, int, int, jsonb, uuid) from public, anon;
grant execute on function public.undo_sale(uuid) to authenticated;
grant execute on function public.record_sale(text, text, text, uuid, text, int, int, int, jsonb, uuid) to authenticated;
