# Cloudflare Access for dev.indrax.uk

`dev.indrax.uk` is a full copy of the site, admin included. It does not need to be
public, so Cloudflare Access sits in front of the whole hostname: every request
must carry an Access session for the author before it reaches the Worker. Scanners
get Cloudflare's login page, not the app, its API or its robots.txt.

Production stays public. Its controls are in the Worker: authentication, CSP and
rate limits.

## Current setup

Access was configured and verified on 2026-10-12 using the existing Teams Free
organisation. `dev.indrax.uk` and `dev-media.indrax.uk` have author-only Allow
policies, a 24-hour session and the existing Cloudflare identity provider. No
Bypass or Service Auth policy was added. Signed-out pages, APIs and media now
receive Access login redirects. Run `npm run security:smoke -- dev` to check them.

Dev media has its own hostname cookie. Sign in at `dev-media.indrax.uk` once if
images cannot load after signing in to the site. See [R2 uploads](r2-uploads.md).
The setup below is reference guidance for rebuilding or changing the application;
the current applications already exist.

## Why the Worker has no other address

Access protects a hostname. A `*.workers.dev` or preview URL for the same Worker
would serve the app without passing through Access. `wrangler.jsonc` therefore sets
`"workers_dev": false` and `"preview_urls": false` for both environments, so the
custom domain is the only way in. Keep them off. A deploy re-applies them, which
also removes any `workers.dev` route enabled earlier in the dashboard.

## One-time setup (dashboard)

This needs a Zero Trust organisation on the account. The free plan covers it.
The wrangler OAuth login has no Access scope, so do this in the dashboard, or use
an API token with **Access: Apps and Policies → Edit**.

1. **Zero Trust → Settings → Authentication → Login methods:** keep
   **One-time PIN**, or add **GitHub** to reuse the account that already signs in
   to the admin.
2. **Zero Trust → Access → Applications → Add an application → Self-hosted**:
   - Application name: `indrax dev`
   - Domain: `dev.indrax.uk`, path empty, so the whole host is covered
   - Session duration: `24 hours`
   - Identity providers: the login method from step 1. Enable **Instant Auth**
     when there is only one.
3. **Add a policy**:
   - Name: `Author only`
   - Action: **Allow**
   - Include → **Emails**: the author's email address
   - No Bypass or Service Auth rules. Nothing automated calls dev: CI deploys
     through the Cloudflare API, not the hostname.
4. Save.

## Verify

```bash
# Signed out: Access answers, not the Worker.
curl -sI https://dev.indrax.uk/ | grep -i -E '^HTTP|^location'
# HTTP/2 302
# location: https://<team>.cloudflareaccess.com/cdn-cgi/access/login/dev.indrax.uk?...

curl -sI https://dev.indrax.uk/api/admin/session | grep -i '^HTTP'
# HTTP/2 302, never 200
```

In a browser, sign in through Access and confirm that the site, the admin GitHub
sign-in and a cover upload still work. GitHub's OAuth callback returns to
`dev.indrax.uk` in the same browser, which already holds the Access cookie, so the
admin flow is unchanged.

## What Access does not replace

The admin still requires the allow-listed GitHub account, CSRF and origin checks
still apply, and the rate limits still run. Access is an outer layer for dev, not
a substitute for the Worker's own checks.
