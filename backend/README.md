<div align="center">
    <h1>Typeform - Judging Scoreboard - Back-End</h1>
    <img src="https://user-images.githubusercontent.com/53804570/196001680-ce93ed21-9302-483f-a6f6-9b5ea1ea444f.gif" alt="Logo" />
    <p>Fetch responses from Typeform and display it in a score board - it fetch workspace forms and set each form as card which has Teams (multiple_choice or picture_choice) and display the total rating score.</p>
</div>

## What the application covers?

- [x] Fetch Specific Workspace Forms <WORKSPACE_ID> `required`
- [x] Bind each form name to a specific category.
  > 💡 NOTE: Workspace membership is fetched per request; form details are cached for five minutes. Use Refresh panels after changing membership.
- [x] Fetch form responses and return each team score. `map each judge to his responses "Judge name is "`
- [x] Fetch Form Variable if you need them

## Typeform Qurstion Structure

| Question          | Type                                  |
| :---------------- | :------------------------------------ |
| `choose a team`   | `multiple_choice` or `picture_choice` |
| `rating question` | `rating`                              |

> This is a [demo team evaluation form](https://form.typeform.com/to/A9z6bGlu#judge=Mohamed%20Fadl), take a look at it.

## Requirements to run it locally

- [Node.js](https://nodejs.org/en/)

## Installation

**Clone the Application.**

```bash
  git clone https://github.com/FADL285/Typeform-Judging-Scoreboard-Backend.git
  cd Typeform-Judging-Scoreboard-Backend/backend
```

**Install Dependencies.**

```bash
  npm install
```

## Environment Setup

**Copy `.env.example` to .env and update the environment variables with your values**

```bash
  cp .env.example .env
```

**`.env` Structure**

```bash
# App Configuration

TYPEFORM_PERSONAL_TOKEN="Your token here"
TYPEFORM_WORKSPACE_ID="Your workspace ID here"
# Required: fill these privately; blank values fail startup.
SCOREBOARD_USER=
SCOREBOARD_PASSWORD=
SCOREBOARD_SESSION_SECRET=
```

Set a nonblank username, a private password of at least 12 characters, and a random signing secret of at least 32 characters. The former public sample password/signing secret are rejected. Never reuse example credentials. Configure all five required variables before starting.

## Run the Application

To run this project run

```bash
  npm run start
```

## Deploy

You can deploy the application on any hosting services platform

For example, configure a Node service on [Render](https://render.com/) with `backend` as its root, `npm ci` for installation, and `npm start` to launch it. Provider plans and availability change; this is not a claim of free hosting. Configure all private authentication and Typeform environment variables on the service.

## API Reference

#### Get all Forms in the Workspace (Form Id, Title, teams, and variables)

```http
  GET /api
```

#### Response Example

```json
{
  "data": [
    {
      "id": "KaxNsOxB",
      "title": "Machine Learning",
      "teams": [
        {
          "id": "71KhmFtvEsYZ",
          "title": "Team_1 Name"
        },
        {
          "id": "71KhmF2fEsYZ",
          "title": "Team_2 Name"
        },
        {
          "id": "43KhmFtvEsYZ",
          "title": "Team_3 Name"
        }
      ],
      "variables": {
        "color": "blue",
        "panel": "Panel 1"
      }
    },
    {
      "id": "KaFadlXB",
      "title": "Graphic Design",
      "teams": [
        {
          "id": "71KhmFtvWfYZ",
          "title": "Team_1 Name"
        },
        {
          "id": "71KhmFtXasYZ",
          "title": "Team_2 Name"
        },
        {
          "id": "71KhFMtvEsYZ",
          "title": "Team_3 Name"
        }
      ],
      "variables": {
        "color": "black",
        "panel": "Panel 2"
      }
    }
  ],
  "statusCode": 200
}
```

#### Get form `category` teams with there scores ( also return rating questions and it's variables )

```http
  GET /api/${formId}
```

| Parameter | Type     | Description                         |
| :-------- | :------- | :---------------------------------- |
| `formId`  | `string` | **Required**. Id of form `Category` |

#### Response Example

```json
{
  "data": {
    "id": "VYxaDyQi",
    "title": "AI/ML & Data Science",
    "teams": [
      {
        "id": "yyxxwWqDjbqL",
        "title": "AstroCodeX",
        "responses": [
          {
            "judge": "Mohamed Fadl",
            "answers": [
              {
                "id": "K0iweO6dUa0J",
                "rating": 9
              },
              {
                "id": "paJyPOZUg2iT",
                "rating": 8
              },
              {
                "id": "9L0zlEV4QU0w",
                "rating": 6
              }
            ]
          },
          {
            "judge": "Ayman Ezzat",
            "answers": [
              {
                "id": "K0iweO6dUa0J",
                "rating": 8
              },
              {
                "id": "paJyPOZUg2iT",
                "rating": 7
              },
              {
                "id": "9L0zlEV4QU0w",
                "rating": 7
              }
            ]
          }
        ]
      },
      {
        "id": "Z1vfoFNAa73Z",
        "title": "EDAD",
        "responses": [
          {
            "judge": "Mohamed Fadl",
            "answers": [
              {
                "id": "K0iweO6dUa0J",
                "rating": 6
              },
              {
                "id": "paJyPOZUg2iT",
                "rating": 7
              },
              {
                "id": "9L0zlEV4QU0w",
                "rating": 8
              }
            ]
          },
          {
            "judge": "Ayman Ezzat",
            "answers": [
              {
                "id": "K0iweO6dUa0J",
                "rating": 9
              },
              {
                "id": "paJyPOZUg2iT",
                "rating": 7
              },
              {
                "id": "9L0zlEV4QU0w",
                "rating": 6
              }
            ]
          }
        ]
      }
    ],
    "ratingQuestions": [
      {
        "id": "K0iweO6dUa0J",
        "title": "Impact",
        "max": 10
      },
      {
        "id": "paJyPOZUg2iT",
        "title": "Completeness",
        "max": 10
      },
      {
        "id": "9L0zlEV4QU0w",
        "title": "Functionality",
        "max": 10
      }
    ],
    "variables": {
      "color": "blue",
      "panel": "Panel 1"
    }
  },
  "statusCode": 200
}
```

## Acknowledgements

- [Typeform API js client](https://github.com/Typeform/js-api-client)

## Authors

- [@FADL285](https://www.github.com/FADL285)

## License

[ISC](https://choosealicense.com/licenses/isc/)

## Server-side scoreboard authentication

All `/api` routes require a server-signed bearer session token. Configure `SCOREBOARD_USER`, a private `SCOREBOARD_PASSWORD` of at least 12 characters, and a random `SCOREBOARD_SESSION_SECRET` of at least 32 characters on the backend only. Login via `POST /api/auth` with JSON `{ "username": "...", "password": "..." }`, then send the returned token in `Authorization: Bearer ...`. Tokens expire after eight hours. Rotate the session secret to invalidate all tokens. Use HTTPS.

The paired frontend must be updated together. Remove all `VITE_AUTH_*` deployment variables: frontend environment variables are public build configuration. Existing shared passwords exposed by old client builds must be replaced before deployment. This is a single shared scoreboard login, not individual judge accounts. Login throttling is per process/IP; deployments with multiple processes need a shared limiter or edge control.

Form details are cached for five minutes with an 8MB cache budget; workspace membership is fetched fresh per request and concurrent in-flight list refreshes are coalesced. Each request builds its own response data.

For reverse-proxy deployments, set optional `SCOREBOARD_TRUST_PROXY` to an explicit comma-separated list of trusted proxy IPs/CIDRs that matches the actual network topology (for example `127.0.0.1/32` only for a local proxy). Trust is disabled by default; never trust arbitrary forwarding headers or use blanket `true`. Configure the proxy to overwrite client forwarding headers.

The first multiple_choice/picture_choice question in form metadata remains the configured team selector; response answers are matched to that exact question ID, not their response ordering.

## Supported workload and secure rollout

Every scoreboard aggregation has a **30-second total server budget**, including workspace membership, cold metadata loading, rate-limit waits, and all response pages. Each upstream call is limited to the smaller of eight seconds and its remaining aggregation budget. Expiry cancels dispatched HTTP requests, prevents queued/worker dispatch, releases slots, and returns HTTP 504 without partial lists or rankings. Retrying is explicit; no automatic unbounded retry runs.

At most two aggregations and two upstream calls run concurrently per process. The queue is capped at 20 calls and starts remain spaced 500ms apart. Busy work returns 429/503. Hard safety ceilings are 1,000 workspace forms, 10,000 fetched responses and 8MB response data per aggregation; these are **size ceilings, not completion guarantees**. A cold catalog needs a workspace-list call plus one detail call per form: 40 forms cost at least 20 seconds before network latency, and a 1,000-form cold catalog cannot fit this budget. Use small event workspaces (roughly 40 lightweight forms cold), split larger workspaces, and retry a timeout only after addressing latency/size. Metadata caching helps subsequent requests but does not guarantee success. Every response page consumes the same total budget.

Form details over 1MB are rejected and the metadata cache is capped at 8MB with a five-minute TTL. Membership remains fresh per aggregation. Production SDK requests carry an AbortSignal and remaining timeout to Axios. Frontend scoreboard requests wait at most 35 seconds, allowing the server's 504 to arrive; login remains limited to 15 seconds. Hosting proxy timeouts must exceed the server budget.

This PR cannot retrofit authentication onto running legacy instances. Before exposing the updated service, put authentication at the edge or drain every old unauthenticated instance and switch frontend/backend together. Do not use a rolling mixed old/new deployment that still routes public traffic to legacy APIs. No deployment is performed by this PR.

The previous `getFormPref` export is retained for compatibility; no in-repository consumer was found. It now applies the same current-workspace authorization before returning metadata.
