/*
---
id: about-web-011
name: "about-web-011: Public Committees section renders the standing committees + rosters"
feature: softball/about
stack: web
priority: P0
group: A
references:
  - app/(public)/about/page.tsx (listCommittees → CommitteesSection)
  - components/ui/committees-section.tsx (about-committees + committee cards/rosters)
  - lib/committees.ts (listCommittees via the RLS publishable client)
  - supabase/migrations/0011_committees.sql (public SELECT policy; seeded 4 committees, 7 members)
---

## Given
The `committees` table (public-read RLS) holds the four standing committees in
sort_order, each with its `committee_members` (7 total), also public-read.

## When
An anonymous visitor opens /about.

## Then
The Committees section (`about-committees`) renders exactly 4 `committee` cards in
sort_order — asserted against a service-key read of `committees` so the test tracks
the seed rather than hard-coded strings. Each card shows a `committee-description`.
The total `committee-member` count is 7. The Competition committee (first card)
lists "Rupert James — Chair" and orders members by sort_order (Chair before Member).

Read-only: this spec never mutates the tables, so it needs no teardown and is safe
to run at both viewports.
*/

import { test, expect } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";

type CommitteeRow = { name: string; slug: string; description: string };

// Out-of-band service-key read: the ordered, seeded committees the page must reflect.
async function readCommittees(): Promise<CommitteeRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("committees")
    .select("name,slug,description")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommitteeRow[];
}

// Out-of-band count of the seeded members (7), independent of the page.
async function countMembers(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("committee_members")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

test.describe("about-web-011 — public Committees section reflects the seeded committees", () => {
  test("anon /about renders the 4 committees in sort_order, each with a description + roster", async ({
    page,
  }) => {
    // GIVEN: the seeded committees and member count, read out-of-band with the service key.
    const expected = await readCommittees();
    const expectedMemberCount = await countMembers();
    expect(expected.length, "seed must hold exactly 4 committees").toBe(4);
    expect(expectedMemberCount, "seed must hold exactly 7 members").toBe(7);

    // WHEN: an anonymous visitor opens /about.
    await page.goto("/about");

    // THEN: the section and exactly 4 committee cards render.
    const section = page.getByTestId("about-committees");
    await expect(section).toBeVisible();

    const cards = section.getByTestId("committee");
    await expect(cards).toHaveCount(4);

    // ...in sort_order — the ordered names match the DB read (note "&" renders literally).
    await expect(section.getByTestId("committee-name")).toHaveText(
      expected.map((c) => c.name),
    );

    // ...each card shows a description (4 descriptions, one per card).
    await expect(section.getByTestId("committee-description")).toHaveCount(4);

    // ...the total member count across all rosters is 7.
    await expect(section.getByTestId("committee-member")).toHaveCount(
      expectedMemberCount,
    );

    // ...the Competition committee (first card, sort_order 10) lists Rupert James — Chair,
    //    and orders members by sort_order (Chair before Member).
    const competition = cards.first();
    await expect(competition.getByTestId("committee-name")).toHaveText(
      "Competition Committee",
    );
    await expect(competition.getByTestId("committee-member-name")).toHaveText([
      "Rupert James",
      "Denise Hodge",
    ]);
    await expect(competition.getByTestId("committee-member-role")).toHaveText([
      "— Chair",
      "— Member",
    ]);
  });
});
