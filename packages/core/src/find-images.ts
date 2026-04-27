import type { Image as MdastImage, Nodes, Root } from "mdast";

export type Image = {
  start: number;
  end: number;
  url: string;
  alt: string;
  title: string | null;
};

export function findImages(root: Root): Image[] {
  const images: Image[] = [];
  visit(root, images);
  images.sort((a, b) => a.start - b.start);
  return images;
}

function visit(node: Nodes, out: Image[]): void {
  if (node.type === "image") {
    const image = toImage(node);
    if (image) out.push(image);
  }
  if ("children" in node) {
    for (const child of node.children) visit(child, out);
  }
}

function toImage(node: MdastImage): Image | null {
  const outer = node.position;
  if (!outer) return null;
  const start = outer.start.offset;
  const end = outer.end.offset;
  if (start === undefined || end === undefined) return null;
  return {
    start,
    end,
    url: node.url,
    alt: node.alt ?? "",
    title: node.title ?? null,
  };
}
