# ADR 0001: Fondasi local-first

## Status

Accepted

## Keputusan

Gunakan React, TypeScript strict, Vite, dan paket scoring engine murni tanpa ketergantungan UI. Pertandingan guest disimpan di `sessionStorage`. UUID dibuat di browser untuk match dan semua event.

## Alasan

Pemisahan ini membuat aturan skor dapat diuji tanpa browser, menjaga interaksi tetap cepat saat koneksi buruk, dan menyiapkan sinkronisasi idempoten ke Supabase tanpa mengubah identitas data lokal.

## Tahap berikutnya

Supabase baru dibutuhkan ketika Google login, histori lintas perangkat, live viewer publik, atau sinkronisasi offline mulai diimplementasikan.
