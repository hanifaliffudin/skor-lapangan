# Aktivasi Supabase

Kode frontend sudah memakai publishable key. Dua konfigurasi dashboard tetap diperlukan sebelum login dan sinkronisasi dapat dipakai.

## 1. Buat tabel dan kebijakan akses

Di Supabase Dashboard, buka **SQL Editor**, salin seluruh isi `supabase/migrations/20261008160000_initial_matches.sql`, lalu jalankan sekali. Migration membuat tabel `matches` dan `match_events`, indeks, pembatas urutan state, serta Row Level Security agar pengguna hanya dapat mengakses pertandingan miliknya sendiri.

## 2. Aktifkan Google OAuth

1. Di Google Cloud Console, buat OAuth Client ID bertipe **Web application**.
2. Tambahkan origin lokal `http://127.0.0.1:5173` dan origin produksi nanti.
3. Tambahkan authorized redirect URI Supabase:
   `https://esuizdlgzcmsundzuhbq.supabase.co/auth/v1/callback`
4. Di Supabase Dashboard, buka **Authentication → Providers → Google**.
5. Aktifkan Google, lalu masukkan Client ID dan Client Secret dari Google Cloud.
6. Di **Authentication → URL Configuration**, set Site URL lokal ke `http://127.0.0.1:5173` dan tambahkan URL produksi saat tersedia.

Client Secret Google hanya disimpan di dashboard Supabase. Jangan masukkan secret itu ke `.env.local` atau repository.

## Pemeriksaan cepat

- Tombol **Masuk dengan Google** membuka consent Google tanpa pesan “belum siap”.
- Setelah login, header menampilkan akun dan layar pertandingan menampilkan status **Tersimpan**.
- Menekan poin beberapa kali tidak membuat duplikat event ketika jaringan terputus lalu tersambung kembali.
