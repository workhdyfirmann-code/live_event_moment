-- Fix the anonymous upload policy for the private event-media bucket.
-- The event UUID must be read from storage.objects.name, not events.name.
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', false)
on conflict (id) do update set public = false;

drop policy if exists "guests can upload event media" on storage.objects;

create policy "guests can upload event media"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'event-media'
  and storage.extension(objects.name) in ('jpg', 'jpeg', 'png', 'webp', 'mp4')
  and split_part(objects.name, '/', 1) = 'events'
  and exists (
    select 1
    from public.events e
    where e.id::text = split_part(objects.name, '/', 2)
      and e.is_active = true
  )
);
