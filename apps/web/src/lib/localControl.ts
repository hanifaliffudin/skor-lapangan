export type LocalControlClaimResult = "acquired" | "held" | "unavailable";

export const localControlLeaseMs = 10_000;

interface LocalControlRecord {
  matchId: string;
  ownerId: string;
  expiresAt: number;
}

export interface LocalControlStore {
  claim(
    matchId: string,
    ownerId: string,
    now?: number,
  ): Promise<LocalControlClaimResult>;
  renew(matchId: string, ownerId: string, now?: number): Promise<boolean>;
  release(matchId: string, ownerId: string): Promise<boolean>;
}

const storagePrefix = "skor-lapangan:control:";
const databaseName = "skor-lapangan-control";
const databaseVersion = 1;
const objectStoreName = "leases";

function isRecord(value: unknown): value is LocalControlRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as LocalControlRecord).matchId === "string" &&
    typeof (value as LocalControlRecord).ownerId === "string" &&
    typeof (value as LocalControlRecord).expiresAt === "number"
  );
}

function recordFor(matchId: string, ownerId: string, now: number) {
  return {
    matchId,
    ownerId,
    expiresAt: now + localControlLeaseMs,
  } satisfies LocalControlRecord;
}

export function createStorageLocalControlStore(
  storage: Storage,
): LocalControlStore {
  const keyFor = (matchId: string) => `${storagePrefix}${matchId}`;
  const read = (matchId: string): LocalControlRecord | null => {
    const value = storage.getItem(keyFor(matchId));
    if (!value) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  return {
    async claim(matchId, ownerId, now = Date.now()) {
      const current = read(matchId);
      if (current && current.expiresAt > now && current.ownerId !== ownerId) {
        return "held";
      }
      try {
        storage.setItem(
          keyFor(matchId),
          JSON.stringify(recordFor(matchId, ownerId, now)),
        );
        return "acquired";
      } catch {
        return "unavailable";
      }
    },
    async renew(matchId, ownerId, now = Date.now()) {
      const current = read(matchId);
      if (!current || current.ownerId !== ownerId || current.expiresAt <= now) {
        return false;
      }
      try {
        storage.setItem(
          keyFor(matchId),
          JSON.stringify(recordFor(matchId, ownerId, now)),
        );
        return true;
      } catch {
        return false;
      }
    },
    async release(matchId, ownerId) {
      const current = read(matchId);
      if (!current || current.ownerId !== ownerId) return false;
      try {
        storage.removeItem(keyFor(matchId));
        return true;
      } catch {
        return false;
      }
    },
  };
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(databaseName, databaseVersion);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(objectStoreName)) {
        request.result.createObjectStore(objectStoreName, {
          keyPath: "matchId",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Local Control database is blocked."));
  });
}

function transactionError(transaction: IDBTransaction): Error {
  return transaction.error ?? new Error("Local Control transaction failed.");
}

export function createIndexedDbLocalControlStore(
  factory: IDBFactory,
): LocalControlStore {
  let databasePromise: Promise<IDBDatabase> | null = null;
  const database = () => {
    databasePromise ??= openDatabase(factory).catch((error) => {
      databasePromise = null;
      throw error;
    });
    return databasePromise;
  };

  return {
    async claim(matchId, ownerId, now = Date.now()) {
      try {
        const db = await database();
        return await new Promise<LocalControlClaimResult>((resolve, reject) => {
          const transaction = db.transaction(objectStoreName, "readwrite");
          const store = transaction.objectStore(objectStoreName);
          let result: LocalControlClaimResult = "held";
          const request = store.get(matchId);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const current = request.result as LocalControlRecord | undefined;
            if (
              current &&
              current.expiresAt > now &&
              current.ownerId !== ownerId
            ) {
              result = "held";
              return;
            }
            store.put(recordFor(matchId, ownerId, now));
            result = "acquired";
          };
          transaction.oncomplete = () => resolve(result);
          transaction.onerror = () => reject(transactionError(transaction));
          transaction.onabort = () => reject(transactionError(transaction));
        });
      } catch {
        return "unavailable";
      }
    },
    async renew(matchId, ownerId, now = Date.now()) {
      try {
        const db = await database();
        return await new Promise<boolean>((resolve, reject) => {
          const transaction = db.transaction(objectStoreName, "readwrite");
          const store = transaction.objectStore(objectStoreName);
          let renewed = false;
          const request = store.get(matchId);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const current = request.result as LocalControlRecord | undefined;
            if (
              current &&
              current.ownerId === ownerId &&
              current.expiresAt > now
            ) {
              store.put(recordFor(matchId, ownerId, now));
              renewed = true;
            }
          };
          transaction.oncomplete = () => resolve(renewed);
          transaction.onerror = () => reject(transactionError(transaction));
          transaction.onabort = () => reject(transactionError(transaction));
        });
      } catch {
        return false;
      }
    },
    async release(matchId, ownerId) {
      try {
        const db = await database();
        return await new Promise<boolean>((resolve, reject) => {
          const transaction = db.transaction(objectStoreName, "readwrite");
          const store = transaction.objectStore(objectStoreName);
          let released = false;
          const request = store.get(matchId);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const current = request.result as LocalControlRecord | undefined;
            if (current?.ownerId === ownerId) {
              store.delete(matchId);
              released = true;
            }
          };
          transaction.oncomplete = () => resolve(released);
          transaction.onerror = () => reject(transactionError(transaction));
          transaction.onabort = () => reject(transactionError(transaction));
        });
      } catch {
        return false;
      }
    },
  };
}

function unavailableLocalControlStore(): LocalControlStore {
  return {
    async claim() {
      return "unavailable";
    },
    async renew() {
      return false;
    },
    async release() {
      return false;
    },
  };
}

function createBrowserLocalControlStore(): LocalControlStore {
  if (typeof indexedDB !== "undefined") {
    return createIndexedDbLocalControlStore(indexedDB);
  }
  if (typeof window !== "undefined") {
    return createStorageLocalControlStore(window.localStorage);
  }
  return unavailableLocalControlStore();
}

export const localControlStore = createBrowserLocalControlStore();

export function createTabControlIdentity(): string {
  const key = "skor-lapangan:control-tab-id";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const identity = crypto.randomUUID();
    window.sessionStorage.setItem(key, identity);
    return identity;
  } catch {
    return crypto.randomUUID();
  }
}
