-- Piutang (Fase 5): catat tanggal bayar saat penjualan belum_lunas dilunasi.

alter table public.sales add column if not exists paid_at timestamptz;

-- Tandai penjualan lunas dengan tanggal bayar (waktu server, WIB-akurat).
create or replace function public.mark_sale_paid(p_sale_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.sales
     set status = 'lunas', paid_at = now()
   where id = p_sale_id and status = 'belum_lunas';
  if not found then
    raise exception 'Transaksi tidak ditemukan atau sudah lunas';
  end if;
end;
$$;

revoke all on function public.mark_sale_paid(uuid) from public, anon;
grant execute on function public.mark_sale_paid(uuid) to authenticated;
