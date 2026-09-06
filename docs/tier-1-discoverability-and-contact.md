# Tier 1 — Discoverability, Shareability, Contact & Analytics

Status: approved for implementation
Owner: Indra Cahya Edytya
Target branch: `feat/tier-1-discoverability-and-contact` → `main`

> **Revision — Workstream 4 (permanent CV URL) was reverted before merge.**
> `/resume.pdf`, the `app/api/resume-pdf` route handler, the `next.config.ts`
> rewrite and `serverExternalPackages` entry, and the `RESUME_PDF_PATH` /
> `RESUME_PDF_FILE_NAME` config exports are all gone. The CV is downloaded the way
> it was on `main` before this branch: react-pdf renders it in the browser on
> click, behind a dynamic import. Two things carry over rather than revert - the
> `resume_pdf_downloaded` event, now captured only after a successful render, and a
> deferred `URL.revokeObjectURL` so the blob outlives the click in browsers that
> read it late. Decisions **D1**, **D5**, and the parts of **D3**
> and **D4** that assume a URL no longer describe the code, and acceptance criteria
> **AC-4.1**–**AC-4.4** are withdrawn. Everything else in this document — the
> structured data, the social card, the contact row, and the analytics — shipped as
> written. The header's second "GitHub profile" control was also removed, so the
> contact row is now the page's only GitHub link.

---

## 1. Context

The site is a single-route resume (`/`) that renders from one typed source file
(`features/resume/data/resume.ts`) and can export itself as a PDF. It is
well-built, but it is currently **inert as a personal-branding asset**:

| Observation (verified in the codebase)                                                                   | Consequence                                                                                              |
| :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| No structured data anywhere                                                                              | Search engines cannot connect `indrax.uk`, the GitHub profile, and the LinkedIn profile as one person    |
| `openGraph.images` is the raw `/foto-profile.jpg`, `twitter.card` is `"summary"`                         | Shared links render as a small square card, not a designed banner                                        |
| No `mailto:` or `tel:` on screen; `PersonalCard` renders name, birth, age/gender/status and address only | A visitor who wants to make contact has nothing to click. Email exists **only** inside the generated PDF |
| PDF is produced client-side in `download-resume-button.tsx` via `pdf(...).toBlob()`                      | There is no URL for the CV. It cannot be pasted into an application, an email signature, or a job form   |
| No analytics dependency in `package.json`                                                                | No way to tell whether anyone reaches the portfolio or takes the CV                                      |

This spec covers the five smallest changes that turn the page into an asset that
can be found, shared, acted on, and measured.

## 2. Goals

1. Make the site machine-readable as a person entity.
2. Make a shared link render as a designed banner.
3. Give a visitor one click to make contact.
4. Give the CV a permanent, pasteable URL.
5. Measure arrival, contact intent, and CV downloads.

## 3. Non-goals

- A blog, case-study routes, or any second content type (Tier 2).
- Editing resume copy, pruning the portfolio, or changing which personal
  fields are displayed (Tier 3 — deliberately excluded so this branch stays
  reviewable).
- A cookie-consent UI. See §9.
- i18n, component tests, Storybook (Tier 4).

## 4. User stories & acceptance criteria

### US-1 — Found by name

> As a recruiter who was given only my name, I want the search result for
> "Indra Cahya Edytya" to resolve to this site and to link out to my verified
> profiles, so that I can confirm I am one person and not three.

- **AC-1.1** The page emits one `<script type="application/ld+json">` block.
- **AC-1.2** It parses as JSON with `@context: "https://schema.org"` and
  `@type: "ProfilePage"`, whose `mainEntity` is a `Person`.
- **AC-1.3** `mainEntity.name` equals `personalInfo.name`, and `jobTitle`
  equals `personalInfo.title` — both read from the data file, never retyped.
- **AC-1.4** `mainEntity.sameAs` contains both `SOCIAL_LINKS.github` and
  `SOCIAL_LINKS.linkedin`.
- **AC-1.5** `mainEntity.url` is the absolute canonical origin.
- **AC-1.6** The block contains **no** `telephone` and no `birthDate` (§9).

### US-2 — Shared link looks deliberate

> As someone posting my link in a Slack channel or on LinkedIn, I want the
> unfurled preview to look designed, so that the first impression is made
> before anyone clicks.

- **AC-2.1** `GET /opengraph-image` returns `200` with `content-type: image/png`.
- **AC-2.2** The image is 1200×630.
- **AC-2.3** It carries the name, the job title, the site host, and uses the
  site's own palette and JetBrains Mono — not a generic default.
- **AC-2.4** The rendered HTML advertises `og:image` and `twitter:image` as
  absolute URLs.
- **AC-2.5** `twitter:card` is `summary_large_image`.

### US-3 — One click to make contact

> As a visitor who has just read the hero and wants to reach me, I want a
> contact action in front of me, so that I do not have to open a drawer or
> download a PDF to find an email address.

- **AC-3.1** The hero renders an email action whose `href` is
  `mailto:` + `personalInfo.email`.
- **AC-3.2** The hero renders LinkedIn and GitHub actions pointing at
  `SOCIAL_LINKS`, each `target="_blank"` with `rel="noopener noreferrer"`.
- **AC-3.3** Every action has an accessible name and is reachable by keyboard.
- **AC-3.4** The email address is rendered as visible text, so a printed sheet
  carries it (today neither the screen nor the printed page shows an email).
- **AC-3.5** The row degrades gracefully if `personalInfo.email` is unset —
  `email` is optional on the `PersonalInfo` type.

### US-4 — The CV has a URL

> As myself, applying for a role, I want a permanent link to my CV, so that I
> can paste it into a form or a signature instead of attaching a file.

- **AC-4.1** `GET /resume.pdf` returns `200` with
  `content-type: application/pdf`.
- **AC-4.2** The body begins with the `%PDF-` magic bytes.
- **AC-4.3** The response sets `content-disposition` with the filename
  `Indra-Cahya-Edytya-Resume.pdf`.
- **AC-4.4** The footer download control points at `/resume.pdf`.
- **AC-4.5** The document is byte-identical in content to what the old
  client-side path produced — same `ResumeDocument`, same fonts.

### US-5 — Know what is working

> As myself, I want to know how many people arrive, whether they try to
> contact me, and whether they take the CV, so that I can tell whether any of
> this is worth maintaining.

- **AC-5.1** PostHog initialises only when `NEXT_PUBLIC_POSTHOG_KEY` is set;
  with no key the site renders and behaves identically and issues no analytics
  request.
- **AC-5.2** A pageview is captured on load.
- **AC-5.3** Activating the CV download captures `resume_pdf_downloaded`.
- **AC-5.4** Activating a contact action captures `contact_clicked` with a
  `channel` property of `email`, `linkedin`, or `github`.
- **AC-5.5** No analytics failure can break the page or block a download.

## 5. Technical design

### 5.1 New and changed files

```
app/
├── layout.tsx                      (M) twitter card → summary_large_image;
│                                       drop manual og image; mount analytics
├── page.tsx                        (M) render the JSON-LD block
├── opengraph-image.tsx             (A) Next convention; serves the card
└── api/resume-pdf/route.tsx        (A) server-rendered PDF

components/
└── posthog-analytics.tsx           (A) "use client", key-gated init

lib/
└── analytics.ts                    (A) capture helper, safe when uninitialised

features/resume/
├── components/hero-section.tsx     (M) contact row
├── components/contact-links.tsx    (A) email / LinkedIn / GitHub actions
├── components/download-resume-button.tsx  (M) anchor to /resume.pdf + event
├── config.ts                       (M) RESUME_PDF_FILE_NAME, RESUME_PDF_PATH
├── pdf/theme.ts                    (M) server-resolvable font paths
├── social-card.tsx                 (A) 1200×630 ImageResponse
└── utils/structured-data.ts        (A) Person / ProfilePage builder

next.config.ts                      (M) rewrite, tracing includes, externals
.env.example                        (A) documents the two PostHog vars
playwright.config.ts                (A)
e2e/*.spec.ts                       (A) see §7
```

### 5.2 Decisions and why

**D1 — `/resume.pdf` is a rewrite, not a route directory.**
`.gitignore` ends with `*.pdf` ("Generated resume export"). A gitignore pattern
matches directories too, so an `app/resume.pdf/` route folder would be silently
untracked along with everything inside it. The handler therefore lives at
`app/api/resume-pdf/route.tsx` and `next.config.ts` rewrites `/resume.pdf` to
it. The public URL is the nice one; the source path is trackable.

**D2 — the client-side PDF path is replaced, not duplicated.**
Keeping both a client generator and a server route would mean two render paths
over the same document — exactly the drift that `config.ts` already warns about
for section copy. The button becomes a plain anchor to `/resume.pdf`. This also
drops a large lazy chunk from the browser and makes the download work with
JavaScript disabled.

**D3 — fonts are registered by filesystem path on the server.**
`@react-pdf/font` branches on the shape of `src`: a data URL is decoded, a URL
is fetched, and **anything else is passed to `fontkit.open()` as a filesystem
path**. The current `"/fonts/JetBrainsMono-Regular.ttf"` works only in the
browser, where it resolves against the origin. Server-side it would be read as
an absolute path from the filesystem root and fail. `registerPdfFonts()` now
resolves against `process.cwd()/public/fonts`.

**D4 — the PDF and the OG image are statically prerendered.**
Both are pure functions of committed data, so `dynamic = "force-static"` renders
them during `next build`, where `public/fonts` is guaranteed present, and serves
them as static assets afterwards. `outputFileTracingIncludes` also ships the
font files with the server bundle, so the routes still work if either is ever
made dynamic.

**D5 — `serverExternalPackages: ["@react-pdf/renderer"]`.**
The renderer pulls in fontkit and other Node-native code that must not be
bundled by Turbopack.

**D6 — the JSON-LD is derived, never retyped.**
`buildPersonStructuredData()` reads `personalInfo`, `bio`, `experiences[0]`,
`education[0]` and `SOCIAL_LINKS`. Nothing in the block is a second copy of a
string that already exists in the data file.

**D7 — analytics is key-gated and fires instantly.**
`posthog-provider.tsx` returns without initialising when
`NEXT_PUBLIC_POSTHOG_KEY` is absent, so a fork or a preview without a key is
unaffected. `capture()` is wrapped so a missing client is a no-op rather than a
thrown error, satisfying AC-5.5. Download and contact events pass
`send_instantly: true` because the click navigates away and PostHog's default
batching would drop the event.

**D8 — the OG image comes from the file convention.**
`app/opengraph-image.tsx` is picked up by Next's metadata convention and produces
an absolute URL automatically. Next also derives `twitter:image` from that same
route, so there is no second card to keep in step. The manual `openGraph.images` /
`twitter.images` entries in `layout.tsx` are removed so the page does not advertise
both the banner and the bare photo.

### 5.3 Structured data shape

```jsonc
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "dateModified": "<RESUME_CONFIG.updatedAt>",
  "mainEntity": {
    "@type": "Person",
    "name": "...", // personalInfo.name
    "jobTitle": "...", // personalInfo.title
    "description": "...", // bio, whitespace-collapsed
    "url": "<SITE_URL>",
    "image": "<SITE_URL>/foto-profile.jpg",
    "email": "mailto:...", // already public via the new contact action
    "address": { "@type": "PostalAddress", "addressLocality": "..." },
    "worksFor": { "@type": "Organization", "name": "..." },
    "alumniOf": { "@type": "EducationalOrganization", "name": "..." },
    "knowsAbout": ["..."], // personalInfo.highlightSkills
    "sameAs": ["<github>", "<linkedin>"],
  },
}
```

### 5.4 OG image composition

1200×630, drawn with the site's own tokens so it reads as the same product:
background `#063b00` (`--primitive-brand-950`), foreground `#ffffff`, accent
`#e1e100` (`--primitive-brand-300`), JetBrains Mono ExtraBold/Regular loaded
from `public/fonts`. Layout: an accent rule, the name in heavy uppercase, the
job title spaced out in the accent colour, the first three highlight skills, and
`indrax.uk` in the corner. The profile photo is embedded as a base64 JPEG
square with a heavy border, echoing the print hero.

### 5.5 Environment

| Variable                   | Required | Default                    | Purpose                              |
| :------------------------- | :------- | :------------------------- | :----------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | no       | —                          | Project key. Absent ⇒ analytics off. |
| `NEXT_PUBLIC_POSTHOG_HOST` | no       | `https://us.i.posthog.com` | Ingestion host.                      |
| `NEXT_PUBLIC_SITE_URL`     | no       | `https://indrax.uk`        | Already used by `config.ts`.         |

## 6. Out-of-band effects to watch

- Removing the client-side renderer changes the footer control from a `<button>`
  to an `<a>`. Its accessible name and `print:hidden` behaviour must survive.
- `metadataBase` already resolves relative metadata URLs, so the file-convention
  image will be absolute without further work.
- The PDF is now generated at build time, so **the build fails loudly** if the
  document or a font path breaks. That is the intended trade: a broken CV is
  caught in CI rather than by a visitor.

## 7. Test plan — Playwright E2E

New dev dependency `@playwright/test`, config at `playwright.config.ts`, specs
in `e2e/`. The web server under test is a real production build
(`npm run build && npm run start`) so the assertions cover prerendering, not dev
behaviour. A dummy PostHog key and a non-routable host are injected for the
analytics specs, and requests to that host are intercepted in-page.

| Spec                          | Covers                                              |
| :---------------------------- | :-------------------------------------------------- |
| `e2e/smoke.spec.ts`           | page renders, `h1`, no console errors, theme toggle |
| `e2e/structured-data.spec.ts` | AC-1.1 … AC-1.6                                     |
| `e2e/social-card.spec.ts`     | AC-2.1 … AC-2.5                                     |
| `e2e/contact-links.spec.ts`   | AC-3.1 … AC-3.5                                     |
| `e2e/resume-pdf.spec.ts`      | AC-4.1 … AC-4.4                                     |
| `e2e/analytics.spec.ts`       | AC-5.1 … AC-5.5                                     |

Scripts: `npm run test:e2e`, `npm run test:e2e:ui`.

## 8. Definition of done

- [ ] All acceptance criteria above are covered by a passing Playwright spec.
- [ ] `npm run check` (format + lint + type-check) passes.
- [ ] `npm run build` succeeds and prerenders `/resume.pdf` and the OG image.
- [ ] The generated OG image has been inspected, not merely asserted on.
- [ ] `ARCHITECTURE.md` / `README.md` reflect the new routes and scripts.
- [ ] No secret is committed; `.env.example` carries only placeholders.

## 9. Privacy, security & follow-ups

- **Cookie consent is not addressed here.** PostHog sets first-party cookies.
  For a `.uk` site with UK/EU visitors, analytics cookies require consent, so a
  consent gate is a required follow-up before this can be called compliant.
  Mitigations applied now: `person_profiles: "identified_only"` (visitors stay
  anonymous unless identified) and `respect_dnt: true`.
- **`telephone` and `birthDate` are deliberately excluded from the JSON-LD.**
  A phone number in structured data is a standing invitation to scrapers, and
  the date of birth is the Tier 3 discussion about which personal fields belong
  on an internationally-facing site. Neither is needed for entity resolution.
- **Publishing `mailto:` increases scraping exposure.** That is the accepted
  cost of a contact action; the address is already public on the PDF and on
  LinkedIn. No obfuscation is attempted, because it breaks accessibility.
- **No user input is accepted anywhere**, so this branch adds no injection
  surface. The JSON-LD is serialised with `JSON.stringify` from committed data.
- **Follow-ups:** consent gate; PostHog reverse proxy to survive blockers; a
  contact form if inbound volume ever justifies it.

---

## 10. Implementation notes

What the build actually taught us, recorded against the plan above rather than
quietly diverging from it.

### 10.1 A bug the work uncovered

**The CV was about to lose its photo.** Moving the PDF onto the server surfaced
`ENOENT: no such file or directory, open '/foto-profile.jpg'` during
`next build`. `resume-document.tsx` drew the hero photo with
`<Image src="/foto-profile.jpg">` — the identical browser-path assumption D3
describes for fonts. react-pdf logs the failure and renders the rest of the
document anyway, so the build still passed and the CV simply came out without a
photo. Fixed by resolving it through `PDF_PHOTO_SRC` in `pdf/theme.ts`, and
covered by a spec asserting the PDF contains a `DCTDecode` stream.

### 10.2 Corrections to §5.1

| Planned                                     | Built                                           | Why                                                                                                                                                                                                     |
| :------------------------------------------ | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| —                                           | `components/ui/linkedin-icon.tsx`               | lucide-react v1 ships no brand marks; `github-icon.tsx` already sets the precedent                                                                                                                      |
| `components/analytics/use-analytics.ts`     | `lib/analytics.ts`                              | A hook buys nothing over a plain function callable from an event handler, and `lib/` is where framework-level helpers already live                                                                      |
| `components/analytics/posthog-provider.tsx` | `components/posthog-analytics.tsx`              | It provides no context — it starts the tracker and renders `null`. A single-file directory also sat oddly next to `components/theme-toggle.tsx`                                                         |
| `opengraph-image.tsx` + `twitter-image.tsx` | `features/resume/social-card.tsx` and one route | Next derives `twitter:image` from the Open Graph route, so the second file was dead weight - and a `twitter-` filename reads as unrelated in a codebase whose only social links are GitHub and LinkedIn |
| Contact row as a `div`                      | A `nav` labelled "Contact"                      | The header already exposes a "GitHub profile" link; two links sharing an accessible name is ambiguous for anyone navigating by link list                                                                |

### 10.3 Analytics findings

- **PostHog silently drops bot traffic.** Its capture guard checks
  `navigator.webdriver` and the `userAgentData.brands` list, and rejects a match
  with no request and no log — which is why the first suite run looked like a
  missing key. That filter is correct in production and stays on; the test
  browser stops advertising itself as automation instead. See the note in
  `e2e/support/analytics.ts`.
- **Payloads are gzipped under a `text/plain` content type**, so Playwright's
  `postData()` returns nothing for them. The helper reads `postDataBuffer()` and
  tries gzip, deflate, raw and base64 in turn.
- **`advanced_disable_flags: true` was added.** There are no flags, experiments
  or surveys here, so the flag request on every load was pure latency.
- **AC-5.1 is only partly covered by the suite.** `NEXT_PUBLIC_*` values are
  inlined at build time and the suite runs one build, so the no-key path cannot
  be exercised without a second build. The sibling guard — a visitor who has
  asked not to be tracked — is covered instead, and the no-key path is a plain
  `if (!POSTHOG_KEY) return` at the top of `startAnalytics()`.

### 10.4 Verification performed

- `npm run check` — Prettier, ESLint and `tsc --noEmit` all clean, no warnings.
- `npm run build` — `/`, `/api/resume-pdf` and `/opengraph-image` all prerender as
  static content.
- `npm run test:e2e` — 23 specs passing against a production build.
- The PDF was fetched and inspected: `%PDF-1.3`, ~240KB, all three JetBrains Mono
  faces embedded, one `DCTDecode` image, and the text extracts cleanly (so it
  stays readable to an ATS).
- The social card was rendered and looked at, not merely asserted on.
