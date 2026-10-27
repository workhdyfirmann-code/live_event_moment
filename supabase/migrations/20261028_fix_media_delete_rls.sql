-- Allow an authenticated admin to delete the media row after Storage cleanup.
grant select, delete on table public.media_uploads to authenticated;

drop policy if exists "admins manage media" on public.media_uploads;
create policy "admins manage media"
on public.media_uploads
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin', 'super_admin')
  )
);
