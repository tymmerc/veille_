import { describe, it, expect, vi, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

vi.mock("./auth", () => ({ getSession: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: {} }));

import { isWeek, listWeeks, readWeek } from "./analyses";

let dir = "";
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "analyses-"));
  writeFileSync(path.join(dir, "2026-W45.json"), JSON.stringify({ semaine: "2026-W45", en_une: "Calme." }));
  writeFileSync(path.join(dir, "2026-W46.json"), JSON.stringify({ semaine: "2026-W46", en_une: "Chargée." }));
  writeFileSync(path.join(dir, "notes.txt"), "pas une analyse");
});

describe("analyses", () => {
  it("accepts only real week ids", () => {
    expect(isWeek("2026-W45")).toBe(true);
    expect(isWeek("../../etc/passwd")).toBe(false);
    expect(isWeek("2026-W45.json")).toBe(false);
  });

  it("lists weeks, newest first, ignoring other files", async () => {
    expect(await listWeeks(dir)).toEqual(["2026-W46", "2026-W45"]);
  });

  it("reads a week and refuses anything that is not a week id", async () => {
    expect((await readWeek("2026-W45", dir))?.en_une).toBe("Calme.");
    expect(await readWeek("../2026-W45", dir)).toBeNull();
    expect(await readWeek("2026-W01", dir)).toBeNull();
  });

  it("missing folder gives an empty list", async () => {
    expect(await listWeeks(path.join(dir, "nope"))).toEqual([]);
  });
});
