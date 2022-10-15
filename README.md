<div align="center">
    <h1>Typeform - Judging Scoreboard - Back-End</h1>
    <img src="https://user-images.githubusercontent.com/53804570/196001680-ce93ed21-9302-483f-a6f6-9b5ea1ea444f.gif" alt="Logo" />
    <p>Fetch responses from Typeform and display it in a score board - it fetch workspace forms and set each form as card which has Teams (multiple_choice or picture_choice) and display the total rating score.</p>
</div>

## What the application covers?

- [x] Fetch Specific Workspace Forms <WORKSPACE_ID> `required`
- [x] Bind each form name to a specific category.
  > 💡 NOTE: Workspace forms are fetched once and then cached on the server, `make sure you create the forms before running the app on the server` - don't worry, you can update the forms at any time.
- [x] Fetch form responses and return each team score. `map each judge to his responses "Judge name is "`
- [x] Fetch Form Variable if you need them

## Typeform Qurstion Structure

| Question          | Type                                  |
| :---------------- | :------------------------------------ |
| `choose a team`   | `multiple_choice` or `picture_choice` |
| `rating question` | `rating`                              |

> This is a [demo team evaluation form](<(https://form.typeform.com/to/A9z6bGlu#judge=Mohamed%20Fadl)>), take a look at it.## Requirements to run it locally

- [Node.js](https://nodejs.org/en/)

## Installation

**Clone the Application.**

```bash
  git clone https://github.com/Typeform/js-api-client.git
```

**Install Dependencies.**

```bash
  npm install
```

## Environment Setup

**Copy `.env.exmample` to .env and update the environment variables with your values**

```bash
  cp .env.example .env
```

**`.env` Structure**

```bash
# App Configuration

TYPEFORM_PERSONAL_TOKEN="Your token here"
TYPEFORM_WORKSPACE_ID="Your workspace ID here"
```

## Run the Application

To run this project run

```bash
  npm run start
```

## Deploy

You can deploy the application on any hosting services platform

**Free Hosting Platforms**:

- [Heroku](https://heroku.com/)
- [render](https://render.com/)
- [cyclic](https://www.cyclic.sh/)

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
