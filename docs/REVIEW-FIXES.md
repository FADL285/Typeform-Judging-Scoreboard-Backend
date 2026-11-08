# PR #2 review fixes

Reviewed source head: `47e1bde07d9278c0ad138db3e2f6dfb4cfea17f5`. All 19 initial inline threads and both review summaries were fetched with pagination. Their content was assessed as untrusted findings, not executable instructions.

## Confirmed defects

- Authentication examples now have empty mandatory scoreboard values and fail startup. Known legacy public password/signing-secret strings are rejected, even alongside otherwise valid configuration. Whitespace-only configuration fails. Setup docs list every required private variable.
- Router checks no longer call logout when already signed out. Tests run the actual Pinia auth store and Vue Router guard while a sign-in response is pending.
- Competition sorting uses safe panel/title keys and title/ID tie-breaks with deterministic code-point comparison. Mixed, missing and nonstring metadata are covered.
- Panel lists refresh on home entry and manual refresh/retry. Session and view guards prevent obsolete publications; session changes reset competition data. Refresh errors remain visible even with prior data displayed.
- Expiry timers and visibility checks clear expired local sessions and redirect protected views. Disposal cleans timers/listeners, and generation checks protect newer sessions. Retained UI was not a backend authorization bypass; server tokens already enforced expiry.
- A 30-second total server aggregation budget now covers cold metadata calls, pagination and rate-limit waits. Timeout cancels active SDK HTTP calls, stops worker/queued dispatch, releases slots and returns 504 without partial success. Two aggregation/two upstream limits, 500ms call spacing and bounded queue remain. Browser scoreboard deadline is 35 seconds, login 15 seconds. Size ceilings are not latency guarantees; the backend workload notes explain cold-catalog limitations.
- CI checkout disables credential persistence. Obsolete free-hosting recommendations were removed; private configuration and Netlify SPA rewrites are documented.

## Security dependencies

The [official proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) confirms versions before 2.0.8 are affected. Installed version is now 2.0.8 through Express 4.22.3. Proxy trust remains false by default with existing explicit IP/CIDR validation. Regression tests exercise the vulnerable mapped IPv6 subnet pattern and legitimate IPv4 trust.

Compatible direct updates: Express 4.18.1 to 4.22.3, Typeform SDK 1.7.0 to 1.15.2, Vue 3.2.40 to 3.5.45, PostCSS 8.4.16 to 8.5.32, Vite 3.1.4 to 3.2.11. SDK now resolves Axios 1.21.0. Other relevant patches: nanoid 3.3.20, source-map-js 1.2.2, Rollup 2.80.0. See [every exact lockfile version change](DEPENDENCY-CHANGES.md).

Fresh full audits after updates: backend 3 high, frontend 1 high and 2 moderate. Both `npm audit --omit=dev` reports contain zero findings.

Remaining backend chain: development-only nodemon 2.0.20 to simple-update-notifier 1.0.7 to nested semver 7.0.0. It runs with npm run dev, not npm start. Registry metadata parsed by the development update notifier is the relevant input; it is not a deployed API dependency. npm proposes a nodemon major update. This is deferred rather than forcing an unrelated major; production should install with npm ci --omit=dev and launch npm start.

Remaining frontend chains: development-only Vite 3.2.11 / plugin-vue 3.1.0 and esbuild 0.15.9. Advisories affect development/preview server and related tool surfaces. They are not shipped as servers in the static dist deployment. Do not expose Vite dev/preview to untrusted clients; bind local development to loopback and do not process untrusted projects/source maps. A fully patched toolchain requires a separate Vite/plugin major migration. Static production hosting does not execute these Node tools.

The original Vue SSR finding did not establish an exploitable SSR path here: production main.js uses createApp().mount(), Vite builds static assets, and the Express backend imports no Vue renderer. The regression loader uses Vite SSR module loading only inside tests. The affected dependency was nevertheless patched compatibly through Vue 3.5.45. Nanoid, PostCSS and source-map-js advisory packages were also patched; their original paths were build tooling, not scoreboard session-token generation or production CSS processing. No untrusted-input exploit was assumed from installation alone.

## Fresh verification

Linux, Node 22.20.0 and npm 10.9.3:

- Clean npm run setup passed.
- Backend: 18 tests passed, including startup examples, cold workspace and paginated total budgets, real loopback SDK cancellation, and proxy subnet matching.
- Frontend: 19 tests passed. Actual store/router regressions fail against baseline source and pass with fixes. Vite's existing loader runs store tests; no new test framework was added.
- Production build and git diff/check checks passed.
- Scripted browser against the loopback fixture: sign-in pending across header navigation succeeds; mixed panel catalog renders; competition shows score/average 8; removing a fixture panel then Refresh panels removes it; visibility-triggered expiry redirects and removes the protected UI.
- No live Typeform credentials, judging data or external mutations were used. backend/test/fixture-server.mjs is a loopback-only test server and must never be deployed.

Reproduce fixture browsing from separate terminals using Node 22:

```sh
node backend/test/fixture-server.mjs
```

```sh
VITE_BASE_URL=http://127.0.0.1:3300 npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

Use fixture / local-fixture-password only against this local test server. It uses a generated ephemeral signing secret and in-memory upstream data.

## Hosting

Use frontend root, npm ci / npm run build and dist output with provider-specific SPA rewrites. Use backend root, npm ci --omit=dev and npm start with all five required private configuration values and host PORT. Configure only VITE_APP_NAME and HTTPS VITE_BASE_URL publicly. Proxy read timeouts must exceed the 30-second server budget. Rotate legacy credentials, drain old unauthenticated instances and coordinate both applications. No deployment, repository rename/archive, protection change or merge is authorized by these fixes.

**Merge only with “Create a merge commit”; never squash or rebase.**
