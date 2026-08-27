import { describe, expect, it } from "vitest";
import { changeTone, formatCurrency, formatIndex, formatPercent } from "./format";

describe("formatCurrency", () => {
  it("renders INR with no decimals and a dash for nullish", () => {
    expect(formatCurrency(5200)).toMatch(/5,200/);
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("adds a sign for positive values by default", () => {
    expect(formatPercent(3.2)).toBe("+3.20%");
    expect(formatPercent(-1.5)).toBe("-1.50%");
    expect(formatPercent(2, { sign: false })).toBe("2.00%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatIndex", () => {
  it("keeps up to two decimals", () => {
    expect(formatIndex(106.123)).toBe("106.12");
    expect(formatIndex(100)).toBe("100");
  });
});

describe("changeTone", () => {
  it("treats near-zero as flat", () => {
    expect(changeTone(0)).toBe("flat");
    expect(changeTone(0.01)).toBe("flat");
    expect(changeTone(1)).toBe("up");
    expect(changeTone(-1)).toBe("down");
    expect(changeTone(null)).toBe("flat");
  });
});
