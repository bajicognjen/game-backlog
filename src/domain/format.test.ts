import { describe, expect, it } from "vitest";
import { formatHours, formatWeeks } from "./format";

describe("format", () => {
  it("shows whole hours without decimals and fractions with one", () => {
    expect(formatHours(25)).toBe("25");
    expect(formatHours(12.5)).toBe("12.5");
    expect(formatHours(901)).toBe("901");
  });

  it("always shows weeks with one decimal", () => {
    expect(formatWeeks(901 / 13)).toBe("69.3");
    expect(formatWeeks(7)).toBe("7.0");
  });
});
