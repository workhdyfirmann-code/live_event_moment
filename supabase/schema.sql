create extension if not exists "uuid-ossp";

create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(), name text not null, slug text not null unique,
  event_date timestamptz, logo_path text, theme_config jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{"max_file_size":26214400,"max_files_per_batch":10,"auto_approve":false,"public_gallery":true,"allowed_media":["photo","video"],"display_duration":7}'::jsonb,
  is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(), user_id uuid unique not null references auth.users(id) on delete cascade,
  full_name text, role text not null default 'admin' check (role in ('admin','super_admin')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.upload_sessions (
  id uuid primary key default uuid_generate_v4(), event_id uuid not null references public.events(id) on delete cascade,
  token_hash text not null unique, expires_at timestamptz not null, upload_count integer not null default 0, max_uploads integer not null default 20, created_at timestamptz not null default now()
);
create table if not exists public.media_uploads (
  id uuid primary key default uuid_generate_v4(), event_id uuid not null references public.events(id) on delete cascade,
  guest_name text, caption text, storage_path text not null unique, thumbnail_path text,
  media_type text not null check (media_type in ('image','video')), mime_type text not null, file_size bigint not null check (file_size > 0),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  is_featured boolean not null default false, is_hidden boolean not null default false, display_order integer,
  uploaded_at timestamptz not null default now(), approved_at timestamptz, approved_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz, rejected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.media_audit_logs (
  id uuid primary key default uuid_generate_v4(), event_id uuid not null references public.events(id) on delete cascade,
  media_id uuid references public.media_uploads(id) on delete set null, actor_id uuid references auth.users(id) on delete set null,
  action text not null, changes jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.event_display_state (
  event_id uuid primary key references public.events(id) on delete cascade, is_active boolean not null default false,
  active_media_id uuid references public.media_uploads(id) on delete set null, slideshow_duration integer not null default 7 check (slideshow_duration between 2 and 120),
  transition text not null default 'fade', updated_at timestamptz not null default now()
);

create index if not exists media_event_status_idx on public.media_uploads(event_id, moderation_status, created_at desc);
create index if not exists media_event_featured_idx on public.media_uploads(event_id, is_featured);
create index if not exists audit_event_idx on public.media_audit_logs(event_id, created_at desc);
create index if not exists sessions_event_idx on public.upload_sessions(event_id, expires_at);

alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.media_uploads enable row level security;
alter table public.media_audit_logs enable row level security;
alter table public.event_display_state enable row level security;

drop policy if exists "active events are public" on public.events;
create policy "active events are public" on public.events for select using (is_active = true);
drop policy if exists "approved media is public" on public.media_uploads;
create policy "approved media is public" on public.media_uploads for select using (moderation_status = 'approved' and is_hidden = false and exists (select 1 from public.events e where e.id = event_id and e.is_active = true and coalesce((e.settings->>'public_gallery')::boolean, true)));
create policy "guests submit pending media" on public.media_uploads for insert with check (
  moderation_status = 'pending' and file_size <= 26214400 and
  exists (select 1 from public.events e where e.id = event_id and e.is_active = true)
);
drop policy if exists "admins manage media" on public.media_uploads;
create policy "admins manage media" on public.media_uploads for all using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','super_admin')));
drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles for select using (user_id = auth.uid());
create policy "admins manage events" on public.events for all using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','super_admin')));
create policy "admins read audit logs" on public.media_audit_logs for select using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','super_admin')));
create policy "admins manage display" on public.event_display_state for all using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','super_admin')));

insert into storage.buckets (id, name, public) values ('event-media', 'event-media', false) on conflict (id) do update set public = false;
drop policy if exists "public can read event media" on storage.objects;
drop policy if exists "guests can upload event media" on storage.objects;
drop policy if exists "admins can delete event media" on storage.objects;
create policy "guests can upload event media" on storage.objects for insert to anon, authenticated with check (bucket_id = 'event-media' and storage.extension(objects.name) in ('jpg','jpeg','png','webp','mp4') and split_part(objects.name, '/', 1) = 'events' and exists (select 1 from public.events e where e.id::text = split_part(objects.name, '/', 2) and e.is_active = true));
create policy "approved media can be read" on storage.objects for select using (bucket_id = 'event-media' and exists (select 1 from public.media_uploads m where m.storage_path = name and m.moderation_status = 'approved' and m.is_hidden = false));
create policy "admins can read event media" on storage.objects for select using (bucket_id = 'event-media' and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','super_admin')));
create policy "admins can delete event media" on storage.objects for delete using (bucket_id = 'event-media' and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role in ('admin','super_admin')));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'media_uploads') then alter publication supabase_realtime add table public.media_uploads; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_display_state') then alter publication supabase_realtime add table public.event_display_state; end if;
end $$;
