# Riset Requirement Club Session untuk Mabar dan Open Play Lintas Olahraga

Tanggal riset: 2026-10-24
Ruang lingkup: Badminton, Pickleball, Tennis, Padel, Table tennis, dan Squash.

## Ringkasan

Club Session sebaiknya dimodelkan sebagai sesi open-play yang punya kebijakan bermain, roster, kapasitas, antrean, dan hasil pertandingan. Ia bukan sekadar kumpulan Match doubles yang dibuat satu per satu.

Pola yang berulang di sumber:

1. Orang mendaftar sendiri, sering tanpa harus membawa pasangan. Sesi punya kapasitas lapangan atau meja, level, waktu, biaya, dan aturan masuk.
2. Rotasi adalah aturan lokal yang harus terlihat jelas. Unitnya bisa satu game, satu set, interval waktu, atau beberapa poin.
3. Keadilan yang dirasakan pemain lebih luas daripada jumlah menang: waktu tunggu, jumlah giliran, kesempatan bermain dengan orang baru, kecocokan level, dan perlakuan terhadap pemain baru ikut menentukan pengalaman.
4. Setiap olahraga punya bentuk open-play yang berbeda. Badminton, pickleball, tennis, dan padel sering memakai doubles, sedangkan table tennis dan squash juga lazim memakai format singles atau permainan singkat dengan antrean.
5. Keluhan paling berisiko adalah menunggu terlalu lama, pemain atau grup menguasai lapangan, no-show, level tidak cocok, aturan antrean tidak jelas, dan organizer harus mengurus semuanya lewat chat atau ingatan.

Kesimpulan produk: dukung semua olahraga dengan satu kerangka Club Session, tetapi gunakan Play Profile per olahraga. Profile itu menentukan format, jumlah pemain per lapangan, unit rotasi, cara mengisi slot, dan metrik fairness. Jangan menerapkan algoritme empat pemain doubles ke semua olahraga.

Status implementasi 2026-10-26: slice pertama sudah menerapkan Play Profile untuk keenam olahraga, queue dan Smart Rotation untuk format singles, migration Preview, serta countdown display untuk table-tennis short rounds. Requirement RSVP, check-in, waitlist, policy rotasi yang configurable, dan fairness berbasis waktu masih menjadi backlog pilot.

## Cara membaca bukti

- **Bukti primer**: aturan atau panduan federasi, dokumentasi platform yang mengoperasikan open match atau waitlist, dan halaman klub atau venue yang menjelaskan praktik mereka sendiri.
- **Bukti komunitas**: halaman event atau komunitas yang ditulis oleh organizer. Ini berguna untuk melihat perilaku nyata, tetapi bukan aturan universal.
- **Sinyal keluhan**: laporan pengguna di forum. Sumber ini anekdotal dan tidak mengukur prevalensi. Ia dipakai untuk menemukan failure mode yang perlu diuji, bukan untuk menyimpulkan bahwa semua komunitas mengalaminya.
- **Inferensi produk**: requirement di bagian backlog adalah turunan dari bukti di atas. Ia perlu divalidasi dengan organizer lokal sebelum dianggap sebagai kontrak final.

Contoh sumber berasal dari beberapa negara dan komunitas. Karena praktik mabar bergantung pada venue, ukuran grup, dan budaya lokal, dokumen ini tidak mengklaim satu aturan rotasi yang berlaku di semua tempat.

## Pola mabar yang ditemukan

| Olahraga     | Bukti praktik open-play                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Default produk yang disarankan                                                                                                                                                                                                    | Catatan keyakinan                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Badminton    | [Badminton England](https://www.badmintonengland.co.uk/wp-content/uploads/2021/10/Club-Programme-Guide.pdf) menggambarkan No Strings sebagai pay-and-play untuk semua kemampuan, dengan coordinator yang menyambut peserta dan mencampur permainan agar peserta bermain dengan dan melawan orang yang berbeda. [Panduan lain](https://www.badmintonengland.co.uk/wp-content/uploads/2021/02/rtp-universities-colleges-v2.pdf) menyebut coordinator mengatur rotasi di lapangan.                                                                                                          | Doubles sebagai default mabar, tetapi format singles tetap tersedia. Satu giliran harus punya batas yang mudah dipahami, misalnya satu game atau satu set pendek.                                                                 | Tinggi untuk kebutuhan coordinator, welcome, dan rotasi. Format doubles adalah default yang masuk akal, bukan aturan semua klub.                    |
| Pickleball   | [USA Pickleball](https://usapickleball.org/sportsmanship-guide/) mewajibkan etika sosial untuk tidak memotong antrean, tidak mengubah skor agar tetap di lapangan, dan siap bermain saat giliran. [Event PickleBali](https://megatix.co.id/events/picklebali-open-play-monday-funday-02) memakai sesi 2 jam, level group, rotasi setelah setiap game, dan pengecualian challenge court. [Venue di Ubud](https://www.dalypickleball.com/) menawarkan walk-in, solo player, dan round robin yang mencampur partner.                                                                        | Open-play doubles, 4 pemain per game dengan kapasitas court yang dapat menampung 4 sampai 6 pemain. Pilih kebijakan everyone rotates atau challenge court; jangan sembunyikan perbedaannya.                                       | Tinggi untuk kebutuhan antrean dan rotasi. Jumlah 4 sampai 6 berasal dari event tertentu, jadi harus configurable.                                  |
| Tennis       | [South Hampstead](https://clubspark.lta.org.uk/southhampsteadtennisclub/PlayTennis/SocialTennis) memprioritaskan doubles, meminta pemain rotasi setelah setiap set, dan memakai racquets-in untuk antrean. [Abergavenny](https://clubspark.lta.org.uk/abergavennytennisclub/SocialMixIn) memberi prioritas kepada pemain yang baru duduk dan meminta pemain siap bermain dengan siapa pun. [Bovingdon](https://clubspark.lta.org.uk/bovingdonflaundentennisclub/PLAY) memakai turn-up play dan membatasi pertandingan menjadi first-to-five ketika ada yang menunggu.                    | Doubles sebagai default social mix-in, dengan short set, timed round, atau first-to-five sebagai unit. Antrean harus memprioritaskan pemain yang sudah menunggu, bukan grup yang baru turun dari court. Singles adalah mode lain. | Tinggi untuk pola social doubles dan queue. Detail durasi berbeda antar klub, sehingga parameter harus milik sesi.                                  |
| Padel        | [Playtomic](https://playerhelp.playtomic.com/hc/en-gb/articles/19831715222929-How-to-book-a-court-or-a-spot-in-a-match-in-your-favourite-Club) membedakan private booking dari Open Match. Open Match bisa dibuat atau diikuti tanpa membawa satu tim penuh, memiliki level range, mode casual atau competitive, dan kebijakan pembayaran atau refund. [Konfigurasi klubnya](https://helpmanager.playtomic.com/hc/en-gb/articles/20535035123473-How-to-configure-Open-Matches-at-your-Club) mendukung single, double, serta finalisasi court setelah ambang peserta atau waktu tertentu. | Default doubles 4 pemain per court. Sesi harus membedakan casual dan competitive, menyimpan level range, dan menjelaskan kapan court dianggap confirmed.                                                                          | Tinggi untuk marketplace dan open-match workflow. Fitur payment dan court booking dapat menjadi integrasi terpisah dari Club Session organizer-led. |
| Table tennis | [Table Tennis England](https://www.tabletennisengland.co.uk/ping-tables/waterside-table-tennis-club/) mencatat open practice tanpa booking. Waterside menggunakan ronde 10 menit lalu semua pemain berpindah agar bertemu pemain baru. [Venue lain](https://www.tabletennisengland.co.uk/ping-tables/wesley-buildings-redruth/) menyebut doubles sering dipakai ketika turnout besar.                                                                                                                                                                                                    | Modelkan table, bukan court. Sediakan singles dan doubles, ronde berbasis waktu atau poin, serta challenge atau round-robin. Kapasitas tabel dan antrean dapat berbeda dari 4 orang.                                              | Tinggi untuk short rounds dan perpindahan cepat. Pilihan winner-stays atau everyone-off harus ditentukan per sesi.                                  |
| Squash       | [Hythe Cricket & Squash Club](https://www.englandsquash.com/finder/club/hythe-cricket-squash-club/483) menjalankan club night dengan satu game sampai 11 poin lalu off, menaruh nama pemain ke queue, dan memasangkan mereka dengan lawan berbeda. [England Squash](https://www.englandsquash.com/finder/club/letchworth-sports-and-tennis-club/543) juga mempromosikan sesi sosial untuk pemula dan pemain berpengalaman.                                                                                                                                                               | Singles sebagai default club night, dua pemain per court, satu game atau timed round, lalu kembali ke antrean. Tambahkan doubles atau racketball hanya sebagai format eksplisit.                                                  | Tinggi untuk queue dan singles. Menganggap semua squash sebagai doubles akan salah secara domain.                                                   |

### Pola komunitas di Indonesia

- [Reclub](https://discover.reclub.co/discover/indonesia/club/temenmaenpickleball) menampilkan komunitas pickleball Indonesia dengan sesi publik berulang, label level, jumlah peserta, venue yang sering dipakai, dan organizer atau host. Ini menunjukkan bahwa discovery dan RSVP individual adalah bagian dari mabar, bukan hanya koordinasi setelah semua orang sudah berkumpul.
- [Daly Pickleball Ubud](https://www.dalypickleball.com/) menawarkan open play semua level, walk-in, solo player, event round robin, dan WhatsApp community untuk mencari teman bermain. Ini menunjukkan dua jalur yang perlu didukung: datang langsung jika kapasitas memungkinkan, atau mendaftar lebih dulu untuk sesi terjadwal.
- [Listing PickleBali](https://megatix.co.id/events/picklebali-open-play-monday-funday-02) menyebut minimum dan maksimum peserta, level group, check-in ticket, prepayment, walk-in jika masih ada ruang, rotasi setelah game, dan hak fasilitator untuk memindahkan pemain antar court agar pengalaman tetap sesuai level. Ini adalah contoh konkret bahwa organizer perlu kewenangan manual di atas aturan otomatis.
- Sumber lokal tersebut adalah praktik organizer tertentu, bukan standar nasional. Gunakan sebagai contoh requirement dan validasi dengan komunitas badminton atau racket sport lokal.

## Keluhan dan friction yang perlu ditangani

| Friction                                                          | Bukti                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Implikasi requirement                                                                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menunggu lama karena court dikuasai grup yang sudah bermain       | [Laporan pengguna badminton](https://www.reddit.com/r/badminton/comments/edmobz/free_play_badminton_at_my_local_citys_sport/) menyebut 10 sampai 15 orang menunggu lebih dari satu jam karena tidak ada rotasi. [USA Pickleball](https://usapickleball.org/sportsmanship-guide/) secara eksplisit melarang memotong antrean dan mengubah skor agar tidak turun.                                                                                             | Tampilkan urutan antrean, waktu tunggu, siapa yang sedang bermain, dan aturan turun. Sediakan satu aksi organizer untuk memindahkan atau mengganti pemain.                                  |
| Aturan rotasi berbeda dan mudah diperdebatkan                     | [Keluhan tennis](https://www.reddit.com/r/10s/comments/1mdqrsh/tennis_court_argumentetiquette) tentang rotasi berdasarkan jam menunjukkan bahwa istilah seperti “sudah satu jam” bisa menghasilkan konflik ketika waktu mulai tiap grup berbeda. Klub lain memakai set, racquet queue, atau first-to-five.                                                                                                                                                  | Simpan rotationPolicy pada sesi, tampilkan ringkasan sebelum join, dan tampilkan alasan pemilihan berikutnya. Jangan hardcode satu arti queueOrder untuk semua olahraga.                    |
| No-show dan pembatalan menit terakhir mengosongkan slot           | [OpenSports](https://opensports.net/blog/what-to-expect-from-the-waitlist-guide-for-players-app--web) menyediakan waitlist berurutan, notifikasi ketika slot terbuka, batas waktu claim, dan perpindahan otomatis ke orang berikutnya. Dokumentasinya juga membedakan waitlist event dari waitlist liga atau turnamen yang masih dikelola admin.                                                                                                            | Tambahkan status RSVP, waitlist, check-in, late, absent, dan replacement dengan konfirmasi organizer. Slot tidak boleh dianggap terisi hanya karena nama pernah ditambahkan.                |
| Level terlalu jauh atau mode casual dan competitive bercampur     | [Playtomic](https://helpmanager.playtomic.com/hc/en-gb/articles/20535188135185-Casual-vs-Competitive-Open-Matches) memakai level range dan approval semua pemain untuk permintaan pemain di luar level. Ia juga membedakan casual yang tidak mengubah level dari competitive yang memengaruhi ranking. [PickleBali](https://megatix.co.id/events/picklebali-open-play-monday-funday-02) memisahkan sesi berdasarkan level.                                  | Jadikan level band dan mode bermain eksplisit, tetapi tetap sediakan casual atau all-level. Hindari menyamakan open dengan semua level tanpa batas.                                         |
| Pemain baru tidak tahu apakah akan mendapat game                  | [Pemain baru di forum squash](https://www.reddit.com/r/squash/comments/1sz51z2/ive_just_joined_my_local_squash_club_what_can_i/) bertanya apakah mereka akan mendapat match sebagai anggota baru. [Badminton England](https://www.badmintonengland.co.uk/wp-content/uploads/2021/10/Club-Programme-Guide.pdf) dan [USA Pickleball](https://usapickleball.org/sportsmanship-guide/) menekankan sambutan, perkenalan, dan perilaku suportif.                  | Tampilkan apakah boleh solo, siapa host, cara check-in, aturan rotasi, dan cara meminta bantuan. Sediakan label first-timer tanpa membuka data sensitif.                                    |
| Warm-up, private group, atau challenge memperpanjang waktu tunggu | [Keluhan pickleball](https://www.reddit.com/r/Pickleball/comments/1l4x38b/is_it_rude_to_warm_up_forever_during_open_play/) menyebut warm-up 10 menit saat orang lain menunggu dan [diskusi lain](https://www.reddit.com/r/Pickleball/comments/1v3jna6/how_do_you_deal_with_players_hogging_public/) membahas grup yang mempertahankan court. Sumber tersebut memperlihatkan perdebatan tentang 4-on/4-off, challenge court, dan siapa yang punya prioritas. | Sesi harus memilih aturan warm-up, durasi ronde, everyone rotates atau winner stays, serta apakah challenge court aktif. Tampilkan aturan di board, bukan hanya di chat.                    |
| Organizer menjadi bottleneck                                      | [Badminton England](https://www.badmintonengland.co.uk/wp-content/uploads/2021/02/rtp-universities-colleges-v2.pdf) menempatkan coordinator sebagai orang yang menyambut dan mengatur rotasi. [Venue lokal](https://www.dalypickleball.com/) menggunakan WhatsApp untuk mengumpulkan pemain. Ini mengurangi beban pemain, tetapi membuat sesi bergantung pada satu orang.                                                                                   | Dukung satu organizer untuk MVP, tetapi semua keputusan penting harus tercatat dan dapat dikoreksi. Tambahkan reminder dan status otomatis agar organizer tidak perlu menghitung dari chat. |
| Biaya dan komitmen tidak jelas                                    | [Playtomic](https://helpmanager.playtomic.com/hc/en-gb/articles/20535035123473-How-to-configure-Open-Matches-at-your-Club) mengonfirmasi spot setelah payment dan memberi refund jika match tidak penuh atau pemain mundur. [Event lokal](https://megatix.co.id/events/picklebali-open-play-monday-funday-02) memakai prepayment dan ticket check-in.                                                                                                       | Minimal simpan fee note, payment status, cancellation deadline, dan apakah walk-in diterima. Payment gateway dapat menyusul, tetapi aturan uang tidak boleh hilang dari detail sesi.        |
| Keselamatan dan perilaku buruk merusak open play                  | [USA Pickleball](https://usapickleball.org/sportsmanship-guide/) meminta pemain menunggu saat melintas di belakang court, memperingatkan bola, dan menjaga sikap terhadap pemain lebih lemah. [Badminton England](https://www.badmintonengland.co.uk/wp-content/uploads/2021/10/Club-Programme-Guide.pdf) menekankan klub yang welcoming dan inklusif.                                                                                                      | Sertakan aturan perilaku dan safety note yang dapat dibaca sebelum join. Beri organizer cara menandai insiden tanpa menjadikan board sebagai forum publik.                                  |

### Batas bukti

- Keluhan Reddit adalah contoh pengalaman individu. Ia cukup untuk menemukan risiko UX, tetapi tidak boleh dipakai untuk menyatakan “mayoritas komunitas” mengalami masalah tersebut.
- Praktik rotasi klub adalah lokal. Fakta bahwa beberapa klub memakai one game to 11, set, first-to-five, atau 10-minute round justru menunjukkan bahwa policy harus configurable.
- Bukti Playtomic lebih kuat untuk alur open match, level, payment, dan refund, tetapi platform tersebut terutama mendokumentasikan tennis dan padel. Jangan menganggap aturan itu otomatis cocok untuk badminton, table tennis, atau squash.
- Sumber lokal Indonesia memperlihatkan praktik nyata, tetapi belum cukup untuk menentukan angka default nasional.

## Requirement backlog untuk codebase ini

Prioritas di bawah adalah requirement produk, bukan daftar perubahan kode yang harus langsung dikerjakan.

### P0: agar klaim all-sport Club Session valid

#### R1. Play Profile per olahraga

Setiap sesi memilih profile yang menyimpan:

- sport;
- format: singles, doubles, mixed doubles, atau format komunitas lain;
- jumlah pemain per game dan kapasitas per court atau table;
- unit rotasi: game, set, poin, atau menit;
- aturan turun: everyone-off, winner-stays, challenge, atau organizer assignment;
- batas warm-up;
- mode skill: casual, all-level, atau level band.

Acceptance criteria:

- Badminton, pickleball, tennis, dan padel tidak otomatis dipaksa ke profile yang sama hanya karena semuanya dapat dimainkan doubles.
- Squash dapat membuat queue dua pemain per court tanpa membuat dua tim kosong.
- Table tennis dapat menjalankan ronde singkat tanpa memalsukan satu ronde sebagai Match doubles empat orang.
- Profile yang dipilih terlihat pada detail sesi dan tidak berubah diam-diam setelah match pertama dimulai.

#### R2. RSVP, kapasitas, waitlist, dan check-in

Tambahkan lifecycle peserta: invited, waitlisted, confirmed, checked_in, late, resting, absent, dan left.

Acceptance criteria:

- Sesi mempunyai kapasitas yang berasal dari jumlah court atau table dan profile.
- Pemain dapat melihat posisi waitlist dan batas waktu claim.
- Organizer dapat memindahkan pemain waitlist untuk mengganti no-show, dengan audit trail.
- Pemain yang belum check-in tidak dipakai Smart Rotation tanpa konfirmasi organizer.

#### R3. Rotation policy yang dapat dijelaskan

Smart Rotation harus memilih kandidat berdasarkan policy sesi, bukan hanya match count.

Minimum metrik:

- jumlah game atau ronde, bukan hanya jumlah Match;
- waktu sejak terakhir bermain dan total waktu menunggu;
- jumlah kali duduk atau tidak mendapat slot;
- pengulangan partner dan lawan;
- kecocokan level dengan mode sesi;
- status late, resting, unavailable, dan absent;
- court atau table yang kosong.

Acceptance criteria:

- Board selalu menampilkan “mengapa pemain ini dipilih” dan “mengapa pemain itu menunggu”.
- Organizer dapat memilih override manual tanpa merusak histori fairness.
- Policy winner-stays tidak boleh digunakan saat sesi memilih everyone-off.

#### R4. Format Match yang tidak hardcode empat player IDs

Model Match dan queue perlu memisahkan:

- peserta sebagai list;
- side atau team bila olahraga membutuhkannya;
- court atau table;
- ronde atau slot waktu;
- status queue;
- result dan unit skor.

Ini adalah gap terpenting pada model sebelum slice Play Profile. ClubSessionMatch dan planner saat itu masih menggunakan tuple empat pemain dan dua pasangan. Implementasi sekarang sudah memisahkan jumlah peserta lewat Play Profile untuk singles squash dan table tennis, tetapi fairness berbasis waktu dan rotasi peserta yang menunggu di luar satu Match masih perlu pilot.

#### R5. Aturan masuk dan hasil yang eksplisit

Detail sesi perlu memuat venue, waktu mulai dan selesai, biaya atau catatan patungan, equipment yang dibawa venue, skill range, mode casual atau competitive, cancellation deadline, dan apakah walk-in diterima.

Acceptance criteria:

- Pemain dapat memutuskan ikut tanpa membuka WhatsApp untuk mencari aturan dasar.
- Perubahan venue, waktu, kapasitas, atau policy tercatat dan terlihat oleh peserta.
- Hasil casual tidak diperlakukan sebagai ranking competitive kecuali organizer memilihnya.

### P1: mengurangi beban organizer dan konflik sosial

#### R6. Live board untuk pemain dan organizer

Board harus menampilkan court atau table yang sedang aktif, queue berikutnya, waktu tunggu, peserta yang check-in, dan aturan rotasi. Organizer tetap menjadi pengambil keputusan, tetapi tidak perlu menghitung dari kertas atau chat.

#### R7. No-show, late arrival, dan replacement

Tambahkan cutoff check-in, reminder, tombol “saya terlambat”, dan replacement yang dapat disetujui organizer. Replacement harus menjaga format dan level profile.

#### R8. Onboarding pemain baru

Saat join, tampilkan apakah boleh solo, apakah pasangan akan diacak, level yang diharapkan, siapa yang menyambut, dan aturan conduct. Ini penting untuk open play yang ingin mengundang pemain baru, bukan hanya grup lama.

#### R9. Fairness report setelah sesi

Tampilkan total ronde, waktu bermain, waktu menunggu, jumlah sitting-out, partner dan lawan yang ditemui, serta jumlah override organizer. Jangan jadikan standings menang-kalah sebagai satu-satunya ukuran keberhasilan.

#### R10. Fee dan settlement yang minimal

Tanpa harus langsung membuat payment gateway, simpan jumlah fee, status dibayar atau belum, deadline pembatalan, dan catatan pembagian court, shuttle, ball, atau rental equipment.

### P2: setelah pola dasar tervalidasi

#### R11. Discovery dan recurring session

Sediakan sesi berulang, pencarian berdasarkan lokasi dan waktu, share link, dan daftar komunitas. Privacy default tetap harus melindungi roster dan hasil dari Live Viewer.

#### R12. Multi-organizer dan role

Tambahkan co-host atau operator hanya jika pilot menunjukkan satu owner terlalu membatasi. Pisahkan hak mengubah roster, mengubah policy, menutup sesi, dan melihat data pribadi.

#### R13. Integrasi booking venue

Integrasikan booking court atau table setelah diketahui bahwa konflik jadwal dan kapasitas memang menjadi hambatan terbesar. Open play marketplace seperti Playtomic menunjukkan bahwa court dapat dikonfirmasi belakangan berdasarkan jumlah peserta dan waktu, sehingga integrasi harus mengakomodasi status pending.

#### R14. Riwayat lintas sesi dan reputasi

Pertimbangkan attendance reliability atau feedback hanya setelah model privacy dan consent siap. Jangan menjadikan hasil mabar santai sebagai ranking default.

## Pemetaan ke codebase saat ini

Yang sudah tersedia dan dapat dipertahankan:

- ClubSessionSport sudah memuat enam olahraga di [clubSessionManagement.ts](../../apps/web/src/features/club-sessions/clubSessionManagement.ts).
- Form create sudah menyediakan keenam pilihan sport di [ClubSessionsPage.tsx](../../apps/web/src/features/club-sessions/ClubSessionsPage.tsx).
- Player sudah punya availability, skill level, gender, dan avoid-player preference. Ini adalah fondasi R3, tetapi belum menggantikan RSVP dan check-in.
- Smart Rotation sudah memiliki fairness berbasis match count, wait, pengulangan pairing, dan skill sebagai tie-breaker. Requirement baru harus memperluas unit fairness ke ronde atau menit, bukan membuang penjelasan yang sudah ada.
- Play Profile sudah menentukan format, jumlah peserta, unit rotasi, dan profil short-round table tennis. Countdown membaca `started_at` Match dan memberi cue pergantian pemain tanpa menghentikan skor otomatis.
- RLS dan session ownership sudah cocok untuk organizer-led private session. Discovery publik, waitlist publik, dan roster publik harus dianggap sebagai perluasan privacy yang terpisah.

Sisa gap yang harus diprioritaskan:

- Profile saat ini masih memilih default per sport. Belum ada pilihan unit rotasi, capacity, venue, waktu, fee, walk-in, atau policy winner-stays versus everyone-off di UI.
- Availability saat ini bukan lifecycle kehadiran. late, resting, dan unavailable tidak sama dengan confirmed, checked-in, absent, atau waitlisted.
- Migration Play Profile sudah menyimpan format dan profile ID, tetapi belum menyimpan policy per sport, capacity, RSVP, payment, check-in, atau rotation event.
- Standings berbasis completed Match tetap berguna untuk competitive mode, tetapi tidak boleh menjadi laporan fairness utama untuk open play.

## Usulan urutan validasi pilot

1. Jalankan satu sesi badminton doubles dan satu sesi pickleball open play dengan jumlah peserta yang lebih besar daripada kapasitas court.
2. Jalankan satu sesi table tennis short-round dan satu sesi squash singles. Tujuannya memaksa model keluar dari asumsi empat pemain.
3. Minta organizer memilih policy sebelum sesi: unit ronde, aturan turun, level mode, warm-up, no-show cutoff, dan apakah walk-in diterima.
4. Catat setiap manual correction: siapa diganti, berapa lama menunggu, mengapa pairing diubah, dan kapan aturan diperdebatkan.
5. Tanyakan setelah sesi: “Kapan Anda merasa sistem tidak adil?”, “Apa yang masih harus ditanyakan lewat WhatsApp?”, dan “Apakah Anda akan memakai profile ini lagi tanpa spreadsheet atau kertas?”

Success measure pilot:

- semua peserta tahu giliran berikutnya tanpa bertanya ke organizer;
- tidak ada peserta yang menunggu tanpa status;
- organizer dapat menjelaskan setiap override;
- pemain baru dapat ikut tanpa pasangan dan tanpa merasa salah level;
- setiap olahraga dapat berjalan dengan policy yang sesuai formatnya.

## Sumber

### Sumber primer atau first-party

- [Badminton England, Club Programme Guide](https://www.badmintonengland.co.uk/wp-content/uploads/2021/10/Club-Programme-Guide.pdf)
- [Badminton England, Return to Play guide for universities and colleges](https://www.badmintonengland.co.uk/wp-content/uploads/2021/02/rtp-universities-colleges-v2.pdf)
- [Badminton England, No Strings Play](https://www.badmintonengland.co.uk/play/)
- [USA Pickleball, Sportsmanship Guide](https://usapickleball.org/sportsmanship-guide/)
- [USA Pickleball, Recreational Programs Guide](https://usapickleball.org/wp-content/uploads/2023/03/usap-rec-programs-guide-march-2023.pdf)
- [Mold Lawn Tennis Club, Social Tennis](https://clubspark.lta.org.uk/MoldLTC/SocialTennis)
- [South Hampstead Tennis Club, Social Tennis](https://clubspark.lta.org.uk/southhampsteadtennisclub/PlayTennis/SocialTennis)
- [Abergavenny Tennis Club, Social Mix-In](https://clubspark.lta.org.uk/abergavennytennisclub/SocialMixIn)
- [Bovingdon and Flaunden Tennis Club, Social Tennis](https://clubspark.lta.org.uk/bovingdonflaundentennisclub/PLAY)
- [Table Tennis England, Waterside Table Tennis Club](https://www.tabletennisengland.co.uk/ping-tables/waterside-table-tennis-club/)
- [Table Tennis England, Wesley Buildings Redruth](https://www.tabletennisengland.co.uk/ping-tables/wesley-buildings-redruth/)
- [England Squash, Hythe Cricket & Squash Club](https://www.englandsquash.com/finder/club/hythe-cricket-squash-club/483)
- [England Squash, Letchworth Sports and Tennis Club](https://www.englandsquash.com/finder/club/letchworth-sports-and-tennis-club/543)
- [Playtomic Help, book a court or spot in an Open Match](https://playerhelp.playtomic.com/hc/en-gb/articles/19831715222929-How-to-book-a-court-or-a-spot-in-a-match-in-your-favourite-Club)
- [Playtomic Manager, configure Open Matches](https://helpmanager.playtomic.com/hc/en-gb/articles/20535035123473-How-to-configure-Open-Matches-at-your-Club)
- [Playtomic Manager, casual versus competitive Open Matches](https://helpmanager.playtomic.com/hc/en-gb/articles/20535188135185-Casual-vs-Competitive-Open-Matches)
- [OpenSports, waitlist guide](https://opensports.net/blog/what-to-expect-from-the-waitlist-guide-for-players-app--web)
- [OpenSports, product changelog](https://opensports.net/changelog)
- [Daly Pickleball Ubud, Open Play](https://www.dalypickleball.com/)
- [Reclub, Temen Maen Pickleball](https://discover.reclub.co/discover/indonesia/club/temenmaenpickleball)
- [Reclub, Sports Plaza Pickleball](https://reclub.co/id/clubs/%40sports-plaza-pickleball)
- [PickleBali Open Play event listing](https://megatix.co.id/events/picklebali-open-play-monday-funday-02)

### Sumber komunitas dan keluhan, dipakai sebagai sinyal anekdotal

- [Badminton user report: no court rotation and long waits](https://www.reddit.com/r/badminton/comments/edmobz/free_play_badminton_at_my_local_citys_sport/)
- [Pickleball user report: court hoarding during public play](https://www.reddit.com/r/Pickleball/comments/1v3jna6/how_do_you_deal_with_players_hogging_public/)
- [Pickleball user report: long warm-up while others wait](https://www.reddit.com/r/Pickleball/comments/1l4x38b/is_it_rude_to_warm_up_forever_during_open_play/)
- [Table tennis user discussion: over-capacity sessions and challenge systems](https://www.reddit.com/r/tabletennis/comments/1ovjbw7/how_do_your_clubs_manage_sessions_when_you_have/)
- [Squash user question: uncertainty about joining a first club night](https://www.reddit.com/r/squash/comments/1sz51z2/ive_just_joined_my_local_squash_club_what_can_i/)
- [Tennis user discussion: disagreement over court rotation timing](https://www.reddit.com/r/10s/comments/1mdqrsh/tennis_court_argumentetiquette)
