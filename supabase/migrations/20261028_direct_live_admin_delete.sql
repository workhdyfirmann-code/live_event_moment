-- Production policy: guests publish directly, admins can remove media.
alter table public.media_uploads enable row level security;

grant insert on public.media_uploads to anon, authenticated;
grant select, update, delete on public.media_uploads to authenticated;

drop policy if exists "guests submit pending media" on public.media_uploads;
drop policy if exists "guests submit approved media" on public.media_uploads;
drop policy if exists "guests can submit media" on public.media_uploads;
create policy "guests submit approved media"
on public.media_uploads
for insert
to anon, authenticated
with check (
  moderation_status = 'approved'
  and approved_at is not null
  and file_size > 0
  and file_size <= 26214400
  and exists (
    select 1 from public.events e
    where e.id = media_uploads.event_id
      and e.is_active = true
  )
);

drop policy if exists "admins manage media" on public.media_uploads;
drop policy if exists "admins select media" on public.media_uploads;
drop policy if exists "admins update media" on public.media_uploads;
drop policy if exists "admins delete media" on public.media_uploads;

create policy "admins select media"
on public.media_uploads for select to authenticated
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin', 'super_admin')));

create policy "admins update media"
on public.media_uploads for update to authenticated
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin', 'super_admin')))
with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin', 'super_admin')));

create policy "admins delete media"
on public.media_uploads for delete to authenticated
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin', 'super_admin')));

grant select, delete on storage.objects to authenticated;
drop policy if exists "admins can delete event media" on storage.objects;
create policy "admins can delete event media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'event-media'
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin', 'super_admin'))
);
