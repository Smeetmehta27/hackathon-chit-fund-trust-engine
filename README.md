# Hackathon Chit Fund Trust Engine

Informal financial groups like chit funds and ROSCAs (Rotating Savings and Credit Associations) rely entirely on personal trust, lacking structured visibility into member reliability and contribution history. This project provides a transparent, AI-powered trust engine that logs payment rounds, calculates an objective trust score based on contribution consistency, and generates natural-language explanations for each member's score using large language models. This empowers group organizers to mitigate default risks and maintain financial health.

## Live Demo
https://main.d2wkw0tz96iy0b.amplifyapp.com

## Screenshots

![Create Group Form](/c:/first-commit/screenshots/create_group.png)
*Creating a new fund group with a fixed monthly contribution amount.*

![Add Members](/c:/first-commit/screenshots/add_member.png)
*Adding members to the group prior to logging the first round.*

![Log Round Form](/c:/first-commit/screenshots/log_round.png)
*Logging a payment round, marking which members have contributed.*

![Dashboard](/c:/first-commit/screenshots/dashboard.png)
*The group dashboard displaying ranked trust scores and AI-generated explanations.*

## Features
- Group and member management tailored for rotating savings.
- Fast, single-page application (SPA) frontend.
- Automated calculation of trust scores (0% to 100%).
- AI-generated contextual explanations of member reliability.
- Persistent logging of payment rounds and historical contributions.

## Architecture

The application is built on a serverless AWS stack for high scalability and low operational overhead.

- **Frontend**: React (Vite) hosted on AWS Amplify Hosting.
- **API Gateway**: HTTP API routing requests to a single backend Lambda function.
- **Compute**: AWS Lambda (Python 3.11) containing the routing and business logic (Mono-Lambda pattern).
- **Database**: Amazon DynamoDB utilizing Single-Table Design for groups, members, and payment rounds.
- **AI Integration**: Amazon Bedrock for generative text explanations.

```text
[ React SPA ] --(HTTPS)--> [ API Gateway ] --(Invoke)--> [ AWS Lambda ]
 (Amplify)                                                     |
                                                               |--> [ DynamoDB ] (Data & Caching)
                                                               |
                                                               |--(Converse API)--> [ Amazon Bedrock ]
```

## How the AI Works

### Trust Score Model
The core quantitative metric is a logistic regression model trained to predict member reliability. It processes raw payment history into three features:
1. **Percentage Paid on Time**: Frequency of timely payments.
2. **Average Days Late**: Measure of delay for missed or late payments.
3. **Consistency**: Variance in payment behavior.

These features are passed through pre-computed weights (extracted from a separately trained sci-kit learn model) to yield a trust score bounded between 0.0 and 1.0.

### Generative Explanations
To translate raw numerical scores into actionable insights, the system invokes Amazon Bedrock using the `us.meta.llama3-1-8b-instruct-v1:0` model via cross-region inference profiles. It provides the model with the member's name and trust score, prompting it to generate a brief, financial-advisor-style explanation (e.g., "Highly reliable with consistent on-time payments"). To optimize latency and reduce costs, Bedrock responses are cached in DynamoDB.

## API Reference

| Method | Path | Description |
|---|---|---|
| POST | `/groups` | Create a new group (requires name and monthlyAmount). |
| POST | `/groups/{groupId}/members` | Add a member to a specific group. |
| POST | `/groups/{groupId}/rounds/{roundNumber}` | Log a payment round for all members. |
| GET | `/groups/{groupId}/dashboard` | Retrieve group stats, member trust scores, and explanations. |

## Local Development

### Prerequisites
- Node.js and npm (for frontend)
- Python 3.11+
- AWS CLI and AWS SAM CLI (for backend deployment)

### Running the Frontend
Navigate to the frontend directory, install dependencies, and start the Vite development server:
```bash
cd frontend
npm install
npm run dev
```

### Deploying the Backend
Navigate to the backend directory and use SAM to build and deploy:
```bash
cd backend
sam build
sam deploy --guided
```

### Environment Variables
The Lambda function expects the following environment variable to be configured (handled automatically by the SAM template):
- `TABLE_NAME`: The name of the DynamoDB table.

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   └── app.py            # Mono-Lambda routing and business logic
│   └── template.yaml         # AWS SAM CloudFormation template
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # React UI and API state machine
│   │   ├── index.css         # Custom CSS Design System
│   │   └── main.jsx          # React entry point
│   ├── package.json
│   └── vite.config.js
├── screenshots/              # UI captures
└── README.md
```

## AI Disclosure
This project was developed with the assistance of AI coding tools, specifically Google Antigravity and Gemini, to accelerate prototyping, generate boilerplate, and implement features.
