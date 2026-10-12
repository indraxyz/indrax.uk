# Cloudflare upload security plan

## Branch and scope

Work is on `fix/cloudflare-upload-security`, created from `develop`. The user
confirmed there is no ticket number. Work initially stayed local for review;
the user then authorized committing, pushing and opening a PR to `develop`
without a co-author attribution. Merging and Worker deployment are outside
that request. Earlier authorized R2/Access infrastructure setup is recorded
separately in [R2 setup](r2-uploads.md).

Protect the dev site and its media with Access, preserve public production
access, and reuse the existing upload-purpose policy, authentication, origin
checks and bounded body reader. Use native R2 bindings, Standard storage and
free-plan features. Do not decode/re-encode images or add a new image service.
Production receives code through the planned develop-to-main release.

## Implementation and acceptance

1. Review prior upload protection and deployment differences; record supported
   controls and remaining limitations in the dated security review.
2. Replace application-side S3 credentials/signing with environment-specific
   R2 bindings; preserve byte/type/purpose checks, generated keys and author
   permissions; condition writes to prevent accidental replacement.
3. Add absolute body-read/drain deadlines and exact media-origin checks.
4. Guard generated deployment configuration against bucket, hostname and
   alternate-URL drift; add signed-out post-deployment security smoke checks.
5. Require an explicit absolute loopback media origin for local development:
   `http://localhost:5173/local-media`. Empty, relative or host/port mismatches
   keep uploads disabled. Enable isolated local upload/read behavior without
   live bucket access. Use the existing Worker dispatcher, policy, renderer and editor
   validators; reject arbitrary paths and keep local serving out of production.
6. Verify unit/API contracts and real browser behavior: enabled admin controls,
   stored cover display, signed-preview data, editor validation, rejected malformed/oversized
   bodies, same-origin protections and production exclusion.
7. Sanity-check code reuse, documentation, dependencies and generated output;
   run repository checks and appropriate builds. Record verification results
   and any checks that remain dependent on an approved deployment.

## Review boundaries

The free Workers CPU budget needs invocation measurements after deployment;
builds/unit tests cannot establish real CPU time. R2 free allocations are shared
account-wide and do not impose a hard billing cap. Full image validity, dimensions
and metadata stripping remain deferred. Author login and final production upload
behavior require post-release verification. Never use remote databases or live
R2 objects as browser test fixtures; clean up only fixtures created by the tests.

## Verification completed

- Repository formatting, lint, generated types, TypeScript and 510 unit tests pass.
- Four local-upload browser tests pass on localhost, covering configured controls,
  file-picker upload, draft persistence, signed-preview API data, actual image
  decoding, refusal paths and fixture cleanup. Public preview hydration is not
  claimed by these checks.
- Eleven production session checks pass, including navigation request reuse,
  stale refresh, lost cookies, allow-list/expiry checks and sign-out.
- Seven production browser security checks pass, including CSP enforcement and
  refusing the development-only local media route.
- Production and dev deployment-target guards pass with their own R2 bindings;
  local builds are checked without a Worker deployment.
- Read-only review corrections include production ignoring loopback media settings,
  rejecting local covers outside development, strict local HTTP/HTTPS URL paths,
  temporary test storage/cache and independent browser artifact directories.
- The actual localhost dashboard's authenticated configuration response was
  verified enabled after restarting its stale dev process.

The user subsequently authorized committing, pushing and opening a PR to
`develop`, without a co-author attribution. Review remains through the PR;
merging and releasing a Worker are outside that request. Live infrastructure
created under the earlier setup authorization is documented in the R2 setup notes.

## Admin UX and request efficiency follow-up

- The new/edit form shows covers below the legend at full container width and
  natural height, with an accessible top-right remove button.
- Selection and removal stay local until Save. Upload runs before the post save,
  and failure retries retain a local file or reuse a successful uploaded URL.
- Shared session query options reuse fresh sessions for 60 seconds, with stale
  navigation/focus/reconnect checks and unchanged server authorization.
- Unit and browser checks cover session deduplication, stale/invalidated refresh,
  navigation request counts, cookie loss, sign-out and authorization boundaries.
