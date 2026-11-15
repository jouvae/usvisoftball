import type { ReactNode } from "react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  battingAverage,
  era,
  formatInningsPitched,
  type Locale,
  type PlayerStatLineWithPlayer,
} from "@/lib/schedule-view";

// Renders one numeric stat cell. Read-only default prints the value; S4's scorekeeper passes a
// renderer with steppers — same table, no fork (D12).
export type StatCellRenderer = (cell: {
  line: PlayerStatLineWithPlayer;
  field: string;
  value: number | string;
}) => ReactNode;

const readCell: StatCellRenderer = ({ value }) => value;

const BATTING = [
  { key: "ab", label: "AB" },
  { key: "r", label: "R" },
  { key: "h", label: "H" },
  { key: "rbi", label: "RBI" },
  { key: "bb", label: "BB" },
  { key: "so", label: "SO" },
] as const;

const PITCHING = [
  { key: "h", label: "H" },
  { key: "r", label: "R" },
  { key: "er", label: "ER" },
  { key: "bb", label: "BB" },
  { key: "so", label: "SO" },
] as const;

const th = "px-2 py-2 font-semibold";
const td = "px-2 py-2";

// The USVI box score (D6): one batting line per player who played (has a stat line), plus a
// pitching table for those who pitched. The caller passes only USVI lines and omits the
// component when there are none. Isomorphic; `renderCell` is the editable-variant seam.
export function BoxScore({
  lines,
  locale,
  title,
  renderCell = readCell,
  className = "",
}: {
  lines: PlayerStatLineWithPlayer[];
  locale: Locale;
  title?: string;
  renderCell?: StatCellRenderer;
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  const pitchers = lines.filter((l) => l.pitching);
  const name = (l: PlayerStatLineWithPlayer) => (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span className="w-6 text-right font-display text-navy tabular-nums">
        {l.player.jerseyNumber ?? "–"}
      </span>
      <span className="font-medium text-foreground">{l.player.name}</span>
      {l.player.position ? <span className="text-xs text-muted">{l.player.position}</span> : null}
    </span>
  );

  return (
    <section data-testid="boxscore" aria-labelledby="boxscore-heading" className={className}>
      <h2
        id="boxscore-heading"
        className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-navy"
      >
        {title ?? t.boxScore}
      </h2>
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-xl ring-1 ring-border">
          <table className="w-full min-w-[30rem] border-collapse text-sm tabular-nums">
            <caption className="sr-only">{t.batting}</caption>
            <thead>
              <tr className="bg-surface text-xs uppercase tracking-wide text-muted">
                <th scope="col" className={`${th} text-left`}>
                  {t.batting}
                </th>
                {BATTING.map((c) => (
                  <th key={c.key} scope="col" className={`${th} text-center`}>
                    {c.label}
                  </th>
                ))}
                <th scope="col" className={`${th} text-center`}>
                  AVG
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} data-testid="boxscore-line" className="border-t border-border">
                  <th scope="row" className={`${td} text-left font-normal`}>
                    {name(l)}
                  </th>
                  {BATTING.map((c) => (
                    <td key={c.key} className={`${td} text-center`}>
                      {renderCell({ line: l, field: c.key, value: l[c.key] })}
                    </td>
                  ))}
                  <td className={`${td} text-center text-muted`}>{battingAverage(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pitchers.length > 0 ? (
          <div className="overflow-x-auto rounded-xl ring-1 ring-border">
            <table className="w-full min-w-[30rem] border-collapse text-sm tabular-nums">
              <caption className="sr-only">{t.pitching}</caption>
              <thead>
                <tr className="bg-surface text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className={`${th} text-left`}>
                    {t.pitching}
                  </th>
                  <th scope="col" className={`${th} text-center`}>
                    IP
                  </th>
                  {PITCHING.map((c) => (
                    <th key={c.key} scope="col" className={`${th} text-center`}>
                      {c.label}
                    </th>
                  ))}
                  <th scope="col" className={`${th} text-center`}>
                    ERA
                  </th>
                </tr>
              </thead>
              <tbody>
                {pitchers.map((l) => {
                  const p = l.pitching!;
                  return (
                    <tr key={l.id} className="border-t border-border">
                      <th scope="row" className={`${td} text-left font-normal`}>
                        {name(l)}
                      </th>
                      <td className={`${td} text-center`}>
                        {renderCell({
                          line: l,
                          field: "pitching.outsPitched",
                          value: formatInningsPitched(p.outsPitched),
                        })}
                      </td>
                      {PITCHING.map((c) => (
                        <td key={c.key} className={`${td} text-center`}>
                          {renderCell({ line: l, field: `pitching.${c.key}`, value: p[c.key] })}
                        </td>
                      ))}
                      <td className={`${td} text-center text-muted`}>{era(p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
