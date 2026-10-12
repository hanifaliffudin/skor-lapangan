import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "id" | "en";

const messages = {
  id: {
    appName: "Skor Lapangan",
    seoTitle:
      "Papan Skor Badminton, Pickleball, Tennis & Padel | Skor Lapangan",
    seoDescription:
      "Catat skor tunggal atau ganda badminton, pickleball, tenis, dan padel dari ponsel. Pantau servis, koreksi poin, lalu bagikan tautan skor langsung.",
    tagline: "Papan skor untuk badminton, pickleball, tenis, dan padel",
    intro:
      "Catat skor tunggal atau ganda dari ponsel. Pantau servis dan posisi pemain, lalu bagikan skor langsung lewat tautan viewer.",
    chooseSport: "Pilih olahraga",
    chooseFormat: "Pilih format permainan",
    badminton: "Badminton",
    pickleball: "Pickleball",
    tennis: "Tenis",
    padel: "Padel",
    badmintonHint: "Skor reli dan servis",
    pickleballHint: "Servis, reli, dan posisi lapangan",
    tennisHint: "Skor game, set, servis, dan tie-break",
    padelHint: "Skor game, servis, penerima, dan tie-break FIP",
    singles: "Tunggal",
    doubles: "Ganda",
    mixedDoubles: "Ganda campuran",
    mixed_doubles: "Ganda campuran",
    singlesHint: "1 pemain per sisi",
    padelSingles: "Tunggal klub",
    padelSinglesHint: "Varian lokal 6 × 20 m, skor turunan FIP",
    doublesHint: "2 pemain per sisi",
    mixedDoublesHint: "1 putri dan 1 putra per sisi",
    tennisFormatTitle: "Format tenis · aturan ITF 2026",
    tennisRulesSource: "Pilih format yang diumumkan untuk pertandingan ini.",
    tennisGameScoring: "Skor game",
    tennisAdvantage: "Advantage",
    tennisNoAd: "No-ad",
    tennisSetScoring: "Set sebelum set penentu",
    tennisTiebreakSet: "Tie-break pada 6–6",
    tennisAdvantageSet: "Advantage set, unggul dua game",
    tennisFinalSet: "Set penentu",
    tennisMatchTiebreak: "Match tie-break menggantikan set",
    tennisMatchTiebreakTarget: "Target match tie-break",
    padelFormatTitle: "Format padel · aturan FIP 2026",
    padelRulesSource:
      "Best of three set. Pilih sistem skor yang diumumkan untuk laga ini.",
    padelLocalFormatTitle: "Format tunggal klub · varian lokal",
    padelLocalRulesSource:
      "FIP tidak mengatur nomor tunggal. Skor ini turunan FIP dan tidak resmi.",
    padelGameScoring: "Skor game",
    padelAdvantage: "Advantage",
    padelStarPoint: "Star Point",
    padelGoldenPoint: "Golden Point",
    padelSetScoring: "Format dua set pertama",
    padelStandardSet: "Set standar · tie-break pada 6–6",
    padelMiniSet: "Mini-set empat game · tie-break pada 4–4",
    padelFinalSet: "Set penentu",
    padelAdvantageSet: "Advantage set · unggul dua game",
    padelMatchTiebreak: "Match tie-break menggantikan set",
    padelMatchTiebreakTarget: "Target match tie-break",
    padelOrdersTitle: "Urutan servis dan penerima padel",
    padelOrdersIntro:
      "Di nomor ganda, pasangan memilih server pertama dan penerima deuce tiap set. Urutan dapat diubah sebelum set berikutnya.",
    padelFirstServingTeam: "Tim yang servis lebih dulu",
    padelFirstServer: "Pemain pertama yang servis untuk tim ini",
    padelFirstReceiver: "Pemain pertama yang menerima servis deuce",
    padelDecidingPoint: "Poin penentu",
    padelMixedRolesLocalOnly:
      "Label peran untuk aturan penerima campuran ini hanya disimpan di perangkat pengendali.",
    padelCourtNote: "Lapangan ganda 10 × 20 m · tunggal klub 6 × 20 m",
    pointsByTwo: "poin, unggul dua",
    tennisOrdersTitle: "Urutan servis dan penerima",
    tennisOrdersIntro:
      "Urutan ganda tetap selama satu set. Tim dapat mengubahnya sebelum set berikutnya.",
    tennisFirstServingTeam: "Tim yang servis lebih dulu",
    tennisPairFirstServer: "Pemain yang servis lebih dulu untuk tim ini",
    tennisDeuceReceiver: "Penerima dari sisi deuce",
    mixedRolesTitle: "Peran ganda campuran",
    mixedRolesLocalOnly:
      "Peran ini hanya disimpan di perangkat pengendali pertandingan.",
    mixedRolesRequired:
      "Ganda campuran memerlukan satu pemain putri dan satu pemain putra di setiap tim.",
    woman: "Putri",
    man: "Putra",
    sideOutStandard: "Side-out standar",
    casual: "Kasual",
    referee: "Wasit",
    continue: "Lanjut atur pemain",
    guestNote:
      "Pertandingan guest tersimpan di perangkat ini. Jika sinkronisasi server tersedia, data yang tersinkron kedaluwarsa setelah 12 jam tanpa aktivitas (maksimal 24 jam).",
    installApp: "Pasang Skor Lapangan",
    installToHomeScreen: "Tambahkan ke Layar Utama",
    installOnIosInstructions:
      "Di Safari, ketuk Bagikan, lalu pilih Tambahkan ke Layar Utama.",
    pwaUpdateReady: "Pembaruan aplikasi tersedia.",
    pwaUpdateButton: "Perbarui aplikasi",
    resumeTitle: "Pertandingan aktif di perangkat ini",
    resumeBody: "Lanjutkan pertandingan tamu yang belum selesai.",
    resumeMatch: "Lanjutkan pertandingan",
    deleteMatch: "Hapus",
    deleteMatchPromptGroup: "Konfirmasi hapus pertandingan",
    deleteMatchConfirm:
      "Hapus pertandingan ini dari perangkat? Salinan yang tersinkron tetap tersedia sampai kedaluwarsa.",
    confirmDeleteMatch: "Hapus dari perangkat",
    matchDeleted: "Pertandingan dihapus dari perangkat ini.",
    back: "Kembali",
    setupTitle: "Siapa yang bermain?",
    setupIntro:
      "Nama boleh dikosongkan. Kami akan memakai label pemain otomatis.",
    teamA: "Tim A",
    teamB: "Tim B",
    player1: "Pemain 1",
    player2: "Pemain 2",
    firstServer: "Servis pertama",
    startMatch: "Mulai pertandingan",
    game: "Game",
    set: "Set",
    games: "Game dalam set",
    tieBreak: "Tie-break",
    matchTieBreak: "Match tie-break",
    deuce: "Deuce",
    advantageScore: "Ad",
    awaitingSetOrders: "Konfirmasi urutan sebelum set berikutnya",
    confirmSetOrders: "Mulai set",
    setOrdersHint:
      "Konfirmasi atau ubah server pertama dan penerima deuce untuk masing-masing pasangan.",
    decidingPoint: "Poin penentu no-ad",
    receiveFrom: "Terima servis dari sisi",
    courtEnds: "Ujung lapangan bertukar",
    correctionGameScore: "Koreksi skor game aktif",
    correctionTieBreakScore: "Koreksi skor tie-break aktif",
    serves: "servis",
    server: "Server",
    right: "kanan",
    left: "kiri",
    pointFor: "Poin untuk",
    rallyFor: "Reli dimenangkan",
    undo: "Undo",
    redo: "Redo",
    correction: "Koreksi skor",
    correctionHint:
      "Perubahan ini disimpan sebagai satu event. Posisi server disesuaikan otomatis.",
    save: "Simpan koreksi",
    endSession: "Akhiri sesi",
    endTitle: "Akhiri pertandingan ini?",
    endBody:
      "Salinan di perangkat ini akan dihapus. Data server pertandingan guest tidak dapat diakses setelah kedaluwarsa, dan tautan viewer dicabut.",
    cancel: "Batal",
    confirmEnd: "Ya, akhiri",
    missingTitle: "Pertandingan tidak ditemukan",
    missingBody: "Sesi mungkin sudah ditutup atau data tab telah dibersihkan.",
    newMatch: "Mulai pertandingan baru",
    matchComplete: "Pertandingan selesai",
    winner: "Pemenang",
    sets: "Game menang",
    tennisSets: "Set",
    completedSets: "Set selesai",
    tennisPointWon: "Poin tenis dimenangkan",
    padelPointWon: "Poin padel dimenangkan",
    padelLocalVariant: "Tunggal klub · varian lokal",
    padelAwaitingOrders: "Konfirmasi urutan set ini",
    padelStarStage: "Tahap Star Point",
    padelDeuceStage: "Deuce",
    officialRules: "Official Rules",
    officialHint: "Aturan standar federasi, dikunci",
    rulesTitle: "Aturan pertandingan",
    customRules: "Aturan khusus untuk pertandingan ini",
    customRulesNotice:
      "Aturan ini hanya berlaku untuk pertandingan tamu ini. Konfigurasinya tetap di perangkat ini dan tidak dipublikasikan.",
    pointsToWin: "Poin untuk menang",
    winBy: "Menang dengan selisih",
    maxPoints: "Batas poin (opsional)",
    bestOf: "Jumlah game",
    bestOfOne: "Satu game",
    bestOfThree: "Best of three",
    bestOfFive: "Best of five",
    scoringMode: "Sistem skor",
    rallyScoring: "Setiap reli menghasilkan poin",
    sideOutScoring: "Hanya tim servis yang mendapat poin",
    serversPerTurn: "Pemain servis sebelum pindah servis",
    openingServerNumber: "Nomor server pertama",
    serverOne: "Server 1",
    serverTwo: "Server 2",
    officialLocked: "Aturan federasi terkunci",
    matchCustomRules: "Custom rules, match ini saja",
    communityRules: "Community Rules",
    rulesUnofficial: "Tidak resmi",
    capMustBeAtLeastTarget:
      "Batas poin harus sama atau lebih besar dari target.",
    saveHistory: "Simpan riwayat dengan Google",
    signOut: "Keluar",
    historySaved: "Riwayat tersimpan",
    syncSaved: "Tersinkron ke server",
    syncLocal: "Tersimpan di perangkat ini",
    syncing: "Menyinkronkan…",
    syncOffline: "Offline · perubahan tersimpan di perangkat",
    syncError: "Gagal menyinkronkan · data masih tersimpan di perangkat",
    syncUnsupportedSport:
      "Server belum mendukung olahraga ini. Skor tetap tersimpan di perangkat.",
    retrySync: "Coba sinkronkan lagi",
    guestSignInError: "Sinkronisasi guest ke server tidak bisa dimulai:",
    retryGuestSync: "Coba sambungkan guest lagi",
    guestCaptchaPrompt:
      "Selesaikan hCaptcha untuk menyambungkan sinkronisasi guest.",
    guestCaptchaMissing:
      "hCaptcha wajib diisi, tetapi site key belum tersedia. Tambahkan VITE_HCAPTCHA_SITE_KEY ke environment dan mulai ulang aplikasi.",
    captchaLoadError:
      "hCaptcha tidak dapat dimuat. Periksa koneksi dan pengaturan domain site key.",
    matchControlWaiting:
      "Menunggu giliran mengendalikan pertandingan ini. Halaman akan bisa digunakan saat kontrol tersedia.",
    matchControlError: "Tidak bisa mengambil kontrol pertandingan ini.",
    retryControl: "Coba lagi",
    liveViewer: "Live Viewer",
    liveViewerDescription:
      "Tautan hanya menampilkan skor, posisi, dan server. Tautan kedaluwarsa bersama data pertandingan.",
    createViewerLink: "Buat tautan viewer",
    revokeViewerLink: "Cabut tautan",
    viewerLink: "Tautan viewer",
    copyLink: "Salin tautan",
    linkCopied: "Tautan disalin.",
    copyFailed: "Tidak bisa menyalin tautan. Pilih dan salin teksnya.",
    shareReady:
      "Tautan viewer aktif. Bagikan hanya kepada orang yang Anda percaya.",
    shareRevoked: "Tautan viewer sudah dicabut.",
    shareFailed: "Gagal membuat tautan viewer.",
    working: "Memproses…",
    selectCommunityRules: "Pilih Community Rules",
    noCommunityRules:
      "Belum ada aturan komunitas yang dipublikasikan untuk olahraga ini.",
    loadRuleError: "Aturan ini tidak dapat dimuat. Coba pilih aturan lain.",
    viewerTitle: "Skor pertandingan langsung",
    viewerLoading: "Mengambil skor terbaru…",
    viewerUnavailable: "Tautan viewer tidak tersedia",
    viewerUnavailableBody:
      "Tautan mungkin dicabut, kedaluwarsa, atau tidak valid.",
    viewerStale: "Terakhir tersinkron",
    viewerLive: "Live",
    updatedAt: "diperbarui",
    score: "Skor",
    communityLibraryTitle: "Aturan komunitas",
    communityLibraryIntro:
      "Jelajahi aturan buatan komunitas. Setiap aturan diberi label tidak resmi.",
    communityDisclaimer:
      "Community Rules tidak resmi dan dikelola pembuatnya. Periksa dulu dengan grup Anda sebelum bermain; gunakan dengan risiko sendiri.",
    createCommunityRule: "Buat Community Rules",
    backendNotConfigured:
      "Supabase belum dikonfigurasi untuk aturan komunitas.",
    loading: "Memuat…",
    noCommunityRulesYet: "Belum ada aturan publik",
    noCommunityRulesBody:
      "Aturan komunitas yang dipublikasikan akan muncul di sini.",
    unofficial: "Tidak resmi",
    unpublished: "Tidak dipublikasikan",
    noRuleDescription: "Tidak ada deskripsi.",
    backToRules: "Kembali ke Community Rules",
    ruleUnavailable: "Aturan tidak tersedia",
    ruleUnavailableBody:
      "Tautan mungkin salah, aturan telah dicabut, atau Anda tidak punya akses.",
    version: "Versi",
    useTheseRules: "Gunakan aturan ini",
    shareCommunityRule: "Bagikan aturan",
    shareCommunityRuleBody:
      "Bagikan tautan atau biarkan grup memindai QR code untuk membuka aturan ini.",
    qrCode: "QR code aturan komunitas",
    editRule: "Edit Community Rules",
    unpublishRule: "Tarik publikasi",
    reportRule: "Laporkan aturan",
    reportReason: "Alasan",
    reportIncorrect: "Informasi atau skor tidak akurat",
    reportMisleading: "Menyesatkan",
    reportUnsafe: "Berisiko atau tidak aman",
    reportSpam: "Spam",
    reportRights: "Hak cipta atau hak lainnya",
    reportOther: "Lainnya",
    reportDetails: "Detail (opsional)",
    reportContact: "Email untuk tindak lanjut (opsional)",
    reportContactHint:
      "Hanya digunakan jika peninjau perlu menghubungi Anda tentang laporan ini.",
    reportReviewNote:
      "Laporan ditinjau manual dan tidak otomatis menyembunyikan aturan.",
    reportSessionRequired: "Menyiapkan sesi guest yang aman…",
    submitReport: "Kirim laporan",
    reportSubmitted: "Laporan diterima.",
    rateLimited: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.",
    saveFailed: "Tidak dapat menyimpan perubahan.",
    ruleUnpublished: "Aturan ini tidak lagi tampil di direktori publik.",
    notRuleOwner: "Hanya pembuat aturan yang dapat mengeditnya.",
    googleRequired: "Masuk dengan Google untuk menerbitkan aturan.",
    googleRequiredBody:
      "Aturan komunitas hanya bisa diterbitkan dan dikelola oleh akun Google.",
    ruleTitle: "Nama aturan",
    sport: "Olahraga",
    ruleDescription: "Deskripsi",
    publishNowNote:
      "Aturan langsung dipublikasikan dan dapat dibagikan. Semua aturan komunitas berlabel tidak resmi.",
    publishRule: "Publikasikan aturan",
    noCap: "Tanpa batas",
    shareLink: "Bagikan tautan",
    matchHistory: "Riwayat pertandingan",
    historyIntro:
      "Skor dan status pertandingan yang tersinkron ke akun Google Anda.",
    historyRequiresGoogle:
      "Masuk dengan Google untuk melihat pertandingan tersimpan. Guest tetap bisa bermain tanpa akun.",
    noSavedMatches: "Belum ada pertandingan tersimpan",
    noSavedMatchesBody:
      "Mulai pertandingan saat koneksi aktif, atau sambungkan akun Google Anda.",
    activeMatch: "Sedang berlangsung",
    lastUpdated: "Terakhir diperbarui:",
    openOnThisDevice: "Buka di perangkat ini",
    detailsOnOriginalDevice: "Detail lengkap hanya tersedia di perangkat asal.",
    backToHome: "Kembali ke beranda",
  },
  en: {
    appName: "Skor Lapangan",
    seoTitle:
      "Badminton, Pickleball, Tennis & Padel Scoreboard | Skor Lapangan",
    seoDescription:
      "Keep score for badminton, pickleball, tennis, and padel singles or doubles from your phone. Track service, correct points, and share a live viewer link.",
    tagline: "Scoreboards for badminton, pickleball, tennis, and padel",
    intro:
      "Keep score for singles or doubles on your phone. Track service and court positions, then share the live score with a viewer link.",
    chooseSport: "Choose a sport",
    chooseFormat: "Choose match format",
    badminton: "Badminton",
    pickleball: "Pickleball",
    tennis: "Tennis",
    padel: "Padel",
    badmintonHint: "Rally scoring and service",
    pickleballHint: "Service, rallies, and court positions",
    tennisHint: "Track games, sets, service, and tie-breaks",
    padelHint: "Track games, service, receivers, and FIP tie-breaks",
    singles: "Singles",
    doubles: "Doubles",
    mixedDoubles: "Mixed doubles",
    mixed_doubles: "Mixed doubles",
    singlesHint: "1 player per side",
    padelSingles: "Club singles",
    padelSinglesHint: "Local 6 × 20 m variant with FIP-derived scoring",
    doublesHint: "2 players per side",
    mixedDoublesHint: "1 woman and 1 man per side",
    tennisFormatTitle: "Tennis format · 2026 ITF rules",
    tennisRulesSource: "Choose the format announced for this match.",
    tennisGameScoring: "Game scoring",
    tennisAdvantage: "Advantage",
    tennisNoAd: "No-ad",
    tennisSetScoring: "Sets before the deciding set",
    tennisTiebreakSet: "Tie-break at 6–6",
    tennisAdvantageSet: "Advantage set, win by two games",
    tennisFinalSet: "Deciding set",
    tennisMatchTiebreak: "Match tie-break replaces the set",
    tennisMatchTiebreakTarget: "Match tie-break target",
    padelFormatTitle: "Padel format · 2026 FIP rules",
    padelRulesSource:
      "Best of three sets. Choose the scoring method announced for this match.",
    padelLocalFormatTitle: "Club singles format · local variant",
    padelLocalRulesSource:
      "FIP does not define singles. This is an unofficial FIP-derived scoring option.",
    padelGameScoring: "Game scoring",
    padelAdvantage: "Advantage",
    padelStarPoint: "Star Point",
    padelGoldenPoint: "Golden Point",
    padelSetScoring: "First two set format",
    padelStandardSet: "Standard set · tie-break at 6–6",
    padelMiniSet: "Four-game mini-set · tie-break at 4–4",
    padelFinalSet: "Deciding set",
    padelAdvantageSet: "Advantage set · win by two games",
    padelMatchTiebreak: "Match tie-break replaces the set",
    padelMatchTiebreakTarget: "Match tie-break target",
    padelOrdersTitle: "Padel service and receiving order",
    padelOrdersIntro:
      "In doubles, pairs choose their first server and deuce-court receiver for each set. Orders can change before the next set.",
    padelFirstServingTeam: "Team serving first",
    padelFirstServer: "Player who serves first for this team",
    padelFirstReceiver: "Player who first receives deuce-court serves",
    padelDecidingPoint: "Deciding point",
    padelMixedRolesLocalOnly:
      "Mixed receiver-role labels stay on the device controlling the match.",
    padelCourtNote: "FIP doubles court 10 × 20 m · club singles 6 × 20 m",
    pointsByTwo: "points, win by two",
    tennisOrdersTitle: "Service and receiving order",
    tennisOrdersIntro:
      "Doubles orders stay fixed for a set. Teams can change them before the next set.",
    tennisFirstServingTeam: "Team serving first",
    tennisPairFirstServer: "Player who serves first for this team",
    tennisDeuceReceiver: "Deuce-court receiver",
    mixedRolesTitle: "Mixed-doubles roles",
    mixedRolesLocalOnly:
      "These roles stay on the device controlling the match.",
    mixedRolesRequired:
      "Mixed doubles needs one woman and one man on each team.",
    woman: "Woman",
    man: "Man",
    sideOutStandard: "Standard side-out",
    casual: "Casual",
    referee: "Referee",
    continue: "Continue to player setup",
    guestNote:
      "Guest matches stay on this device. If server sync is available, synced data expires after 12 hours without activity (24-hour maximum).",
    installApp: "Install Skor Lapangan",
    installToHomeScreen: "Add to Home Screen",
    installOnIosInstructions:
      "In Safari, tap Share, then choose Add to Home Screen.",
    pwaUpdateReady: "An app update is ready.",
    pwaUpdateButton: "Update app",
    resumeTitle: "Active matches on this device",
    resumeBody: "Continue an unfinished guest match.",
    resumeMatch: "Resume match",
    deleteMatch: "Delete",
    deleteMatchPromptGroup: "Confirm match deletion",
    deleteMatchConfirm:
      "Remove this match from this device? Any synced copy remains available until it expires.",
    confirmDeleteMatch: "Remove from device",
    matchDeleted: "Match removed from this device.",
    back: "Back",
    setupTitle: "Who is playing?",
    setupIntro:
      "Names are optional. We will use automatic player labels when blank.",
    teamA: "Team A",
    teamB: "Team B",
    player1: "Player 1",
    player2: "Player 2",
    firstServer: "First server",
    startMatch: "Start match",
    game: "Game",
    set: "Set",
    games: "Games in set",
    tieBreak: "Tie-break",
    matchTieBreak: "Match tie-break",
    deuce: "Deuce",
    advantageScore: "Ad",
    awaitingSetOrders: "Confirm the order before the next set",
    confirmSetOrders: "Start set",
    setOrdersHint:
      "Confirm or change each pair’s first server and deuce-court receiver.",
    decidingPoint: "No-ad deciding point",
    receiveFrom: "Receive from the",
    courtEnds: "Court ends changed",
    correctionGameScore: "Correct active game score",
    correctionTieBreakScore: "Correct active tie-break score",
    serves: "serves",
    server: "Server",
    right: "right",
    left: "left",
    pointFor: "Point for",
    rallyFor: "Rally won by",
    undo: "Undo",
    redo: "Redo",
    correction: "Correct score",
    correctionHint:
      "This change is stored as one event. Server position adjusts automatically.",
    save: "Save correction",
    endSession: "End session",
    endTitle: "End this match?",
    endBody:
      "This device copy will be removed. Guest match data becomes inaccessible after expiry, and the viewer link is revoked.",
    cancel: "Cancel",
    confirmEnd: "Yes, end it",
    missingTitle: "Match not found",
    missingBody:
      "The session may have ended or this tab's data may have been cleared.",
    newMatch: "Start a new match",
    matchComplete: "Match complete",
    winner: "Winner",
    sets: "Games won",
    tennisSets: "Sets",
    completedSets: "Completed sets",
    tennisPointWon: "Tennis point won by",
    padelPointWon: "Padel point won by",
    padelLocalVariant: "Club singles · local variant",
    padelAwaitingOrders: "Confirm this set’s orders",
    padelStarStage: "Star Point stage",
    padelDeuceStage: "Deuce",
    officialRules: "Official Rules",
    officialHint: "Locked federation-standard rules",
    rulesTitle: "Match rules",
    customRules: "Custom rules for this match",
    customRulesNotice:
      "These rules apply only to this guest match. The configuration stays on this device and is not published.",
    pointsToWin: "Points to win",
    winBy: "Win by",
    maxPoints: "Point cap (optional)",
    bestOf: "Games per match",
    bestOfOne: "One game",
    bestOfThree: "Best of three",
    bestOfFive: "Best of five",
    scoringMode: "Scoring system",
    rallyScoring: "A point on every rally",
    sideOutScoring: "Only the serving team scores",
    serversPerTurn: "Servers before side-out",
    openingServerNumber: "Opening server number",
    serverOne: "Server 1",
    serverTwo: "Server 2",
    officialLocked: "Locked federation rules",
    matchCustomRules: "Custom rules for this match only",
    communityRules: "Community Rules",
    rulesUnofficial: "Unofficial",
    capMustBeAtLeastTarget: "The point cap must be at least the target score.",
    saveHistory: "Save history with Google",
    signOut: "Sign out",
    historySaved: "History saved",
    syncSaved: "Synced to server",
    syncLocal: "Saved on this device",
    syncing: "Syncing…",
    syncOffline: "Offline · changes are saved on this device",
    syncError: "Could not sync · this match is still saved on this device",
    syncUnsupportedSport:
      "The server does not support this sport yet. The score is still saved on this device.",
    retrySync: "Retry sync",
    guestSignInError: "Guest cloud sync could not start:",
    retryGuestSync: "Retry guest connection",
    guestCaptchaPrompt: "Complete hCaptcha to connect guest sync.",
    guestCaptchaMissing:
      "hCaptcha is required, but its site key is missing. Add VITE_HCAPTCHA_SITE_KEY to your environment and restart the app.",
    captchaLoadError:
      "hCaptcha could not load. Check your connection and the site key's allowed domains.",
    matchControlWaiting:
      "Waiting to control this match. It becomes editable when control is free.",
    matchControlError: "Could not acquire control of this match.",
    retryControl: "Try again",
    liveViewer: "Live Viewer",
    liveViewerDescription:
      "The link shows score, positions, and server only. It expires with the match data.",
    createViewerLink: "Create viewer link",
    revokeViewerLink: "Revoke link",
    viewerLink: "Viewer link",
    copyLink: "Copy link",
    linkCopied: "Link copied.",
    copyFailed: "Could not copy. Select and copy the text instead.",
    shareReady: "Viewer link is live. Share it only with people you trust.",
    shareRevoked: "Viewer link revoked.",
    shareFailed: "Could not create a viewer link.",
    working: "Working…",
    selectCommunityRules: "Choose Community Rules",
    noCommunityRules: "No published community rules for this sport yet.",
    loadRuleError: "This ruleset could not be loaded. Choose another one.",
    viewerTitle: "Live match score",
    viewerLoading: "Loading the latest score…",
    viewerUnavailable: "Viewer link unavailable",
    viewerUnavailableBody:
      "The link may have been revoked, expired, or be invalid.",
    viewerStale: "Last synced",
    viewerLive: "Live",
    updatedAt: "updated",
    score: "Score",
    communityLibraryTitle: "Community Rules",
    communityLibraryIntro:
      "Browse rules made by the community. Every rule is marked unofficial.",
    communityDisclaimer:
      "Community Rules are unofficial and maintained by their creators. Check them with your group before play; use at your own risk.",
    createCommunityRule: "Create Community Rules",
    backendNotConfigured: "Supabase is not configured for Community Rules.",
    loading: "Loading…",
    noCommunityRulesYet: "No public rules yet",
    noCommunityRulesBody: "Published Community Rules will appear here.",
    unofficial: "Unofficial",
    unpublished: "Unpublished",
    noRuleDescription: "No description provided.",
    backToRules: "Back to Community Rules",
    ruleUnavailable: "Rule unavailable",
    ruleUnavailableBody:
      "The link may be invalid, the rule may have been unpublished, or you may not have access.",
    version: "Version",
    useTheseRules: "Use these rules",
    shareCommunityRule: "Share these rules",
    shareCommunityRuleBody:
      "Share the link or let your group scan the QR code to open this ruleset.",
    qrCode: "Community Rules QR code",
    editRule: "Edit Community Rules",
    unpublishRule: "Unpublish",
    reportRule: "Report this rule",
    reportReason: "Reason",
    reportIncorrect: "Inaccurate information or scoring",
    reportMisleading: "Misleading",
    reportUnsafe: "Risky or unsafe",
    reportSpam: "Spam",
    reportRights: "Copyright or other rights",
    reportOther: "Other",
    reportDetails: "Details (optional)",
    reportContact: "Email for follow-up (optional)",
    reportContactHint:
      "Used only if the reviewer needs to contact you about this report.",
    reportReviewNote:
      "Reports are reviewed manually and do not automatically hide a rule.",
    reportSessionRequired: "Preparing a secure guest session…",
    submitReport: "Submit report",
    reportSubmitted: "Report received.",
    rateLimited: "Too many requests. Please wait a little and try again.",
    saveFailed: "Could not save the change.",
    ruleUnpublished: "This rule is no longer listed publicly.",
    notRuleOwner: "Only the rule creator can edit it.",
    googleRequired: "Sign in with Google to publish rules.",
    googleRequiredBody:
      "Community Rules can only be published and managed by a Google account.",
    ruleTitle: "Rule name",
    sport: "Sport",
    ruleDescription: "Description",
    publishNowNote:
      "Rules publish immediately and can be shared. All Community Rules are labeled unofficial.",
    publishRule: "Publish rules",
    noCap: "No cap",
    shareLink: "Share link",
    matchHistory: "Match history",
    historyIntro: "Scores and match status synced to your Google account.",
    historyRequiresGoogle:
      "Sign in with Google to see saved matches. Guests can still play without an account.",
    noSavedMatches: "No saved matches yet",
    noSavedMatchesBody:
      "Start a match while online, or link your Google account.",
    activeMatch: "In progress",
    lastUpdated: "Last updated:",
    openOnThisDevice: "Open on this device",
    detailsOnOriginalDevice:
      "Full details are only available on the original device.",
    backToHome: "Back to home",
  },
} as const;

type MessageKey = keyof (typeof messages)["id"];

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function localeFromPath(pathname: string): Locale {
  return pathname === "/id" || pathname.startsWith("/id/") ? "id" : "en";
}

export function localizedPath(pathname: string, locale: Locale): string {
  const pathWithoutLocale =
    pathname === "/id" ? "/" : pathname.replace(/^\/id(?=\/)/, "");
  const normalizedPath = pathWithoutLocale || "/";

  if (locale === "id") {
    return normalizedPath === "/" ? "/id/" : `/id${normalizedPath}`;
  }

  return normalizedPath;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() =>
    localeFromPath(window.location.pathname),
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("skor-lapangan:locale", locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key) => messages[locale][key] }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
