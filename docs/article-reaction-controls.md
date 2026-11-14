# Article reaction controls — issue #111

## Investigation and plan

The public detail route owns one `PostReactions` query/mutation lifecycle. Previously
its picker appeared beside metadata while positive count chips preceded tags.
Keep the existing API, identity/storage policy, query keys and authoritative write
response cache seeding. Refactor presentation and article composition.

1. Put metadata, tags and grouped interactions in reading order.
2. Preserve pending guards, local focus recovery and accessible error feedback.
3. Keep controls within the viewport when text grows; extend mobile contents to
   both viewport edges.
4. Extend regressions, run checks and build, then open a PR to develop.

The user’s final layout overrides the issue’s visible Copy link label and repeated
footer proposal: Add reaction and Copy link remain icon-only; reactions appear
only below the tags. Selected reactions have no checkmarks or underlines.

## Acceptance criteria

- Header order is title, passive metadata, tags, interactions, series/body. Empty
  optional slots produce no blank rows; previews have no public controls.
- Positive count chips sit beside Add reaction. Copy link is a separate trailing
  icon-only action with an accessible name, hover title and canonical clipboard
  behavior. There is no reaction row after the article body.
- One query/mutation owner provides counts, selected state and pending guards.
  Successful writes seed the cache without a redundant GET.
- The picker retains Radix trigger/popup associations. Escape returns focus to
  its trigger. A disappearing focused chip returns focus to the nearby trigger
  after the update commits, without scrolling or stealing focus moved elsewhere.
- Count-aware button names and pressed states remain. Selection uses heavier
  count weight and a slightly larger selected picker emoji. No checkmarks or
  underlines appear. Chips, picker choices, Add reaction and Copy link have at
  least 44 × 44 CSS px targets and visible keyboard focus.
- One live status announces updates. Initial load errors remain retryable;
  mutation/storage errors stay beside the controls. Current load errors take
  precedence over obsolete mutation feedback after a visitor change.
- Layout wraps at 320, 390, 768 and 1280 CSS px with large counts and long content,
  including 200% root text and 320px reflow equivalent to 400% of 1280px. Controls
  are hidden in print. SSR content, TOC, series, view beacon, metadata and code-copy
  behavior remain intact.
- Site navigation and consent buttons wrap at enlarged text sizes, as requested
  after the stress test exposed existing overflow. Article titles and passive
  date groups wrap too.
- The mobile/tablet contents bar extends across the public shell’s horizontal
  padding to both viewport edges. Internal controls retain their inset, sticky
  position and native disclosure behavior. Desktop contents stay in the sidebar.

## QA

Automate GET/write request budgets, pending guards, Escape, final-chip focus,
load/retry, mutation/rate-limit errors, blocked storage, visitor replacement and
clearing, preview isolation and canonical copy behavior. Check DOM order, absence
of footer reactions, 44px targets, whole-page overflow and axe with an open picker.
Capture mobile/desktop headers and edge-to-edge contents at 390px and 1024px.

Run `npm run check`, `npm run build` and focused reaction/content/interaction/
navigation browser suites against disposable seeded SQL. Check site navigation
and consent regressions when wrapping changes. Record executed/skipped/retried
cases and limitations in the PR.

Manual acceptance includes keyboard-only use, actual browser zoom/reflow,
light/dark appearance, print and JavaScript-disabled content. Screen reader
verification requires NVDA/Firefox or VoiceOver/Safari; automated axe is not a
substitute. No deployment or infrastructure changes belong to this ticket.

## Verification record

Validated with Node 24 and Chromium against a sanitized temporary checkout and
an isolated, migrated and seeded loopback database:

- `npm run check`: formatting, ESLint, generated types, TypeScript and 1,038 tests
  across 98 unit files passed.
- `npm run build`: public SSR Worker and independent admin bundles passed.
- Reaction suite: 20 passed. Related article content, sharing, series, navigation
  and analytics suites: 76 passed. Final runs had no skips or retries.
- Mobile/desktop interaction screenshots and full-width contents screenshots at
  390px/1024px were captured and inspected. Automated axe, keyboard/focus, print,
  200% root text, 320px reflow and JavaScript-disabled checks passed.

Manual screen-reader and actual browser zoom checks remain unverified. Complete
CI is required before merge; no remote deployment was used for validation.
