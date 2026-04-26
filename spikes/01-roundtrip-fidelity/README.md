# Spike 1 — Round-trip fidelity through Remark

> Status: **Run.** Initial findings below. Recommendation: see end.
> Maps to: [Decision D5 — Round-trip fidelity](../../docs/facet-decisions.md).

## What this tests

Whether the unified / Remark pipeline can parse and re-serialize real-world markdown without unacceptable mutations. Pipeline under test:

```ts
unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml", "toml"])
  .use(remarkStringify)
```

For each `.md` file: parse → stringify → diff against input. Report byte-identical / mutated split, categorize mutations, optionally print unified diffs.

## Run it

```sh
pnpm install
pnpm spike                          # default: spike fixtures/
pnpm spike -- ../../docs            # any directory of .md
pnpm spike -- ../../docs --diff     # show per-file diffs
pnpm spike -- /path/to/your/wiki    # point at the team wiki
```

## Initial findings

### Against `fixtures/` (deliberately tricky, n=7)

```
Byte-identical : 1 / 7  (14.3%)
```

Only `frontmatter.md` round-tripped clean.

### Against `../../docs/` (real, hand-written, n=4)

```
Byte-identical : 0 / 4  (0.0%)
```

Two mutation classes: bullet markers (`-` → `*`) and table cell padding (unpadded → column-aligned).

## Mutation catalog

Two kinds of mutation, importantly different:

### Tunable — choose a house style and they go away

Each is controlled by a `remark-stringify` option:

| Mutation observed                    | Option        | Default     |
| ------------------------------------ | ------------- | ----------- |
| `-` / `+` bullets → `*`              | `bullet`      | `*`         |
| `1)` ordered marker → `1.`           | `bulletOrdered` | `.`       |
| `_x_` italic → `*x*`                 | `emphasis`    | `*`         |
| `__x__` bold → `**x**`               | `strong`      | `*`         |
| `~~~` fences → ` ``` `               | `fence`       | `` ` ``     |
| Setext `===` / `---` → ATX `#` / `##` | `setext`     | `false`     |
| Hard break `  \n` → `\\\n`           | (handler)     | backslash   |

Pick a Facet house style (e.g. `-` bullets, `*` emphasis, ATX headings, backtick fences) and any file already in that style round-trips. Files in other styles get rewritten on first save.

### Lossy by AST design — no option recovers these

`mdast` is a **semantic** AST, not a concrete syntax tree. The following information is **not** in the parsed tree at all, so the serializer cannot reproduce it:

| Information lost                                              | Effect                                   |
| ------------------------------------------------------------- | ---------------------------------------- |
| Indented vs fenced code blocks                                | Indented code → fenced ``` ```           |
| Exact intra-cell whitespace in tables                         | `\|a\|b\|c\|` → `\| a \| b \| c \|`      |
| Mid-word underscore byte sequences                            | `foo_bar_baz` → `foo\_bar\_baz` (escape) |
| Bare-URL vs autolink form (with `remark-gfm`)                 | `https://x` → `<https://x>`              |
| Blank-line spacing between reference link definitions         | Extra blank lines inserted               |
| Whether "tight" or "loose" list spacing was originally chosen | Recomputed from AST                      |

Some of these (table padding, autolink wrapping) come from sub-extensions like `mdast-util-gfm-table` and may have their own options worth investigating. Most do not.

## What this means for Decision D5

**Remark cannot byte-identical round-trip arbitrary markdown — by design.** That sounds bad for D5, but it changes meaning depending on *when we ask Remark to serialize*.

There are two viable architectures, each preserves D5:

### Option A — Source of truth is the text buffer; Remark is parser-only

In v1, CodeMirror 6 owns the text buffer. Author edits land as byte-level patches against the source. **Saving writes the buffer's bytes verbatim** — no AST round-trip happens at save time.

Remark is used for *understanding* the document (rendering decorations, link resolution, frontmatter extraction, semantic queries) but **`remark-stringify` is never called**.

- ✅ D5 holds trivially: unchanged regions are byte-identical because they were never re-serialized.
- ✅ Minimal architectural commitment; the lossy-by-design issues become non-issues.
- ⚠️ Any feature that wants to *generate or edit* markdown via the AST (e.g. "insert a heading", "promote this paragraph to a quote") has to either (a) apply concrete-text edits using `node.position` offsets from the parse, or (b) accept that the inserted slice will follow the house style.
- ⚠️ Future Surfaces (Facet Studio's True WYSIWYG) will eventually need a serializer. By then we know the constraints.

### Option B — Configure a house style and accept a one-time normalization

Pick `bullet: '-'`, ATX headings, backtick fences, etc. Run the team's wiki through it once, commit the result, and from then on every save round-trips clean *because every file already matches the style*.

- ✅ D5 holds for files already in the style.
- ❌ First-save mutates files that aren't, surprising the Author.
- ❌ Lossy-by-AST items (indented code, table padding) still mutate even style-matching files.

### Recommendation

**Adopt Option A.** It's the right primitive: in a CodeMirror-hosted editor, the source of truth is already the text buffer. We don't need to round-trip an AST to save. Reserve `remark-stringify` for a later, scoped use case (e.g. an Author-invoked "format document" command, opt-in like Prettier) where mutation is expected.

This also keeps `packages/core/` honest: it should expose **parsing and AST queries** but not **stringification** in v1. If Facet Studio later needs a serializer, that's a v2 problem with full information.

### Headline (one sentence)

**In v1, Remark is parser-only. `remark-stringify` is never in the save path. CodeMirror's text buffer is the source of truth; saves write its bytes verbatim — that is how Decision D5 is preserved.**

### Files to update after this spike

These files currently assume Remark is "parse and serialize". Update them to reflect parser-only in v1:

1. **`docs/facet-decisions.md` — Decision D5**
   - Under **Implementation implications**, replace *"Use Remark / unified for parse and serialize"* with two bullets: (a) Remark / unified is used for **parsing only** in v1; (b) `remark-stringify` is **not called at save time** — CodeMirror's text buffer writes bytes verbatim. Note that this is what makes byte-identical round-trip trivially achievable; mdast is a semantic AST and *cannot* round-trip arbitrary markdown.
   - Update *"Build a Round-trip fidelity test suite early"* to point at `spikes/01-roundtrip-fidelity/` as the seed for that suite, and reframe its job: it guards against `remark-stringify` accidentally creeping into the save path, and tracks Remark parsing changes.
   - Add a **When to revisit** subsection: revisit when (a) Facet Studio (True WYSIWYG) is built and needs an AST→markdown serializer, or (b) an opt-in "Format document" command is desired (Prettier-style). Both are out of scope for v1.

2. **`docs/facet-spec-v1.md`**
   - Line ~41 ("Markdown parsing"): change *"Remark / unified for parse and serialize, even though CodeMirror has its own markdown extension"* to *"Remark / unified for **parsing**, even though CodeMirror has its own markdown extension. Saves write the CodeMirror buffer verbatim — `remark-stringify` is not in the save path. See `spikes/01-roundtrip-fidelity/README.md`."*
   - Line ~109 ("Remark / unified for parse and serialize"): same change — drop "and serialize", same rationale.
   - Line ~31 ("Remark/unified parsing ecosystem"): already correct — leave alone.
   - Line ~42 (round-trip fidelity foundational concern): leave the *constraint* as written, but add a sentence explaining the *mechanism*: "We preserve this by not serializing the AST at save time."

3. **`HANDOFF.md`**
   - **Status line** ("Pre-implementation. Design converged. No code yet."): change to "Pre-implementation. Spike 1 run; D5 architecture refined to parser-only. No production code yet."
   - **Spike 1 section**: mark with a status line at the top — `**Status: Run (this spike directory).** See [spikes/01-roundtrip-fidelity/README.md](spikes/01-roundtrip-fidelity/README.md).` Keep the original method/criteria text for context; add a one-line conclusion: "Remark cannot round-trip arbitrary markdown by AST design. v1 resolves this by treating Remark as parser-only and saving the CodeMirror buffer verbatim."
   - **Implementation order item 1** ("CodeMirror 6 in the custom editor, writing back to disk with byte-perfect round-trip"): clarify the mechanism — *"…writing the CodeMirror buffer verbatim. Round-trip fidelity comes from never serializing the AST, not from a perfect serializer."*
   - **Implementation order item 2** ("Remark integration for AST awareness"): add *"— parse only; no `remark-stringify` in the save path."*
   - **Guardrails section, "Round-trip fidelity is non-negotiable"**: append *"In v1 this is preserved structurally: the save path writes the CodeMirror buffer's bytes verbatim. `remark-stringify` is not called on save."*

4. **`CLAUDE.md`**
   - **Architecture paragraph** (line ~23): change *"Remark / unified is the parser/serializer (not CodeMirror's built-in markdown)"* to *"Remark / unified is the **parser** (not CodeMirror's built-in markdown). In v1, `remark-stringify` is deliberately not used: saves write the CodeMirror buffer verbatim, which is what preserves round-trip fidelity (D5)."* Keep the rationale about cross-Surface AST consistency.
   - Same paragraph, the sentence about `packages/core/`: append *"`packages/core/` should expose parsing and AST queries; it deliberately does not expose markdown stringification in v1."*
   - **Guardrails bullet on D5** (line ~29): replace the existing wording with: *"**Round-trip fidelity (D5).** Saving must produce byte-identical markdown unless the Author actually changed the Document. The mechanism in v1 is structural: CodeMirror owns the text buffer and saves write its bytes verbatim — `remark-stringify` is not called on save. Don't add a save-path serializer. Don't let CodeMirror, Remark config, or any plugin silently normalize list markers, reflow paragraphs, or rewrite link forms. Promote `spikes/01-roundtrip-fidelity/` into a permanent test the moment `packages/core/` exists; its job is to guard against `remark-stringify` re-entering the save path and to track Remark parsing changes."*

### Other follow-ups (later, not for next session)

- Promote this spike's runner into a permanent test in `packages/core/` once the monorepo is scaffolded.
- Run this spike against the team's actual wiki (`pnpm spike -- /path/to/wiki`) before declaring D5 fully de-risked. Synthetic fixtures + 4-doc baseline is suggestive, not conclusive.
- If/when an opt-in "Format document" command is added, that is the right place to invoke `remark-stringify` — explicitly, with the Author's consent, mutation expected. Until then, keep it out of the codebase entirely.

## File layout

```
spikes/01-roundtrip-fidelity/
├── README.md           # this file
├── package.json
├── tsconfig.json
├── src/run.ts          # the spike runner
└── fixtures/           # tricky-by-design corpus (7 files)
    ├── code.md
    ├── emphasis.md
    ├── frontmatter.md
    ├── headings-and-breaks.md
    ├── links.md
    ├── list-markers.md
    └── tables.md
```
