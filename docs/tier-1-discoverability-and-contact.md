# Discoverability, Sharing, Contact and Analytics

This document describes the current profile-site implementation, not a pending
framework-specific build plan. The public application uses React Router
**8.4.0** SSR and Vite; admin is an independent static CSR application.
See [architecture](../ARCHITECTURE.md), [the migration guide](react-router-migration.md)
and [testing](testing.md). Writing-specific distribution requirements live in
[the writing PRD](writing-prd.md).

## Profile identity and metadata

`app/routes/home.tsx` emits `ProfilePage` JSON-LD with a `Person` main entity.
`features/resume/utils/structured-data.ts` derives identity, role, organization,
education, skills and social links from existing resume data/configuration;
those facts must not be copied into a second source. The canonical URL and profile
image are absolute. `telephone` and `birthDate` are deliberately omitted.
The JSON-LD serializer escapes unsafe HTML characters before embedding data.

`app/routes/meta.ts` supplies title, description, canonical, Open Graph and Twitter
metadata through React Router route exports. Public profile pages remain readable
in the initial HTML. Shared cards use absolute image URLs and
`summary_large_image`, with one image source for both metadata formats.

## Social cards and machine-readable resources

`lib/resources.server.ts` handles `/opengraph-image` and the profile/article social
card resource URLs. `features/resume/social-card.tsx` owns profile composition;
`features/writing/social-card.tsx` owns article composition. Shared card dimensions,
brand palette and font handling live under `lib/og/`. Images are 1200×630 PNGs
using the site's visual identity and committed profile content.

Resource response caching avoids repeating image generation on a warm cache;
article keys include the current public revision so unpublished content cannot
be served through a stale article-image lookup. Missing article cards redirect
to the generic profile card; generation failures are safely logged and return an
unavailable response. A generated fallback for every rendering failure is not
currently guaranteed.

The same resource handler exposes robots, sitemap and RSS. Sitemap entries derive
from current public routes and published writing only. Robots excludes admin/API
paths. RSS advertises absolute published article links, and the root document
exposes its alternate feed link. Private admin routes also receive a noindex
header at the Worker boundary.

## Contact actions

The hero contact row exposes LinkedIn and GitHub from existing configuration.
Email is shown in the personal-information card/drawer through `EmailLink`, with
a visible address and `mailto:` target; the card omits it when email is absent.
External profile links use safe new-window attributes, and every action has an
accessible name and keyboard path. Preserve the existing print presentation.

Keep the existing profile/portfolio facts unchanged when maintaining these
features. Contact presentation, metadata and analytics should reuse their data,
not rewrite it.

## Resume PDF

The current download is generated **in the browser on demand** by
`features/resume/components/download-resume-button.tsx`. It dynamically imports
`features/resume/pdf/generate-resume.client.tsx`, uses the shared document/font
configuration and downloads a blob with a name derived from `personalInfo.name`.
The large renderer is not part of the initial page load and does not consume
Worker CPU while generating the document.

The control announces progress, prevents duplicate requests and exposes failure
feedback for retry. Blob URLs are revoked after the browser claims the download.
The successful-download event is recorded after generation succeeds.

There is no current `/resume.pdf` server resource or permanent static PDF URL.
Providing a pasteable CV URL would be a separate asset-generation requirement;
do not document an unavailable endpoint or a build-time PDF renderer as shipped.

## Consent and analytics

`components/posthog-analytics.tsx` starts analytics only after explicit consent
and stops it when consent is withdrawn, including changes from another tab.
`components/consent-banner.tsx` owns the consent UI; its layout must not cover
contact, download or consent controls. No key means no tracker initialization.

`lib/analytics.ts` owns safe event capture and pageview filtering. Public pageviews,
`contact_clicked` with `email`/`linkedin`/`github` channel, and successful
`resume_pdf_downloaded` events are captured when configured and consented.
Analytics failures must never block navigation, contact or downloads. The tracker
is mounted in the public app, not the independent admin app. URL-valued event
properties redact `token` and `preview` query parameters; preview pageviews are
not wholly excluded. Never send private document data or session credentials.
Analytics ingestion/asset hosts and CSP use shared host configuration to avoid drift.

Public configuration and environment templates are documented in
[README](../README.md). Build-time public settings must stay explicitly allowlisted;
OAuth, auth and database secrets belong only in Worker runtime configuration.
Consent behavior is an implementation control, not a blanket statement of legal
compliance in every jurisdiction.

## Verification and maintenance

Existing Playwright coverage includes:

| Specs                                            | Behavior                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `e2e/structured-data.spec.ts`                    | Derived identity, metadata and intentionally excluded personal fields |
| `e2e/social-card.spec.ts`                        | Resource response, image dimensions and metadata URLs                 |
| `e2e/contact-links.spec.ts`                      | Contact targets, accessibility and print behavior                     |
| `e2e/resume-pdf.spec.ts`                         | Actual PDF download and lazy renderer loading                         |
| `e2e/analytics.spec.ts`                          | Consent, pageviews/events and unobstructed controls                   |
| `e2e/navigation-progress.spec.ts`                | Initial spinner and navigation feedback in public/admin apps          |
| `e2e/smoke.spec.ts`, `e2e/accessibility.spec.ts` | Page/theme behavior and accessibility                                 |

Run the built Worker using the current scripts and fixtures in
[testing](testing.md), plus `npm run check` and `npm run build`. Wait for hydration
before invoking browser-only handlers. Inspect a generated social card when its
composition changes, and validate the actual PDF rather than only the click.
Do not retain historical pass counts or claim build-time prerendering that the
current application does not perform.
