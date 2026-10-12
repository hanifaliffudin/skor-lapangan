import { registerSW } from "virtual:pwa-register";

type PwaUpdate = (reloadPage?: boolean) => Promise<void>;

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

export function applyPwaUpdate(): Promise<void> | undefined {
  return applyUpdate?.(true);
}

applyUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateAvailable = true;
    updateListeners.forEach((listener) => listener());
  },
});
