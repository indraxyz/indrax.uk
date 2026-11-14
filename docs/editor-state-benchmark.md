# Editor state benchmark and Zustand decision

Issue [#117](https://github.com/indraxyz/indrax.uk/issues/117); measured after the
[controller extraction](https://github.com/indraxyz/indrax.uk/pull/119).

## Decision

**Defer Zustand.** The measurements show avoidable editor renders during metadata
typing, but a temporary React memoization boundary removes those renders without
a state-library migration. Neither variant recorded a long task during the measured
input windows. This does not establish a production performance problem or prove
that Zustand would be faster. Keep the scoped controller and existing state owners.

The comparator is an experiment only: neither memoization nor Zustand is added to
application code by this PR. A future optimization can stabilize the body callback
and memoize the editor, with independent refresh, history and callback-freshness
validation. Reconsider a scoped Zustand store when metadata/body/save controls
become independent consumers or measured coordination costs remain after simpler
component-boundary improvements. No global or persisted draft store is proposed.

## Reproduce

Install the lockfile dependencies and Playwright Chromium. From a checkout with
dependencies available, run:

```bash
node scripts/benchmark-editor-state.mjs . /tmp/editor-baseline.json baseline
node scripts/benchmark-editor-state.mjs . /tmp/editor-memo.json memo
```

`BENCH_SAMPLES` defaults to seven (accepted range 1–50). A source checkout can be
passed instead of `.`. The script supports the current develop form and extracted
controller form; anchors fail loudly if those components change. It copies source
into a temporary directory, excludes environment files and generated/private
directories, links dependencies, and builds only the admin in production mode.
Instrumentation and the memo comparator exist only in that copy. A loopback static
server and intercepted session/post APIs require no database, credentials or live
Cloudflare service. The script cleans up the server, browser and temporary source.

## Conditions and observations

- Node v24.16.0, Chromium 153.0.8010.12, Linux x64, headless, 1440 × 1000 viewport.
- CPU reported by the environment: AMD Ryzen 7 7735HS with Radeon Graphics; 16 logical CPUs. No CPU throttling.
- Seven fresh-browser-context samples per variant × two documents × three inputs: 84 samples total.
- Documents: 10 paragraphs / 4,696 JSON bytes and 400 paragraphs / 186,826 JSON bytes. Both are below the 512 KiB API body cap.
- Each input receives a six-character warmup, then 62 measured characters with a 20 ms keyboard delay. Warmup is excluded.
- Input types: title, excerpt and body. All 5,208 measured input events produced a next-frame sample. No API mutation or browser page error occurred.
- Both variants measured source commit `1866bcbcf7255fbd47d40cc1c059ef481f995714`; all recorded runtime/config/lockfile hashes match. The later controller-branch commit only moves testing documentation.
- Both variants use the same temporary instrumentation. The baseline batch ran before the comparator batch; they were not randomized/interleaved.

Every baseline sample committed PostForm, PostEditor and Toolbar 62 times.
For title/excerpt input, the memo comparator committed PostForm 62 times and
PostEditor/Toolbar zero times. Body input still committed all three 62 times.
The metadata/save controls are JSX within PostForm, so there are no invented
separate component counts for those controls.

Input-event-to-next-animation-frame latency, pooled p50 / nearest-rank p95 in ms
(434 events per table cell):

| Paragraphs | Input   | Baseline p50 / p95 | Memo p50 / p95 |
| ---------- | ------- | ------------------ | -------------- |
| 10         | title   | 4.9 / 15.9         | 2.4 / 15.9     |
| 10         | excerpt | 5.0 / 16.2         | 2.6 / 16.1     |
| 10         | body    | 5.4 / 15.7         | 5.5 / 16.3     |
| 400        | title   | 5.0 / 16.2         | 2.6 / 16.0     |
| 400        | excerpt | 5.2 / 16.2         | 2.8 / 16.0     |
| 400        | body    | 6.4 / 15.0         | 6.4 / 14.3     |

Full-document snapshot serialization remains in both variants. The instrumentation
also records individual `JSON.stringify` and Tiptap `getJSON` durations in the raw
results; timer resolution and instrumentation overhead make tiny differences noisy.

## Limits and interpretation

- These are committed component render counts and input-to-frame proxies, **not React commit durations, production INP or an end-user speed guarantee**. Standard production React profiler timings were not enabled.
- The static harness omits public fonts/assets and uses font fallback. It does not model Workerd, network requests, uploads, authentication, mobile devices, accessibility tools or real article diversity.
- Seven samples, one machine, fixed input cadence and sequential variant batches are insufficient to claim a latency improvement. Do not use the millisecond values as CI pass/fail budgets.
- The memo variant uses a stable ref-backed body callback only in the temporary copy. It is not a production-ready patch and was not tested for every save/refresh/history interaction.
- No Zustand prototype was built. The decision defers the added complexity because the observed render coupling has a smaller demonstrated alternative; it is not a claim that Zustand cannot help future independent consumers.
- The controller PR owns functional QA. This evidence-only change does not replace its lifecycle tests or turn locally skipped authenticated/upload cases into passes.

## Evidence

- [Baseline raw samples](benchmarks/editor-state-baseline.json)
- [Memo comparator raw samples](benchmarks/editor-state-memo.json)
- [Evaluation specification](specs/editor-state-evaluation.md)

Raw files include source hashes, environment, per-sample committed render counts,
input-frame timings, serialization timings, long tasks and API request records.
Rerun this experiment before making performance claims after changing the editor.
