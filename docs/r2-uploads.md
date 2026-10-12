# R2 uploads on the free allowance

Configured on 2026-10-12. The existing account uses Workers Free and Teams Free;
the owner activated R2 during setup. No Workers upgrade or Images service was added.

| Environment | Worker binding | Standard bucket  | Media origin                |
| ----------- | -------------- | ---------------- | --------------------------- |
| Production  | MEDIA_BUCKET   | indrax-media     | https://media.indrax.uk     |
| Dev         | MEDIA_BUCKET   | indrax-dev-media | https://dev-media.indrax.uk |

Both buckets were verified empty, in APAC, with Standard as their default storage
class. Each custom domain requires TLS 1.2 or newer. Their alternate `r2.dev`
URLs are disabled. No S3 credentials or browser upload CORS rules are needed:
the author uploads to the site's Worker, which writes through its bucket binding.
Browser builds default to the matching media origin even when CI's public media
variable is empty. A custom origin override must also match the Wrangler variable.
The local loopback media override is ignored by production builds, so it cannot
replace the deployed media origin. Production validators/renderers reject local
cover URLs.

Production covers are public. Dev's site and media hostname both require
Cloudflare Access using the existing Cloudflare identity provider, an author-only
Allow policy and a 24-hour session. Access cookies are hostname-specific: open
[dev media](https://dev-media.indrax.uk) and sign in once if cover images cannot
load after signing in to the dev site. App GitHub authentication is still required
for uploads. These buckets are for covers, not private documents.

## Lightweight enforcement

`/api/upload?purpose=cover` requires the author, the request's exact Origin, a
known purpose, an allowed image Content-Type and a matching file signature.
The body is capped while streaming at 5 MiB; client-reported size is not trusted.
The Worker has 90 seconds to read an upload and at most 2 seconds to drain a
refused body. Other bounded JSON reads use a 10-second deadline. Each body has
one timer and one promise race, not an extra timer or race per chunk.

Writes use `MEDIA_BUCKET.put`, explicitly select Standard storage and refuse to
overwrite an existing key. The server generates the key and sets the stored
Content-Type, Content-Disposition and immutable Cache-Control. There is no
application-side S3 signing or full-file hashing. The existing edge rate limiter
runs before database authorization. Local development uses local R2 simulations;
no binding has `remote: true`.

With `npm run dev`, set `NEXT_PUBLIC_MEDIA_ORIGIN=http://localhost:5173/local-media`
in `.env.local`, matching the exact host and port opened in the browser. Empty,
relative, or mismatched settings keep local uploads disabled. Loopback requests
use absolute URLs under the configured `/local-media/covers/` base. The development-only route
streams generated cover keys from simulated R2, allows GET/HEAD only and sends
nosniff and sandbox headers. Production builds return 404 for this route. Local
cover URLs pass the editor's validation and renderer; arbitrary relative paths
are rejected. Restart the dev server after changing the upload configuration.
The built `npm run start` preview retains the deployment's media configuration;
use `npm run dev` to test isolated local uploads.

R2 custom-domain reads go straight through Cloudflare rather than this Worker.
One free Response Header Transform Rule, saved in
`config/cloudflare-media-headers.json`, adds nosniff, a sandboxed content policy,
no-referrer and frame denial on both media hosts. It does not use regex or run
Worker code. It was applied to the zone after verifying that no response-header
phase ruleset already existed. Do not recreate/replace that ruleset blindly on a
later update; preserve any rules added since setup.

Image decoding, re-encoding, dimension validation and metadata removal were
explicitly deferred. A valid signature does not prove that the whole image is
valid. Future upload purposes can reuse byte limits, origin/auth guards and key
generation, but need their own content and visibility rules.

## Free-plan limits

Documentation checked on 2026-10-12:

- Workers Free: 100,000 requests/day, 10 ms CPU/request and 128 MiB memory per
  isolate. Waiting on network/storage is wall time, not CPU time. Application
  authentication, buffering and SSR still use CPU; free-plan support alone does
  not prove a workload stays under 10 ms. Check invocation CPU measurements,
  especially authenticated uploads and rendering cold starts.
- R2 Standard: 10 GB-month of storage, one million Class A operations/month and
  ten million Class B operations/month, with free egress. Usage is shared across
  the account, including both buckets. Each successful upload is a Class A write.
  The free allowance is not a hard spending cap; excess R2 usage is billed.
  Infrequent Access does not qualify for the free allowance.
- Workers KV, D1 and Workers Logs have free allocations. Existing bindings were
  retained; no paid-only API was introduced. Rate-limiting bindings are supported
  by the current Wrangler/runtime and do not require a WAF rate-limiting purchase.
- The zone is Free Website; Transform Rules allow ten active rules on this plan.
  The media headers use one. Teams Free provides Access for up to 50 users.

See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[rate-limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/),
[Transform Rules availability](https://developers.cloudflare.com/rules/transform/),
and [Zero Trust plans](https://www.cloudflare.com/plans/zero-trust-services/).

## Release and verification

The buckets, domains, Access policies and media headers are live. Worker bindings
and upload code take effect when this source is deployed. Production receives
them through the planned develop-to-main release. No production release was
performed as part of setup.

The deployment guard checks bucket/environment isolation and disabled alternate
Worker URLs. CI now runs `npm run security:smoke -- dev` or `production` after
deployment. The smoke checks are signed-out reads and an empty refused production
upload; they never create an object and do not exercise author login.

Live signed-out dev site/API/static/media checks passed. Production media's
missing-object response was verified with nosniff and the sandboxed policy.
Both `r2.dev` URLs were verified disabled. An authenticated browser should verify
the final login and cover-upload flow after deployment.

Formatting, lint, generated types, TypeScript and all 515 unit tests passed.
Production and dev builds, deployment-target guards and Wrangler deployment dry
runs passed with their respective bucket bindings. No Worker was deployed.

Local development verification also passed against the actual Vite/Workers
runtime: a temporary PNG in simulated R2 was served through GET and HEAD with
the expected bytes and safety headers, while DELETE was refused. The temporary
object was removed afterward. Upload-to-read tests exercise the local URL flow,
editor validation, and rejection of non-loopback/production requests, unsafe
paths and inconsistent stored types.

The four authenticated local-upload Playwright tests passed using `localhost`:
the file picker enabled, previews and removal caused no writes until Save,
the PNG upload returned an absolute configured URL,
the draft saved, signed-preview data retained the cover URL, and a browser
decoded the stored image. Mobile previews preserve the natural aspect ratio;
removing a saved cover changes the post only after Save and retains the object.
Upload and post-save failures preserve retry state without repeating a successful
upload. Unauthorized, cross-origin, malformed and oversized
uploads returned 401/403/415/413. Fixture removal was verified with a subsequent 404. All seven production security browser tests passed, including the local
media route's 404 and CSP enforcement. These checks did not exercise the public
preview page's full hydration; they checked its API data and the image directly.

The user's actual `localhost:5173` server initially retained its old configuration.
It was restarted to load the explicit media origin. A temporary local author
session then confirmed `coverUploadsConfigured: true`; that identity was revoked.
