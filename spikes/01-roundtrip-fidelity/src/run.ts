import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createPatch } from "diff";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml", "toml"])
  .use(remarkStringify);

type FileResult = {
  path: string;
  identical: boolean;
  inputBytes: number;
  outputBytes: number;
  patch?: string;
  categories?: string[];
};

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(p)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

function categorize(input: string, output: string): string[] {
  const cats = new Set<string>();
  const inLines = input.split("\n");
  const outLines = output.split("\n");

  if (input.length !== output.length || input === output) {
    // continue
  }

  // List marker normalization: any `* ` or `+ ` at line starts in input but not output (or vice versa)
  const listMarkerIn = inLines.some((l) => /^\s*[*+]\s/.test(l));
  const listMarkerOut = outLines.some((l) => /^\s*[*+]\s/.test(l));
  if (listMarkerIn !== listMarkerOut) cats.add("list-marker-normalized");

  // Emphasis marker normalization: `_x_` or `__x__` in input, but `*x*` / `**x**` more frequent in output
  const underscoreEmIn = (input.match(/(^|\W)_[^_\n]+_/g) ?? []).length;
  const underscoreEmOut = (output.match(/(^|\W)_[^_\n]+_/g) ?? []).length;
  if (underscoreEmIn !== underscoreEmOut) cats.add("emphasis-marker-normalized");

  // Setext heading collapsed to ATX
  const setextIn = inLines.some((l, i) => /^=+\s*$|^-+\s*$/.test(l) && i > 0 && inLines[i - 1].trim().length > 0);
  const setextOut = outLines.some((l, i) => /^=+\s*$|^-+\s*$/.test(l) && i > 0 && outLines[i - 1].trim().length > 0);
  if (setextIn && !setextOut) cats.add("setext-heading-converted-to-atx");

  // Trailing whitespace lost (hard breaks via `  \n` → `\\\n` or vice versa)
  const trailingTwoSpaceIn = inLines.filter((l) => /  $/.test(l)).length;
  const trailingTwoSpaceOut = outLines.filter((l) => /  $/.test(l)).length;
  if (trailingTwoSpaceIn !== trailingTwoSpaceOut) cats.add("hard-break-style-changed");

  // Trailing newline at EOF
  if (input.endsWith("\n") !== output.endsWith("\n")) cats.add("eof-newline-changed");

  // Reference-style links flattened to inline
  const refDefIn = inLines.some((l) => /^\[[^\]]+\]:\s+\S+/.test(l));
  const refDefOut = outLines.some((l) => /^\[[^\]]+\]:\s+\S+/.test(l));
  if (refDefIn && !refDefOut) cats.add("reference-link-flattened");

  // Indented code blocks converted to fenced
  const fencedIn = (input.match(/^```/gm) ?? []).length;
  const fencedOut = (output.match(/^```/gm) ?? []).length;
  if (fencedIn !== fencedOut) cats.add("code-fence-count-changed");

  // Blank line count drift
  const blankIn = inLines.filter((l) => l.trim() === "").length;
  const blankOut = outLines.filter((l) => l.trim() === "").length;
  if (blankIn !== blankOut) cats.add("blank-line-count-changed");

  if (cats.size === 0) cats.add("uncategorized");
  return [...cats];
}

async function runOne(path: string, repoRoot: string): Promise<FileResult> {
  const input = await readFile(path, "utf8");
  const file = await processor.process(input);
  const output = String(file);
  const identical = input === output;
  const rel = relative(repoRoot, path);
  if (identical) {
    return { path: rel, identical, inputBytes: input.length, outputBytes: output.length };
  }
  const patch = createPatch(rel, input, output, "input", "output", { context: 2 });
  return {
    path: rel,
    identical,
    inputBytes: input.length,
    outputBytes: output.length,
    patch,
    categories: categorize(input, output),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const showDiffs = args.includes("--diff");
  const targets = args.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    targets.push("fixtures");
  }

  const repoRoot = resolve(import.meta.dirname, "..");
  const allFiles: string[] = [];
  for (const t of targets) {
    const abs = resolve(t);
    const s = await stat(abs);
    if (s.isDirectory()) {
      allFiles.push(...(await walk(abs)));
    } else if (abs.endsWith(".md")) {
      allFiles.push(abs);
    }
  }

  if (allFiles.length === 0) {
    console.error("No .md files found in:", targets.join(", "));
    process.exit(1);
  }

  const results: FileResult[] = [];
  for (const f of allFiles) {
    results.push(await runOne(f, repoRoot));
  }

  const identical = results.filter((r) => r.identical);
  const mutated = results.filter((r) => !r.identical);

  console.log("=".repeat(72));
  console.log(`Spike 1 — Round-trip fidelity through Remark`);
  console.log("=".repeat(72));
  console.log(`Files scanned     : ${results.length}`);
  console.log(`Byte-identical    : ${identical.length}  (${((identical.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Mutated           : ${mutated.length}`);
  console.log();

  if (mutated.length > 0) {
    const tally = new Map<string, number>();
    for (const r of mutated) {
      for (const c of r.categories ?? []) tally.set(c, (tally.get(c) ?? 0) + 1);
    }
    console.log("Mutation categories (files affected):");
    for (const [cat, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n.toString().padStart(3)}  ${cat}`);
    }
    console.log();
    console.log("Mutated files:");
    for (const r of mutated) {
      console.log(`  ${r.path}  [${r.categories?.join(", ")}]`);
    }
    if (showDiffs) {
      console.log();
      console.log("Diffs:");
      for (const r of mutated) {
        console.log("\n" + "-".repeat(72));
        console.log(r.patch);
      }
    } else {
      console.log();
      console.log("Re-run with --diff to see per-file unified diffs.");
    }
  }

  process.exit(mutated.length === 0 ? 0 : 0); // never fail; this is a report
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
