import { findLinkAt } from "./find-link-at.js";

export type LinkClickDecision = { follow: true; url: string } | { follow: false };

export function decideLinkClick(
  doc: string,
  clickOffset: number,
  selFrom: number,
  selTo: number,
): LinkClickDecision {
  const link = findLinkAt(doc, clickOffset);
  if (!link) return { follow: false };
  const cursorWasInside = selFrom < link.end && selTo > link.start;
  if (cursorWasInside) return { follow: false };
  return { follow: true, url: link.url };
}
