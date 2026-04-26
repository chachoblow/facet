import type {
  Node,
  Nodes,
  Root,
  Table as MdastTable,
  TableCell as MdastTableCell,
  TableRow as MdastTableRow,
} from "mdast";

export type ColumnAlign = "left" | "right" | "center" | null;

export type TableCell = {
  start: number;
  end: number;
};

export type TableRow = {
  start: number;
  end: number;
  isHeader: boolean;
  cells: TableCell[];
};

export type Table = {
  type: "table";
  start: number;
  end: number;
  align: ColumnAlign[];
  alignmentRow: { start: number; end: number };
  rows: TableRow[];
};

export function findTables(root: Root): Table[] {
  const tables: Table[] = [];
  visit(root, tables);
  tables.sort((a, b) => a.start - b.start);
  return tables;
}

function visit(node: Nodes, out: Table[]): void {
  if (node.type === "table") {
    const table = toTable(node);
    if (table) out.push(table);
  }
  if ("children" in node) {
    for (const child of node.children) visit(child, out);
  }
}

function toTable(node: MdastTable): Table | null {
  const range = toRange(node);
  if (!range) return null;
  const alignmentRow = toAlignmentRow(node);
  if (!alignmentRow) return null;
  const align = (node.align ?? []).map((a) => a ?? null);
  const rows = node.children.flatMap((row, i) => toRow(row, i === 0) ?? []);
  return { type: "table", ...range, align, alignmentRow, rows };
}

function toRow(node: MdastTableRow, isHeader: boolean): TableRow | null {
  const range = toRange(node);
  if (!range) return null;
  const cells = node.children.flatMap((cell) => toCell(cell) ?? []);
  return { ...range, isHeader, cells };
}

function toCell(node: MdastTableCell): TableCell | null {
  return toRange(node);
}

function toAlignmentRow(node: MdastTable): { start: number; end: number } | null {
  const header = toRange(node.children[0]);
  const firstBody = toRange(node.children[1]);
  if (!header || !firstBody) return null;
  return { start: header.end + 1, end: firstBody.start - 1 };
}

function toRange(node: Node | undefined): { start: number; end: number } | null {
  const pos = node?.position;
  if (!pos) return null;
  const start = pos.start.offset;
  const end = pos.end.offset;
  if (start === undefined || end === undefined) return null;
  return { start, end };
}
