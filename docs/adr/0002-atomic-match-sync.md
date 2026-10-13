# ADR 0002: Atomic match journal sync

## Status

Accepted

## Date

2026-10-13

## Context

Match scoring berjalan local-first. Browser menyimpan snapshot match dan journal event, lalu mengirimkannya saat Supabase tersedia. Pola dua request terpisah untuk snapshot dan event dapat meninggalkan data setengah tersimpan ketika salah satu request gagal. Dua device juga dapat mengirim sequence yang berbeda dan saling menimpa tanpa tanda.

## Decision

Gunakan satu RPC Supabase bernama `public.sync_match_journal` untuk menerima snapshot match dan daftar event yang menunggu dalam satu transaksi database.

RPC tersebut:

- memeriksa bahwa `p_owner_id` sama dengan user yang sedang login;
- mengunci baris match dengan `FOR UPDATE` sebelum membandingkan `last_client_sequence`;
- mengembalikan `stale` ketika client lebih lama daripada snapshot server;
- mengembalikan `conflict` ketika sequence sama tetapi state berbeda;
- meng-upsert snapshot dan memasukkan event berdasarkan UUID dengan `ON CONFLICT DO NOTHING`;
- mengembalikan `applied` atau `already_synced` untuk retry yang aman;
- hanya dapat dipanggil oleh role `authenticated`.

Frontend memperlakukan `stale` dan `conflict` sebagai konflik sync. Device tidak menimpa state server secara otomatis. Scoring lokal tetap dipertahankan agar operator dapat menyimpan hasilnya sebelum memilih tindakan pemulihan.

## Alternatives considered

- **Dua upsert dari browser:** ditolak karena snapshot dan event dapat berbeda jika request kedua gagal.
- **Last write wins:** ditolak karena update dari device lama dapat menghapus poin yang sudah masuk dari device lain.
- **Merge otomatis berdasarkan event:** ditunda karena journal dapat berisi koreksi, undo, redo, dan perubahan order yang tidak aman untuk digabung tanpa keputusan operator.
- **Lock penuh per match di browser:** tidak cukup untuk menjamin konsistensi antar device dan tidak melindungi API langsung.

## Consequences

Positif:

- Snapshot dan event masuk bersama atau tidak ada perubahan sama sekali.
- Retry idempotent tidak menggandakan row event.
- Konflik antar device terlihat jelas dan dapat ditangani.
- Validasi ownership dan lock berada di database, bukan hanya di UI.

Trade-off:

- Database harus sudah memiliki RPC sebelum frontend yang memakainya dideploy.
- Multi-device tetap single-writer. Operator perlu memilih state yang benar jika konflik terjadi.
- Perubahan kontrak payload harus dibuat sebagai migration baru dan diuji terhadap database disposable sebelum diterapkan ke project aktif.

## Operational note

Migration sync bersifat forward-only. Jangan mengedit file migration yang sudah diterapkan atau menghapus function produksi sebagai cara rollback. Untuk perbaikan, tambahkan migration baru, uji, terapkan, lalu verifikasi history dan signature RPC. Lihat [operations runbook](../operations-runbook.md).
