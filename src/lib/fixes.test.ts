import { describe, it, expect, vi, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

vi.mock("./auth", () => ({ getSession: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: {} }));

import { isFixId, listFixes, readFix, claudeLink } from "./fixes";

let dir = "";
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "fixes-"));
  const base = { titre: "", projets: [], nb_failles: 1, nb_critiques: 0, cible: "", prompt: "p", failles: [] };
  writeFileSync(path.join(dir, "npm-axios-1.13.2.json"), JSON.stringify({ ...base, id: "npm-axios-1.13.2", gravite: "haute" }));
  writeFileSync(path.join(dir, "npm-next-14.0.4.json"), JSON.stringify({ ...base, id: "npm-next-14.0.4", gravite: "critique", nb_critiques: 4 }));
  writeFileSync(path.join(dir, "notes.txt"), "pas un brief");
});

describe("fixes", () => {
  it("accepts only safe ids", () => {
    expect(isFixId("npm-next-14.0.4")).toBe(true);
    expect(isFixId("../../etc/passwd")).toBe(false);
    expect(isFixId("npm/next")).toBe(false);
  });

  it("lists critical first", async () => {
    expect((await listFixes(dir)).map((f) => f.id)).toEqual(["npm-next-14.0.4", "npm-axios-1.13.2"]);
  });

  it("reads one brief and refuses unsafe ids", async () => {
    expect((await readFix("npm-next-14.0.4", dir))?.gravite).toBe("critique");
    expect(await readFix("../npm-next-14.0.4", dir)).toBeNull();
  });

  it("builds the desktop deep link with the prompt url-encoded", () => {
    expect(claudeLink("Corrige & vérifie")).toBe("claude://code/new?q=Corrige%20%26%20v%C3%A9rifie");
  });
});
