# Legal and owner release gate

Dokumen ini mengubah draft legal menjadi daftar pekerjaan yang dapat diverifikasi. Status saat ini: **belum siap dipublikasikan** karena identitas operator, kontak, keputusan produk, dan review hukum belum diisi.

## Satu paket informasi yang harus diisi owner

- Nama legal operator.
- Email privacy dan email support yang benar-benar dipantau.
- Alamat atau informasi usaha jika diwajibkan oleh wilayah layanan.
- Wilayah layanan dan hukum yang dipilih.
- Tanggal berlaku privacy notice dan terms of use.
- Kebijakan usia minimum dan parental consent jika relevan.
- Keputusan tentang biaya, perubahan layanan, penghentian layanan, warranty, liability, dan dispute.

Jangan mengganti placeholder dengan data contoh. Nilai final harus berasal dari operator layanan.

## Pemeriksaan teknis sebelum publikasi

- Cocokkan privacy notice dengan environment Vercel dan Supabase yang benar-benar aktif.
- Catat provider, region, retention, analytics, consent, dan tag aktif di Google Tag Manager.
- Pastikan deskripsi local storage, anonymous Auth, guest expiry, Live Viewer bearer link, dan penghapusan data sama dengan implementasi.
- Uji mailbox privacy dan support menggunakan pesan test, lalu catat siapa yang menerima dan tanggal pengujian.
- Pastikan link final privacy notice dan terms dapat dibuka tanpa login.
- Pastikan owner menyetujui staged rollout configured OAuth providers, account history, dan in-app account deletion. Community Rules tetap nonaktif sampai moderation, contact, and legal gates pass.

## Bukti persetujuan

Simpan bersama catatan release:

- nama reviewer dan tanggal review;
- URL atau commit final dokumen;
- hasil uji mailbox;
- daftar environment dan provider yang diverifikasi;
- keputusan owner untuk setiap placeholder yang sebelumnya terbuka.

## Dokumen yang harus diselesaikan

- [Privacy notice draft](privacy-notice.md)
- [Terms of use draft](terms-of-use.md)
- [Account deletion workflow](account-deletion-request-draft.md), sebelum account foundation dipromosikan ke production
- [Community Rules policy draft untuk V1.1](community-rules-policy.md), sebelum Community Rules dibuka

Dokumen ini tidak menggantikan nasihat hukum. Untuk rilis Indonesia, minta reviewer yang kompeten menilai dokumen final terhadap hukum yang berlaku, termasuk UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
