import { findInlineMarks, parse } from "@facet/core";

export type LinkAt = { url: string; start: number; end: number };

export function findLinkAt(doc: string, offset: number): LinkAt | null {
  const marks = findInlineMarks(parse(doc));
  for (const mark of marks) {
    if (mark.type !== "link") continue;
    if (offset >= mark.start && offset < mark.end) {
      return { url: mark.url, start: mark.start, end: mark.end };
    }
  }
  return null;
}
