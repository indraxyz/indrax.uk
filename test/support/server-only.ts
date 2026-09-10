/**
 * A stand-in for the `server-only` package, used by the unit tests.
 *
 * `server-only` throws on import outside a React Server Component, which is
 * exactly what makes it useful in the application: it turns "this module leaked
 * into a client bundle" from a subtle bug into a build error.
 *
 * A Node test runner is neither a client bundle nor a server component, so the
 * guard fires there too and nothing importing it can be unit tested. Aliasing it
 * to this empty module in `vitest.config.mts` removes the guard for tests only -
 * the real package is still what the application resolves, so the protection it
 * exists for is untouched.
 */
export {}
