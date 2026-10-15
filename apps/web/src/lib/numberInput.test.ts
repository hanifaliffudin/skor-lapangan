import { describe, expect, it } from "vitest";
import { normalizeIntegerInput } from "./numberInput";

describe("normalizeIntegerInput", () => {
  it("removes leading zeroes without removing the zero value", () => {
    expect(normalizeIntegerInput("042")).toBe("42");
    expect(normalizeIntegerInput("00042")).toBe("42");
    expect(normalizeIntegerInput("0")).toBe("0");
    expect(normalizeIntegerInput("")).toBe("");
  });
});
