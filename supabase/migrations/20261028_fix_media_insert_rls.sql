-- Fix anonymous metadata inserts after a successful Storage upload.
-- This policy intentionally permits only pending uploads for active events.
alter table public.media_uploads enable row level security;

grant insert on table public.media_uploads to anon, authenticated;

drop policy if exists "guests submit pending media" on public.media_uploads;
drop policy if exists "guests can submit media" on public.media_uploads;

create policy "guests submit pending media"
on public.media_uploads
for insert
to anon, authenticated
with check (
  moderation_status = 'pending'
  and file_size > 0
  and file_size <= 26214400
  and exists (
    select 1
    from public.events as e
    where e.id = media_uploads.event_id
      and e.is_active = true
  )
);
