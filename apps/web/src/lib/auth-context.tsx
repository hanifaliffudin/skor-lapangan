import { createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
  authError: string | null;
  retryGuestSession: (captchaToken?: string) => Promise<void>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const guestAuth: AuthContextValue = {
  loading: false,
  session: null,
  user: null,
  isAnonymous: false,
  authError: null,
  retryGuestSession: async () => undefined,
  signInWithGoogle: async () => "Supabase is not configured.",
  signOut: async () => undefined,
};

export const AuthContext = createContext<AuthContextValue>(guestAuth);

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export type AuthProviderProps = { children: ReactNode };
