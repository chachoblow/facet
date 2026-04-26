# Facet — Vision & Context

## What Facet is for

Markdown files as **shared Artifacts of Alignment** — the canonical reference that humans, AI agents, and future-you all orient around when working on the same "thing."

Every Collaborator brings their own internal model of the work. A Dev pictures one shape; a PM pictures another; an AI agent has yet another; you, weeks later, may have forgotten the original. Without a shared Artifact, those models drift, conflict, and produce misaligned output.

Facet is the product where individual mental models **Converge** into a shared written one — and the **Artifact** that results is the Markdown file itself, durable in git, readable by everyone, editable by any Author through the right Surface.

## The core articulation

> Each party has some conceptual idea of the "thing" trying to be understood. I have one vision in my head, another developer has another, a PM has another, and an LLM has another. Through the process of using this product, an artifact representing the shared understanding of that "thing" is created.

This is the soul of the product. Every feature decision should be checked against it: *does this make Convergence of understanding easier, or does it just add Surface features?*

## Audiences and use cases

Facet is designed to serve three audience patterns with the same underlying Artifact:

### 1. Human ↔ AI Alignment
Authoring agent instructions, system prompts, skill definitions, and behavior specs that AI agents read as context. The Markdown file is the contract between the human's intent and the agent's behavior.

### 2. Cross-functional team Alignment
Dev designs, product specs, RFCs, ADRs. The Artifact bridges Devs and PMs who think differently and historically use different tools (Devs comfortable in git, PMs comfortable in Notion/Confluence/Docs). One Artifact, two native Surfaces.

### 3. Personal continuity
Notes, reference docs, second-brain material. The Artifact aligns past-you, present-you, and future-you — the canonical thing you fall back to when memory fades.

## Current-state pain (why now)

The team's current best workflow for collaborative markdown review is **Azure DevOps pull requests**:

- ✅ Threads (with replies) exist
- ✅ Threads can be marked resolved
- ✅ The PR description acts as a top-level discussion post
- ❌ PMs aren't familiar with ADO PRs and find the tool alienating
- ❌ Threads anchor to **raw markdown**, not the rendered Document — bad Reviewer experience for anyone who doesn't read markdown fluently
- ❌ Devs and PMs end up working in different tools, duplicating intent across systems

**Facet Review** is the direct response to this gap: **Threads anchored to the rendered Document, in a Surface that doesn't require git literacy, with the Markdown file in the repo as the Content source of truth.**

## Why markdown specifically

Markdown is the lingua franca underneath all three use cases:

- **Plain text** — diffable, mergeable, durable across tooling generations
- **Git-native** — versioning, blame, history, branching all come for free
- **Universally rendered** — GitHub, ADO, GitLab, static site generators, AI agent contexts, every modern doc tool
- **Readable raw** — Devs can edit it directly without a tool; PMs can read it raw in a pinch
- **Adaptive** — the same source can be rendered for editing, reading, reviewing, or AI agent consumption

Facet bets that a great experience *on top of* markdown beats trying to invent a new format.

## What success looks like

A team using Facet should experience:

1. **One Artifact, no duplication.** The dev spec the team aligns on is the same file the PMs left Threads on, the same file the AI agent reads as context, the same file in the git repo.
2. **Native Surfaces, not lowest-common-denominator UI.** Devs get a Hybrid live-preview Surface in VS Code (Facet for VS Code). PMs get clean rendered review in a browser (Facet Review). Nobody is forced into the other's tool.
3. **Convergence as a process, not an event.** Threads, edits, and resolutions happen iteratively in the Surfaces people actually live in.
4. **The repo stays the Content source of truth.** Threads (and their Comments) live in the Collaboration source of truth — a platform/database. *Content* lives in git, where it has always belonged.
