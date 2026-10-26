import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const SUPPORTED_LOCALES = ["en", "id"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const localeConfig: Record<Locale, { tag: string; direction: "ltr" | "rtl" }> =
  {
    en: { tag: "en-US", direction: "ltr" },
    id: { tag: "id-ID", direction: "ltr" },
  };

export function localeTag(locale: Locale): string {
  return localeConfig[locale].tag;
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return localeConfig[locale].direction;
}

function validDate(value: Date | number | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(
  value: Date | number | string,
  locale: Locale,
): string {
  const date = validDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(
  value: Date | number | string,
  locale: Locale,
): string {
  const date = validDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatClockTime(
  value: string | null | undefined,
  locale: Locale,
): string {
  if (!value || !/^\d{2}:\d{2}/.test(value)) return "";
  const [hourPart, minutePart] = value.slice(0, 5).split(":");
  const hour = Number(hourPart ?? "");
  const minute = Number(minutePart ?? "");
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "";
  }
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 1, hour, minute)));
}

export function formatDateOnly(value: string, locale: Locale): string {
  const date = validDate(`${value}T00:00:00Z`);
  if (!date) return value;

  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function fillMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

const messages = {
  id: {
    appName: "Skor Lapangan",
    language: "Bahasa",
    theme: "Tampilan",
    themeSystem: "Sistem",
    themeLight: "Terang",
    themeDark: "Gelap",
    primaryNavigation: "Navigasi utama",
    loading: "Memuat…",
    loadingMatch: "Memuat pertandingan…",
    loadingLatestMatch: "Memuat versi terbaru…",
    matchLoadErrorTitle: "Pertandingan belum bisa dibuka",
    matchLoadErrorBody:
      "Periksa koneksi Anda, lalu coba muat ulang pertandingan ini.",
    retryMatchLoad: "Muat ulang pertandingan",
    remoteMatchWarning:
      "Versi server belum bisa divalidasi. Data lokal tetap dipakai. Coba muat ulang setelah sinkronisasi.",
    seoTitle:
      "Papan Skor Badminton, Pickleball, Tennis, Padel, Tenis Meja & Squash | Skor Lapangan",
    seoDescription:
      "Catat skor tunggal atau ganda badminton, pickleball, tenis, padel, tenis meja, dan squash dari ponsel. Pantau servis, koreksi poin, lalu bagikan tautan skor langsung.",
    tagline: "Catat skor olahraga raket",
    sportEyebrow:
      "BADMINTON · PICKLEBALL · TENIS · PADEL · TENIS MEJA · SQUASH",
    intro:
      "Catat skor tunggal atau ganda dari ponsel. Pantau servis, penerima, kotak servis, dan posisi pemain, lalu bagikan skor langsung lewat tautan viewer.",
    chooseSport: "Pilih olahraga",
    chooseFormat: "Pilih format permainan",
    quickStart: "Mulai cepat",
    setupPageTitle: "Penyiapan pertandingan · Skor Lapangan",
    matchPageTitle: "Pertandingan langsung · Skor Lapangan",
    matchControls: "Kontrol pertandingan",
    badminton: "Badminton",
    pickleball: "Pickleball",
    tennis: "Tenis",
    padel: "Padel",
    table_tennis: "Tenis meja",
    squash: "Squash",
    badmintonHint: "Skor reli dan servis",
    pickleballHint: "Servis, reli, dan posisi lapangan",
    tennisHint: "Skor game, set, servis, dan tie-break",
    padelHint: "Skor game, servis, penerima, dan tie-break FIP",
    tableTennisHint: "Skor 11 poin, servis, penerima, dan rotasi ganda",
    squashHint: "Skor PARS 11, servis, penerima, dan kotak servis",
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
    customTennisFormatTitle: "Pengaturan khusus tenis",
    customTennisRulesSource: "Atur skor game dan set untuk pertandingan ini.",
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
    customPadelFormatTitle: "Pengaturan khusus padel",
    customPadelRulesSource: "Atur skor game dan set untuk pertandingan ini.",
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
    tableTennisFormatTitle: "Format tenis meja · aturan ITTF 2022",
    customTableTennisFormatTitle: "Pengaturan khusus tenis meja",
    customTableTennisRulesSource: "Atur jumlah game untuk pertandingan ini.",
    tableTennisRulesSource:
      "Game berakhir pada 11 poin dengan selisih dua. Pilih best of three atau five.",
    tableTennisOrdersTitle: "Urutan servis dan penerima tenis meja",
    tableTennisOrdersIntro:
      "Tentukan tim dan pemain yang memulai servis, lalu pilih penerima pertama untuk nomor ganda. Rotasi berikutnya dihitung otomatis.",
    tableTennisFirstServingTeam: "Tim yang servis lebih dulu",
    tableTennisFirstServer: "Pemain yang servis lebih dulu",
    tableTennisFirstReceiver: "Penerima pertama",
    tableTennisReceiverTeam: "Tim penerima",
    squashFormatTitle: "Format squash · aturan WSF",
    customSquashFormatTitle: "Pengaturan khusus squash",
    customSquashRulesSource: "Atur jumlah game untuk pertandingan ini.",
    squashRulesSource:
      "Setiap reli menghasilkan poin sampai 11. Tunggal harus unggul dua; pada ganda, skor 11–10 langsung mengakhiri game. Pilih best of three atau five.",
    squashOrdersTitle: "Urutan servis, penerima, dan kotak servis squash",
    squashOrdersIntro:
      "Pilih tim dan pemain yang memulai servis serta kotak pembuka. Pada ganda, urutan server tetap dan pasangan menentukan penerima sisi kiri/kanan.",
    squashFirstServingTeam: "Tim yang servis lebih dulu",
    squashFirstServer: "Server pertama untuk tim ini",
    squashFirstServiceBox: "Kotak servis pembuka",
    squashReceiverLeft: "Penerima dari sisi kiri",
    squashReceiverRight: "Penerima dari sisi kanan",
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
    casual: "Pencatatan kasual",
    referee: "Wasit",
    continue: "Lanjut atur pemain",
    guestNote:
      "Pertandingan guest tersimpan di perangkat ini. Jika sinkronisasi server tersedia, data yang tersinkron kedaluwarsa setelah 12 jam tanpa aktivitas (maksimal 24 jam).",
    installPromptTitle: "Pasang Skor Lapangan",
    installPromptBody:
      "Buka lebih cepat dan gunakan layar penuh saat mencatat skor.",
    installApp: "Pasang Skor Lapangan",
    installLater: "Nanti saja",
    installToHomeScreen: "Tambahkan ke Layar Utama",
    installOnIosInstructions:
      "Di Safari, ketuk Bagikan, lalu pilih Tambahkan ke Layar Utama.",
    pwaUpdateReady: "Pembaruan aplikasi tersedia.",
    pwaUpdateDeferred:
      "Selesaikan pertandingan aktif atau sinkronisasi tertunda sebelum memperbarui aplikasi.",
    pwaUpdateButton: "Perbarui aplikasi",
    localMatchesTitle: "Pertandingan di perangkat ini",
    localMatchesBody:
      "Lanjutkan pertandingan aktif atau buka hasil yang menunggu sinkronisasi.",
    localMatchesBodyAccount:
      "Lanjutkan pertandingan aktif atau buka hasil lokal yang menunggu sinkronisasi.",
    resumeBody: "Lanjutkan pertandingan tamu yang belum selesai.",
    resumeBodyAccount:
      "Lanjutkan pertandingan yang tersimpan di perangkat ini.",
    accountNote:
      "Pertandingan baru akan tersimpan di perangkat ini dan disinkronkan ke akun Anda.",
    guestHistoryPrompt:
      "Masuk ke akun untuk menyimpan riwayat dan melanjutkan pertandingan di perangkat lain.",
    resumeMatch: "Lanjutkan",
    openMatch: "Buka hasil",
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
    confirmGameOrders: "Mulai game",
    setOrdersHint:
      "Konfirmasi atau ubah server pertama dan penerima deuce untuk masing-masing pasangan.",
    decidingPoint: "Poin penentu no-ad",
    receiveFrom: "Terima servis dari sisi",
    courtEnds: "Ujung lapangan bertukar",
    correctionGameScore: "Koreksi skor game aktif",
    correctionTieBreakScore: "Koreksi skor tie-break aktif",
    serves: "servis",
    server: "Server",
    receives: "Penerima",
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
    endSession: "Akhiri pertandingan",
    endTitle: "Akhiri pertandingan ini?",
    endBody:
      "Salinan di perangkat ini akan dihapus. Tautan viewer yang ada ikut dicabut. Data guest yang tersinkron tetap tersedia sampai kedaluwarsa.",
    closeSession: "Tutup di perangkat ini",
    closeSessionTitle: "Tutup pertandingan di perangkat ini?",
    closeSessionBody:
      "Salinan lokal akan dihapus dan tautan viewer akan dicabut. Pertandingan tetap tersimpan sebagai berlangsung dan bisa dilanjutkan dari Riwayat atau perangkat lain.",
    newMatchPrompt: "Mulai pertandingan baru?",
    newMatchBody:
      "Pertandingan selesai ini akan dihapus dari perangkat, lalu tautan viewer yang ada dicabut sebelum kembali ke beranda.",
    keepPlaying: "Lanjut bermain",
    backToScore: "Kembali ke skor",
    goHome: "Ke beranda",
    cancel: "Batal",
    confirmEnd: "Ya, akhiri pertandingan",
    endFailure: "Pertandingan belum diakhiri. Coba lagi.",
    confirmCloseSession: "Tutup di perangkat ini",
    closeSessionFailure: "Pertandingan belum ditutup. Coba lagi.",
    finalScoreSaveFailed:
      "Skor akhir belum tersimpan. Tetap di halaman ini dan coba lagi.",
    matchStorageError: "Penyimpanan pertandingan gagal di perangkat.",
    matchStorageErrorTitle: "Pertandingan belum tersimpan",
    matchStorageErrorBody:
      "Periksa ruang penyimpanan di perangkat lalu coba lagi.",
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
    tableTennisPointWon: "Poin tenis meja dimenangkan",
    tableTennisGames: "Game menang",
    tableTennisAwaitingOrders: "Konfirmasi urutan sebelum game berikutnya",
    tableTennisOrderNote:
      "Pada ganda, urutan penerima dan sisi pada game penentuan akan bertukar saat salah satu pasangan mencapai 5 poin.",
    squashPointWon: "Reli squash dimenangkan",
    squashGames: "Menang game",
    squashAwaitingOrders: "Konfirmasi urutan game berikutnya",
    squashOrderNote:
      "Urutan server ganda tetap sepanjang pertandingan. Pemenang game menjadi server pertama berikutnya; pemetaan penerima kiri/kanan dapat diubah.",
    squashChooseServiceBox: "Pilih kotak servis untuk melanjutkan",
    squashServiceBoxHint:
      "Server baru harus memilih kotak. Setelah menang reli, kotak berganti otomatis.",
    courtMarkerServer: "S = Server",
    courtMarkerReceiver: "R = Penerima",
    squashServiceBoxLeft: "Kotak kiri",
    squashServiceBoxRight: "Kotak kanan",
    padelLocalVariant: "Tunggal klub · varian lokal",
    padelAwaitingOrders: "Konfirmasi urutan set ini",
    padelStarStage: "Tahap Star Point",
    padelDeuceStage: "Deuce",
    officialRules: "Aturan resmi",
    officialHint: "Aturan standar federasi, dikunci",
    portfolioNotice:
      "Project portfolio untuk mabar santai. Bukan alat referee resmi atau layanan federasi. Gunakan nama panggilan dan jangan masukkan data sensitif.",
    rulesTitle: "Aturan pertandingan",
    rulesIntro: "Pilih sumber aturan untuk pertandingan ini.",
    customRules: "Aturan khusus untuk pertandingan ini",
    officialRulesBody: "Standar federasi. Tidak dapat diubah.",
    communityRulesBody:
      "Dibuat pemain lain. Tinjau detailnya sebelum mulai bermain.",
    communityRulesUnavailable: "Belum ada aturan publik untuk olahraga ini",
    communityRulesEmptyBody:
      "Pilih aturan resmi atau buat aturan khusus untuk pertandingan ini.",
    communityRulesLoadError: "Aturan komunitas tidak dapat dimuat saat ini.",
    communityRulesLoadErrorBody:
      "Coba lagi nanti, atau gunakan aturan resmi untuk pertandingan ini.",
    customRulesBody: "Atur sistem skor hanya untuk pertandingan ini.",
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
    matchCustomRules: "Aturan khusus untuk pertandingan ini",
    communityRules: "Aturan komunitas",
    clubSessions: "Sesi klub",
    clubSessionsPageTitle: "Sesi klub · Skor Lapangan",
    clubSessionEyebrow: "PAPAN SESI · 6 OLAHRAGA · PROFIL",
    clubSessionsIntro:
      "Atur pemain, lapangan, dan antrean pertandingan untuk sesi main bersama.",
    clubSessionDetailIntro:
      "Catat peserta dan lapangan, susun pasangan secara manual, lalu simpan hasil dari pencatat skor.",
    clubSessionSignInTitle: "Sesi klub tersimpan di akun",
    clubSessionSignInBody:
      "Masuk ke akun untuk membuat papan sesi privat. Nama peserta hanya terlihat oleh akun pengelola.",
    clubSessionYourSessions: "Sesi Anda",
    clubSessionListEmpty:
      "Belum ada sesi. Buat sesi pertama untuk mulai menyusun permainan.",
    clubSessionCreateTitle: "Buat sesi",
    clubSessionCreateBody:
      "Buat sesi open play untuk semua olahraga yang didukung dengan satu pengelola.",
    clubSessionName: "Nama sesi",
    clubSessionDate: "Tanggal",
    clubSessionTime: "Waktu mulai",
    clubSessionLocation: "Lokasi (opsional)",
    clubSessionLocationPlaceholder: "Contoh: Court 3, Downtown Club",
    clubSessionTimeZoneHint: "Waktu disimpan dalam zona {timeZone}.",
    clubSessionSchedule: "Jadwal",
    clubSessionTimeNotSet: "Waktu belum ditentukan",
    clubSessionPairingMode: "Mode pasangan",
    clubSessionPlayProfile: "Format sesi",
    clubSessionSinglesRound: "Tunggal · {players} pemain per match",
    clubSessionShortRound: "Round singkat {minutes} menit",
    clubSessionRoundTimer: "Round {minutes} menit",
    clubSessionRoundRemaining: "tersisa",
    clubSessionRoundExpired:
      "Waktu habis. Selesaikan poin terakhir lalu ganti pemain.",
    clubSessionOpenDoubles: "Ganda open",
    clubSessionMixedDoubles: "Ganda campuran",
    clubSessionCreateAction: "Buat papan sesi",
    clubSessionLoadError:
      "Sesi tidak dapat dimuat. Periksa koneksi, lalu coba lagi.",
    clubSessionOffline:
      "Pengelolaan sesi klub memerlukan koneksi internet. Pertandingan lokal tetap dapat dilanjutkan di perangkat ini.",
    clubSessionNotFound: "Sesi tidak tersedia",
    clubSessionNotFoundBody:
      "Sesi mungkin sudah dihapus atau Anda tidak memiliki akses ke sesi ini.",
    clubSessionSaveError: "Perubahan belum tersimpan. Coba lagi sebentar.",
    clubSessionStatus: "Status",
    clubSessionActive: "Berjalan",
    clubSessionCompleted: "Selesai",
    clubSessionComplete: "Tutup sesi",
    clubSessionReopen: "Buka kembali sesi",
    clubSessionDelete: "Hapus sesi",
    clubSessionDeleteConfirm:
      "Roster, antrean, dan tautan sesi akan dihapus. Jurnal pertandingan tetap ada di riwayat akun.",
    clubSessionDeleteConfirmAction: "Hapus permanen",
    clubSessionPlayers: "Pemain aktif",
    clubSessionRosterTitle: "Daftar pemain",
    clubSessionRosterBody:
      "Urutan ini dipertahankan. Peringkat otomatis dihitung dari pertandingan selesai.",
    clubSessionPlayerName: "Nama pemain",
    clubSessionPlayerPlaceholder: "Nama panggilan",
    clubSessionPlayerGender: "Gender",
    clubSessionGenderMan: "Pria",
    clubSessionGenderWoman: "Wanita",
    clubSessionGenderOther: "Lainnya",
    clubSessionGenderUnspecified: "Tidak ditentukan",
    clubSessionSkillLevel: "Level 1–5",
    clubSessionAvailability: "Kehadiran",
    clubSessionAvailable: "Siap main",
    clubSessionLate: "Terlambat",
    clubSessionResting: "Istirahat",
    clubSessionUnavailable: "Tidak tersedia",
    clubSessionRotationPreferences: "Preferensi rotasi",
    clubSessionAvoidPlayersBody:
      "Tandai pemain yang sebaiknya tidak dipasangkan. Preferensi ini tetap dapat diatasi saat kondisi lapangan terbatas.",
    clubSessionAddPlayer: "Tambah pemain",
    clubSessionRosterEmpty: "Tambahkan pemain untuk mulai membuat antrean.",
    clubSessionDeactivate: "Nonaktifkan",
    clubSessionReactivate: "Aktifkan",
    clubSessionRecord: "Main {played} · Menang {won} · Kalah {lost}",
    clubSessionStandingsTitle: "Klasemen sesi",
    clubSessionStandingsBody:
      "Jumlah menang menjadi urutan utama; win rate menjadi pembanding berikutnya.",
    clubSessionStandingPlayer: "Pemain",
    clubSessionStandingRecord: "M · M · K",
    clubSessionStandingWinRate: "Win rate",
    clubSessionStandingEmpty:
      "Klasemen akan terisi setelah pertandingan selesai dan tersinkron.",
    clubSessionCourtsTitle: "Lapangan",
    clubSessionCourtName: "Lapangan",
    clubSessionCourtPlaceholder: "Contoh: Lapangan 1",
    clubSessionAddCourt: "Tambah",
    clubSessionCourtsEmpty:
      "Tambahkan setidaknya satu lapangan untuk membuat antrean.",
    clubSessionQueueTitle: "Antrean pertandingan",
    clubSessionQueueBody:
      "Pilih satu lapangan dan pemain sesuai profil sesi, atau isi lapangan berikutnya dengan Smart Rotation.",
    clubSessionSelectCourt: "Pilih lapangan",
    clubSessionSelectPlayer: "Pilih pemain",
    clubSessionTeamAPlayer: "Tim A · Pemain {number}",
    clubSessionTeamBPlayer: "Tim B · Pemain {number}",
    clubSessionAddToQueue: "Tambah ke antrean",
    clubSessionGenerateSchedule: "Buat jadwal otomatis",
    clubSessionGenerateScheduleBody:
      "Buat antrean dari pemain dan lapangan aktif sesuai profil sesi.",
    clubSessionScheduleExists:
      "Jadwal sudah dibuat. Tambahkan pertandingan manual jika ingin memperpanjangnya.",
    clubSessionScheduleRequirements:
      "Jadwal otomatis membutuhkan minimal {players} pemain aktif dan satu lapangan aktif.",
    clubSessionFillNextCourts: "Isi lapangan berikutnya",
    clubSessionSmartRotationBody:
      "Rotasi memilih pemain dengan jumlah match paling sedikit, waktu tunggu terlama, dan pasangan yang lebih bervariasi.",
    clubSessionRotationPreviewTitle: "Usulan rotasi berikutnya",
    clubSessionRotationPreviewBody:
      "Tinjau pemain yang dipilih sebelum menambahkannya ke antrean.",
    clubSessionRotationWhy:
      "Dasar pemilihan: jumlah match paling sedikit. Jika seri, rotasi memprioritaskan waktu tunggu, variasi pasangan/lawan, lalu keseimbangan skill.",
    clubSessionRotationPlayed: "Riwayat match saat ini: {players}",
    clubSessionRotationFairnessGap: "Gap pada usulan ini: {count} match",
    clubSessionRotationTieBreakers:
      "Preferensi dihindari: {avoid} · Pengulangan pasangan/lawan: {repeat} · Gap skill: {skill}",
    clubSessionConfirmRotation: "Konfirmasi rotasi",
    clubSessionRejectRotation: "Tolak usulan",
    clubSessionRotationRejected:
      "Usulan rotasi ditolak. Tidak ada antrean yang ditambahkan.",
    clubSessionRotationStale:
      "Data sesi berubah sejak usulan dibuat. Usulan dibatalkan; buat preview baru untuk melihat kondisi terbaru.",
    clubSessionNoFreeCourt:
      "Belum ada lapangan kosong. Selesaikan atau mulai antrean yang ada terlebih dahulu.",
    clubSessionRotationRequirements:
      "Rotasi membutuhkan jumlah pemain sesuai profil yang siap bermain.",
    clubSessionMixedFallbackRequired:
      "Belum ada kombinasi ganda campuran yang valid untuk pemain yang siap. Anda dapat memakai ganda open untuk rotasi ini.",
    clubSessionMixedManualFallbackRequired:
      "Penugasan ini bukan ganda campuran yang valid. Konfirmasi jika ingin memakainya sebagai ganda open.",
    clubSessionUseOpenFallback: "Pakai ganda open kali ini",
    clubSessionOpenFallback: "Fallback open",
    clubSessionSaveProfileError:
      "Profil pemain belum tersimpan. Periksa koneksi lalu coba lagi.",
    clubSessionQueueRequirements:
      "Perlu pemain aktif sesuai profil sesi dan satu lapangan aktif.",
    clubSessionQueueRequirementsDynamic:
      "Perlu {players} pemain aktif dan satu lapangan aktif.",
    clubSessionAssignmentError:
      "Pilih lapangan dan pemain berbeda sesuai format sesi.",
    clubSessionQueueClosed:
      "Sesi ditutup. Buka kembali sesi untuk menambah antrean.",
    clubSessionMatchNumber: "Pertandingan {number}",
    clubSessionWinner: "Pemenang: {team}",
    clubSessionMatchSynced: "Pertandingan tersimpan",
    clubSessionMatchNotSynced: "Menunggu sinkronisasi skor",
    clubSessionMatchQueued: "Dalam antrean",
    clubSessionOpenMatch: "Buka skor",
    clubSessionContinueSetup: "Lanjutkan setup",
    clubSessionStartMatch: "Mulai skor",
    remove: "Hapus",
    clubSessionQueueEmpty: "Belum ada pertandingan di antrean.",
    clubSessionPrivacyNote:
      "Papan sesi bersifat privat. Peserta tidak perlu akun dan tidak dapat melihat data sesi dari perangkat lain.",
    clubSessionNamesLocked:
      "Nama mengikuti roster sesi agar hasil tetap tercatat ke pemain yang ditugaskan.",
    allSports: "Semua olahraga",
    communityRuleSetupNote:
      "Pilih aturan komunitas yang telah dipublikasikan untuk pertandingan ini.",
    communityRuleSelectPlaceholder: "Pilih aturan komunitas…",
    browseCommunityRules: "Lihat semua aturan komunitas",
    viewCommunityRule: "Lihat aturan",
    rulesUnofficial: "Tidak resmi",
    capMustBeAtLeastTarget:
      "Batas poin harus sama atau lebih besar dari target.",
    customRulesInvalid:
      "Masukkan angka bulat yang valid: target 1–101, selisih 1–10, dan batas poin minimal sama dengan target.",
    signIn: "Masuk",
    signInDialogTitle: "Masuk ke akun",
    signInDialogDescription:
      "Simpan riwayat pertandingan dan lanjutkan di perangkat lain.",
    signInDialogProviders: "Pilih penyedia akun",
    signInDialogGuestNote: "Anda tetap bisa bermain tanpa akun.",
    signInWithGoogle: "Masuk dengan Google",
    signInWithProvider: "Masuk dengan {provider}",
    account: "Akun",
    accountMenu: "Menu akun",
    accountSettings: "Pengaturan akun",
    accountTitle: "Akun",
    accountPageTitle: "Akun · Skor Lapangan",
    accountIntro: "Kelola akun dan pertandingan yang tersimpan.",
    accountSignedInAs: "Masuk sebagai",
    accountRequiresGoogle: "Masuk untuk membuka pengaturan akun.",
    accountRequiresGoogleBody:
      "Akun diperlukan untuk membuka riwayat, menyinkronkan pertandingan, dan mengelola data Anda.",
    accountDeleteSection: "Hapus akun",
    accountDeleteWarning:
      "Penghapusan akun bersifat permanen. Riwayat, event skor, tautan Live Viewer, laporan, dan data akun akan dihapus.",
    accountDeleteButton: "Hapus akun",
    accountDeleteConfirmTitle: "Hapus akun ini?",
    accountDeleteConfirmBody:
      "Match, event skor, tautan Live Viewer, laporan, dan data akun akan dihapus. Data lokal di browser juga dibersihkan. Anda akan kembali sebagai guest.",
    accountDeleteConfirmButton: "Ya, hapus akun",
    accountDeleteInProgress: "Menghapus akun…",
    accountDeleteError: "Akun belum dihapus:",
    accountError: "Masalah akun:",
    googleSignInError: "Login akun gagal:",
    accountSignInError: "Login akun gagal:",
    claimError: "Login berhasil, tetapi match guest belum tersinkron:",
    googleLinkFallback:
      "Identitas ini sudah memiliki akun Skor Lapangan. Kami akan masuk ke akun tersebut dan mencoba membawa match guest Anda.",
    oauthLinkFallback:
      "Identitas ini sudah memiliki akun Skor Lapangan. Kami akan masuk ke akun tersebut dan mencoba membawa match guest Anda.",
    signingOut: "Keluar…",
    savingGuestMatches: "Menyimpan pertandingan guest ke akun Anda…",
    guestMatchesSaved: "Pertandingan guest sudah tersimpan di akun Anda.",
    accountDeleted: "Akun dihapus. Anda kembali sebagai guest.",
    saveHistory: "Simpan riwayat ke akun",
    signOut: "Keluar",
    historySaved: "Riwayat tersimpan",
    syncSaved: "Skor tersimpan",
    syncLocal: "Tersimpan di perangkat ini",
    syncing: "Menyimpan skor…",
    syncPending: "Menunggu sinkronisasi",
    syncOffline: "Offline · perubahan tersimpan di perangkat",
    pendingSyncBody:
      "Hasil akhir tersimpan di perangkat dan akan dikirim saat koneksi kembali.",
    syncError: "Gagal menyinkronkan · data masih tersimpan di perangkat",
    syncConflict:
      "Versi skor di server lebih baru atau berbeda. Lanjutkan dari perangkat utama.",
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
    matchControlHeld: "Pertandingan ini sedang digunakan di perangkat lain.",
    matchControlLost: "Kontrol pertandingan berpindah ke perangkat lain.",
    matchReadOnly: "Pertandingan ini hanya bisa dilihat.",
    takeOverMatch: "Ambil alih pertandingan",
    matchRemoteConflict: "Versi server dan versi perangkat ini berbeda.",
    matchConflictBody:
      "Pilih hasil yang ingin dipertahankan. Aplikasi tidak menggabungkan skor secara otomatis.",
    localVersion: "Perangkat ini",
    serverVersion: "Server",
    useServerVersion: "Gunakan versi server",
    saveLocalAsNewMatch: "Simpan sebagai Match baru",
    recovering: "Menyimpan pilihan...",
    matchControlError: "Tidak bisa mengambil kontrol pertandingan ini.",
    retryControl: "Coba lagi",
    liveViewer: "Live Viewer",
    liveViewerDescription:
      "Tautan hanya menampilkan skor, posisi, dan server—tanpa nama pemain. Tautan kedaluwarsa bersama data pertandingan.",
    createViewerLink: "Bagikan skor langsung",
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
    selectCommunityRules: "Pilih aturan komunitas",
    noCommunityRules:
      "Belum ada aturan komunitas yang dipublikasikan untuk olahraga ini.",
    loadRuleError: "Aturan ini tidak dapat dimuat. Coba pilih aturan lain.",
    viewerTitle: "Skor pertandingan langsung",
    viewerPageTitle: "Skor pertandingan langsung · Skor Lapangan",
    viewerLoading: "Mengambil skor terbaru…",
    viewerUnavailable: "Tautan viewer tidak tersedia",
    viewerUnavailableBody:
      "Tautan mungkin dicabut, kedaluwarsa, atau tidak valid.",
    viewerStale: "Stale · terakhir tersinkron",
    viewerRefresh: "Muat ulang skor",
    viewerDisplayMode: "Mode display",
    viewerDisplayModeBody:
      "Buka tampilan besar ini di TV atau proyektor. Kontrol skor tetap dari perangkat pemain.",
    viewerOpenDisplay: "Buka mode display",
    viewerFullscreen: "Layar penuh",
    viewerExitFullscreen: "Keluar layar penuh",
    viewerLive: "Live",
    updatedAt: "diperbarui",
    score: "Skor",
    communityLibraryTitle: "Aturan komunitas",
    communityRulesPageTitle: "Aturan komunitas · Skor Lapangan",
    communityRulesSeoDescription:
      "Jelajahi aturan skor buatan komunitas untuk badminton, pickleball, tenis, padel, tenis meja, dan squash.",
    communityLibraryIntro:
      "Jelajahi aturan buatan komunitas. Setiap aturan diberi label tidak resmi.",
    communitySearchPlaceholder: "Cari nama atau deskripsi aturan",
    communityFilterLabel: "Tampilkan",
    communityFilterAll: "Semua aturan",
    communityFilterPublished: "Sudah dipublikasikan",
    communityFilterMine: "Aturan saya",
    communityNoResults: "Tidak ada aturan yang cocok",
    clearCommunityFilters: "Hapus filter",
    communityDisclaimer:
      "Aturan komunitas ini tidak resmi dan dikelola oleh pembuatnya. Tinjau bersama grup Anda sebelum bermain dan gunakan atas risiko Anda sendiri.",
    createCommunityRule: "Buat aturan komunitas",
    backendNotConfigured:
      "Supabase belum dikonfigurasi untuk aturan komunitas.",
    noCommunityRulesYet: "Belum ada aturan publik",
    noCommunityRulesBody:
      "Aturan komunitas yang telah dipublikasikan akan muncul di sini.",
    unofficial: "Tidak resmi",
    unpublished: "Tidak dipublikasikan",
    noRuleDescription: "Tidak ada deskripsi.",
    backToRules: "Kembali ke aturan komunitas",
    ruleUnavailable: "Aturan tidak tersedia",
    ruleUnavailableBody:
      "Tautan mungkin tidak valid, aturan mungkin sudah tidak dipublikasikan, atau Anda tidak memiliki akses.",
    version: "Versi",
    useTheseRules: "Gunakan aturan ini",
    shareCommunityRule: "Bagikan aturan ini",
    shareCommunityRuleBody:
      "Bagikan tautan atau minta grup Anda memindai kode QR untuk membuka aturan ini.",
    qrCode: "Kode QR aturan komunitas",
    editRule: "Edit aturan komunitas",
    unpublishRule: "Batalkan publikasi",
    republishRule: "Terbitkan lagi",
    reportRule: "Laporkan aturan",
    reportReason: "Alasan",
    reportIncorrect: "Informasi atau skor tidak akurat",
    reportMisleading: "Menyesatkan",
    reportUnsafe: "Berisiko atau tidak aman",
    reportSpam: "Spam",
    reportRights: "Hak cipta atau hak lainnya",
    reportOther: "Lainnya",
    reportDetails: "Detail (opsional)",
    reportContact: "Alamat email untuk tindak lanjut (opsional)",
    reportContactHint:
      "Hanya digunakan jika peninjau perlu menghubungi Anda tentang laporan ini.",
    reportReviewNote:
      "Laporan ditinjau secara manual dan tidak otomatis menyembunyikan aturan.",
    reportLimitNote:
      "Jika menemukan masalah yang berbeda, Anda dapat mengirim laporan lain. Satu akun dibatasi maksimal 3 laporan per jam.",
    reportSessionRequired: "Menyiapkan sesi tamu yang aman…",
    submitReport: "Kirim laporan",
    reportSubmitted: "Laporan Anda sudah dicatat.",
    reportSubmittedBody:
      "Laporan ini akan ditinjau secara manual. Aturan tetap tampil sampai peninjauan selesai.",
    reportAnother: "Laporkan masalah lain",
    rateLimited: "Terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi.",
    saveFailed: "Tidak dapat menyimpan perubahan.",
    ruleUnpublished: "Aturan ini tidak lagi tampil di direktori publik.",
    ruleRepublished:
      "Aturan ini kembali tampil di direktori publik. Versinya tetap sama.",
    notRuleOwner: "Hanya pembuat aturan yang dapat mengeditnya.",
    googleRequired: "Masuk ke akun untuk menerbitkan aturan.",
    historyGoogleRequired: "Masuk ke akun untuk melihat riwayat.",
    historyPageTitle: "Riwayat pertandingan · Skor Lapangan",
    googleRequiredBody:
      "Aturan komunitas hanya bisa diterbitkan dan dikelola oleh akun permanen.",
    ruleTitle: "Nama aturan",
    sport: "Olahraga",
    ruleDescription: "Deskripsi",
    publishNowNote:
      "Aturan langsung dipublikasikan dan dapat dibagikan. Semua aturan komunitas diberi label tidak resmi.",
    publishRule: "Terbitkan aturan",
    noCap: "Tanpa batas poin",
    shareLink: "Bagikan tautan",
    matchHistory: "Riwayat pertandingan",
    historyIntro: "Pertandingan yang tersimpan di akun ini.",
    historyRequiresGoogle:
      "Masuk ke akun untuk melihat riwayat dan membukanya kembali dari perangkat lain. Anda tetap bisa bermain tanpa akun.",
    historyLoadError:
      "Riwayat belum bisa dimuat. Periksa koneksi lalu coba lagi.",
    historySearchPlaceholder: "Cari olahraga atau nama tim",
    historyFilterStatus: "Status pertandingan",
    historyFilterAll: "Semua pertandingan",
    historyFilterInProgress: "Berlangsung",
    historyFilterCompleted: "Selesai",
    historyFilterSport: "Olahraga",
    historyFilterWinner: "Pemenang",
    teamAWinner: "Team A menang",
    teamBWinner: "Team B menang",
    historyFromDate: "Dari tanggal",
    historyToDate: "Sampai tanggal",
    historySort: "Urutkan",
    historySortNewest: "Terbaru",
    historySortOldest: "Terlama",
    historyNoResults: "Tidak ada pertandingan yang cocok",
    clearHistoryFilters: "Hapus filter",
    retryHistory: "Muat ulang riwayat",
    loadMore: "Muat lebih banyak",
    gamesWon: "game dimenangkan",
    noSavedMatches: "Belum ada pertandingan tersimpan",
    noSavedMatchesBody:
      "Mulai pertandingan saat koneksi aktif, atau sambungkan akun Anda.",
    activeMatch: "Sedang berlangsung",
    historyInProgress: "Berlangsung",
    historyCompleted: "Selesai",
    viewMatch: "Lihat skor",
    lastUpdated: "Terakhir diperbarui:",
    openOnThisDevice: "Buka pertandingan",
    detailsOnOriginalDevice:
      "Pertandingan aktif dapat dilanjutkan dari perangkat lain setelah masuk ke akun.",
    deleteHistoryMatch: "Hapus dari riwayat",
    confirmDeleteHistoryMatch: "Ya, hapus pertandingan",
    deletingHistoryMatch: "Menghapus…",
    historyDeleteError:
      "Pertandingan belum dihapus. Periksa koneksi lalu coba lagi.",
    historyStatistics: "Statistik ringkas",
    historyStatisticsSource: "Akun + perangkat ini",
    historyStatisticsLocalSource: "Perangkat ini",
    historyStatisticsFallback:
      "Statistik akun belum tersedia. Menampilkan data perangkat ini.",
    historyStatisticsEmpty: "Belum ada pertandingan selesai untuk filter ini.",
    completedMatches: "Pertandingan selesai",
    teamAWins: "Menang Team A",
    teamBWins: "Menang Team B",
    teamAWinRate: "Rasio menang Team A",
    teamBWinRate: "Rasio menang Team B",
    teamAShort: "A",
    teamBShort: "B",
    shareResult: "Bagikan hasil",
    shareResultDescription: "Bagikan skor akhir sebagai teks.",
    resultShared: "Hasil pertandingan dibagikan.",
    resultCopied: "Hasil pertandingan disalin.",
    shareResultFailed: "Hasil belum bisa dibagikan atau disalin.",
    quickRematch: "Rematch cepat",
    completedLocalMatches: "Pertandingan selesai di perangkat ini",
    completedLocalMatchesBody:
      "Bagikan hasil atau gunakan konfigurasi yang sama untuk rematch.",
    rematchLoadError: "Konfigurasi rematch belum bisa dimuat. Coba lagi.",
    playedAt: "Tanggal",
    backToHome: "Kembali ke beranda",
  },
  en: {
    appName: "Skor Lapangan",
    language: "Language",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    primaryNavigation: "Main navigation",
    loading: "Loading…",
    loadingMatch: "Loading match…",
    loadingLatestMatch: "Loading the latest version…",
    matchLoadErrorTitle: "The match could not be opened",
    matchLoadErrorBody:
      "Check your connection, then try loading the match again.",
    retryMatchLoad: "Reload match",
    remoteMatchWarning:
      "The server version could not be validated yet. The local copy remains in use. Reload after sync completes.",
    seoTitle:
      "Badminton, Pickleball, Tennis, Padel, Table Tennis & Squash Scoreboard | Skor Lapangan",
    seoDescription:
      "Keep score for badminton, pickleball, tennis, padel, table tennis, and squash singles or doubles from your phone. Track service, correct points, and share a live viewer link.",
    tagline: "Keep score for racket sports",
    sportEyebrow:
      "BADMINTON · PICKLEBALL · TENNIS · PADEL · TABLE TENNIS · SQUASH",
    intro:
      "Keep score for singles or doubles on your phone. Track service, receivers, service boxes, and court positions, then share the live score with a viewer link.",
    chooseSport: "Choose a sport",
    chooseFormat: "Choose match format",
    quickStart: "Quick start",
    setupPageTitle: "Match setup · Skor Lapangan",
    matchPageTitle: "Live match · Skor Lapangan",
    matchControls: "Match controls",
    badminton: "Badminton",
    pickleball: "Pickleball",
    tennis: "Tennis",
    padel: "Padel",
    table_tennis: "Table tennis",
    squash: "Squash",
    badmintonHint: "Rally scoring and service",
    pickleballHint: "Service, rallies, and court positions",
    tennisHint: "Track games, sets, service, and tie-breaks",
    padelHint: "Track games, service, receivers, and FIP tie-breaks",
    tableTennisHint:
      "Track 11-point games, service, receivers, and doubles rotation",
    squashHint: "Track PARS 11, service, receivers, and service boxes",
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
    customTennisFormatTitle: "Custom tennis settings",
    customTennisRulesSource: "Set game and set scoring for this match.",
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
    customPadelFormatTitle: "Custom padel settings",
    customPadelRulesSource: "Set game and set scoring for this match.",
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
    tableTennisFormatTitle: "Table tennis format · 2022 ITTF rules",
    customTableTennisFormatTitle: "Custom table tennis settings",
    customTableTennisRulesSource: "Set the number of games for this match.",
    tableTennisRulesSource:
      "Games end at 11 points, win by two. Choose best of three or five.",
    tableTennisOrdersTitle: "Table tennis service and receiving order",
    tableTennisOrdersIntro:
      "Choose the team and player serving first, then select the first receiver for doubles. Later rotation is calculated automatically.",
    tableTennisFirstServingTeam: "Team serving first",
    tableTennisFirstServer: "Player serving first",
    tableTennisFirstReceiver: "First receiver",
    tableTennisReceiverTeam: "Receiving team",
    squashFormatTitle: "Squash format · WSF rules",
    customSquashFormatTitle: "Custom squash settings",
    customSquashRulesSource: "Set the number of games for this match.",
    squashRulesSource:
      "Every rally scores a point to 11. Singles must win by two; in doubles, 11–10 ends the game. Choose best of three or five.",
    squashOrdersTitle: "Squash service, receiving, and service-box order",
    squashOrdersIntro:
      "Choose the team, first server, and opening box. In doubles, the server order stays fixed and each pair sets its left/right receivers.",
    squashFirstServingTeam: "Team serving first",
    squashFirstServer: "First server for this team",
    squashFirstServiceBox: "Opening service box",
    squashReceiverLeft: "Receiver from the left side",
    squashReceiverRight: "Receiver from the right side",
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
    casual: "Casual scoring",
    referee: "Referee",
    continue: "Continue to player setup",
    guestNote:
      "Guest matches stay on this device. If server sync is available, synced data expires after 12 hours without activity (24-hour maximum).",
    installPromptTitle: "Install Skor Lapangan",
    installPromptBody:
      "Open it faster and use a full screen while keeping score.",
    installApp: "Install Skor Lapangan",
    installLater: "Not now",
    installToHomeScreen: "Add to Home Screen",
    installOnIosInstructions:
      "In Safari, tap Share, then choose Add to Home Screen.",
    pwaUpdateReady: "An app update is ready.",
    pwaUpdateDeferred:
      "Finish active matches or complete pending sync before updating.",
    pwaUpdateButton: "Update app",
    localMatchesTitle: "Matches on this device",
    localMatchesBody:
      "Resume an active match or open a result waiting to sync.",
    localMatchesBodyAccount:
      "Resume an active match or open a local result waiting to sync.",
    resumeBody: "Continue an unfinished guest match.",
    resumeBodyAccount: "Continue a match saved on this device.",
    accountNote: "New matches stay on this device and sync to your account.",
    guestHistoryPrompt:
      "Sign in to keep match history and continue on another device.",
    resumeMatch: "Resume",
    openMatch: "Open result",
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
    confirmGameOrders: "Start game",
    setOrdersHint:
      "Confirm or change each pair’s first server and deuce-court receiver.",
    decidingPoint: "No-ad deciding point",
    receiveFrom: "Receive from the",
    courtEnds: "Court ends changed",
    correctionGameScore: "Correct active game score",
    correctionTieBreakScore: "Correct active tie-break score",
    serves: "serves",
    server: "Server",
    receives: "Receiver",
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
    endSession: "End match",
    endTitle: "End this match?",
    endBody:
      "This device copy will be removed. Any existing viewer link will be revoked. Synced guest data remains available until it expires.",
    closeSession: "Close on this device",
    closeSessionTitle: "Close this match on this device?",
    closeSessionBody:
      "The local copy will be removed and any viewer link will be revoked. The match remains in progress and can be resumed from History or another device.",
    newMatchPrompt: "Start a new match?",
    newMatchBody:
      "This finished match will be removed from this device, and any viewer link will be revoked before you return home.",
    keepPlaying: "Keep playing",
    backToScore: "Back to score",
    goHome: "Go to home",
    cancel: "Cancel",
    confirmEnd: "End this match",
    endFailure: "The match was not ended. Try again.",
    confirmCloseSession: "Close on this device",
    closeSessionFailure: "The match was not closed. Try again.",
    finalScoreSaveFailed:
      "The final score was not saved. Stay on this page and try again.",
    matchStorageError: "Match storage failed on this device.",
    matchStorageErrorTitle: "Match not saved",
    matchStorageErrorBody: "Check available device storage and try again.",
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
    tableTennisPointWon: "Table tennis point won by",
    tableTennisGames: "Games won",
    tableTennisAwaitingOrders: "Confirm the order before the next game",
    tableTennisOrderNote:
      "In doubles, receiving order and court ends switch in the deciding game when either pair reaches five points.",
    squashPointWon: "Squash rally won by",
    squashGames: "Games won",
    squashAwaitingOrders: "Confirm the next game's order",
    squashOrderNote:
      "Doubles server order stays fixed for the match. The game winner serves first next; left/right receiver mapping can change.",
    squashChooseServiceBox: "Choose a service box to continue",
    squashServiceBoxHint:
      "The new server chooses a box. It switches automatically after a winning rally.",
    courtMarkerServer: "S = Server",
    courtMarkerReceiver: "R = Receiver",
    squashServiceBoxLeft: "Left box",
    squashServiceBoxRight: "Right box",
    padelLocalVariant: "Club singles · local variant",
    padelAwaitingOrders: "Confirm this set’s orders",
    padelStarStage: "Star Point stage",
    padelDeuceStage: "Deuce",
    officialRules: "Official Rules",
    officialHint: "Locked federation-standard rules",
    portfolioNotice:
      "Portfolio project for informal play. Not an official referee tool or federation service. Use nicknames and avoid sensitive data.",
    rulesTitle: "Match rules",
    rulesIntro: "Choose the rule source for this match.",
    customRules: "Custom rules for this match",
    officialRulesBody: "Federation standard. Fixed for this match.",
    communityRulesBody:
      "Shared by players. Review the details before you play.",
    communityRulesUnavailable: "No published rules for this sport yet",
    communityRulesEmptyBody:
      "Choose Official Rules or set custom rules for this match.",
    communityRulesLoadError: "Community Rules are unavailable right now.",
    communityRulesLoadErrorBody:
      "Try again later, or use Official Rules for this match.",
    customRulesBody: "Set the scoring for this match only.",
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
    clubSessions: "Club sessions",
    clubSessionsPageTitle: "Club sessions · Skor Lapangan",
    clubSessionEyebrow: "SESSION BOARD · 6 SPORTS · PROFILES",
    clubSessionsIntro:
      "Organize players, courts, and a match queue for a casual club session.",
    clubSessionDetailIntro:
      "Add players and courts, assign pairs manually, then record results with the scorekeeper.",
    clubSessionSignInTitle: "Club sessions are saved to your account",
    clubSessionSignInBody:
      "Sign in to create a private session board. Player names are visible only to the organizer’s account.",
    clubSessionYourSessions: "Your sessions",
    clubSessionListEmpty:
      "No sessions yet. Create one to start organizing play.",
    clubSessionCreateTitle: "Create a session",
    clubSessionCreateBody:
      "Create an open-play session for any supported sport with one organizer.",
    clubSessionName: "Session name",
    clubSessionDate: "Date",
    clubSessionTime: "Start time",
    clubSessionLocation: "Location (optional)",
    clubSessionLocationPlaceholder: "Example: Court 3, Downtown Club",
    clubSessionTimeZoneHint: "Time is saved in the {timeZone} time zone.",
    clubSessionSchedule: "Schedule",
    clubSessionTimeNotSet: "Time not set",
    clubSessionPairingMode: "Pairing mode",
    clubSessionPlayProfile: "Session format",
    clubSessionSinglesRound: "Singles · {players} players per match",
    clubSessionShortRound: "{minutes}-minute short rounds",
    clubSessionRoundTimer: "{minutes}-minute round",
    clubSessionRoundRemaining: "remaining",
    clubSessionRoundExpired:
      "Time is up. Finish the current point, then rotate players.",
    clubSessionOpenDoubles: "Open doubles",
    clubSessionMixedDoubles: "Mixed doubles",
    clubSessionCreateAction: "Create session board",
    clubSessionLoadError:
      "Could not load the session. Check your connection and try again.",
    clubSessionOffline:
      "Club session management needs an internet connection. Local matches can still be continued on this device.",
    clubSessionNotFound: "Session unavailable",
    clubSessionNotFoundBody:
      "This session may have been deleted, or you may not have access to it.",
    clubSessionSaveError: "This change was not saved. Please try again.",
    clubSessionStatus: "Status",
    clubSessionActive: "Active",
    clubSessionCompleted: "Completed",
    clubSessionComplete: "Complete session",
    clubSessionReopen: "Reopen session",
    clubSessionDelete: "Delete session",
    clubSessionDeleteConfirm:
      "The roster, queue, and session links will be deleted. Match journals remain in account history.",
    clubSessionDeleteConfirmAction: "Delete permanently",
    clubSessionPlayers: "Active players",
    clubSessionRosterTitle: "Player roster",
    clubSessionRosterBody:
      "Roster order stays fixed. Automatic standings use completed synced matches.",
    clubSessionPlayerName: "Player name",
    clubSessionPlayerPlaceholder: "Display name",
    clubSessionPlayerGender: "Gender",
    clubSessionGenderMan: "Man",
    clubSessionGenderWoman: "Woman",
    clubSessionGenderOther: "Other",
    clubSessionGenderUnspecified: "Not specified",
    clubSessionSkillLevel: "Skill 1–5",
    clubSessionAvailability: "Availability",
    clubSessionAvailable: "Ready to play",
    clubSessionLate: "Late",
    clubSessionResting: "Resting",
    clubSessionUnavailable: "Unavailable",
    clubSessionRotationPreferences: "Rotation preferences",
    clubSessionAvoidPlayersBody:
      "Mark players who should not be paired together. The preference can be overridden when court capacity is limited.",
    clubSessionAddPlayer: "Add player",
    clubSessionRosterEmpty: "Add players to start building the queue.",
    clubSessionDeactivate: "Deactivate",
    clubSessionReactivate: "Reactivate",
    clubSessionRecord: "Played {played} · Won {won} · Lost {lost}",
    clubSessionStandingsTitle: "Session standings",
    clubSessionStandingsBody:
      "More wins rank higher; win rate is the next tie-breaker.",
    clubSessionStandingPlayer: "Player",
    clubSessionStandingRecord: "P · W · L",
    clubSessionStandingWinRate: "Win rate",
    clubSessionStandingEmpty:
      "Standings appear after completed matches sync to the server.",
    clubSessionCourtsTitle: "Courts",
    clubSessionCourtName: "Court",
    clubSessionCourtPlaceholder: "For example: Court 1",
    clubSessionAddCourt: "Add court",
    clubSessionCourtsEmpty: "Add at least one court to create a queue entry.",
    clubSessionQueueTitle: "Match queue",
    clubSessionQueueBody:
      "Choose a court and the players required by the session profile, or fill the next courts with Smart Rotation.",
    clubSessionSelectCourt: "Select a court",
    clubSessionSelectPlayer: "Select a player",
    clubSessionTeamAPlayer: "Team A · Player {number}",
    clubSessionTeamBPlayer: "Team B · Player {number}",
    clubSessionAddToQueue: "Add to queue",
    clubSessionGenerateSchedule: "Generate schedule",
    clubSessionGenerateScheduleBody:
      "Build a queue from active players and courts using the session profile.",
    clubSessionScheduleExists:
      "A schedule already exists. Add manual matches if you want to extend it.",
    clubSessionScheduleRequirements:
      "Automatic scheduling needs at least {players} active players and one active court.",
    clubSessionFillNextCourts: "Fill next courts",
    clubSessionSmartRotationBody:
      "Rotation chooses players with the fewest matches, the longest wait, and more varied pairings.",
    clubSessionRotationPreviewTitle: "Next rotation proposal",
    clubSessionRotationPreviewBody:
      "Review the selected players before adding them to the queue.",
    clubSessionRotationWhy:
      "Selection basis: the fewest current matches. Ties favor longer waits, varied pairings/opponents, then skill balance.",
    clubSessionRotationPlayed: "Current match history: {players}",
    clubSessionRotationFairnessGap: "Proposal gap: {count} matches",
    clubSessionRotationTieBreakers:
      "Avoid preference penalty: {avoid} · Repeated partner/opponent penalty: {repeat} · Skill gap: {skill}",
    clubSessionConfirmRotation: "Confirm rotation",
    clubSessionRejectRotation: "Reject proposal",
    clubSessionRotationRejected:
      "Rotation proposal rejected. No queue entry was added.",
    clubSessionRotationStale:
      "The session data changed after this proposal was created. The proposal was cancelled; create a new preview to use the latest state.",
    clubSessionNoFreeCourt:
      "There is no free court yet. Start or finish the current queue entries first.",
    clubSessionRotationRequirements:
      "Rotation needs the profile's required number of ready players.",
    clubSessionMixedFallbackRequired:
      "There is no valid mixed-doubles combination among the players ready to play. You can use open doubles for this rotation.",
    clubSessionMixedManualFallbackRequired:
      "This assignment is not a valid mixed-doubles combination. Confirm if you want to use it as open doubles.",
    clubSessionUseOpenFallback: "Use open doubles this time",
    clubSessionOpenFallback: "Open fallback",
    clubSessionSaveProfileError:
      "The player profile was not saved. Check the connection and try again.",
    clubSessionQueueRequirements:
      "Active players matching the session profile and one active court are required.",
    clubSessionQueueRequirementsDynamic:
      "{players} active players and one court are required.",
    clubSessionAssignmentError:
      "Choose a court and different players that match the session format.",
    clubSessionQueueClosed:
      "This session is closed. Reopen it to add to the queue.",
    clubSessionMatchNumber: "Match {number}",
    clubSessionWinner: "Winner: {team}",
    clubSessionMatchSynced: "Match saved",
    clubSessionMatchNotSynced: "Waiting for score sync",
    clubSessionMatchQueued: "Queued",
    clubSessionOpenMatch: "Open score",
    clubSessionContinueSetup: "Continue setup",
    clubSessionStartMatch: "Start scoring",
    remove: "Remove",
    clubSessionQueueEmpty: "There are no matches in the queue yet.",
    clubSessionPrivacyNote:
      "Session boards are private. Players do not need accounts and cannot view session data from their own devices.",
    clubSessionNamesLocked:
      "Names follow the session roster so results stay attributed to the assigned players.",
    allSports: "All sports",
    communityRuleSetupNote:
      "Choose a published community ruleset for this match.",
    communityRuleSelectPlaceholder: "Choose a community ruleset…",
    browseCommunityRules: "Browse all Community Rules",
    viewCommunityRule: "View rules",
    rulesUnofficial: "Unofficial",
    capMustBeAtLeastTarget: "The point cap must be at least the target score.",
    customRulesInvalid:
      "Enter whole numbers: target 1–101, win-by 1–10, and a point cap at least as high as the target.",
    signIn: "Sign in",
    signInDialogTitle: "Sign in to your account",
    signInDialogDescription:
      "Save match history and continue on another device.",
    signInDialogProviders: "Choose an account provider",
    signInDialogGuestNote: "You can keep playing without an account.",
    signInWithGoogle: "Sign in with Google",
    signInWithProvider: "Sign in with {provider}",
    account: "Account",
    accountMenu: "Account menu",
    accountSettings: "Account settings",
    accountTitle: "Account",
    accountPageTitle: "Account · Skor Lapangan",
    accountIntro: "Manage your account and saved matches.",
    accountSignedInAs: "Signed in as",
    accountRequiresGoogle: "Sign in to open account settings.",
    accountRequiresGoogleBody:
      "An account is needed to open history, sync matches, and manage your data.",
    accountDeleteSection: "Delete account",
    accountDeleteWarning:
      "Account deletion is permanent. History, score events, Live Viewer links, reports, and account data will be removed.",
    accountDeleteButton: "Delete account",
    accountDeleteConfirmTitle: "Delete this account?",
    accountDeleteConfirmBody:
      "Matches, score events, Live Viewer links, reports, and account data will be deleted. Browser data will also be cleared. You will return as a guest.",
    accountDeleteConfirmButton: "Yes, delete account",
    accountDeleteInProgress: "Deleting account…",
    accountDeleteError: "The account was not deleted:",
    accountError: "Account problem:",
    googleSignInError: "Account sign-in failed:",
    accountSignInError: "Account sign-in failed:",
    claimError: "Sign-in succeeded, but guest matches are not synced yet:",
    googleLinkFallback:
      "This identity already has a Skor Lapangan account. We will sign you in there and try to bring over your guest matches.",
    oauthLinkFallback:
      "This identity already has a Skor Lapangan account. We will sign you in there and try to bring over your guest matches.",
    signingOut: "Signing out…",
    savingGuestMatches: "Saving your guest matches to your account…",
    guestMatchesSaved: "Your guest matches are now saved to your account.",
    accountDeleted: "Account deleted. You are back in guest mode.",
    saveHistory: "Save history to your account",
    signOut: "Sign out",
    historySaved: "History saved",
    syncSaved: "Score saved",
    syncLocal: "Saved on this device",
    syncing: "Saving score…",
    syncPending: "Pending sync",
    syncOffline: "Offline · changes are saved on this device",
    pendingSyncBody:
      "The final result is saved on this device and will be sent when the connection returns.",
    syncError: "Could not sync · this match is still saved on this device",
    syncConflict:
      "The server has a newer or different score. Continue from the controlling device.",
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
    matchControlHeld: "This match is being used on another device.",
    matchControlLost: "Control of this match moved to another device.",
    matchReadOnly: "This match is read-only.",
    takeOverMatch: "Take over match",
    matchRemoteConflict: "The server version and this device version differ.",
    matchConflictBody:
      "Choose which result to keep. The app will not merge the scores automatically.",
    localVersion: "This device",
    serverVersion: "Server",
    useServerVersion: "Use server version",
    saveLocalAsNewMatch: "Save as a new Match",
    recovering: "Saving choice...",
    matchControlError: "Could not acquire control of this match.",
    retryControl: "Try again",
    liveViewer: "Live Viewer",
    liveViewerDescription:
      "The link shows score, positions, and server only—never player names. It expires with the match data.",
    createViewerLink: "Share live score",
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
    viewerPageTitle: "Live match score · Skor Lapangan",
    viewerLoading: "Loading the latest score…",
    viewerUnavailable: "Viewer link unavailable",
    viewerUnavailableBody:
      "The link may have been revoked, expired, or be invalid.",
    viewerStale: "Stale · last synced",
    viewerRefresh: "Refresh score",
    viewerDisplayMode: "Display mode",
    viewerDisplayModeBody:
      "Open this large view on a TV or projector. Score control stays on the player device.",
    viewerOpenDisplay: "Open display mode",
    viewerFullscreen: "Full screen",
    viewerExitFullscreen: "Exit full screen",
    viewerLive: "Live",
    updatedAt: "updated",
    score: "Score",
    communityLibraryTitle: "Community Rules",
    communityRulesPageTitle: "Community Rules · Skor Lapangan",
    communityRulesSeoDescription:
      "Browse community-made scoring rules for badminton, pickleball, tennis, padel, table tennis, and squash.",
    communityLibraryIntro:
      "Browse community-made rules. Each ruleset is marked unofficial.",
    communitySearchPlaceholder: "Search rule names or descriptions",
    communityFilterLabel: "Show",
    communityFilterAll: "All rules",
    communityFilterPublished: "Published",
    communityFilterMine: "My rules",
    communityNoResults: "No matching rules",
    clearCommunityFilters: "Clear filters",
    communityDisclaimer:
      "These community rules are unofficial and maintained by their creators. Review them with your group before you play, and use them at your own risk.",
    createCommunityRule: "Create a community ruleset",
    backendNotConfigured: "Supabase is not configured for Community Rules.",
    noCommunityRulesYet: "No public rules yet",
    noCommunityRulesBody: "Published community rules will appear here.",
    unofficial: "Unofficial",
    unpublished: "Unpublished",
    noRuleDescription: "No description provided.",
    backToRules: "Back to community rules",
    ruleUnavailable: "Ruleset unavailable",
    ruleUnavailableBody:
      "The link may be invalid, the ruleset may have been unpublished, or you may not have access.",
    version: "Version",
    useTheseRules: "Use this ruleset",
    shareCommunityRule: "Share this ruleset",
    shareCommunityRuleBody:
      "Share the link or let your group scan the QR code to open this ruleset.",
    qrCode: "Community rules QR code",
    editRule: "Edit this ruleset",
    unpublishRule: "Unpublish",
    republishRule: "Republish",
    reportRule: "Report this ruleset",
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
    reportLimitNote:
      "If you find a different problem, you can send another report. Each account is limited to 3 reports per hour.",
    reportSessionRequired: "Preparing a secure guest session…",
    submitReport: "Submit report",
    reportSubmitted: "Your report has been recorded.",
    reportSubmittedBody:
      "A reviewer will check it manually. The ruleset stays visible until the review is complete.",
    reportAnother: "Report another problem",
    rateLimited: "Too many requests. Please wait a little and try again.",
    saveFailed: "Could not save the change.",
    ruleUnpublished: "This ruleset is no longer listed publicly.",
    ruleRepublished:
      "This ruleset is public again. Its version remains unchanged.",
    notRuleOwner: "Only the ruleset creator can edit it.",
    googleRequired: "Sign in to publish a ruleset.",
    historyGoogleRequired: "Sign in to view your history.",
    googleRequiredBody:
      "Community Rules can only be published and managed by a durable account.",
    ruleTitle: "Rule name",
    sport: "Sport",
    ruleDescription: "Description",
    publishNowNote:
      "Rules are published immediately and can be shared. All community rules are marked unofficial.",
    publishRule: "Publish ruleset",
    noCap: "No point cap",
    shareLink: "Share link",
    matchHistory: "Match history",
    historyPageTitle: "Match history · Skor Lapangan",
    historyIntro: "Matches saved to this account.",
    historyRequiresGoogle:
      "Sign in to view history and reopen it on another device. You can still play without an account.",
    historyLoadError:
      "History could not be loaded. Check your connection and try again.",
    historySearchPlaceholder: "Search by sport or team name",
    historyFilterStatus: "Match status",
    historyFilterAll: "All matches",
    historyFilterInProgress: "In progress",
    historyFilterCompleted: "Completed",
    historyFilterSport: "Sport",
    historyFilterWinner: "Winner",
    teamAWinner: "Team A won",
    teamBWinner: "Team B won",
    historyFromDate: "From date",
    historyToDate: "To date",
    historySort: "Sort by",
    historySortNewest: "Newest",
    historySortOldest: "Oldest",
    historyNoResults: "No matching matches",
    clearHistoryFilters: "Clear filters",
    retryHistory: "Reload history",
    loadMore: "Load more",
    gamesWon: "games won",
    noSavedMatches: "No saved matches yet",
    noSavedMatchesBody: "Start a match while online, or link your account.",
    activeMatch: "In progress",
    historyInProgress: "In progress",
    historyCompleted: "Completed",
    viewMatch: "View score",
    lastUpdated: "Last updated:",
    openOnThisDevice: "Open match",
    detailsOnOriginalDevice:
      "Active matches can be continued on another device after signing in.",
    deleteHistoryMatch: "Delete from history",
    confirmDeleteHistoryMatch: "Yes, delete match",
    deletingHistoryMatch: "Deleting…",
    historyDeleteError:
      "The match was not deleted. Check your connection and try again.",
    historyStatistics: "Match statistics",
    historyStatisticsSource: "Account + this device",
    historyStatisticsLocalSource: "This device",
    historyStatisticsFallback:
      "Account statistics are unavailable. Showing this device's data.",
    historyStatisticsEmpty: "No completed matches for these filters.",
    completedMatches: "Completed matches",
    teamAWins: "Team A wins",
    teamBWins: "Team B wins",
    teamAWinRate: "Team A win rate",
    teamBWinRate: "Team B win rate",
    teamAShort: "A",
    teamBShort: "B",
    shareResult: "Share result",
    shareResultDescription: "Share the final score as text.",
    resultShared: "Match result shared.",
    resultCopied: "Match result copied.",
    shareResultFailed: "The result could not be shared or copied.",
    quickRematch: "Quick rematch",
    completedLocalMatches: "Completed matches on this device",
    completedLocalMatchesBody:
      "Share the result or reuse the same setup for a rematch.",
    rematchLoadError:
      "The rematch configuration could not be loaded. Try again.",
    playedAt: "Date",
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
    document.documentElement.dir = localeDirection(locale);
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
