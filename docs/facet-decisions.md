# Facet — Decision Log

A record of meaningful design decisions made during initial scoping, the alternatives considered, and the reasoning behind each choice. The purpose of this document is to make it easier to **revisit** decisions later with full context, not to lock them in permanently.

---

## D1. Editor library for Facet for VS Code

**Decision:** CodeMirror 6, configured for Hybrid live-preview.

**Alternatives considered:**

| Option | Why rejected |
|---|---|
| **TipTap** | True WYSIWYG, large community, but markdown is *not* its native data model — it serializes to/from a ProseMirror JSON document. Round-trip fidelity to raw markdown is the weak spot, which conflicts directly with the Content source of truth being the git repo. |
| **Milkdown** | Markdown-native (built on Remark). Excellent fit conceptually, but designed for True WYSIWYG, not Hybrid live-preview. Building Hybrid live-preview on top of it would be fighting the library. **Still the live candidate for Facet Studio (the web True WYSIWYG Surface).** |
| **ProseMirror (raw)** | Maximum control, but months of undifferentiated work building things TipTap/Milkdown give for free. |
| **Quill** | Markdown support is bolted on and limited. Ruled out early. |

**Why CodeMirror 6 won:**
- Hybrid live-preview is the *native* experience CodeMirror is designed for (Obsidian uses it, VS Code itself uses it internally).
- Battle-tested with large markdown Documents.
- Excellent cursor and selection behavior, which is the hardest thing to get right in a Hybrid live-preview Surface.

**When to revisit:**
- If implementing high-quality Hybrid live-preview in CodeMirror 6 turns out to require significantly more custom plugin work than expected.
- If we decide cross-Surface code reuse outweighs best-in-class per-Surface UX (see D3).

---

## D2. Editing mode per Surface

**Decision:** One Editing mode per Surface, no in-Surface mode toggle.

- Facet for VS Code → Hybrid live-preview only
- Facet Studio (future) → True WYSIWYG only
- Facet Review (future) → Renderer with comment overlay (not an editing mode at all)

**Alternative considered:** Allow toggling between Hybrid live-preview and True WYSIWYG within a Surface.

**Why rejected:**
- Mode-toggle UX is a tar pit: cursor preservation, scroll position, undo history coherence, and dirty state across the toggle are individually small problems that compound into weeks of polish work.
- Two libraries running simultaneously (CodeMirror 6 + Milkdown) double the surface area for bugs and feature parity.
- Most Authors want their default mode and rarely switch. The added optionality serves a small audience.

**When to revisit:**
- If three or more Authors in a row request the non-default mode in their Surface.
- Specifically: if Devs in Facet for VS Code start asking for True WYSIWYG, or if PMs in Facet Studio ask for raw markdown access.

---

## D3. "One library everywhere" path not taken

**Decision:** Use CodeMirror 6 in Facet for VS Code and Milkdown in Facet Studio (when it ships), accepting that cross-Surface feature work duplicates.

**Alternative considered:** Use **Milkdown for both Surfaces**, maximizing code reuse. True WYSIWYG natively in Facet Studio; a Milkdown source-mode toggle approximating Hybrid live-preview behavior in Facet for VS Code.

**Why rejected (for now):**
- Devs explicitly value the Obsidian-style Hybrid live-preview experience. Milkdown's source-mode toggle would feel like a compromise.
- The shared core that matters across Surfaces is **Remark / unified** (the markdown parser), not the editor library. Both CodeMirror 6 and Milkdown can use Remark for parse/serialize, so the most important shared layer is preserved either way.

**Why this is a live fallback:**
- If CodeMirror's Hybrid live-preview proves harder than expected, switching Facet for VS Code to Milkdown (with a source toggle) gets working software faster and unifies the codebase.
- Don't treat this as off the table — it's a real Plan B.

**When to revisit:**
- During Facet for VS Code v1 implementation, if Hybrid live-preview in CodeMirror requires substantially more custom plugin work than budgeted.
- During Facet Studio scoping, if maintaining two editor libraries feels disproportionately expensive relative to the gains.

---

## D4. Thread storage and Anchoring (future, Facet Review)

**Decision (provisional, for Facet Review):** Threads (and their Comments) live in the Collaboration source of truth (a separate database), not in the Markdown file. Anchoring uses text-content matching with graceful staleness (GitHub-PR-style "outdated" Threads, surfaced as Stale Threads).

**Alternatives considered:**

*Storage:*
- **In the Markdown file** (HTML comments or custom syntax) — pollutes diffs, requires inventing syntax, threaded replies get gnarly.
- **Sidecar file** committed alongside the `.md` — drifts out of sync, still messy diffs.
- **Separate database (Collaboration source of truth)** — repo is no longer the *full* source of truth, but is still the **Content source of truth**. Matches the team's existing mental model from Azure DevOps PRs.

*Anchoring:*
- **Line numbers** — break on any edit above the Thread.
- **Text content matching** — survives line shifts; the Thread becomes a Stale Thread when the anchored text itself is edited.
- **Stable AST node IDs** — survives most edits, requires injecting IDs (back to syntax pollution) or maintaining a sidecar.
- **CRDT / OT position tracking** — Google Docs-grade, massive engineering investment.

**Why this combination:**
- Storage in the Collaboration source of truth matches existing team mental model (ADO PRs work this way).
- Text-matching is good enough for async Review workflows; Stale Threads are a known acceptable failure mode.
- Avoids the CRDT rabbit hole, which is a 6–12 month engineering effort on its own.

**When to revisit:**
- If Stale Threads become a major Reviewer complaint, upgrade to AST node IDs.
- If real-time collaboration becomes a requirement, the whole Anchoring model needs rethinking.

---

## D5. Markdown round-trip fidelity

**Decision:** Treat Round-trip fidelity as a foundational, non-negotiable constraint. Saving a file must produce byte-identical markdown unless the Author actually changed something.

**Why this matters more than it seems:**
- Protects git history hygiene today (no spurious diffs).
- Prerequisite for stable Thread Anchoring in Facet Review (text-matching breaks if a Surface silently rewrites text).
- Necessary for cross-Surface portability (the same Markdown file edited in Facet for VS Code and Facet Studio should not drift).

**Implementation implications:**
- **Remark / unified** is used for **parsing only** in v1 (rendering decorations, link resolution, frontmatter extraction, semantic queries).
- **`remark-stringify` is not called at save time.** CodeMirror owns the text buffer and saves write its bytes verbatim. This is what makes byte-identical round-trip trivially achievable; `mdast` is a *semantic* AST and *cannot* round-trip arbitrary markdown by design (indented vs fenced code, intra-cell table whitespace, tight/loose list spacing, and other concrete-syntax details are not in the parsed tree).
- The spike at [`spikes/01-roundtrip-fidelity/`](../spikes/01-roundtrip-fidelity/) is the seed of a permanent test suite. Its job is to **guard against `remark-stringify` accidentally creeping into the save path** and to **track Remark parsing changes** that might affect downstream features. Promote it into `packages/core/` once the monorepo is scaffolded.

**When to revisit:**
- When **Facet Studio** (True WYSIWYG) is built and genuinely needs an AST→markdown serializer.
- If an opt-in **"Format document"** command is desired (Prettier-style — explicit Author invocation, mutation expected). Both are out of scope for v1.

---

## D6. Custom markdown syntax

**Decision:** No custom markdown syntax. Stick to CommonMark + GFM.

**Alternatives considered:** Wiki-style `[[links]]`, custom callouts, custom embed syntax.

**Why rejected:**
- The team already uses standard markdown links, not wiki-style links.
- Custom syntax forks the parser and breaks portability across Surfaces, GitHub, ADO, and any external renderer.
- The "publish as code" wiki vision requires the files to render correctly outside Facet.

**When to revisit:**
- Only if a use case emerges that genuinely cannot be served by CommonMark + GFM, and even then prefer extensions that are widely supported (e.g., math via KaTeX, footnotes per GFM extensions).

---

## D7. Naming

**Decision:** Facet (working name).

**Framing of the choice:** Names cluster by what they emphasize.

| Emphasis | Examples | Story |
|---|---|---|
| **Architecture** | **Facet** ✅ | One source, many Surfaces |
| **Output (Artifact)** | Lodestar, Touchstone, Keystone | The canonical reference everyone aligns to |
| **Process (Convergence)** | Crucible, Mosaic, Weave | The act of converging understanding |

**Why Facet:**
- Maps cleanly to the three-Surface architecture (Facet for VS Code, Facet Review, Facet Studio are literal facets of one source).
- Short, modern, distinctive, no significant baggage.
- Product family names compose naturally: Facet for VS Code, Facet Review, Facet Studio.
- Spousal review approval (a meaningful signal — non-technical audience finds it appealing).

**When to revisit:**
- During availability checks (marketplace, npm, GitHub, domain). If a major conflict surfaces, the strongest alternates are **Crucible** (Convergence framing) and **Lodestar** (Artifact framing).
- If the product positioning shifts to emphasize *the act of building shared understanding* rather than *the multi-Surface architecture*, Crucible becomes the more honest name.

---

## D8. Rendering model for complex blocks (line-based reveal vs. overlay layer)

**Decision (provisional, for v1):** Render complex blocks (frontmatter, tables, code blocks, blockquotes, headings, lists) using **line-based reveal-on-cursor** — when the cursor is on any line of the block, the raw source is revealed for editing; when it's elsewhere, marker characters are hidden via `Decoration.replace` and styling is applied via per-line `Decoration.line`. The block stays *inline* in the source.

**Alternative considered: Block-overlay "layer" (Obsidian-style).** The block renders as a styled overlay layer **above** the source. Clicking the layer drops into raw-source edit mode; clicking out re-applies the layer. Arrow keys treat each layer as a single atomic unit. This is the model Obsidian uses for frontmatter and embedded blocks, and it's the long-term direction the Author finds compelling.

**Why line-based reveal won for v1:**

- Aligned with CodeMirror 6's native model (per-decoration StateFields over the live text buffer). Each block type ships independently — frontmatter, tables, code, etc. each get their own PR-sized unit, no cross-cutting overlay abstraction needed up front.
- Round-trip fidelity (D5) is structurally trivial: the source is always the rendered representation; saves write the buffer verbatim. An overlay model still saves the buffer, but the cursor/focus model is more elaborate, raising the surface area for accidental buffer mutations.
- Plan B (D3, Milkdown with a source-mode toggle) would naturally provide overlay-style rendering if we pivot. Over-investing in a CM-native overlay system before D3's revisit conditions trigger would duplicate work.

**Why the overlay model is genuinely tempting (and tracked here, not rejected):**

- Complex blocks (Mermaid in step 10, eventually a properties panel for frontmatter, eventually a table grid) are fundamentally render-not-edit experiences. An overlay layer is the natural fit; trying to retrofit them onto line-based reveal is fighting the model.
- Cursor edge cases compound across block types under the line-based model. Two are parked already (arrow-up/down goal-column drift across decorated lines, and the same drift exaggerated through the multi-line frontmatter widget — currently papered over with `EditorView.atomicRanges`). Each new block type adds a similar edge case.

**When to revisit:**

- ~~**Before step 10 (Mermaid).** Mermaid is render-not-edit by nature; if we build it as a third bespoke decoration variant, we're committing to the line-based model. Make this decision explicitly there.~~ **Cleared.** Step 10 shipped Mermaid as a seventh StateField using the existing line-based reveal pattern (`Decoration.replace({ block: true })` over the whole fenced range with a `MermaidWidget`, plus `EditorView.atomicRanges` for arrow-key navigation, plus click-to-enter-source mirroring the frontmatter pattern). The async render lifecycle (lazy import, error placeholder) fit cleanly inside the existing `WidgetType` shape — no flicker observed in the EDH because `eq()` is keyed on code so unchanged source reuses the existing DOM. No D8 signal fired.
- ~~**After step 7 (code blocks)** if syntax highlighting + visible-but-muted fences + a `lang` badge starts to feel like overlay-in-disguise.~~ **Cleared at step 7.** Block-level fence collapse + a `lang` badge widget on the opening fence fit the line-based pattern.
- **During step 13 (polish)** if the parked cursor edge cases (most acute on frontmatter and arrow-up/down across decorated lines) feel actively bad rather than tolerable in the "live on the team wiki for a week" acceptance test. **This is now the next active D8 checkpoint.**
- **If D3's Plan B activates** (switch to Milkdown), this decision is moot — Milkdown gives overlay rendering for free.

**Out of scope here:** D8 governs the rendering model only. Whether frontmatter eventually gets a properties-panel UI, whether tables get a grid editor, whether Mermaid gets PNG export — those are separate scope decisions, listed under "Open questions" below.

---

## Open questions (deferred, not decided)

These have been discussed but explicitly not decided. Captured here so they aren't lost when web Surfaces get scoped:

- **Auth and identity** for Facet Review and Facet Studio.
- **Backend / hosting** for the web Surfaces (self-hosted vs SaaS, single-tenant vs multi-tenant).
- **Real-time vs async collaboration.** Async is the realistic v1 of Facet Review. Real-time would change the Thread Anchoring architecture meaningfully.
- **Properties panel for Frontmatter** (schema-aware editing). Deferred from v1 of Facet for VS Code.
- **Paste / drag-drop image insertion** with auto-save to workspace. Deferred from v1.
- **Mermaid PNG export and authoring assistance.** Deferred from v1.
- **Other diagram formats** (PlantUML, D2, Graphviz). Out of scope unless demand emerges.
