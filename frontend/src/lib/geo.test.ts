import { describe, expect, it } from "vitest";
import {
  CITIES,
  INDIA_OUTLINE,
  indiaOutlinePath,
  LAT_MAX,
  LAT_MIN,
  projectLatLng,
} from "./geo";

describe("projectLatLng", () => {
  const W = 400;
  const H = 440;

  it("places the northern extreme near the top and the southern near the bottom", () => {
    const [, yNorth] = projectLatLng(LAT_MAX, 80, W, H);
    const [, ySouth] = projectLatLng(LAT_MIN, 80, W, H);
    expect(yNorth).toBeCloseTo(0);
    expect(ySouth).toBeCloseTo(H);
    expect(yNorth).toBeLessThan(ySouth);
  });

  it("is monotonic in longitude (east => larger x)", () => {
    const [xWest] = projectLatLng(20, 70, W, H);
    const [xEast] = projectLatLng(20, 90, W, H);
    expect(xEast).toBeGreaterThan(xWest);
  });

  it("keeps the six basket cities inside the viewport", () => {
    for (const c of Object.values(CITIES)) {
      const [x, y] = projectLatLng(c.lat, c.lon, W, H);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(W);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(H);
    }
  });

  it("orders Delhi above Chennai and Mumbai west of Kolkata", () => {
    const [, delY] = projectLatLng(CITIES.DEL.lat, CITIES.DEL.lon, W, H);
    const [, maaY] = projectLatLng(CITIES.MAA.lat, CITIES.MAA.lon, W, H);
    expect(delY).toBeLessThan(maaY);

    const [bomX] = projectLatLng(CITIES.BOM.lat, CITIES.BOM.lon, W, H);
    const [ccuX] = projectLatLng(CITIES.CCU.lat, CITIES.CCU.lon, W, H);
    expect(bomX).toBeLessThan(ccuX);
  });
});

describe("indiaOutlinePath", () => {
  it("produces a closed SVG path with a move + line commands", () => {
    const d = indiaOutlinePath(400, 440);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect((d.match(/L/g) ?? []).length).toBe(INDIA_OUTLINE.length - 1);
  });
});
