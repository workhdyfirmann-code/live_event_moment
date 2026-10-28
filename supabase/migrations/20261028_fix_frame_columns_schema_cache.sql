-- Add framed-upload metadata to an existing media_uploads table.
-- Safe to run multiple times in Supabase SQL Editor.
alter table public.media_uploads add column if not exists original_storage_path text;
alter table public.media_uploads add column if not exists framed_storage_path text;
alter table public.media_uploads add column if not exists frame_template_path text;
alter table public.media_uploads add column if not exists frame_template_version integer;
alter table public.media_uploads add column if not exists processing_status text not null default 'completed';
alter table public.media_uploads add column if not exists processing_error text;
alter table public.media_uploads add column if not exists processed_at timestamptz;

alter table public.media_uploads drop constraint if exists media_uploads_processing_status_check;
alter table public.media_uploads add constraint media_uploads_processing_status_check
  check (processing_status in ('pending', 'processing', 'completed', 'failed'));

notify pgrst, 'reload schema';
