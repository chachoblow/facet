# Ubiquitous Language

The shared vocabulary for the Facet product. Use these terms precisely; avoid the listed aliases.

## Product

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Facet** | The product as a whole — the family of tools for creating, viewing, and aligning around shared markdown documents. | The product, the editor, the tool |
| **Surface** | A specific presentation-and-interaction context in which Facet renders a **Document** (e.g. the VS Code editor, the web review app). The technical concept. | View, mode, instance |
| **Facet for VS Code** | The **Surface** that runs inside VS Code as a custom editor. Audience: **Authors** (devs). Mode: **Hybrid live-preview**. | VS Code Facet, the extension, the VS Code app |
| **Facet Review** | The future web **Surface** for reading and commenting on a **Document**. Audience: **Reviewers**. Mode: **Renderer with comment overlay**. | Web review, the comment app |
| **Facet Studio** | The future web **Surface** for authoring a **Document**. Audience: **Authors** (PMs primarily). Mode: **True WYSIWYG**. | Web editor, the WYSIWYG app |

## Editing modes

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Hybrid live-preview** | An editing mode where markdown syntax is visible on the block under the cursor and rendered on every other block. The default for **Facet for VS Code**. | Hybrid mode, live preview, Obsidian mode |
| **True WYSIWYG** | An editing mode where markdown syntax is never visible — the user always sees the rendered form. The mode for **Facet Studio**. | WYSIWYG, rich-text mode, Notion mode |
| **Renderer** | A read-mostly mode that displays the rendered **Document** with comment overlays but no editing surface. The mode for **Facet Review**. | Preview, viewer, read-only mode |

## Documents

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Markdown file** | The on-disk `.md` file in the git repo. The canonical storage of a **Document**. | The file, .md, source |
| **Document** | The conceptual content represented by a **Markdown file**. What a user perceives across any **Surface**. | Doc, page, content |
| **Artifact** | The **Document** in its role as the captured shared understanding produced by collaboration. The philosophical framing of why the **Document** exists. | Output, deliverable, result |
| **Frontmatter** | The YAML metadata block at the top of a **Markdown file**. | Header, metadata block |
| **Round-trip fidelity** | The property that opening and saving a **Markdown file** through a **Surface** produces byte-identical output unless the user changed the **Document**. A non-negotiable constraint. | Lossless save, clean save |
| **Content source of truth** | The git repo holding **Markdown files**. Distinct from **Collaboration source of truth**. | Source of truth (alone — too ambiguous) |
| **Collaboration source of truth** | The platform/database holding **Comments**, **Threads**, and resolution state. Distinct from **Content source of truth**. | Source of truth (alone — too ambiguous) |

## Collaboration

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Comment** | A single note left by a **Reviewer** anchored to a position in a **Document**. | Note, remark, annotation |
| **Thread** | One or more **Comments** sharing the same **Anchor**, including replies. The unit that gets resolved or marked outdated. | Discussion, conversation |
| **Anchor** | The position in a **Document** to which a **Thread** is attached. Implemented in v1 of **Facet Review** as text-content matching. | Pin, location, link |
| **Resolution** | The state of a **Thread** indicating that the issue it raised has been addressed. A **Thread** is *resolved* or *unresolved*. | Closed, done, fixed |
| **Stale Thread** | A **Thread** whose **Anchor** text no longer exists in the **Document**. Surfaced separately so context isn't lost. | Outdated comment, broken comment |
| **Review** | The act of a **Reviewer** reading a **Document** and leaving **Threads** on it. Distinct from **Facet Review** (the **Surface**). | Reviewing (when ambiguous with the surface name) |
| **Convergence** | The *process* by which separate participants' mental models merge into one shared understanding through collaborative editing and review. | Synthesis, merging, unification |
| **Alignment** | The *state* of shared understanding achieved through **Convergence**. The goal Facet exists to support. | Agreement, consensus |

## People

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Collaborator** | Any participant interacting with a **Document** through any **Surface**. Includes **Authors** and **Reviewers**. | User, participant, contributor |
| **Author** | A **Collaborator** who edits a **Document**. Operates through **Facet for VS Code** or **Facet Studio**. | Writer, editor (overloaded with the library), creator |
| **Reviewer** | A **Collaborator** who reads a **Document** and leaves **Threads** on it. Operates through **Facet Review**. | Commenter, approver |
| **Dev** | A developer **Collaborator**. The primary audience for **Facet for VS Code**. | Engineer, programmer |
| **PM** | A product manager **Collaborator**. The primary audience for **Facet Studio** and **Facet Review**. | Product, product folk, product manager (in casual use), product owner |
| **AI agent** | A non-human consumer of a **Document** that reads it as context (instructions, prompts, skills). Treated as a first-class **Collaborator** in the vision, even though it doesn't comment. | LLM, model, bot |

## Relationships

- A **Markdown file** stores exactly one **Document**.
- A **Document** is presented through one or more **Surfaces**, each running one **Editing mode**.
- A **Document** lives in the **Content source of truth** (the git repo).
- A **Thread** is anchored to exactly one position in a **Document** via an **Anchor**.
- A **Thread** contains one or more **Comments** and has exactly one **Resolution** state.
- **Threads** and their **Comments** live in the **Collaboration source of truth** (the platform/database), *not* in the **Markdown file**.
- An **Author** writes through **Facet for VS Code** or **Facet Studio**.
- A **Reviewer** comments through **Facet Review**.
- The **Artifact** is what the **Document** *becomes* through **Convergence** among **Collaborators**; **Alignment** is the resulting state.

## Example dialogue

> **Dev:** "If I'm editing a **Document** in **Facet for VS Code** and a **Reviewer** has open **Threads** on it, what shows up in my **Surface**?"

> **Domain expert:** "In v1, nothing — **Facet for VS Code** doesn't render **Threads**. They live in the **Collaboration source of truth**, and the only **Surface** that displays them is **Facet Review**. The **Markdown file** itself is unaware of them."

> **Dev:** "What if I edit the text a **Thread** is anchored to? Does the **Anchor** break?"

> **Domain expert:** "The **Thread** becomes a **Stale Thread** because its **Anchor** can no longer match the current **Document** text. **Facet Review** surfaces it separately so the **Reviewer**'s context isn't lost, but it's no longer pinned to a position."

> **Dev:** "And that's still considered acceptable **Round-trip fidelity**?"

> **Domain expert:** "Yes — **Round-trip fidelity** is about not silently mutating the **Markdown file**. If the **Author** intentionally rewrites a paragraph, we expect downstream **Threads** to go stale; that's a **Convergence** event, not a fidelity violation."

> **Dev:** "Got it. So **Alignment** is what we hope happens once the **Stale Thread** is reviewed and the **Document** stabilizes."

> **Domain expert:** "Exactly. The **Document** is the **Artifact** of that **Convergence**."

## Flagged ambiguities

- **"Surface" vs "Facet"** — early conversation used these interchangeably. They are *not* the same. **Facet** is the product brand and conceptual model (one source, many faces). **Surface** is the technical term for a specific presentation context. The product names *Facet for VS Code*, *Facet Review*, *Facet Studio* are brand-prefixed names for individual **Surfaces**.
- **"Editor"** — heavily overloaded across the conversation. It variously meant: a **Surface**, an **Author** (the person), and a software library (CodeMirror 6, Milkdown). Avoid the bare term in spec language. Say **Surface** when you mean the product context, **Author** when you mean the person, and name the library directly (CodeMirror 6, Milkdown) when you mean the software.
- **"Comment" vs "Thread"** — *Comment* is a single note; *Thread* is the anchored conversation containing one or more **Comments**. **Resolution** applies to the **Thread**, not individual **Comments**. Use the right term.
- **"Source of truth"** — used loosely for both the git repo and any future platform database. Always qualify: **Content source of truth** (git, for **Documents**) vs **Collaboration source of truth** (database, for **Threads**).
- **"Hybrid mode" / "live preview" / "hybrid live-preview"** — three phrasings for one concept. Canonical: **Hybrid live-preview**.
- **"Product folk" / "PM" / "product manager"** — pick **PM** for spec and code; "product folk" is fine in casual or vision-doc prose but not as a domain term.
- **"Convergence" vs "Alignment"** — *Convergence* is the **process**; *Alignment* is the **resulting state**; the **Artifact** is the **persistent output**. These three are distinct and the spec/vision docs should use them precisely rather than treating them as synonyms.
