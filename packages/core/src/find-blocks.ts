import type { Blockquote, Code, Heading, ListItem, Nodes, Root } from "mdast";

export type Block =
  | {
      type: "heading";
      depth: 1 | 2 | 3 | 4 | 5 | 6;
      start: number;
      end: number;
      markerStart: number;
      markerEnd: number;
    }
  | { type: "blockquote"; depth: number; start: number; end: number }
  | {
      type: "listItem";
      ordered: boolean;
      checked: boolean | null;
      start: number;
      end: number;
      markerStart: number;
      markerEnd: number;
      checkboxStart: number | null;
      checkboxEnd: number | null;
    }
  | { type: "code"; lang: string | null; start: number; end: number };

type Context = { ordered: boolean | null; blockquoteDepth: number };

export function findBlocks(root: Root): Block[] {
  const blocks: Block[] = [];
  visit(root, blocks, { ordered: null, blockquoteDepth: 0 });
  blocks.sort((a, b) => a.start - b.start);
  return blocks;
}

function visit(node: Nodes, out: Block[], ctx: Context): void {
  if (node.type === "heading") {
    const block = toHeading(node);
    if (block) out.push(block);
  } else if (node.type === "blockquote") {
    const block = toBlockquote(node, ctx.blockquoteDepth + 1);
    if (block) out.push(block);
  } else if (node.type === "code") {
    const block = toCode(node);
    if (block) out.push(block);
  } else if (node.type === "listItem" && ctx.ordered !== null) {
    const block = toListItem(node, ctx.ordered);
    if (block) out.push(block);
  }

  if ("children" in node) {
    const childCtx: Context = {
      ordered: node.type === "list" ? node.ordered === true : ctx.ordered,
      blockquoteDepth: node.type === "blockquote" ? ctx.blockquoteDepth + 1 : ctx.blockquoteDepth,
    };
    for (const child of node.children) visit(child, out, childCtx);
  }
}

function toHeading(node: Heading): Block | null {
  const outer = node.position;
  if (!outer) return null;
  const start = outer.start.offset;
  const end = outer.end.offset;
  if (start === undefined || end === undefined) return null;

  const firstChildStart = node.children[0]?.position?.start.offset ?? start;
  return {
    type: "heading",
    depth: node.depth,
    start,
    end,
    markerStart: start,
    markerEnd: firstChildStart,
  };
}

function toBlockquote(node: Blockquote, depth: number): Block | null {
  const pos = node.position;
  if (!pos) return null;
  const start = pos.start.offset;
  const end = pos.end.offset;
  if (start === undefined || end === undefined) return null;
  return { type: "blockquote", depth, start, end };
}

function toCode(node: Code): Block | null {
  const pos = node.position;
  if (!pos) return null;
  const start = pos.start.offset;
  const end = pos.end.offset;
  if (start === undefined || end === undefined) return null;
  return { type: "code", lang: node.lang ?? null, start, end };
}

function toListItem(node: ListItem, ordered: boolean): Block | null {
  const pos = node.position;
  if (!pos) return null;
  const start = pos.start.offset;
  const end = pos.end.offset;
  if (start === undefined || end === undefined) return null;

  const firstChildStart = node.children[0]?.position?.start.offset ?? start;
  const checked = node.checked ?? null;
  const checkboxEnd = checked === null ? null : firstChildStart - 1;
  const checkboxStart = checked === null ? null : firstChildStart - 4;
  return {
    type: "listItem",
    ordered,
    checked,
    start,
    end,
    markerStart: start,
    markerEnd: firstChildStart,
    checkboxStart,
    checkboxEnd,
  };
}
