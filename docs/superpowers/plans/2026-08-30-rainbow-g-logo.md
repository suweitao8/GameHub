# Rainbow G Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace GameHub's current cat/blue placeholder branding with one rainbow-gradient G mark shared by the game Header, mobile menu, browser favicon, and server fallback assets.

**Architecture:** Keep the existing static asset names for compatibility, but make `gamehub-logo.svg`, `gamehub-favicon.svg`, and `logo.svg` render the same transparent 512 × 512 G mark and gradient. Render the canonical asset explicitly in Angular templates instead of drawing a text G with CSS, and point document/server fallback references at that asset. Extend the existing GameHub client contract script so future changes cannot silently split the page Logo from the favicon.

**Tech Stack:** Angular templates and SCSS, static SVG assets, Node.js contract checks, pnpm client build/lint, Playwright-compatible real browser verification.

---

### Task 1: Add failing Logo consistency contract

**Files:**
- Modify: `scripts/verify-gamehub-client.mjs`

- [ ] **Step 1: Add assertions for the intended Logo contract**

Read the favicon link, Header and menu templates, Header SCSS, and server fallback source. Assert that the templates use `/client/assets/images/gamehub-logo.svg`, that the document favicon uses `/client/assets/images/gamehub-favicon.svg`, that the Header no longer creates a text G with `::before`, and that all three SVG assets contain the same G path and rainbow gradient stop definitions.

- [ ] **Step 2: Run the focused contract and verify it fails for the missing implementation**

Run: `pnpm exec node scripts/verify-gamehub-client.mjs`

Expected: FAIL with Logo contract messages because the current Header still uses the CSS `content: 'G'` pseudo-element and the existing SVG files do not share the new rainbow mark.

### Task 2: Implement the shared rainbow G assets

**Files:**
- Modify: `client/src/assets/images/gamehub-logo.svg`
- Modify: `client/src/assets/images/gamehub-favicon.svg`
- Modify: `client/src/assets/images/logo.svg`

- [ ] **Step 1: Replace each legacy mark with the same transparent SVG G**

Use the same 512 × 512 viewBox, rounded G path, `gamehub-rainbow` linearGradient, and accessible title/description in each compatibility asset. Keep the favicon file name and logo fallback file name intact while ensuring their rendered path and gradient stops match the main GameHub Logo.

- [ ] **Step 2: Run the focused contract**

Run: `pnpm exec node scripts/verify-gamehub-client.mjs`

Expected: the new asset assertions and all existing client contracts pass.

### Task 3: Connect the mark to every current brand surface

**Files:**
- Modify: `client/src/index.html`
- Modify: `client/src/app/header/header.component.html`
- Modify: `client/src/app/header/header.component.scss`
- Modify: `client/src/app/menu/menu.component.html`
- Modify: `client/src/app/menu/menu.component.scss`
- Modify: `server/core/lib/server-config-manager.ts`

- [ ] **Step 1: Render the SVG in the game Header and mobile menu**

Add a decorative `<img>` with empty alt text and `aria-hidden="true"` beside the existing GameHub wordmark and in the mobile menu controls. Remove the Header CSS pseudo-element that renders a different text G, and size the image through the existing responsive Logo classes.

- [ ] **Step 2: Point document and server fallbacks to the shared mark**

Keep the current cache-busting favicon query parameter, but point the fallback favicon and Header logo entries in `ServerConfigManager` to `gamehub-favicon.svg` and `gamehub-logo.svg` respectively. Do not alter the custom uploaded-logo selection path.

- [ ] **Step 3: Run the focused contract and client lint**

Run: `pnpm exec node scripts/verify-gamehub-client.mjs` and `pnpm --dir client run lint -- --no-warn-ignored`

Expected: both commands exit 0 with no new errors.

### Task 4: Build and verify the rendered brand

**Files:**
- No source changes expected.

- [ ] **Step 1: Build the light client**

Run: `pnpm run build:client:light`

Expected: the en-US client build exits 0 and includes the three SVG assets in the built asset tree.

- [ ] **Step 2: Run the GameHub self-test gate**

Run: `pnpm run self-test:gamehub`

Expected: the server/client build, lint, static contracts, and live checks complete successfully. If the live prerequisite services are unavailable, record the exact blocked check and run all non-live checks separately; do not claim the full gate passed.

- [ ] **Step 3: Verify desktop and mobile in a real browser**

Open the running GameHub page in the browser at the configured local URL. Confirm the game Header shows the rainbow G plus GameHub wordmark, the mobile menu shows the same G, the favicon request resolves to the new SVG, and the browser console has no Logo-related errors. Check both a desktop viewport and a narrow mobile viewport.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check`, `git status --short`, and `git diff --stat`

Expected: only the documented Logo assets, references, contract check, and design documents are changed.
