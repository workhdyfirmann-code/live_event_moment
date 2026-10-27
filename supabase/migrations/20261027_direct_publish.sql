-- Jalankan jika project Supabase sudah memakai schema lama.
drop policy if exists "guests can submit media" on public.media_uploads;
create policy "guests can submit media" on public.media_uploads
  for insert
  with check (file_size <= 26214400 and moderation_status = 'Approved');
