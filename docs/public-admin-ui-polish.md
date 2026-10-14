# Public and admin UI polish

Branch: `fix/public-admin-ui-polish`, based on `develop`. No ticket number supplied.

## Plan and implementation

1. Reuse the shared archive controls: visually hide the introductory description
   on both sites and remove redundant sort captions and tag explanations. Retain
   accessible dialog descriptions, the disabled relevance option explanation,
   custom UTC date hints, validation errors and tag limits.
2. Use the stylesheet shared by public SSR and admin CSR for pointer cursors on
   links, buttons, selects, disclosure summaries and semantic action roles.
   Disabled actions use a not-allowed cursor; text inputs retain text cursors.
3. Replace the public footer's revision date with `© <current year> by Indra`,
   bold the name, align credit left and cookie/theme icons right, and remove
   the theme toggle from the public header. Keep the existing consent lifecycle:
   the cookie icon appears after a decision and reopens the banner. Revision
   dates remain in resume/PDF metadata, structured data and the sitemap.
   Use Lucide's 14px copyright icon alongside 14px credit text, with an accessible
   copyright symbol. Cookie and theme icons are both 20px, centered in 44px controls.
   Register the existing bold font at weight 700 instead of mapping it to regular
   glyphs; browser coverage verifies the actual bold face loads.
4. Update browser coverage for concise copy, actual computed cursors, disabled
   tag limits, footer placement at 320px and desktop in both themes, theme changes
   and consent reopening. Run formatting, lint, types, unit tests and the relevant
   browser suites against a production build; inspect browser screenshots.

## Release scope

These UI changes need no schema, environment, dependency or deployment changes.
Local review was completed and shipping authorized. Commit without a co-author
trailer, push and open a PR targeting `develop`; merging remains a review step.
Follow [production release preparation](public-site-release.md) for the separate
`develop` to `main` release PR. Account configuration and deployed staging revision
must be verified separately; local checks cannot establish their state.

## Verification results

- `npm run check`: formatting, lint, generated types and TypeScript passed;
  58 unit-test files / 524 tests passed. Wrangler logs were redirected to `/tmp`
  for the final run because the sandbox makes the default log directory read-only.
- Production build and Playwright: all 43 selected public/admin browser tests
  passed after the icon and font updates. Admin discovery used isolated browser
  API fixtures and wrote no private data; real OAuth is outside this targeted suite.
- Footer cases verify 14px copyright/text alignment, equal 20px action icons and
  44px controls, and a loaded weight-700 bold font face. Visually inspected public
  and admin sheets plus light/mobile and dark/desktop footer captures.
- `git diff --check` passed. No schema or configuration changes were introduced.

The browser runtime needed sandbox escalation for local D1 and loopback serving.
The build still reports existing JetBrains Mono font resolution warnings; browser
assertions and visual review passed. Full seeded CI, real OAuth and live staging
review remain release gates rather than claims made by these local UI checks.
