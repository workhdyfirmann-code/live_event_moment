-- Allow an authenticated admin to list/delete objects in the private media bucket.
grant select, delete on table storage.objects to authenticated;

drop policy if exists "admins can read event media" on storage.objects;
create policy "admins can read event media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'event-media'
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin', 'super_admin')
  )
);

drop policy if exists "admins can delete event media" on storage.objects;
create policy "admins can delete event media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-media'
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin', 'super_admin')
  )
);
