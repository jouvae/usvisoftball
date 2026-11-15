// Feature softball/schedule — a minimal iCalendar (RFC 5545) builder for "Add to calendar".
//
// Pure and client-safe. One VEVENT per file; times are UTC (`…Z`) so every calendar app places
// the event correctly whatever the device zone. Lines end CRLF, text values are escaped and long
// lines are folded at 75 octets, as RFC 5545 §3.1 requires.

// Default duration when an event has no end (a softball game is ~2 h).
export const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

export interface IcsEventInput {
  uid: string; // globally unique, stable per event (e.g. "{slug}@usvisoftball.org")
  startsAt: string; // ISO instant
  endsAt: string | null; // ISO instant; null → start + DEFAULT_EVENT_DURATION_MS
  summary: string;
  location: string;
  url: string; // absolute
  description?: string;
  now?: Date; // DTSTAMP; defaults to the current time
}

// 2099-03-15T15:00:00Z → "20990315T150000Z".
export function icsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Escape a TEXT value: backslash, semicolon, comma, and newlines (RFC 5545 §3.3.11).
export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Fold a content line to ≤ 75 octets per physical line (continuations start with a space).
export function icsFold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const len = bytes.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines spend 1 octet on the space
    if (size + len > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += len;
  }
  out.push(current);
  return out.join("\r\n ");
}

// A complete VCALENDAR with one VEVENT, CRLF-terminated.
export function buildEventIcs(input: IcsEventInput): string {
  const start = new Date(input.startsAt);
  const end = input.endsAt
    ? new Date(input.endsAt)
    : new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//USVI Softball Federation//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscape(input.uid)}`,
    `DTSTAMP:${icsUtc(input.now ?? new Date())}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${icsEscape(input.summary)}`,
    `LOCATION:${icsEscape(input.location)}`,
    `URL:${input.url}`,
    ...(input.description ? [`DESCRIPTION:${icsEscape(input.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
