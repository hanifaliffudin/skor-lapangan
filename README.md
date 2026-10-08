# Skor Lapangan

Scorekeeper mobile-first untuk pertandingan ganda Badminton dan Pickleball. Aplikasi membantu pemain mengingat skor, giliran servis, server aktif, dan posisi pemain tanpa harus memahami seluruh aturan dari awal.

Versi v1.0 sengaja berfokus pada dua olahraga ini agar UX koreksi skor, undo/redo, sinkronisasi, dan keterbacaan di lapangan dapat divalidasi sebelum olahraga lain ditambahkan.

## Fitur

- Badminton ganda: reli 21, best of 3, menang selisih 2, batas 30.
- Pickleball ganda: side-out, best of 3, 11 poin, menang selisih 2.
- Diagram lapangan dengan server dan posisi pemain aktif.
- Undo, redo, dan override skor sebagai event audit.
- Bahasa Indonesia dan Inggris.
- Mode guest tanpa akun; data hanya hidup selama tab masih terbuka.
- Login Google dan sinkronisasi histori melalui Supabase.
- Official Rules dikunci dan memiliki versi ruleset yang tersimpan bersama pertandingan.

## Tech stack

- React 19, TypeScript, Vite, dan React Router.
- Supabase Auth dan PostgreSQL dengan Row Level Security.
- Vitest dan Testing Library.
- pnpm workspace dengan scoring engine terpisah dari UI.

## Arsitektur local-first

Skor selalu diperbarui ke `sessionStorage` terlebih dahulu supaya pertandingan tetap responsif. Jika pengguna login, snapshot pertandingan dan event kemudian disinkronkan ke Supabase.

Setiap match dan event mendapat UUID dari browser. Backend menggunakan UUID serta urutan event sebagai batas idempotensi, sehingga retry setelah koneksi terputus tidak membuat pertandingan atau event ganda. State server juga menolak snapshot lama yang datang terlambat.

## Menjalankan lokal

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Isi `apps/web/.env.local` dengan URL dan publishable key Supabase. Jangan pernah meletakkan service-role key di aplikasi web.

Perintah verifikasi:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Struktur proyek

```text
apps/web/                 React web app
packages/scoring-core/   Pure scoring engine dan aturan olahraga
supabase/migrations/     Schema, trigger, dan RLS policies
supabase/tests/          Pengujian kebijakan database
docs/                    ADR, sumber aturan, dan panduan setup
```

## Batas rilis

Community Rules, live sharing, dan olahraga lain seperti Tenis atau Squash tidak termasuk v1.0. Fitur tersebut direncanakan sebagai pembaruan terpisah setelah fondasi dua olahraga pertama terbukti kuat.

Aktivasi project Supabase dijelaskan di [docs/supabase-setup.md](docs/supabase-setup.md).
