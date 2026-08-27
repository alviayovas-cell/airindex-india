import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const cols = [
  { key: "route", header: "Route" },
  { key: "fare", header: "Avg fare" },
];

describe("toCsv", () => {
  it("writes a header row then one line per row", () => {
    const csv = toCsv(cols, [
      { route: "DEL-BOM", fare: 5200 },
      { route: "DEL-BLR", fare: 5600 },
    ]);
    expect(csv.split("\n")).toEqual([
      "Route,Avg fare",
      "DEL-BOM,5200",
      "DEL-BLR,5600",
    ]);
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    const csv = toCsv([{ key: "v", header: "V" }], [
      { v: 'a,"b"\nc' },
    ]);
    expect(csv).toBe('V\n"a,""b""\nc"');
  });

  it("renders null and undefined as empty cells", () => {
    const csv = toCsv(cols, [{ route: null, fare: undefined }]);
    expect(csv).toBe("Route,Avg fare\n,");
  });
});
