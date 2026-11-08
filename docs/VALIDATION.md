> Historical validation of prepared head `47e1bde`. Current review fixes and audit disposition are in [REVIEW-FIXES.md](REVIEW-FIXES.md). Original notes below are retained.

# Consolidation validation — 8 November 2026

## Status

BLOCKED pending final-head CI/review and resolution or explicit risk disposition of inherited dependency advisories. This change does not deploy either application.

## Sources and history

Backend main: `8459f1b2cca3d854675d9f9a659be39a5f7b25bc` (29 commits).
Frontend main: `27634e6d82ffec9b2c37e5f30df341922e07e17b` (33 commits).
Both were fetched over SSH and match the supplied baselines. No newer source commits were omitted.
Prepared bundle head: `47e1bde07d9278c0ad138db3e2f6dfb4cfea17f5` (66 reachable commits).
Bundle SHA-256: `15b107391b3e54cf5f1ff900724e8a8ea45318963a7b108ed37d07dbee487cf9`.

The complete bundle passed native `git bundle verify` before operational import and `git fsck --full --strict` after import. Both original heads are ancestors. Each original commit was read using `git cat-file commit` and rehashed with `git hash-object -t commit --stdin`; all 62 IDs match. Identical commit objects retain authors, timestamps, messages, trees, and parent relationships.

Reproduce from repository root:

```sh
git fsck --full --strict
git merge-base --is-ancestor 8459f1b2cca3d854675d9f9a659be39a5f7b25bc HEAD
git merge-base --is-ancestor 27634e6d82ffec9b2c37e5f30df341922e07e17b HEAD
git rev-list --count 8459f1b2cca3d854675d9f9a659be39a5f7b25bc
git rev-list --count 27634e6d82ffec9b2c37e5f30df341922e07e17b
git rev-list --count HEAD
git diff origin/main:README.md HEAD:backend/README.md
git diff frontend-source/main:README.md HEAD:frontend/README.md
git diff frontend-source/main:package-lock.json HEAD:frontend/package-lock.json
```

Tree comparison confirms application code and backend lockfile are identical to their sources. Both application READMEs have relocation-related edits. Frontend lockfile version remains 2; 22 optional platform package entries were added without changing existing package entries. Root scripts, CI, documentation, and ignore rules support the separate application directories.

## Fresh local checks

Linux, Node 22.20.0, npm 10.9.3; hosted CI specifies Node 22.

| Check | Result | Limitations |
| --- | --- | --- |
| `npm run setup` | PASS: clean npm ci for both applications | Audit advisories below |
| `npm test` | PASS: 13 backend, 15 frontend tests | Fixture-based; no live workspace |
| `npm run build` | PASS: Vite 3.1.4 production build | Outdated Browserslist database warning |
| `git diff --check` | PASS | Repeated after documentation edit |
| Actual backend `npm start`, port 3300 | PASS: welcome 200, API without token 401, invalid login 401, valid local-test login 200 | Explicit placeholder Typeform configuration; no authenticated data call |
| Actual frontend development server, port 5173 | PASS | Local development HTTP mode |
| Playwright browser | PASS: signed-out redirect, title, rendered sign-in form, invalid login error from actual backend | Scripted browser, not human acceptance; no live-data dashboard |
| Fixture HTTP integration | PASS: real auth, frontend API client, backend handlers, category list, rating 8, missing form 404 | Temporary Express harness and in-memory upstream, not production route mounting |
| Live Typeform integration | NOT RUN | No production credentials supplied or external resources accessed |

Root scripts use npm --prefix so each application starts with its own working directory. Vite aliases remain relative to frontend configuration. Environment examples and SPA rewrite reside in their application directories. Production builds require an HTTPS backend URL; local HTTP integration uses Vite development mode.

## Inherited dependency risks

Fresh npm audit reports backend: 18 (3 low, 2 moderate, 12 high, 1 critical); frontend: 23 (6 moderate, 17 high). These are inherited locked dependencies, not introduced upgrades. No audit fix or dependency upgrade was run.

The critical advisory is [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h): proxy-addr before 2.0.8 can mishandle IPv4-mapped IPv6 trust subnets. Backend proxy trust defaults to false, reducing default exposure; configured proxy deployments still need assessment and remediation. Do not treat successful tests as a clean security audit.

## Hosting and transition after merge

Frontend: root frontend, install npm ci, build npm run build, output dist, retain vercel.json SPA rewrite. Configure VITE_APP_NAME and HTTPS VITE_BASE_URL only.
Backend: root backend, install npm ci, start npm start, Node 22, host-provided PORT. Configure TYPEFORM_PERSONAL_TOKEN, TYPEFORM_WORKSPACE_ID, SCOREBOARD_USER, SCOREBOARD_PASSWORD, SCOREBOARD_SESSION_SECRET privately. Configure SCOREBOARD_TRUST_PROXY only for verified proxy topology. Do not expose secrets in VITE_* variables.

Remove legacy VITE_AUTH_* settings and rotate previously exposed secrets. Coordinate frontend/backend transition and drain unauthenticated legacy instances; do not mix old and new public APIs. Hosting configuration and deployment remain untouched.

Continue using the existing backend repository (created 14 October 2022). Renaming, archival of the frontend repository with a link, and profile updates are later transition steps, not performed here. Preserve historical PR discussions in their original repositories.

**Merge with “Create a merge commit”; never squash or rebase.**
