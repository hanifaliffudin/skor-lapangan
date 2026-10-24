import { registerSW } from "virtual:pwa-register";

type PwaUpdate = (reloadPage?: boolean) => Promise<void>;
export type PwaUpdateResult = "applied" | "deferred" | "unavailable";

const updateListeners = new Set<() => void>();
let updateAvailable = false;
let applyUpdate: PwaUpdate | undefined;

export function isPwaUpdateAvailable(): boolean {
  return updateAvailable;
}

export function subscribeToPwaUpdate(listener: () => void): () => void {
  updateListeners.add(listener);
  if (updateAvailable) listener();
  return () => updateListeners.delete(listener);
}

export async function applyPwaUpdate(): Promise<PwaUpdateResult> {
  if (!applyUpdate) return "unavailable";

  try {
    const { hasActiveOrPendingMatches } = await import("./session");
    if (await hasActiveOrPendingMatches()) return "deferred";
  } catch {
    return "deferred";
  }

  await applyUpdate(true);
  return "applied";
}

applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateAvailable = true;
    updateListeners.forEach((listener) => listener());
  },
});
