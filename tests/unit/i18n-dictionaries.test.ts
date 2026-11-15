// Feature softball/schedule — slice S2 (i18n foundation).
// @scenario-id: schedule-unit-010
// @scenario-name: The `es` dictionary has exactly the keys of `en` (no missing/extra).
// Spec: docs/features/softball/schedule/scenarios.md §S2, overview.md §4.
//
// The `satisfies Dictionary` typing on `es` gives compile-time completeness; this test is the
// runtime twin: identical key paths in both directions, and no empty-string values.

import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";

type Tree = { [key: string]: string | Tree };

function isTree(value: unknown): value is Tree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every leaf key path ("nav.teams"), sorted. Non-string, non-object leaves are reported. */
function leafPaths(tree: Tree, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isTree(value)) out.push(...leafPaths(value, path));
    else out.push(path);
  }
  return out.sort();
}

function leafEntries(tree: Tree, prefix = ""): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isTree(value)) out.push(...leafEntries(value, path));
    else out.push([path, value]);
  }
  return out;
}

describe("schedule-unit-010: es dictionary mirrors en", () => {
  it("en and es are non-empty nested objects", () => {
    expect(isTree(en)).toBe(true);
    expect(isTree(es)).toBe(true);
    expect(leafPaths(en as unknown as Tree).length).toBeGreaterThan(0);
  });

  it("es has exactly the key paths of en (no missing, no extra)", () => {
    const enPaths = leafPaths(en as unknown as Tree);
    const esPaths = leafPaths(es as unknown as Tree);
    const missing = enPaths.filter((p) => !esPaths.includes(p));
    const extra = esPaths.filter((p) => !enPaths.includes(p));
    expect(missing, "keys in en missing from es").toEqual([]);
    expect(extra, "keys in es not present in en").toEqual([]);
  });

  it("every leaf in both dictionaries is a non-empty string", () => {
    for (const [name, dict] of [
      ["en", en],
      ["es", es],
    ] as const) {
      for (const [path, value] of leafEntries(dict as unknown as Tree)) {
        expect(typeof value, `${name}.${path} is not a string`).toBe("string");
        expect((value as string).trim(), `${name}.${path} is empty`).not.toBe("");
      }
    }
  });
});
