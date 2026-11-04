import { describe, expect, it } from "vitest";
import {
  MS_PER_DAY,
  addDays,
  floorToDay,
  formatDate,
  isValidIsoDate,
  parseIsoDate,
  toIsoDate,
  todayIso,
} from "./dates";

describe("parseIsoDate / toIsoDate", () => {
  it("parses an ISO date to UTC midnight", () => {
    expect(parseIsoDate("2026-11-02")).toBe(Date.UTC(2026, 10, 2));
  });

  it("round-trips through toIsoDate", () => {
    for (const iso of ["2026-01-01", "2026-11-02", "2028-02-29", "1999-12-31"]) {
      expect(toIsoDate(parseIsoDate(iso))).toBe(iso);
    }
  });

  it("rejects malformed and impossible dates", () => {
    for (const bad of ["", "2026-2-3", "02.11.2026", "2026-02-30", "2027-02-29", "abc"]) {
      expect(() => parseIsoDate(bad), bad).toThrow();
      expect(isValidIsoDate(bad), bad).toBe(false);
    }
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });
});

describe("formatDate", () => {
  it("formats as dd.MM.yyyy with zero padding", () => {
    expect(formatDate("2026-03-05")).toBe("05.03.2026");
    expect(formatDate(parseIsoDate("2026-11-15"))).toBe("15.11.2026");
  });

  it("floors fractional days like a spreadsheet", () => {
    const day = parseIsoDate("2026-11-15");
    expect(formatDate(day + 0.01 * MS_PER_DAY)).toBe("15.11.2026");
    expect(formatDate(day + 0.999 * MS_PER_DAY)).toBe("15.11.2026");
    expect(formatDate(day + 1.0 * MS_PER_DAY)).toBe("16.11.2026");
  });
});

describe("day arithmetic", () => {
  it("treats every day as exactly 24 hours, across DST changes too", () => {
    // Europe switches to summer time on 2026-03-29.
    const before = parseIsoDate("2026-03-28");
    expect(addDays(before, 2) - before).toBe(2 * MS_PER_DAY);
    expect(toIsoDate(addDays(before, 2))).toBe("2026-03-30");
  });

  it("keeps fractions and floors only on demand", () => {
    const start = parseIsoDate("2026-11-02");
    const end = addDays(start, 13.46);
    expect(end).not.toBe(floorToDay(end));
    expect(toIsoDate(end)).toBe("2026-11-15");
  });
});

describe("todayIso", () => {
  it("uses the local calendar date", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(todayIso(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });
});
