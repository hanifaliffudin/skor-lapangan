# Changelog

Perubahan penting pada Skor Lapangan dicatat di sini. Entri bertanda `Unreleased` mencatat working tree dan belum menjadi tanda bahwa rilis publik sudah disetujui.

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
