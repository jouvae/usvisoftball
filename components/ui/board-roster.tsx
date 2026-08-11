import {
  BoardMemberCard,
  type BoardMemberCardData,
} from "@/components/ui/board-member-card";

export type BoardRosterProps = {
  // Roster testid differs by context: `about-board-roster` (current) vs
  // `about-term-roster` (archive detail). The caller supplies it.
  testId: string;
  members: BoardMemberCardData[];
  className?: string;
};

// A grid of board-member cards. Server Component. Members are rendered in the order
// given — callers sort by sort_order before passing them in. `role="list"` is explicit
// because some resets strip <ul> semantics.
export function BoardRoster({ testId, members, className = "" }: BoardRosterProps) {
  return (
    <ul
      role="list"
      data-testid={testId}
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      {members.map((member) => (
        <BoardMemberCard key={member.name} member={member} />
      ))}
    </ul>
  );
}
