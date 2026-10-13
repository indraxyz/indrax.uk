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
`GITHUB_CLIENT_SECRET` and `ALLOWED_GITHUB_ID` configured per Worker. Dev's OAuth
App callback is `https://dev.indrax.uk/api/auth/callback/github`; production uses
`https://indrax.uk/api/auth/callback/github`. `BETTER_AUTH_URL` must match the
respective site origin. Missing configuration keeps author operations closed.

## Domains and indexing

Both Workers retain `workers_dev: false` and `preview_urls: false`. Custom domains
keep canonical origins and domain-level protections consistent. This configuration
does not recreate Access applications or require an Access cookie.

Dev remains non-indexable through `X-Robots-Tag: noindex, nofollow` and a
`robots.txt` disallow-all response. These are indexing controls, not login gates.
Do not publish confidential documents on public dev pages or in the cover bucket.
Draft content stays behind the application's author checks.

## Verification

```bash
npm run security:smoke -- dev
npm run security:smoke -- production
```

Both targets verify reachable public and login pages with strict script policies,
app login redirects, anonymous session privacy/configuration, denied private API
reads, refused unsigned uploads and public missing-cover responses with safety
headers. Dev additionally verifies its noindex header and disallow-all robots.txt.
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
