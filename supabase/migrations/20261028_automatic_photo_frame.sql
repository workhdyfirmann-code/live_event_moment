-- Persist original/framed output and the exact template version used per upload.
alter table public.media_uploads add column if not exists original_storage_path text;
alter table public.media_uploads add column if not exists framed_storage_path text;
alter table public.media_uploads add column if not exists frame_template_path text;
alter table public.media_uploads add column if not exists frame_template_version integer;
alter table public.media_uploads add column if not exists processing_status text not null default 'completed';
alter table public.media_uploads add column if not exists processing_error text;
alter table public.media_uploads add column if not exists processed_at timestamptz;
alter table public.media_uploads drop constraint if exists media_uploads_processing_status_check;
alter table public.media_uploads add constraint media_uploads_processing_status_check check (processing_status in ('pending','processing','completed','failed'));

create index if not exists media_processing_idx on public.media_uploads(event_id, processing_status, created_at desc);

-- Realtime sends framed metadata updates to the live display.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'media_uploads') then
    alter publication supabase_realtime add table public.media_uploads;
  end if;
end $$;
