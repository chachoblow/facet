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
- Use **Remark / unified** for parse and serialize, even though CodeMirror has its own markdown handling.
- Build a Round-trip fidelity test suite early. Run it against a corpus of real-world markdown (existing repo files, GitHub READMEs, etc.) before shipping v1.

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

## Open questions (deferred, not decided)

These have been discussed but explicitly not decided. Captured here so they aren't lost when web Surfaces get scoped:

- **Auth and identity** for Facet Review and Facet Studio.
- **Backend / hosting** for the web Surfaces (self-hosted vs SaaS, single-tenant vs multi-tenant).
- **Real-time vs async collaboration.** Async is the realistic v1 of Facet Review. Real-time would change the Thread Anchoring architecture meaningfully.
- **Properties panel for Frontmatter** (schema-aware editing). Deferred from v1 of Facet for VS Code.
- **Paste / drag-drop image insertion** with auto-save to workspace. Deferred from v1.
- **Mermaid PNG export and authoring assistance.** Deferred from v1.
- **Other diagram formats** (PlantUML, D2, Graphviz). Out of scope unless demand emerges.
