# Unified writing discovery change plan

## Scope and decisions

Use one `/writing` discovery surface. Remove old writing search/tag page routes
and their redirect modules; retain existing public APIs for compatibility.
Keep old `/blog/search` and `/blog/tag/:tag` links as direct permanent redirects
to query-based archive URLs. Do not change
article/series reading, admin authoring permissions or publication visibility.
Extend the same controls to `/admin/posts` with private backend pagination and
an additional status filter.

URL state uses `q`, repeated `tag`, `sort`, `date`, `from`, `to`, `duration` and
`page`. Tags match OR; the other filter dimensions match AND. The right-hand
sheet holds draft controls until Apply. Closing discards drafts; applying or
submitting search resets pagination. Keep selected options through browser
history, refresh and copied URLs. Tag counts represent published articles.
Both search inputs include an accessible clear button. Clearing an applied query
preserves the selected filters and sort, resets pagination, and keeps input focus;
when no query is applied, clearing unsubmitted text only changes the input.

Implement seven sorts: newest, oldest, views, updated, relevance and title in
both directions. Relevance requires a query. Date ranges cover any time, past
7/30 days, this year and custom inclusive UTC calendar days. Duration has any,
short (under 5 minutes), medium (5–10 inclusive) and long (over 10) options. Validate and bound these values on the server,
filter before counting, and use stable unique ordering after the selected sort.
Use native select controls and existing shared Sheet/Badge styles, Ky, TanStack Query and progress
feedback. No standalone tags/search page or external archive tag strip remains.

## Admin parity

The admin URL adds `status=any|draft|published|archived`; its default sort is
`updated`. The authenticated backend applies the entire query/filter/sort set
before pagination and returns private counts. Tag counts cover all statuses.
Drafts with null publication dates are excluded by publication-date filters;
Newest/Oldest place null dates last. Most Relevant is disabled without a query,
with its hint inline inside the select. Reuse the schema; no migrations are
needed. Author permission checks and `no-store` apply to all private discovery
reads and counts.

## Implementation order

1. Investigate current published queries, route/API contracts, caching and UI.
2. Extend shared normalized options and published-only SQL, counts, sorting and
   private admin discovery; keep admin mutations compatible and use the existing
   schema without migrations.
3. Add typed public/admin transport/query keys and the shared search/filter sheet interface.
4. Move public route modules/tests into `app/routes/`, remove standalone writing
   search/tag routes, point legacy blog redirects directly to the archive and
   remove retired sitemap entries.
5. Sync requirements, technical docs, stack information and local examples.
6. Run targeted tests, type/lint/build checks and browser verification. The
   initial workflow paused delivery for user review; the user subsequently
   authorized commit, push and a pull request after the remaining checks pass.
   Merge and deployment remain outside that authorization.

## Validation

- Unit/API coverage: malformed options, query length, repeated tags, publication
  isolation, date boundaries, duration boundaries, sort ties and filter keys.
- Database integration: OR tags plus AND dimensions, correct count/page result,
  stable ordering, admin status/full-set pagination, private tag counts, null
  publication dates and legacy endpoint compatibility.
- Route/resource coverage: retired writing pages have no redirect and return 404
  with existing fixtures; legacy blog 308 redirects retain query/sort/filter/page
  state and target the archive directly. Sitemap excludes retired discovery
  pages and arbitrary filter combinations.
- Browser coverage: Apply versus cancel, search preserving filters, dot state,
  reset, empty results, pagination, refresh/back/forward, keyboard focus,
  desktop/mobile layouts and light/dark presentation.
- Release gates: formatting, lint, generated types/TypeScript, relevant unit and
  integration suites, production build and Playwright. Commit, push and open a
  pull request after passing checks; leave merge and deployment for approval.
