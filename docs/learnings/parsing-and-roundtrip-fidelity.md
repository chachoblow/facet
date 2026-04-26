# Parsing, ASTs, and round-trip fidelity

What I worked through to understand Spike 1's findings. Personal reference, not project doctrine — for that, see `CLAUDE.md` and `docs/facet-decisions.md` D5.

## The question Spike 1 was answering

If we parse a markdown file into a tree, possibly edit via that tree, and serialize back to markdown — do we get the original file back, byte-for-byte?

**Answer: no, not in general. By design.**

## The chain of reasoning

### 1. A markdown file is just characters

`# Project notes` is literally `#`, space, `P`, `r`, `o`... Nothing in the bytes inherently says "heading." *You* see structure because you know the convention; software has to apply rules to recognize it.

### 2. Parsing recognizes structure

A parser reads characters and produces a structured representation: "this region is a heading; this is a list with two items."

### 3. The structure is a tree

Things contain things contain things. A document contains a heading and a list; the list contains items; each item contains text. Drawn naturally as a tree of nested *nodes*. This is universal across parsers — markdown, JSON, HTML, programming languages all produce trees.

### 4. The tree is *abstract* — it records meaning, not surface form

This is the key fact.

The tree has nodes for "list item" but **no field for which marker character was used**. `- buy milk`, `* buy milk`, and `+ buy milk` all parse to the same tree. Same for `**bold**` vs `__bold__`, ` ``` ` vs `~~~`, ATX `#` vs setext `===` headings. The tree records *what it means*, not *how it was written*.

That's what the "A" in **AST** means — Abstract Syntax Tree. The markdown-specific name is **mdast**.

### 5. Serializing (tree → text) must invent surface details

Going the other way is called *serialization* (or "stringification"). The serializer walks the tree and emits markdown. But because the tree didn't record the marker character, the serializer has to *pick* one — it uses a default. Remark's default bullet is `*`. So `- buy milk` round-trips to `* buy milk`. Same meaning, different bytes.

That's the headline mutation. Round-trips through an AST are not byte-faithful by structure, not by bug.

### 6. Two categories of mutation

Spike 1 sorted every observed mutation into one of two buckets:

**Tunable.** The serializer made a stylistic choice you can override via config. These are fixable because the choice is *uniform* — you typically use the same bullet marker throughout a document, so a single setting governs all instances. Examples: bullet character, ordered marker (`1.` vs `1)`), italic marker, bold marker, fence character, ATX vs setext headings, hard-break style.

**Lossy by design.** No config option recovers these. Either:
- The choice is *per-instance* — different instances in the same doc legitimately want different forms (e.g. one code block fenced for a long example, another indented inside a list item). A single global config can't reproduce that.
- The output is *computed* — table cell padding is calculated from column widths, not chosen.

Examples: indented vs fenced code blocks, exact intra-cell whitespace in tables, bare URL vs `<autolink>` form, blank-line spacing between reference link definitions, tight vs loose list spacing.

**Implication:** "just configure it correctly" hits a hard ceiling. Configuration is a *global* lever; lossy-by-design mutations are *per-instance* problems. Wrong tool, no matter how carefully wielded.

## The architectural move

There's a third kind of tree in the parsing world: a **concrete syntax tree** (CST), or *lossless* syntax tree. Same tree shape as an AST, but each node also carries the surface details the AST throws away. Tree-sitter, rust-analyzer, and Prettier use CSTs precisely for round-trip fidelity.

Spike 1 didn't reach for a CST. The move it made instead is simpler:

> **Buffer is truth. AST is a map. Save writes bytes. Edits patch bytes.**

In an editor like CodeMirror, the original characters are already sitting in the text buffer — that's literally what the user is typing into. There's no need to build a parallel CST to remember them; they're already there. So:

- **On save:** write the buffer's bytes verbatim. No serialization happens. `remark-stringify` is never called.
- **The AST exists,** parsed from the buffer, used for *understanding* the document — rendering decorations, link resolution, frontmatter extraction, semantic queries.
- **For AST-driven edits** (e.g. "wrap selection in blockquote"): walk the AST to find the relevant node's `position` (start/end byte offsets in the source), then apply a text patch at those offsets. The AST *locates*; you patch.

D5 (round-trip fidelity) is preserved **structurally**, not by clever serialization.

## Why this only works because CodeMirror is text-buffer-centric

Editors split into two categories. The architectural move above is only available in the first.

**Text-buffer-centric** — CodeMirror, Monaco, Vim, Emacs, plain `<textarea>`. Primary internal representation is a flat sequence of characters; structure is derived on top. The file *is* the truth.

- Pros: file = truth, trivial round-trip, plays well with git, plain-text operations are first-class, format-agnostic.
- Cons: structural features bolted on via plugins (decorations to make `# heading` look like a heading), AST-driven edits must compute text-level patches, true WYSIWYG is hard.

**Tree-centric** — ProseMirror, Slate, Quill, Lexical, Notion, Word. Primary representation is a tree of typed nodes; text is a derived format. There is no underlying text buffer.

- Pros: structure is native, true WYSIWYG is the default, rich interactive elements are natural, real-time collab is easier to model, schema enforcement.
- Cons: on-disk format is a *projection* of the tree — round-trip fidelity has to be engineered, every save is a serialization. Plain-text features (regex search, classic find/replace) get awkward. Diffs in git get noisy. Often format-locked-in (people end up storing the editor's JSON, not markdown).

**Bearing on Decision D3 (Plan B):** Milkdown is built on ProseMirror, so it's tree-centric. If Facet ever switches from CodeMirror to Milkdown, the "save bytes verbatim" architecture *evaporates*. Round-trip fidelity would have to be re-engineered, probably via a CST-style annotation layer. That's a real cost of switching, and Spike 1's findings make the cost more visible.

## Why text-buffer-centric is the right v1 choice for Facet

The vision actively favors it:

- **Convergence of understanding** (vision doc): the file on disk is the artifact people share, comment on, trust over time. If it mutates whenever someone opens it, the artifact is unstable, which corrodes trust.
- **D5 (round-trip fidelity):** non-negotiable. Text-buffer-centric solves it for free.
- **D6 (no custom syntax):** the file must render correctly on GitHub/ADO. Text-buffer-centric naturally enforces this — what's in the editor is what those services see.
- **Git as content source of truth:** if files reformat on save, every diff has noise and every blame fractures.

The cons that matter (limited WYSIWYG, harder rich elements) are explicitly *deferred to future Surfaces*. Facet Studio (v2 True WYSIWYG) is where tree-centric would fit, as a separate Surface with its own engineering.

## Takeaways

- mdast is *abstract* by design. Useful for understanding, lossy for reconstruction.
- Round-trip mutations split cleanly: config-fixable (uniform choices) vs unfixable (per-instance choices, or computed layout).
- The clean v1 answer is to never serialize at all. CodeMirror's text buffer being the source of truth is what makes that possible.
- AST-driven edits still work — via `node.position` + text patches, not tree mutation + serialization.
- This architecture is contingent on text-buffer-centric editing. Switching to Milkdown later (D3 Plan B) would invalidate the whole approach.

## See also

- `spikes/01-roundtrip-fidelity/README.md` — the spike itself, with the full mutation catalog and recommendation
- `docs/facet-decisions.md` — D5 (round-trip fidelity), D3 (Plan B Milkdown)
- `CLAUDE.md` — the D5 guardrail that operationalizes this for future code work
