import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStorageLocalControlStore } from "../../lib/localControl";
import { useMatchControl } from "./useMatchControl";

const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

function setLockManager(value: LockManager | undefined) {
  if (value) {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value,
    });
  } else {
    Reflect.deleteProperty(navigator, "locks");
  }
}

afterEach(() => {
  if (originalLocks) {
    Object.defineProperty(navigator, "locks", originalLocks);
  } else {
    Reflect.deleteProperty(navigator, "locks");
  }
});

describe("useMatchControl", () => {
  it("waits for the current controller and takes control when it releases", async () => {
    let grant: (() => void) | undefined;
    const request = vi.fn(
      (
        _name: string,
        options: LockOptions,
        callback: (lock: Lock) => unknown,
      ) =>
        new Promise<void>((resolve, reject) => {
          const abort = () =>
            reject(new DOMException("The request was aborted", "AbortError"));
          options.signal?.addEventListener("abort", abort, { once: true });
          grant = () => {
            options.signal?.removeEventListener("abort", abort);
            Promise.resolve(callback({} as Lock)).then(() => resolve(), reject);
          };
        }),
    );
    setLockManager({ request } as unknown as LockManager);

    const { result, unmount } = renderHook(() => useMatchControl("match-1"));

    expect(result.current.status).toBe("waiting");
    expect(result.current.canControl).toBe(false);

    await act(async () => {
      grant?.();
    });

    expect(result.current.status).toBe("active");
    expect(result.current.canControl).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("allows a retry when the browser rejects a lock request", async () => {
    let grant: (() => void) | undefined;
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("Lock request failed"))
      .mockImplementation(
        (
          _name: string,
          _options: LockOptions,
          callback: (lock: Lock) => unknown,
        ) =>
          new Promise<void>((resolve, reject) => {
            grant = () =>
              Promise.resolve(callback({} as Lock)).then(
                () => resolve(),
                reject,
              );
          }),
      );
    setLockManager({ request } as unknown as LockManager);

    const { result } = renderHook(() => useMatchControl("match-2"));
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await act(async () => {
      grant?.();
    });

    expect(result.current.canControl).toBe(true);
  });

  it("allows control in browsers without the Web Locks API", async () => {
    setLockManager(undefined);
    const { result, unmount } = renderHook(() => useMatchControl("match-3"));

    await waitFor(() => expect(result.current.canControl).toBe(true));
    unmount();
  });

  it("waits for a durable local Control and recovers after release", async () => {
    setLockManager(undefined);
    const store = createStorageLocalControlStore(window.localStorage);
    await store.claim("match-4", "other-tab", Date.now());

    const { result, unmount } = renderHook(() => useMatchControl("match-4"));
    await waitFor(() => expect(result.current.status).toBe("waiting"));
    expect(result.current.canControl).toBe(false);

    await act(async () => {
      await store.release("match-4", "other-tab");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "skor-lapangan:control:match-4",
        }),
      );
    });
    await waitFor(() => expect(result.current.canControl).toBe(true));
    unmount();
  });
});
