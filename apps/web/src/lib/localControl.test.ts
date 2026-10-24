import { describe, expect, it } from "vitest";
import { createStorageLocalControlStore } from "./localControl";

describe("local Match Control store", () => {
  it("keeps one tab as Control until its lease expires", async () => {
    const store = createStorageLocalControlStore(window.localStorage);

    await expect(store.claim("match-1", "tab-a", 1_000)).resolves.toBe(
      "acquired",
    );
    await expect(store.claim("match-1", "tab-b", 1_500)).resolves.toBe("held");
    await expect(store.claim("match-1", "tab-a", 2_000)).resolves.toBe(
      "acquired",
    );
    await expect(store.claim("match-1", "tab-b", 2_500)).resolves.toBe("held");
    await expect(store.claim("match-1", "tab-b", 12_001)).resolves.toBe(
      "acquired",
    );
  });

  it("only lets the current owner renew or release Control", async () => {
    const store = createStorageLocalControlStore(window.localStorage);

    await expect(store.claim("match-2", "tab-a", 2_000)).resolves.toBe(
      "acquired",
    );
    await expect(store.renew("match-2", "tab-b", 3_000)).resolves.toBe(false);
    await expect(store.release("match-2", "tab-b")).resolves.toBe(false);
    await expect(store.renew("match-2", "tab-a", 3_000)).resolves.toBe(true);
    await expect(store.release("match-2", "tab-a")).resolves.toBe(true);
    await expect(store.claim("match-2", "tab-b", 3_001)).resolves.toBe(
      "acquired",
    );
  });
});
