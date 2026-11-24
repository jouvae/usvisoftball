import { describe, expect, it } from "vitest";
import {
  isAllowedImagePath,
  isBlockedImage,
  normalizeBody,
  parseArticleSpec,
} from "@/lib/article-spec";

const ROOTS = ["/repo/.local", "/work/run-1"];

const valid = () => ({
  title: "USVI Faces Mexico as Pool Play Wraps Up",
  excerpt: "The Virgin Islands close out Group C today.",
  body: "First paragraph.\n\nSecond paragraph. 🇻🇮",
  category: "Game Preview",
  cover: { file: "/repo/.local/usvisoftball-8.jpeg", alt: "Players on the infield" },
  provenance: { model: "claude-opus-5-5", source: "federation copy (verbatim)" },
});

describe("article-spec", () => {
  it("article-spec-001: a valid spec parses with defaults (slug, author, focus, in-review timing)", () => {
    const r = parseArticleSpec(valid(), { allowedRoots: ROOTS });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.slug).toBe("usvi-faces-mexico-as-pool-play-wraps-up");
    expect(r.spec.authorName).toBe("Federation Staff");
    expect(r.spec.cover.focus).toBe("attention");
    expect(r.spec.publishedAt).toBeNull();
    expect(r.spec.eventSlug).toBeNull();
  });

  it("article-spec-002: the travel sheet is blocked by name, under any path or extension", () => {
    expect(isBlockedImage("/repo/softball-schedule.jpeg")).toBe(true);
    expect(isBlockedImage("/work/Softball-Schedule.PNG")).toBe(true);
    expect(isBlockedImage("/work/softball-schedule-crop.jpg")).toBe(true);
    expect(isBlockedImage("/repo/.local/usvisoftball-8.jpeg")).toBe(false);
    const spec = { ...valid(), cover: { file: "/repo/.local/softball-schedule.jpeg", alt: "x" } };
    const r = parseArticleSpec(spec, { allowedRoots: ROOTS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/blocked/);
  });

  it("article-spec-003: local images must sit under an allowed root (no ../ escapes)", () => {
    expect(isAllowedImagePath("/repo/.local/a.jpg", ROOTS)).toBe(true);
    expect(isAllowedImagePath("/repo/.local/../public/a.jpg", ROOTS)).toBe(false);
    expect(isAllowedImagePath("/repo/.localx/a.jpg", ROOTS)).toBe(false);
    const r = parseArticleSpec(
      { ...valid(), cover: { file: "/home/me/secret.jpg", alt: "x" } },
      { allowedRoots: ROOTS },
    );
    expect(r.ok).toBe(false);
  });

  it("article-spec-004: AI provenance is required", () => {
    const noProv: Record<string, unknown> = valid();
    delete noProv.provenance;
    const r = parseArticleSpec(noProv, { allowedRoots: ROOTS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/provenance/);
  });

  it("article-spec-005: no emoji in headlines; category from the fixed list; alt text required", () => {
    const r = parseArticleSpec(
      { ...valid(), title: "🇻🇮 USVI Faces Mexico", category: "Recap", cover: { file: "/repo/.local/a.jpg" } },
      { allowedRoots: ROOTS },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const all = r.errors.join("\n");
    expect(all).toMatch(/title: no emoji/);
    expect(all).toMatch(/category/);
    expect(all).toMatch(/cover.alt/);
  });

  it("article-spec-006: published_at must carry a time zone and is normalised to UTC", () => {
    const bad = parseArticleSpec({ ...valid(), published_at: "2026-11-23 12:00" }, { allowedRoots: ROOTS });
    expect(bad.ok).toBe(false);
    const good = parseArticleSpec({ ...valid(), published_at: "2026-11-23T12:00:00-06:00" }, { allowedRoots: ROOTS });
    expect(good.ok && good.spec.publishedAt).toBe("2026-11-23T18:00:00.000Z");
  });

  it("article-spec-007: body is normalised to blank-line paragraphs", () => {
    expect(normalizeBody("  a \r\n\r\n\r\n b\n \n c  ")).toBe("a\n\nb\n\nc");
  });

  it("article-spec-008: an image needs exactly one of file or url, and urls must be https", () => {
    const both = parseArticleSpec(
      { ...valid(), cover: { file: "/repo/.local/a.jpg", url: "https://x/a.jpg", alt: "x" } },
      { allowedRoots: ROOTS },
    );
    expect(both.ok).toBe(false);
    const http = parseArticleSpec({ ...valid(), cover: { url: "http://x/a.jpg", alt: "x" } }, { allowedRoots: ROOTS });
    expect(http.ok).toBe(false);
  });
});
