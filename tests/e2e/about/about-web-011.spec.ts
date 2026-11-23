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
The `committees` table (public-read RLS) with its `committee_members`, read out of band. The
0011 seed committees (placeholder names) were deleted from prod on 2026-11-23 (home-feed Phase
B); the board adds real ones through /admin/committees.

## When
An anonymous visitor opens /about.

## Then
No committees → no Committees section at all (empty sections never render). Otherwise
`about-committees` renders one `committee` card per row in sort_order (names match the DB
read), each with its description when set, and the `committee-member` count equals the DB count
of members on those committees.

Read-only: this spec never mutates the tables, so it needs no teardown and is safe
to run at both viewports.
*/

import { test, expect } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";

type CommitteeRow = { id: string; name: string; description: string };

// Out-of-band service-key read: the ordered committees the page must reflect.
async function readCommittees(): Promise<CommitteeRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("committees")
    .select("id,name,description")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommitteeRow[];
}

async function countMembers(committeeIds: string[]): Promise<number> {
  if (committeeIds.length === 0) return 0;
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("committee_members")
    .select("id", { count: "exact", head: true })
    .in("committee_id", committeeIds);
  if (error) throw error;
  return count ?? 0;
}

test.describe("about-web-011 — public Committees section reflects the committees table", () => {
  test("anon /about renders the committees in sort_order, or no section when there are none", async ({
    page,
  }) => {
    const expected = await readCommittees();
    const memberCount = await countMembers(expected.map((c) => c.id));

    await page.goto("/about");
    const section = page.getByTestId("about-committees");

    if (expected.length === 0) {
      await expect(section).toHaveCount(0);
      return;
    }

    await expect(section).toBeVisible();
    await expect(section.getByTestId("committee")).toHaveCount(expected.length);
    await expect(section.getByTestId("committee-name")).toHaveText(expected.map((c) => c.name));
    await expect(section.getByTestId("committee-description")).toHaveCount(
      expected.filter((c) => c.description).length,
    );
    await expect(section.getByTestId("committee-member")).toHaveCount(memberCount);
  });
});
