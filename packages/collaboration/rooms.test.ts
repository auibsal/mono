import { describe, expect, test } from "vitest";
import { presenceColor } from "./colors";
import { parseRoom, roomId } from "./rooms";

const BRAND_COLOUR = /^var\(--sal-(crimson|ink)/;
const id = "0b6f6d5e-1f2a-4c3b-9d8e-7f6a5b4c3d2e";

describe("collaboration rooms", () => {
  test("a known kind and uuid round-trip", () => {
    expect(parseRoom(roomId("minutes", id))).toMatchObject({
      id,
      kind: "minutes",
      permission: "governance.minutes.write",
    });
  });

  test("anything else is refused", () => {
    for (const room of [
      `sal:submission:${id}`,
      `sal:minutes:${id}x`,
      `minutes:${id}`,
      "sal:minutes:*",
      `sal:__proto__:${id}`,
      `sal:minutes:${id.toUpperCase()}`,
    ]) {
      expect(parseRoom(room), room).toBeNull();
    }
  });

  test("blind-review submissions never get a room", () => {
    expect(parseRoom(`sal:submission:${id}`)).toBeNull();
    expect(parseRoom(`sal:blind:${id}`)).toBeNull();
  });

  test("presence colours come from the brand palette", () => {
    for (const user of ["a", "b", "c", id]) {
      expect(presenceColor(user)).toMatch(BRAND_COLOUR);
    }
  });
});
