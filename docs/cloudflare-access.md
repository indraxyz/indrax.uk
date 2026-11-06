# Public dev access and GitHub admin authentication

Cloudflare Access was removed from the development site and media hostnames on
2026-10-13. Public pages and published cover images can be reached without an
Access session, just as on production. No Worker-specific Access policy is needed.

## Application authentication

The repo's Better Auth integration handles GitHub OAuth and database-backed
sessions. Signed-out `/admin` visitors redirect to `/admin/login`; protected
client routes revalidate the author session before loading private data.
Every private API and mutation independently verifies the session and immutable
numeric GitHub author ID on the server. The public admin JavaScript and login
page do not grant author access.

`/api/admin/session` is intentionally reachable without authentication and returns
only `author: null` and `authConfigured` to signed-out callers, with `no-store`.
Private archive, tag and overview reads return 401, as do unsigned uploads and
post mutations. OAuth callbacks remain reachable so GitHub can complete sign-in.

Keep `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET` and `ALLOWED_GITHUB_ID` configured separately for production and staging. The named `develop` Preview uses
`https://develop.previews.indrax.uk/api/auth/callback/github`; production uses
`https://indrax.uk/api/auth/callback/github`. During rollout, preserve the legacy
dev OAuth App callback `https://dev.indrax.uk/api/auth/callback/github` and use a
separate Preview OAuth App so both origins remain testable. `BETTER_AUTH_URL` must match the
respective site origin. Missing configuration keeps author operations closed.

## Domains and indexing

Production, the legacy dev Worker and custom-domain Preview hosting retain
`workers_dev: false` and `preview_urls: false`. The Preview base domain
`previews.indrax.uk` has `previews_enabled: true` and `enabled: false`, producing
`develop.previews.indrax.uk` without routing the base hostname to production.
Verify TLS coverage before enabling the Preview CI cutover gate. Custom domains
keep canonical origins and domain-level protections consistent. This configuration
does not recreate Access applications or require an Access cookie.

Legacy dev and the staging Preview remain non-indexable through `X-Robots-Tag: noindex, nofollow` and a
`robots.txt` disallow-all response. These are indexing controls, not login gates.
Do not publish confidential documents on public dev pages or in the cover bucket.
Draft content stays behind the application's author checks.

## Verification

```bash
npm run security:smoke -- dev     # legacy deployment during rollout
npm run security:smoke -- staging # named develop Preview after bootstrap
npm run security:smoke -- production
```

All targets verify reachable public and login pages with strict script policies,
app login redirects, anonymous session privacy/configuration, denied private API
reads, refused unsigned uploads and public missing-cover responses with safety
headers. Both staging targets additionally verify its noindex header and disallow-all robots.txt.
Requests carry no session and follow no redirects. The refused upload has an empty
body and creates no R2 object; no content or sessions are created.

Browser tests cover signed-out and forged-session admin boundaries, authoring
sessions, OAuth failure handling and public pages. A real GitHub sign-in/out
round trip remains a manual check with the environment's OAuth App.

## Deployment implication

GitHub Actions runs the smoke command after deployment. The previous dev check
expected Access redirects and shared site/media Access audiences; those expectations
must not be retained after removing Access. This change updates that gate without
weakening the app's session, author, origin, upload or edge rate-limit checks.

## Preview maintenance authentication

`POST /api/internal/preview/media-cleanup` is a machine-only staging test route.
It requires `PREVIEW_MAINTENANCE_ENABLED=true`, the configured staging origin, a
staging-only `PREVIEW_MAINTENANCE_TOKEN`, and an empty JSON object. A foreign Origin
header is rejected; a server caller may omit Origin. Author session cookies do not
replace the bearer token. The disabled/production route returns 404, invalid
credentials return 401, and responses remain no-store/noindex.

This invokes the same bounded cleanup function as production Cron. Preview cleanup
runs after deployment or manual maintenance, not on an hourly Cloudflare schedule.
Keep the runtime token in Preview secrets and the matching GitHub `Preview`
environment secret; never expose it through public Vite settings. See
[deployment and rollout](development-and-deployment.md#preview-bootstrap-and-cleanup).
