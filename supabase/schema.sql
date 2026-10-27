create extension if not exists "uuid-ossp";

create table if not exists events (
  id uuid primary key default uuid_generate_v4(), name text not null, event_date date,
  logo_url text, theme_config jsonb default '{}'::jsonb, is_active boolean default true,
  created_at timestamptz default now()
);
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(), user_id uuid unique references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','moderator')), created_at timestamptz default now()
);
create table if not exists media_uploads (
  id uuid primary key default uuid_generate_v4(), event_id uuid not null references events(id) on delete cascade,
  guest_name text, caption text, storage_path text not null, media_type text not null check (media_type in ('photo','video')),
  mime_type text not null, file_size bigint not null, moderation_status text not null default 'Pending' check (moderation_status in ('Pending','Approved','Rejected')),
  is_featured boolean default false, created_at timestamptz default now(), approved_at timestamptz
);
create index if not exists media_event_status_idx on media_uploads(event_id, moderation_status, created_at desc);

alter table events enable row level security;
alter table profiles enable row level security;
alter table media_uploads enable row level security;
create policy "active events are public" on events for select using (is_active = true);
create policy "approved media is public" on media_uploads for select using (moderation_status = 'Approved');
create policy "guests can submit media" on media_uploads for insert with check (file_size <= 26214400 and moderation_status = 'Approved');
create policy "admins manage media" on media_uploads for all using (exists (select 1 from profiles where user_id = auth.uid() and role in ('admin','moderator')));
create policy "admins read profiles" on profiles for select using (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('event-media', 'event-media', true) on conflict (id) do nothing;
create policy "public can read event media" on storage.objects for select using (bucket_id = 'event-media');
create policy "guests can upload event media" on storage.objects for insert with check (bucket_id = 'event-media');
create policy "admins can delete event media" on storage.objects for delete using (bucket_id = 'event-media' and auth.role() = 'authenticated');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'media_uploads'
  ) then
    alter publication supabase_realtime add table public.media_uploads;
  end if;
end $$;
