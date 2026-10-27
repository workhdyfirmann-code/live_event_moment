# Momen Kita – Live Event Gallery

Aplikasi React/Vite untuk upload foto/video tamu, moderasi admin, dan live gallery realtime.

## Menjalankan

```bash
npm install
npm run dev
```

Backend Supabase wajib dikonfigurasi untuk upload, autentikasi, storage, dan live gallery. Salin `.env.example` menjadi `.env.local`, isi URL/anon key Supabase, dan gunakan UUID event nyata. Aplikasi tidak menggunakan `localStorage` atau data dummy sebagai backend produksi.

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

1. Buka Supabase SQL Editor dan jalankan `supabase/schema.sql`. Untuk project lama yang sudah memakai schema sebelumnya, jalankan juga `supabase/migrations/20261027_production_foundation.sql`.
2. Buat satu row `events`, lalu masukkan UUID-nya ke `VITE_EVENT_ID`.
3. Buat user admin di Authentication → Users.
4. Masukkan row `profiles` dengan `user_id` user admin dan `role = 'admin'`.
5. Aktifkan realtime untuk tabel `media_uploads` (Database → Publications → `supabase_realtime`).
6. Pastikan bucket private `event-media` tersedia; schema membuat bucket dan policy storage-nya. Media approved dibaca melalui signed URL.

## Rute

- `/` — halaman tamu. Mendukung multi-file JPG/JPEG/PNG/WEBP/MP4, preview, validasi 25 MB/file, upload Storage, metadata `pending`, dan retry/error state.
- `/live` — layar fullscreen. Hanya media approved, slideshow otomatis, dan menerima perubahan status melalui Supabase Realtime.
- `/admin` — login Supabase Auth, statistik, filter, pencarian, approve/reject/delete/featured. RLS tetap memvalidasi hak admin di database.

## End-to-end verification

Setelah migration dan environment variables aktif, uji dari dua browser/perangkat:

1. Buka `/` dan pilih satu foto/video.
2. Isi nama dan pesan, lalu upload.
3. Pastikan row `media_uploads` berstatus `pending` dan file ada di bucket `event-media`.
4. Login `/admin`, approve media.
5. Buka `/live` di perangkat lain; subscription dan polling fallback harus menampilkan media tanpa reload.
6. Reject/hide/delete dari admin dan pastikan item hilang setelah event update atau resync.

Gunakan DevTools Console untuk log `FILE_SELECTED`, `STORAGE_UPLOAD_SUCCESS`, `DATABASE_INSERT_SUCCESS`, `REALTIME_EVENT_RECEIVED`, dan `MEDIA_RENDERED`. Test terhadap project Supabase/Vercel aktual harus dilakukan setelah credentials tersedia; build lokal saja tidak membuktikan koneksi backend.

## Keamanan

Gunakan hanya anon key di frontend. Jangan pernah memasukkan Supabase service-role key ke `.env` Vite atau bundle browser. RLS pada `supabase/schema.sql` membatasi media publik hanya yang approved dan operasi moderasi kepada profile admin/moderator. Untuk deployment production, tambahkan rate limiting/bot protection di Edge Function atau gateway sebelum insert upload.
