import type { MatchJournal } from "@skor-lapangan/scoring-core";

export const matchStoreSchemaVersion = 1;

const databaseName = "skor-lapangan";
const databaseVersion = 1;
const objectStoreName = "matches";
const storagePrefix = "skor-lapangan:match-store:";

export interface StoredMatchRecord {
  matchId: string;
  schemaVersion: number;
  journal: MatchJournal;
  expiresAt?: string;
  ownerId?: string;
  sync?: MatchSyncMetadata;
}

export type MatchSyncStatus = "local" | "pending";

export interface MatchSyncMetadata {
  status: MatchSyncStatus;
  lastServerSequence: number;
  pendingFromSequence: number | null;
  updatedAt: string;
}

export interface MatchStore {
  get(matchId: string): Promise<StoredMatchRecord | null>;
  list(): Promise<StoredMatchRecord[]>;
  put(record: StoredMatchRecord): Promise<void>;
  remove(matchId: string): Promise<void>;
  clear(): Promise<void>;
}

export class MatchStoreError extends Error {
  readonly code: "unavailable" | "persistence_failed";

  constructor(
    code: "unavailable" | "persistence_failed",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "MatchStoreError";
    this.code = code;
  }
}

function cloneRecord(record: StoredMatchRecord): StoredMatchRecord {
  return JSON.parse(JSON.stringify(record)) as StoredMatchRecord;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
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
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB could not be opened."));
    request.onblocked = () =>
      reject(new Error("IndexedDB is blocked by another browser context."));
  });
}

export function createIndexedDbMatchStore(factory: IDBFactory): MatchStore {
  let databasePromise: Promise<IDBDatabase> | null = null;
  const database = () => {
    databasePromise ??= openDatabase(factory).catch((error) => {
      databasePromise = null;
      throw new MatchStoreError(
        "unavailable",
        "Durable Match storage is unavailable.",
        { cause: error },
      );
    });
    return databasePromise;
  };

  return {
    async get(matchId) {
      try {
        const db = await database();
        const transaction = db.transaction(objectStoreName, "readonly");
        const result = await requestResult(
          transaction.objectStore(objectStoreName).get(matchId),
        );
        return result ? cloneRecord(result as StoredMatchRecord) : null;
      } catch (error) {
        if (error instanceof MatchStoreError) throw error;
        throw new MatchStoreError(
          "persistence_failed",
          "Could not read the saved Match.",
          { cause: error },
        );
      }
    },
    async list() {
      try {
        const db = await database();
        const transaction = db.transaction(objectStoreName, "readonly");
        const result = await requestResult(
          transaction.objectStore(objectStoreName).getAll(),
        );
        return (result as StoredMatchRecord[]).map(cloneRecord);
      } catch (error) {
        if (error instanceof MatchStoreError) throw error;
        throw new MatchStoreError(
          "persistence_failed",
          "Could not read saved Matches.",
          { cause: error },
        );
      }
    },
    async put(record) {
      try {
        const db = await database();
        const transaction = db.transaction(objectStoreName, "readwrite");
        transaction.objectStore(objectStoreName).put(cloneRecord(record));
        await transactionComplete(transaction);
      } catch (error) {
        if (error instanceof MatchStoreError) throw error;
        throw new MatchStoreError(
          "persistence_failed",
          "Could not save the Match on this device.",
          { cause: error },
        );
      }
    },
    async remove(matchId) {
      try {
        const db = await database();
        const transaction = db.transaction(objectStoreName, "readwrite");
        transaction.objectStore(objectStoreName).delete(matchId);
        await transactionComplete(transaction);
      } catch (error) {
        if (error instanceof MatchStoreError) throw error;
        throw new MatchStoreError(
          "persistence_failed",
          "Could not remove the saved Match.",
          { cause: error },
        );
      }
    },
    async clear() {
      try {
        const db = await database();
        const transaction = db.transaction(objectStoreName, "readwrite");
        transaction.objectStore(objectStoreName).clear();
        await transactionComplete(transaction);
      } catch (error) {
        if (error instanceof MatchStoreError) throw error;
        throw new MatchStoreError(
          "persistence_failed",
          "Could not remove saved Matches.",
          { cause: error },
        );
      }
    },
  };
}

export function createStorageMatchStore(storage: Storage): MatchStore {
  const keyFor = (matchId: string) => `${storagePrefix}${matchId}`;

  return {
    async get(matchId) {
      const value = storage.getItem(keyFor(matchId));
      if (!value) return null;
      try {
        return cloneRecord(JSON.parse(value) as StoredMatchRecord);
      } catch (error) {
        throw new MatchStoreError(
          "persistence_failed",
          "Could not read the saved Match.",
          { cause: error },
        );
      }
    },
    async list() {
      const records: StoredMatchRecord[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(storagePrefix)) continue;
        const matchId = key.slice(storagePrefix.length);
        const record = await this.get(matchId);
        if (record) records.push(record);
      }
      return records;
    },
    async put(record) {
      try {
        storage.setItem(keyFor(record.matchId), JSON.stringify(record));
      } catch (error) {
        throw new MatchStoreError(
          "persistence_failed",
          "Could not save the Match on this device.",
          { cause: error },
        );
      }
    },
    async remove(matchId) {
      try {
        storage.removeItem(keyFor(matchId));
      } catch (error) {
        throw new MatchStoreError(
          "persistence_failed",
          "Could not remove the saved Match.",
          { cause: error },
        );
      }
    },
    async clear() {
      try {
        const keys: string[] = [];
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key?.startsWith(storagePrefix)) keys.push(key);
        }
        keys.forEach((key) => storage.removeItem(key));
      } catch (error) {
        throw new MatchStoreError(
          "persistence_failed",
          "Could not remove saved Matches.",
          { cause: error },
        );
      }
    },
  };
}

export function createBrowserMatchStore(): MatchStore {
  if (typeof indexedDB !== "undefined") {
    return createIndexedDbMatchStore(indexedDB);
  }
  if (typeof window !== "undefined") {
    return createStorageMatchStore(window.localStorage);
  }
  throw new MatchStoreError(
    "unavailable",
    "Durable Match storage is unavailable.",
  );
}

export const matchStore = createBrowserMatchStore();
