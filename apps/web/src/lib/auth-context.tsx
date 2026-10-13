import { createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AuthAction =
  "idle" | "google" | "claiming" | "signing-out" | "deleting";
export type AuthErrorKind = "guest" | "google" | "claim" | "delete" | null;

export interface AuthContextValue {
  loading: boolean;
  action: AuthAction;
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
  authError: string | null;
  authErrorKind: AuthErrorKind;
  authNotice: string | null;
  retryGuestSession: (captchaToken?: string) => Promise<void>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<boolean>;
  deleteAccount: () => Promise<string | null>;
}

export const guestAuth: AuthContextValue = {
  loading: false,
  action: "idle",
  session: null,
  user: null,
  isAnonymous: false,
  authError: null,
  authErrorKind: null,
  authNotice: null,
  retryGuestSession: async () => undefined,
  signInWithGoogle: async () => "Supabase is not configured.",
  signOut: async () => false,
  deleteAccount: async () => "Supabase is not configured.",
};

export const AuthContext = createContext<AuthContextValue>(guestAuth);

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export type AuthProviderProps = { children: ReactNode };
