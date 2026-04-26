import { describe, expect, it } from "vitest";
import { findFrontmatter } from "../src/find-frontmatter.js";
import { parse } from "../src/parse.js";

describe("findFrontmatter", () => {
  it("returns null for a doc with no frontmatter", () => {
    expect(findFrontmatter(parse("# Just a heading\n"))).toBeNull();
  });

  it("returns the outer fence-to-fence range for a basic frontmatter doc", () => {
    // 0    5    10   15
    // 0123456789012345678
    // ---\nfoo: bar\n---\n
    //                 ^^^ closing fence ends at offset 16
    const md = "---\nfoo: bar\n---\n";
    expect(findFrontmatter(parse(md))).toEqual({ type: "yaml", start: 0, end: 16 });
  });

  it("covers the full fence-to-fence range for a multi-line YAML body", () => {
    // ---\ntitle: Hi\ntags: [a, b]\nauthor: w\n---\n
    // 0    5         15            29        38
    // closing fence ends at 41
    const md = "---\ntitle: Hi\ntags: [a, b]\nauthor: w\n---\n";
    const fm = findFrontmatter(parse(md));
    expect(fm).toMatchObject({ type: "yaml", start: 0 });
    expect(fm?.end).toBe(md.length - 1); // ends at closing `---`, not the trailing newline
  });

  it("does not bleed into body content following the frontmatter", () => {
    // ---\nfoo: bar\n---\n# Heading\n
    //                 ^^^ closing fence ends at offset 16; "# Heading" starts at 17
    const md = "---\nfoo: bar\n---\n# Heading\n";
    expect(findFrontmatter(parse(md))).toEqual({ type: "yaml", start: 0, end: 16 });
  });

  it("returns null when --- fences appear mid-document instead of at offset 0", () => {
    // remark-frontmatter only recognizes frontmatter at the start of the doc;
    // mid-doc `---` parses as a thematic break. This test locks that assumption
    // so callers can rely on `findFrontmatter` only ever returning a top-of-doc range.
    const md = "# Heading\n\n---\nfoo: bar\n---\n";
    expect(findFrontmatter(parse(md))).toBeNull();
  });
});
