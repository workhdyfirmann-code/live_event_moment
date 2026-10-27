-- Upgrade an existing installation to the production default: pending moderation.
drop policy if exists "guests can submit media" on public.media_uploads;
drop policy if exists "guests submit pending media" on public.media_uploads;
create policy "guests can submit media" on public.media_uploads
  for insert
  with check (file_size <= 26214400 and moderation_status = 'pending');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'media_uploads'
  ) then
    alter publication supabase_realtime add table public.media_uploads;
  end if;
end $$;
