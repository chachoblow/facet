# Facet for VS Code — v1 Spec

## Name

**Facet** — one document (the gem), many faces (the **Surfaces**). Facet for VS Code is one Surface, Facet Review another, Facet Studio a third — same source markdown file, different views for different audiences.

The metaphor maps directly to the product architecture: a single Content source of truth, multiple presentation modes adapted to different Collaborators (Devs, PMs, AI agents, future-you). **Facet** is the product brand; **Surface** is the canonical technical term for an individual presentation context. The two are not interchangeable — see `UBIQUITOUS_LANGUAGE.md`.

Product family naming: **Facet for VS Code** (this spec), **Facet Review** (future), **Facet Studio** (future web WYSIWYG Surface).

Working name. Confirm marketplace, npm, GitHub, and domain availability before locking it in.

## Problem

VS Code's native markdown experience forces constant context-switching between the raw text editor and the rendered preview. Developers either lose the structural feedback of seeing rendered output, or they pay the cognitive tax of managing two panes.

We want a **hybrid live-preview editor** in VS Code: edits happen in-place against the rendered output, but markdown syntax remains accessible (visible when the cursor is on a block, hidden when it isn't). Think Obsidian's Live Preview mode, native to VS Code.

## Long-term vision

V1 is a stepping stone toward a broader **"docs as code with shared editing experience"** vision. Three eventual Surfaces, all backed by markdown files in a git repo:

| Surface | Audience | Editing mode | Status |
|---|---|---|---|
| **Facet for VS Code** | Devs authoring | Hybrid live-preview | **V1 (this spec)** |
| **Facet Review** | All Collaborators | Renderer with comment overlay | Future |
| **Facet Studio** | PMs authoring | True WYSIWYG | Future |

The git repo is the **Content source of truth**. **Threads** (and their **Comments** and resolution state) live in the **Collaboration source of truth** — a separate platform/database — when web Surfaces ship, analogous to how Azure DevOps PR comments work today.

The shared core across all three Surfaces is the **markdown content + the Remark/unified parsing ecosystem**, not a single editor library. Each Surface uses the library that best fits its Editing mode.

## V1 scope

**Just Facet for VS Code (the Hybrid live-preview Surface).** Web Surfaces are explicitly out of scope. Decisions made in v1 should preserve runway toward the long-term vision but should not pre-build for it.

## Architecture

- **VS Code integration**: `CustomTextEditorProvider`. The `.md` file remains the Content source of truth; VS Code handles undo/redo, dirty state, find/replace, and the file lifecycle natively. The webview hosts the rendering/editing layer, not a parallel state store.
- **Editor library**: **CodeMirror 6**, in Hybrid live-preview configuration. Battle-tested in Obsidian and VS Code itself. Excellent performance and cursor behavior. The right fit for Hybrid live-preview; not the right fit for True WYSIWYG (deferred to Facet Studio).
- **Markdown parsing**: **Remark / unified** for **parsing**, even though CodeMirror has its own markdown extension. This keeps the AST consistent across future web Surfaces and gives us a single, well-supported parser to reason about. Saves write the CodeMirror buffer verbatim — `remark-stringify` is not in the save path. See [`spikes/01-roundtrip-fidelity/README.md`](../spikes/01-roundtrip-fidelity/README.md).
- **Round-trip fidelity is a foundational concern.** Saving a file must produce byte-identical markdown unless the user actually changed something. This protects git history today and is a prerequisite for stable Thread anchoring in Facet Review. We preserve this by not serializing the AST at save time: CodeMirror owns the text buffer, and saves write its bytes verbatim. Test this aggressively.
- **No custom markdown syntax.** Stick to CommonMark + GFM. Custom syntax forks the parser and breaks portability across Surfaces and external renderers (GitHub, ADO, etc.).

## V1 features

### Rendering and editing
- CommonMark + GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks)
- Hybrid live-preview rendering for: headings, bold/italic, links, lists, code blocks, blockquotes, tables, task lists, images
- Syntax highlighting in fenced code blocks
- Native VS Code undo/redo, find/replace, dirty state
- Respects VS Code themes (light, dark, high-contrast)

### Mermaid diagrams
- Render Mermaid fenced code blocks (` ```mermaid `)
- Cursor inside the fence → show source for editing
- Cursor outside the fence → show rendered SVG
- Debounce rendering (~300ms) while editing inside the fence
- Invalid syntax → show inline error in the rendered slot, keep source visible
- Lazy-load Mermaid library only when a `mermaid` fence is detected in the document
- Mermaid theme follows VS Code theme (light/dark)

### Frontmatter
- YAML frontmatter rendered as a **collapsed, styled block** at the top of the document
- Click to expand and edit raw YAML
- No properties-panel UI in v1

### Links
- Standard markdown links (`[text](./path.md)`) navigate within the editor
- Anchor links (`[text](./other.md#section)`) open the target file and scroll to the heading
- Remote links (`https://...`) open in the user's browser
- Click handling routed through the extension host via `vscode.open`

### Images
- Local relative paths resolved against the markdown file's directory and converted via `Webview.asWebviewUri()`
- Remote images (`https://...`) render directly
- Webview CSP configured to allow both

### Activation and opt-out
- The Surface is **opt-in** via a command: `"Facet: Set as default markdown editor"`
- Per-workspace override supported via `.vscode/settings.json`:
  ```json
  { "workbench.editorAssociations": { "*.md": "facet.editor" } }
  ```
  Wiki repos can ship this so contributors get the experience automatically.
- A **"View source"** toggle button is always available within Facet for VS Code to bail out to VS Code's native text editor for the current file.
- VS Code's native `"Reopen With…"` command continues to work as the standard escape hatch.

## Explicit non-goals for v1

The following are deferred. Some are tracked as future runway, some are explicit "no for now" calls.

- **True WYSIWYG mode in VS Code.** The Hybrid live-preview model serves Devs better. True WYSIWYG is Facet Studio's job.
- **Editing mode toggle within a Surface** (Hybrid live-preview ↔ True WYSIWYG). Mode-switching UX is a tar pit (cursor preservation, undo history, dirty state across the toggle). Not worth it until users ask.
- **Custom toolbar, slash commands, command palette.** Standard markdown editing only.
- **Wiki-style `[[links]]`.** Team uses standard links; non-standard syntax breaks portability.
- **Paste / drag-drop image insertion** with auto-save to workspace. Loved feature, real complexity. Defer to v1.1.
- **Mermaid PNG export, Mermaid authoring assistance** (autocomplete, templates, validation).
- **Other diagram formats** (PlantUML, D2, Graphviz). Mermaid only.
- **Real-time collaboration** (Google Docs / CRDT-style).
- **Threads, Comments, Review workflow.** Facet Review concern.
- **Properties panel for Frontmatter.** Schema-aware editing is a feature in itself.
- **Web Surfaces** of any kind.

## Decisions that protect future runway

These are choices we are making in v1 *specifically* because they keep doors open for Facet Review and Facet Studio:

1. **Remark / unified for parsing.** Same AST the future Surfaces will use. Same parser, same edge cases, one codebase to debug. (`remark-stringify` is deliberately not in the v1 save path — see Architecture and Decision D5.)
2. **Aggressive round-trip fidelity testing.** A v1 that subtly mutates `- [ ]` into `* [ ]` or reflows lists will corrupt git history *and* break stable Thread anchoring later.
3. **No custom markdown syntax.** Files written in v1 must render correctly on GitHub, ADO, and any future Surface without special handling.
4. **Library-agnostic core where reasonable.** Logic that handles markdown parsing, Frontmatter extraction, and link resolution should live separately from CodeMirror-specific code, so it can be reused by Milkdown / a Renderer / a Thread system later. Don't over-engineer this — just don't bury it inside CodeMirror plugins.

## Open questions for the future (not v1)

These do not need answers now but should be revisited when web Surfaces are scoped:

- **Thread anchoring scheme.** Text-content matching with graceful staleness (GitHub-style) vs. stable AST node IDs vs. CRDT positions. Likely text-matching for v1 of Facet Review.
- **Thread storage.** Almost certainly the Collaboration source of truth (a separate database), not the Markdown file. Team is already comfortable with this model from ADO PRs.
- **Auth and identity** for the web Surfaces.
- **Real-time vs async collaboration.** Async-only is the realistic v1 of Facet Review; matches the existing Review workflow.
- **Backend / hosting** for the web Surfaces.

## Strawman v1 acceptance criteria

An Author can:

1. Install the extension, run the "Set as default" command, and open any `.md` file in Facet for VS Code.
2. Edit a complex existing Markdown file (headings, lists, tables, code blocks, Mermaid, Frontmatter, images, links) without seeing syntax mutations on save (Round-trip fidelity preserved).
3. See live-rendered output for blocks their cursor is not on, and raw markdown for blocks their cursor is on.
4. Click a relative link to another `.md` file and have it open in Facet for VS Code.
5. Click "View source" to drop into VS Code's native text editor for the current file.
6. Have the Surface follow their VS Code theme, including in Mermaid diagrams.
7. Open a file with invalid Mermaid syntax and see a clear inline error without losing access to the source.
