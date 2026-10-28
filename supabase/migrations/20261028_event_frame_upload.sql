-- Private guest media stays in event-media; event frame artwork is public branding.
insert into storage.buckets (id, name, public)
values ('event-frames', 'event-frames', true)
on conflict (id) do update set public = true;

drop policy if exists "public can read event frames" on storage.objects;
create policy "public can read event frames"
on storage.objects for select to anon, authenticated
using (bucket_id = 'event-frames');

drop policy if exists "admins upload event frames" on storage.objects;
create policy "admins upload event frames"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-frames'
  and storage.extension(name) in ('png', 'jpg', 'jpeg', 'webp')
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin', 'super_admin'))
);

drop policy if exists "admins update event frames" on storage.objects;
create policy "admins update event frames"
on storage.objects for update to authenticated
using (bucket_id = 'event-frames' and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin', 'super_admin')))
with check (bucket_id = 'event-frames' and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin', 'super_admin')));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end $$;
