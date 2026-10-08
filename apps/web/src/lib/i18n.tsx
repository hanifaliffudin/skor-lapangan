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
      "Pertandingan tamu tersimpan di tab ini dan hilang saat tab ditutup.",
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
    endBody: "Data pertandingan tamu akan dihapus dari tab ini.",
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
      "Guest matches stay in this tab and disappear when the tab is closed.",
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
    endBody: "The guest match data will be removed from this tab.",
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
