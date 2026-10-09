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
    tagline: "Skor jelas. Laga tetap jalan.",
    intro:
      "Scorekeeper dan panduan posisi untuk pertandingan ganda di lapangan.",
    chooseSport: "Pilih olahraga",
    chooseMode: "Pilih mode",
    badminton: "Badminton",
    pickleball: "Pickleball",
    badmintonHint: "Ganda · reli 21",
    pickleballHint: "Ganda · 3 angka",
    casual: "Kasual",
    referee: "Wasit",
    casualHint: "Cepat dan sederhana",
    refereeHint: "Kontrol lebih lengkap",
    continue: "Lanjut atur pemain",
    guestNote:
      "Pertandingan tamu tersedia di perangkat ini hingga 12 jam setelah aktivitas terakhir.",
    resumeTitle: "Pertandingan aktif di perangkat ini",
    resumeBody: "Lanjutkan pertandingan tamu yang belum selesai.",
    resumeMatch: "Lanjutkan pertandingan",
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
      "Salinan perangkat ini dihapus. Data guest di server kedaluwarsa dalam 12 jam; tautan viewer dicabut. Riwayat akun tetap tersimpan.",
    cancel: "Batal",
    confirmEnd: "Ya, akhiri",
    missingTitle: "Pertandingan tidak ditemukan",
    missingBody: "Sesi mungkin sudah ditutup atau data tab telah dibersihkan.",
    newMatch: "Mulai pertandingan baru",
    matchComplete: "Pertandingan selesai",
    winner: "Pemenang",
    sets: "Game menang",
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
    reportMisleading: "Menyesatkan",
    reportUnsafe: "Berisiko atau tidak aman",
    reportSpam: "Spam",
    reportOther: "Lainnya",
    reportDetails: "Detail (opsional)",
    submitReport: "Kirim laporan",
    reportSubmitted: "Laporan diterima.",
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
    tagline: "Clear score. Keep the game moving.",
    intro: "A scorekeeper and position guide for doubles matches on court.",
    chooseSport: "Choose a sport",
    chooseMode: "Choose a mode",
    badminton: "Badminton",
    pickleball: "Pickleball",
    badmintonHint: "Doubles · rally to 21",
    pickleballHint: "Doubles · 3-number score",
    casual: "Casual",
    referee: "Referee",
    casualHint: "Fast and simple",
    refereeHint: "More match controls",
    continue: "Continue to player setup",
    guestNote:
      "Guest matches stay on this device for up to 12 hours after the last activity.",
    resumeTitle: "Active matches on this device",
    resumeBody: "Continue an unfinished guest match.",
    resumeMatch: "Resume match",
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
      "This device copy will be removed. Guest server data expires within 12 hours and the viewer link is revoked. Account history stays saved.",
    cancel: "Cancel",
    confirmEnd: "Yes, end it",
    missingTitle: "Match not found",
    missingBody:
      "The session may have ended or this tab's data may have been cleared.",
    newMatch: "Start a new match",
    matchComplete: "Match complete",
    winner: "Winner",
    sets: "Games won",
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
    reportMisleading: "Misleading",
    reportUnsafe: "Risky or unsafe",
    reportSpam: "Spam",
    reportOther: "Other",
    reportDetails: "Details (optional)",
    submitReport: "Submit report",
    reportSubmitted: "Report received.",
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

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() =>
    window.localStorage.getItem("skor-lapangan:locale") === "id" ? "id" : "en",
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem("skor-lapangan:locale", locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key) => messages[locale][key] }),
    [locale],
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
