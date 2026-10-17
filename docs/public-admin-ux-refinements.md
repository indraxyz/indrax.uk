# Hero, admin navigation, and Stack refinements

Follow-up branch: `fix/public-admin-styles-and-resume`, based on `develop`.
This records the current public/admin refinements and shared style consistency fixes.

## Scope

- Home and resume share a hero heading scaled from 24px to 32px. Personal
  information and PDF controls are on the left; LinkedIn and GitHub are on the right.
  The personal sheet is titled “About me”, with matching open/close labels. Its six
  section icons use the hero social controls' solid secondary color, square border,
  and shadow, while remaining decorative and outside the keyboard tab order.
- Admin navigation groups Resume, Writing, and Stack under Public on desktop and
  mobile. The brand links to the dashboard, replacing the duplicate home control.
  Public links load the public application; private links use browser routing.
  Public uses the same underline hover style as Posts on desktop, with a down
  chevron to identify its dropdown and text-only menu items. Inside the mobile
  sheet, Public matches the bordered Posts row, with a globe and trailing chevron.
  Sign-out is a ghost icon button on desktop and a full-width primary button with
  centered icon and text inside the sheet, matching Apply's primary colors.
  Sign-out and filter Apply use the shared flat button appearance: no elevation or
  movement on hover/press, with the same readable color and keyboard focus states.
  Sheet rows have no persistent active background; `aria-current` identifies Posts.
  Resizing closes the drawer when CSS actually reveals desktop navigation, avoiding
  a separate JavaScript breakpoint that can drift from the stylesheet.
  The theme icon lives in the page footer,
  aligned right opposite “Administrator”; the sign-in page needs no mobile menu.
- Public Writing and admin Posts filter sheets use concise Apply/Clear actions.
  Shared pagination uses borderless arrow icons with accessible direction labels,
  tooltips, 44px targets, visible keyboard focus, inactive end-of-list arrows, and
  a concise “Page x of x” counter on the left with both arrows grouped on the right.
- Post creation uses `/admin/posts/new`; editing uses `/admin/posts/edit/:id`.
  Existing `/admin/new` and `/admin/edit/:id` bookmarks redirect. Dashboard links,
  list links, save navigation, and test expectations use the new routes.
- Validated post covers link to the editor and have an accessible link name and
  visible keyboard focus. Absent or untrusted covers do not leave an empty link.
- The shared post menu uses Eye for Preview, Send for Publish, ExternalLink for
  Visit, EyeOff for Unpublish, Archive for Archive, and Trash2 for Delete.
- Stack explanations start with each tool’s role and place supporting rationale
  behind “Why these tools?”. Copy reflects server-rendered public content, browser
  archives, the independent admin, deferred PDF generation, saved-image cleanup,
  authentication checks, local tooling, CI, separate environments, and analytics.
  Branch protection is described as documented policy rather than a live audit.
  Repeated sections and resource links live in `features/tech-stack/data/stack.ts`;
  the route renders them. TypeScript validates each section’s required fields.
  Resume content continues to use `features/resume/data/resume.ts`.

- Related articles rank by shared-tag count, publication date, then post UUID for
  stable ties. A versioned cache key retires results using the old ordering.

## Editing page content

Use TypeScript objects so component consumers check the field names and types at
build time. These pages import content directly; they do not fetch or parse JSON.

- `features/resume/data/resume.ts`: personal information, biography, experience,
  skills, projects, education, and other resume records shared by the page and PDF.
- `features/resume/data/page.ts`: shared hero heading, name-derived page metadata,
  and section descriptions consumed by the resume page and PDF.
- `features/resume/config.ts`: runtime display configuration, including the built
  revision date and its date format.
- `features/tech-stack/data/stack.ts`: page metadata, overview, reading/publishing/
  delivery descriptions, typed technology sections, rationale, and source links.

Page components own rendering, layout, and interaction. Introduce JSON or a CMS
only when another system needs to edit or deliver this content; the current site
needs neither extra runtime parsing nor a separate content service.

## Verification

Colocated unit tests cover trusted cover links, omitted invalid media, editor save
navigation, and unchanged query budgets. Browser tests cover responsive hero order
and heading size, Public menu destinations and keyboard focus, editor URL redirects,
distinct action icons, cover navigation, Stack disclosures, resume print/PDF output,
and filter behavior. Public and admin pagination specs share
`e2e/support/pagination.ts` to verify rendered icon styles, 44px targets, focus,
concise counters, and real first/last-page navigation.

`test/integration/related-posts.test.ts` exercises real PostgreSQL ranking and ties,
the three-result default and smaller limits, source/private/incomplete/unrelated
exclusions, and untagged/nonexistent sources. It checks the single-query budget and
summary-only results. Use the disposable local database workflow in [testing](testing.md)
for SQL, authenticated authoring/session, and isolated media-upload checks.

The unconfigured-auth boundary test asserts the existing Worker’s exact 503 error;
configured anonymous requests still return an empty session with 200. No production
auth behavior changes. Browser checks use fixture GitHub identities and do not
exercise live OAuth. Local Chromium can fail initial assets with
`ERR_NETWORK_CHANGED`; retain traces and report isolated reruns, as described in
the test guide.

No database schema, package dependency, environment, or deployment configuration
changes are required. This pull request targets `develop`; deployment is separate.
