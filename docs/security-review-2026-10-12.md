# Dev Access and production upload security review

Implementation update: dev and dev-media Access are now live and signed-out smoke
checks pass. Separate Standard R2 buckets and media domains were created; r2.dev
URLs are disabled and edge media security headers were verified. Source changes
add body deadlines, exact media-origin checks, native R2 bindings, conditional
writes and deployment/smoke guards. Image decoding/re-encoding was deferred by
the owner. Production will receive source changes with the planned main release.
See [R2 setup and current limits](r2-uploads.md). The findings below preserve the
initial observations; their historical "remaining work" is superseded by this update.

Reviewed on 2026-10-12, approximately 08:37–08:42 UTC. Scope: dev Access,
upload enforcement and reuse, and production/main deployment. Production remains
public. This review did not change infrastructure or upload objects.

## Evidence and current state

Git references were refreshed from origin. `origin/develop` is `0440429`;
`origin/main` is `318532d`. The secure upload commit `b0a77c2` is not an ancestor
of main. Main still contains the Next.js presigned upload endpoint; develop uses
the React Router Worker and the upload proxy.

Unauthenticated live checks returned:

| Host          | Request                                    | Result                        |
| ------------- | ------------------------------------------ | ----------------------------- |
| dev.indrax.uk | HEAD /                                     | 200, application HTML         |
| dev.indrax.uk | HEAD /robots.txt                           | 200, application text         |
| dev.indrax.uk | HEAD /api/admin/session                    | 401, application JSON         |
| dev.indrax.uk | POST /api/upload?purpose=cover, empty body | 401, Not authorised           |
| indrax.uk     | HEAD /                                     | 200, Next.js/OpenNext headers |
| indrax.uk     | POST /api/upload, empty JSON               | 401, Not authorised           |

Wrangler reports the latest dev deployment on 2026-10-11 and the latest
production deployment on 2026-09-29. This supports the branch/runtime difference;
deployment timestamps alone do not prove which source commit was deployed.

## Confirmed findings

### 1. High priority: dev Access is not enforcing the intended boundary

Signed-out requests reach the application. An admin 401 is application
authentication, not Access protection. Robots and noindex headers do not prevent
scanners from making requests.

`docs/cloudflare-access.md` provides setup instructions, but the live behavior
contradicts its opening description. The precise cause—absent application,
incorrect domain/path, or a bypass policy—was not inspected. The Wrangler OAuth
login has no Access permission.

Remaining work: configure or repair a self-hosted Access application for the
entire `dev.indrax.uk` hostname, allow only the intended author identity, and
inspect overlapping path applications and bypass rules. Confirm signed-out
requests to pages, API routes and assets receive Access denial/login, then
verify author login, GitHub OAuth and uploads in an authenticated browser.
Inspect live routes and confirm workers.dev and preview URLs cannot bypass it.
The repository already disables these URLs in both environments; live settings
were not independently verified.

### 2. High priority: production/main lacks the secure upload implementation

`origin/main:app/api/upload/route.ts` checks client-reported size and type, then
returns a five-minute presigned PUT URL. A local reproduction of its signer
using dummy credentials produces `X-Amz-SignedHeaders=host`: neither the actual
body nor its Content-Type is constrained by that signature. Someone holding a
minted URL can upload different bytes, declare a different type or exceed the
application's intended 5 MiB cap. Authentication protects URL issuance, which
limits the prerequisite to an author session or possession of an issued URL.

The URL is also reusable until expiry, so its generated key does not prevent a
holder overwriting that same object during the validity window. Cloudflare
documents this reuse behavior in its presigned URL reference.

Remaining work: release the validated Worker upload pipeline to production, or
backport it together with its browser caller to the Next.js application. Main
differs substantially from develop, including a framework migration; promoting
develop would release more than these security changes. Do not cherry-pick only
the new endpoint without its runtime dependencies and client contract.

The owner plans to merge develop into main soon. Use that planned release to
deliver the upload changes; a separate backport is unnecessary unless the release
is delayed. Verify the production deployment afterward, since a merge alone does
not prove that the deployed upload endpoint has changed.

R2 does not provide the S3 bucket-policy mechanism assumed by the old endpoint's
comments. Enforce the application cap before storage rather than relying on a
bucket rule. Retire the old URL issuer; previously issued URLs expire after
their five-minute validity period.

### 3. Medium: signatures establish format hints, not valid cover images

`lib/uploads/file-signature.ts` accepts a three-byte JPEG prefix and an eight-byte
PNG prefix. A local reproduction confirms `[0xff, 0xd8, 0xff]` is identified as
JPEG despite containing no image. The upload route accepts that result and
writes the bytes unchanged. Its success test uses a truncated PNG fixture.

Consequences: malformed files and arbitrary data following a recognized prefix
can be stored. A small compressed image can also have extremely large decoded
dimensions; the byte cap does not bound pixels. This is a content-validity gap,
not evidence that an attacker can execute script in the site.

Remaining work: decode and preferably re-encode accepted images using a
Worker-compatible service or implementation with dimension, pixel and animation
limits. Reject invalid images and strip unnecessary metadata. Keep those checks
in the shared pipeline, and test real valid fixtures alongside malformed,
truncated and oversized-dimension examples.

### 4. Lower priority: body consumption is bounded by bytes but not time

`readBoundedBody` and `discardBody` await stream reads without a deadline. The
upload endpoint awaits draining even after authentication fails, up to another
16 MiB. A slow or stalled sender can delay the rejection. No live flood or
slow-client test was performed; platform connection limits may reduce impact.

Remaining work: add read/drain deadlines and cancellation, preserving readable
errors for ordinary uploads. The per-IP edge limiter helps but does not bound
concurrent uploads or impose a storage quota.

## What is solid on develop

- Actual bytes are counted while streaming, including requests without a
  Content-Length header; oversized bodies are refused before storage.
- A shared purpose policy caps covers at 5 MiB and allows only JPEG, PNG, WebP
  and AVIF. Unknown purposes and SVG are rejected.
- Author authorization and exact request-Origin checks precede validation and
  storage. The author guard checks the numeric GitHub allowlist and session age.
- The server generates UUID keys under a policy prefix and chooses extensions
  and stored Content-Type from the allowed format.
- The browser uses the same limits, but the server makes the enforcement decision.
- The Worker applies an edge rate limit before database authorization work.
- Both environment configurations disable workers.dev and preview URLs.

These are reusable controls for public, author-only image uploads. They are not
yet a generic file or private-document pipeline: each future feature needs an
explicit authorization rule, content validator and visibility policy. The
current handler always requires the author and returns a public media URL.

Verification: six targeted Vitest files passed, 68 tests total, covering the
upload endpoint, request bodies, policies, signatures, storage configuration
and edge rate limiting. This review did not exercise authenticated uploads or
write to R2.

## Checks still unavailable or required before release

Live Access policy metadata, R2 credential scopes, bucket/public-domain settings,
CORS, media-host response headers, and dev/production bucket isolation were not
verified. A passing application test does not establish these properties.

Verify bucket-scoped credentials or use environment-specific R2 bindings; a
direct credentialed storage writer can bypass the application's upload cap.
Confirm media responses have the intended Content-Type and nosniff protection
on the media host itself. The application's headers do not cover a separate
R2 custom domain. Public cover URLs also make uploaded draft covers public to
anyone who knows their URL; keep future private uploads in private storage.

Add a deployment smoke check for signed-out dev Access denial and a release check
that production uses the new upload contract. The existing deployment-target
guard validates names, routes and KV/D1 targets but does not assert workers.dev,
preview URL settings or Access enforcement.

## References

- [Cloudflare self-hosted Access setup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [R2 presigned URLs and reuse](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
