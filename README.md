# Typeform Judging Scoreboard

A Vue scoreboard and Express API for competition judging through Typeform. Judges submit team ratings in Typeform; the dashboard presents competition categories, team totals, and rankings.

Originally built in 2022 and used for IEEE Mansoura Branch's IEEE VICTORIS and university NASA Space Apps events. Subsequent maintenance adds server-side authentication, bounded upstream requests, and regression coverage while preserving the original sum-based scoring rules.

![Scoreboard demonstration](https://user-images.githubusercontent.com/53804570/196001680-ce93ed21-9302-483f-a6f6-9b5ea1ea444f.gif)

## Structure

| Directory | Responsibility |
| --- | --- |
| [`frontend/`](frontend/) | Vue 3, Pinia, Vue Router, Tailwind CSS, Vite |
| [`backend/`](backend/) | Node.js, Express, Typeform API integration and signed sessions |

The applications keep separate dependencies and lockfiles. There is no root dependency installation and no workspace migration.

## Run locally

Use Node.js 22 and npm. From the repository root:

```sh
npm run setup
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Configure `backend/.env` with a Typeform token and workspace ID, a scoreboard username, a private password of at least 12 characters, and a random signing secret of at least 32 characters. These values stay on the server. The default backend port is `3000`.

Configure `frontend/.env`:

```dotenv
VITE_APP_NAME="Judging Scoreboard"
VITE_BASE_URL="http://localhost:3000"
```

Start each application in a separate terminal:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

Open the URL printed by Vite and sign in with the backend scoreboard credentials. Real scoreboard data requires a configured Typeform workspace; the automated tests use fixtures and do not require credentials.

## Verify

```sh
npm test
npm run build
```

The root commands run both applications' existing regression suites and build the frontend. CI repeats these checks on pushes and pull requests.

## Scoring and authentication

- Teams rank by descending **sum** of criterion ratings across submitted judging responses.
- Cards separately display the average per judging response. Tied sums preserve input order.
- Missing or invalid criterion ratings produce an incomplete-data error; they are not silently scored as zero.
- The backend signs eight-hour bearer sessions. Typeform credentials, passwords, and signing secrets must never be placed in `VITE_*` variables.

Read the [frontend notes](frontend/README.md#authentication-and-score-ordering) and [backend API and security notes](backend/README.md#server-side-scoreboard-authentication) for details and workload limits.

## Deployment after consolidation

The layout change requires hosting configuration updates before deploying:

- **Frontend:** use `frontend` as the hosting project's root directory, `npm ci` as the install command, `npm run build` as the build command, and `dist` as the output directory. The SPA rewrite lives in `frontend/vercel.json`.
- **Backend:** use `backend` as the service root, `npm ci` as the build/install command, and `npm start` as the start command. Configure all private environment values on that service. `PORT` is supplied by the host where applicable.
- Set the production `VITE_BASE_URL` to the HTTPS backend origin. Remove legacy `VITE_AUTH_*` values and rotate any secrets exposed by old client builds.
- Switch both applications together after draining unauthenticated legacy instances; see the backend rollout notes. The monorepo does not deploy either application automatically.

No live demo is advertised until hosting and both deployed applications have been verified. The previous Render service is unavailable; local checks do not establish deployment readiness.

## History and repository transition

This repository continues the existing backend repository, created on **14 October 2022**. The frontend repository was created on **15 October 2022**. Both original default-branch histories are ancestors of the consolidation commit, with their original commit IDs, authors, author dates, and committer dates unchanged.

The new directory moves and merge are dated when performed. No original commits are rebased, squashed, cherry-picked, or backdated. Git can follow file moves using `git log --follow -- frontend/src/App.vue`, for example; directory-scoped history views may require following renames to see older paths.

**Merge this PR using “Create a merge commit”. Do not squash or rebase it**, because importing both histories is an explicit requirement.

After the PR is merged and deployment roots have been adjusted, rename the existing backend repository to `Typeform-Judging-Scoreboard`, update profile links, and archive the former frontend repository with a pointer here. Historical PR discussions remain in their original repositories; Git history import does not move those discussions, stars, or forks. The frontend repository must not be deleted.

## Author

[Mohamed Fadl](https://github.com/FADL285)
