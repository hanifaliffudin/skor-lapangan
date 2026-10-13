# V1.0 QA evidence, 2026-10-13

**Status: verifikasi engineering selesai untuk checks yang tersedia di host ini; belum menjadi sign-off rilis publik.** Database disposable, audit dependency, browser automation lokal, device fisik, konfigurasi provider, dan persetujuan owner/legal tetap harus diverifikasi di environment yang sesuai.

## Scope

Run ini mencakup working tree setelah penambahan Tenis meja, Squash, hardening local journal, atomic match sync, dan regression coverage. Player names tidak digunakan sebagai data uji pada smoke test.

## Automated checks

| Check                                  | Result          | Evidence                                                                                                                                             |
| -------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`                    | Pass            | Prettier menyelesaikan pemeriksaan repository tanpa perubahan.                                                                                       |
| `git diff --check`                     | Pass            | Tidak ada whitespace error pada diff.                                                                                                                |
| `pnpm typecheck`                       | Pass            | Scoring core dan web typecheck lulus.                                                                                                                |
| `pnpm test`                            | Pass            | Scoring core: 5 file, 68 test. Web: 10 file, 65 test.                                                                                                |
| `pnpm test:coverage`                   | Pass            | Scoring core: statements 91.25%, branches 78.19%, functions 93.86%. Web: statements 72.43%, branches 77.76%, functions 58.68%. Threshold terlampaui. |
| `pnpm build`                           | Pass            | Vite production build dan PWA build lulus tanpa chunk-size warning baru.                                                                             |
| Supabase migration history             | Pass            | `npx --yes supabase@latest migration list` menunjukkan local dan remote cocok sampai `20261013130000_atomic_match_sync_guard`.                       |
| `supabase test db`                     | Not run         | Docker/Postgres lokal tidak tersedia; pgTAP dijalankan oleh job database di CI, bukan terhadap project aktif.                                        |
| `pnpm audit --prod --audit-level=high` | Not run         | Registry npm tidak dapat di-resolve pada host ini. Job CI tetap menjalankan audit.                                                                   |
| `pnpm test:e2e`                        | Not run locally | Browser automation lokal dibatasi sandbox host. Spec dan job CI sudah tersedia; Chrome manual smoke lulus.                                           |

## Chrome smoke test

Environment: development server lokal pada `http://127.0.0.1:5175/`, Chrome melalui Codex.

- Home terbuka tanpa error console.
- Setup dapat dibuka dan match dapat dimulai.
- Satu poin dapat dicatat dan skor berubah.
- Dialog akhir match dapat dibuka dan ditutup.
- `consoleErrors` kosong.

Smoke ini memverifikasi jalur dasar. Ia tidak menggantikan test tunggal/ganda lengkap, sync aktif, Live Viewer, atau device fisik.

## Migration verification

Project Supabase aktif sudah menerima migration sampai:

1. `20261013120000_atomic_match_sync.sql`
2. `20261013130000_atomic_match_sync_guard.sql`

Migration list lokal dan remote cocok. Test SQL disposable belum dapat dijalankan di host ini. Sebelum rilis publik, jalankan `supabase test db` pada runner dengan Docker dan pastikan test untuk constraint sport/event, sanitasi, order event, service-box event, viewer projection, serta atomic sync lulus.

## Release gates still open

- Jalankan job CI lengkap, termasuk Playwright, audit dependency, dan database pgTAP.
- Jalankan smoke sync dan Live Viewer terhadap environment Supabase non-produksi atau staging.
- Uji mobile pada device nyata untuk jarak pandang, brightness, keyboard, focus ring, touch target, dan rotasi layout.
- Verifikasi Auth anonymous limit, `purge-expired-guest-data`, dan retention pada dashboard Supabase.
- Lengkapi [legal and owner release gate](legal-release-gate.md).
- Isi dan setujui semua item pada [QA release checklist](qa-release-checklist.md).
