// Behavior lock for Remark's parse + stringify on real-world markdown.
//
// V1 deliberately does not call remark-stringify on the save path — saves
// write the CodeMirror buffer verbatim to preserve byte-identical round-trips
// (decision D5). This test exists so that any future change to Remark's
// parsing or stringification surfaces as a reviewable snapshot diff. Promoted
// from spikes/01-roundtrip-fidelity/.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";

const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml", "toml"])
  .use(remarkStringify);

const fixtures = readdirSync(fixturesDir).filter((n) => n.endsWith(".md"));

describe("Remark round-trip", () => {
  it.each(fixtures)("%s: parse + stringify is stable", async (fixture) => {
    const input = readFileSync(join(fixturesDir, fixture), "utf8");
    const output = String(await processor.process(input));
    await expect(output).toMatchFileSnapshot(`./__file_snapshots__/${fixture}.snap`);
  });
});
