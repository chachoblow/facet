import type { Heading, Nodes } from "mdast";
import { parse } from "./parse.js";
import { slugifyHeadings } from "./slugify-heading.js";

export function findHeadingLineForAnchor(markdown: string, anchor: string): number | null {
  const root = parse(markdown);
  const headings: Heading[] = [];
  collectHeadings(root, headings);
  const slugs = slugifyHeadings(headings.map(headingText));
  const idx = slugs.indexOf(anchor);
  if (idx === -1) return null;
  const line = headings[idx]?.position?.start.line;
  return typeof line === "number" ? line - 1 : null;
}

function collectHeadings(node: Nodes, out: Heading[]): void {
  if (node.type === "heading") out.push(node);
  if ("children" in node) {
    for (const child of node.children) collectHeadings(child, out);
  }
}

function headingText(node: Heading): string {
  let out = "";
  for (const child of node.children) out += nodeText(child);
  return out;
}

function nodeText(node: Nodes): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) {
    let out = "";
    for (const child of node.children) out += nodeText(child);
    return out;
  }
  return "";
}
