-- Enable direct-to-live publishing for the guest upload flow.
-- Run this in Supabase SQL Editor after the existing schema migrations.
grant insert on table public.media_uploads to anon, authenticated;

drop policy if exists "guests submit pending media" on public.media_uploads;
drop policy if exists "guests can submit media" on public.media_uploads;
drop policy if exists "guests submit approved media" on public.media_uploads;

create policy "guests submit approved media"
on public.media_uploads
for insert
to anon, authenticated
with check (
  moderation_status = 'approved'
  and file_size > 0
  and file_size <= 26214400
  and approved_at is not null
  and exists (
    select 1
    from public.events as e
    where e.id = media_uploads.event_id
      and e.is_active = true
  )
);
