# Changelog

Perubahan penting pada Skor Lapangan dicatat di sini. Entri bertanda `Unreleased` mencatat working tree dan belum menjadi tanda bahwa rilis publik sudah disetujui.

## Unreleased, 2026-10-15

### Diperbaiki

- Test alur Tennis dibuat menunggu perpindahan halaman lazy-loaded dan kontrol skor sebelum melakukan assertion, sehingga suite penuh tidak lagi bergantung pada timing.
- Smoke coverage Playwright diperluas ke Badminton, Pickleball, Tennis, dan Padel; coverage yang sudah ada untuk Tenis meja, Squash, dan Community Rules tetap dipertahankan.
- Hint olahraga di layar sempit kini membungkus teks alih-alih memotong perbedaan aturan dengan ellipsis.
- Metadata HTML statis mencantumkan enam olahraga, dan route setup, match, viewer, serta Community Rules memperbarui judul dokumen sesuai locale.

### Verifikasi

- `pnpm test`: scoring-core 68 test dan web 122 test lulus.
- `pnpm test:coverage`: scoring-core statements 91,23%; web statements 73,59%; threshold lulus.
- Smoke E2E lokal satu worker: 8 test lulus. Verifikasi job CI dan dependency audit tetap mengikuti pipeline release.

## Unreleased, 2026-10-13

### Ditambahkan

- Tenis meja untuk tunggal dan ganda dengan ruleset ITTF, best-of-3 atau best-of-5, rotasi servis, order ganda, koreksi skor, undo/redo, history, sync, dan Live Viewer.
- Squash untuk tunggal dan ganda dengan ruleset WSF, best-of-5 sebagai default atau best-of-3, service box, order server dan penerima, koreksi skor, undo/redo, history, sync, dan Live Viewer.
- Layout meja dan lapangan responsif dengan marker server, penerima, service box, dan status game.
- Sinkronisasi journal atomik melalui RPC `sync_match_journal` dengan penolakan snapshot stale atau divergent.
- Coverage threshold, browser smoke test, Supabase pgTAP test, dan job CI untuk format, typecheck, test, build, audit dependency, database, dan browser.
- Panduan operasi, ADR sync, bukti QA, dan checklist legal release.

### Diubah

- Journal lokal memakai envelope berversi dan validasi payload sebelum dipulihkan dari browser storage.
- Payload sync dan proyeksi Live Viewer hanya membawa state yang diperlukan, tanpa nama pemain.
- Konflik snapshot ditampilkan sebagai status yang perlu ditangani, bukan ditimpa diam-diam oleh device lain.
- README, panduan pengguna, sumber aturan, spesifikasi implementasi, roadmap, dan panduan Supabase diperbarui untuk Tenis meja dan Squash.

### Verifikasi

- `pnpm format:check`, `git diff --check`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, dan `pnpm build` lulus pada working tree ini.
- Smoke test Chrome lokal mencapai alur Home, Setup, Match, pencatatan poin, dan dialog akhir match tanpa error console.
- Daftar migration lokal dan project Supabase aktif cocok sampai migration `20261013130000_atomic_match_sync_guard.sql`.
- Test database Supabase, audit dependency, dan Playwright lokal masih membutuhkan environment yang tersedia di CI atau host dengan Docker, akses registry, dan browser automation yang berfungsi. Detailnya ada di [bukti QA 2026-10-13](docs/qa-evidence-v1.0-2026-10-13.md).
