import { createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AuthProviderId } from "./runtime-config";

export type AuthAction =
  "idle" | "oauth" | "claiming" | "signing-out" | "deleting";
export type AuthErrorKind = "guest" | "oauth" | "claim" | "delete" | null;

export interface AuthContextValue {
  loading: boolean;
  action: AuthAction;
  session: Session | null;
  user: User | null;
  isAnonymous: boolean;
  authError: string | null;
  authErrorKind: AuthErrorKind;
  authNotice: string | null;
  authProviders: readonly AuthProviderId[];
  retryGuestSession: (captchaToken?: string) => Promise<void>;
  signInWithProvider: (provider: AuthProviderId) => Promise<string | null>;
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
  authProviders: ["google"],
  retryGuestSession: async () => undefined,
  signInWithProvider: async () => "Supabase is not configured.",
  signInWithGoogle: async () => "Supabase is not configured.",
  signOut: async () => false,
  deleteAccount: async () => "Supabase is not configured.",
};

export const AuthContext = createContext<AuthContextValue>(guestAuth);

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export type AuthProviderProps = { children: ReactNode };
