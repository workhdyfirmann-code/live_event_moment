# Momen Kita – Live Event Gallery

Aplikasi React/Vite untuk upload foto/video tamu, moderasi admin, dan live gallery realtime.

## Menjalankan

```bash
npm install
npm run dev
```

Tanpa environment variables, aplikasi berjalan dalam **mode demo lokal** menggunakan `localStorage`. Untuk alur produksi, salin `.env.example` menjadi `.env.local`, isi URL/anon key Supabase, dan gunakan UUID event nyata.

## Deploy ke Vercel

1. Push project ini ke GitHub/GitLab/Bitbucket.
2. Di Vercel pilih **Add New → Project**, lalu import repository tersebut.
3. Vercel akan menggunakan konfigurasi `vercel.json`:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Pada **Project Settings → Environment Variables**, tambahkan tiga variable berikut untuk environment Production, Preview, dan Development:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_EVENT_ID=uuid-event-dari-tabel-events
   ```

5. Klik **Redeploy** setelah variable disimpan.

`vercel.json` menyediakan SPA rewrite supaya URL `/live` dan `/admin` tetap bisa dibuka langsung atau setelah halaman di-refresh. Jangan masukkan `SUPABASE_SERVICE_ROLE_KEY` ke Vercel Environment Variables yang dipakai frontend; hanya gunakan anon key.

## Supabase setup

1. Buka Supabase SQL Editor dan jalankan `supabase/schema.sql`.
2. Buat satu row `events`, lalu masukkan UUID-nya ke `VITE_EVENT_ID`.
3. Buat user admin di Authentication → Users.
4. Masukkan row `profiles` dengan `user_id` user admin dan `role = 'admin'`.
5. Aktifkan realtime untuk tabel `media_uploads` (Database → Publications → `supabase_realtime`).
6. Pastikan bucket `event-media` tersedia; schema membuat bucket dan policy storage-nya.

## Rute

- `/` — halaman tamu. Mendukung multi-file JPG/JPEG/PNG/WEBP/MP4, preview, validasi 25 MB/file, upload storage, metadata, dan langsung menayangkan media yang berhasil diunggah.
- `/live` — layar fullscreen. Hanya media approved, slideshow otomatis, dan menerima perubahan status melalui Supabase Realtime.
- `/admin` — login Supabase Auth, statistik, filter, pencarian, approve/reject/delete/featured.

## Keamanan

Gunakan hanya anon key di frontend. Jangan pernah memasukkan Supabase service-role key ke `.env` Vite atau bundle browser. RLS pada `supabase/schema.sql` membatasi media publik hanya yang approved dan operasi moderasi kepada profile admin/moderator. Untuk deployment production, tambahkan rate limiting/bot protection di Edge Function atau gateway sebelum insert upload.
