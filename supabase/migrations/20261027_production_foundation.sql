-- Upgrade an existing installation created with the original schema.
-- Run this after the base schema in Supabase SQL Editor.
alter table public.events add column if not exists slug text;
alter table public.events add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.events add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.events add column if not exists updated_at timestamptz not null default now();
update public.events set slug = coalesce(nullif(slug, ''), lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(id::text, 8)) where slug is null or slug = '';
create unique index if not exists events_slug_unique_idx on public.events(slug);

alter table public.media_uploads add column if not exists thumbnail_path text;
alter table public.media_uploads add column if not exists is_hidden boolean not null default false;
alter table public.media_uploads add column if not exists display_order integer;
alter table public.media_uploads add column if not exists uploaded_at timestamptz;
alter table public.media_uploads add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.media_uploads add column if not exists rejected_at timestamptz;
alter table public.media_uploads add column if not exists rejected_by uuid references auth.users(id) on delete set null;
alter table public.media_uploads add column if not exists updated_at timestamptz not null default now();
update public.media_uploads set moderation_status = lower(moderation_status), uploaded_at = coalesce(uploaded_at, created_at);
alter table public.media_uploads drop constraint if exists media_uploads_moderation_status_check;
alter table public.media_uploads add constraint media_uploads_moderation_status_check check (moderation_status in ('pending','approved','rejected'));
alter table public.media_uploads drop constraint if exists media_uploads_media_type_check;
update public.media_uploads set media_type = case when media_type = 'photo' then 'image' else media_type end;
alter table public.media_uploads add constraint media_uploads_media_type_check check (media_type in ('image','video'));

create table if not exists public.media_audit_logs (
  id uuid primary key default uuid_generate_v4(), event_id uuid not null references public.events(id) on delete cascade,
  media_id uuid references public.media_uploads(id) on delete set null, actor_id uuid references auth.users(id) on delete set null,
  action text not null, changes jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.event_display_state (
  event_id uuid primary key references public.events(id) on delete cascade, is_active boolean not null default false,
  active_media_id uuid references public.media_uploads(id) on delete set null, slideshow_duration integer not null default 7 check (slideshow_duration between 2 and 120), transition text not null default 'fade', updated_at timestamptz not null default now()
);
alter table public.media_audit_logs enable row level security;
alter table public.event_display_state enable row level security;

drop policy if exists "approved media is public" on public.media_uploads;
drop policy if exists "guests can submit media" on public.media_uploads;
drop policy if exists "guests submit pending media" on public.media_uploads;
create policy "approved media is public" on public.media_uploads for select using (moderation_status = 'approved' and is_hidden = false and exists (select 1 from public.events e where e.id = event_id and e.is_active = true and coalesce((e.settings->>'public_gallery')::boolean, true)));
create policy "guests submit pending media" on public.media_uploads for insert with check (moderation_status = 'pending' and file_size <= 26214400 and exists (select 1 from public.events e where e.id = event_id and e.is_active = true));

insert into storage.buckets (id, name, public) values ('event-media', 'event-media', false) on conflict (id) do update set public = false;
drop policy if exists "public can read event media" on storage.objects;
drop policy if exists "guests can upload event media" on storage.objects;
drop policy if exists "guests can upload event media" on storage.objects;
create policy "guests can upload event media" on storage.objects for insert with check (bucket_id = 'event-media' and storage.extension(name) in ('jpg','jpeg','png','webp','mp4') and split_part(name, '/', 1) = 'events' and exists (select 1 from public.events e where e.id::text = split_part(name, '/', 2) and e.is_active = true));
drop policy if exists "approved media can be read" on storage.objects;
create policy "approved media can be read" on storage.objects for select using (bucket_id = 'event-media' and exists (select 1 from public.media_uploads m where m.storage_path = name and m.moderation_status = 'approved' and m.is_hidden = false));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'media_uploads') then alter publication supabase_realtime add table public.media_uploads; end if;
end $$;
