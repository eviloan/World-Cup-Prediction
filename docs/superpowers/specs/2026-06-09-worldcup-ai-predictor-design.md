# WorldCup AI Predictor Design

## Goal

Build a local website for browsing World Cup information and predicting selected match outcomes.

## Scope

The first version includes schedules, teams, player rosters, match detail selection, and prediction output for score plus win/draw/loss probabilities. It uses built-in demo data so the site is usable immediately. The data layer is isolated so real tournament data can replace the demo data later.

## Architecture

The project uses a dependency-free Node.js server and a browser frontend. The server serves static files and exposes `POST /api/predict`. The prediction endpoint calls Kimi when `KIMI_API_KEY` is configured, then falls back to a deterministic local rules engine if the API is unavailable.

## Components

- `src/data.js`: World Cup demo schedule, teams, rosters, and baseline team strength metadata.
- `src/prediction.js`: local probability model, Kimi prompt builder, Kimi response parsing, and fallback orchestration.
- `server.js`: static file server plus prediction API.
- `src/app.js`: browser UI state, match selection, filtering, and prediction requests.
- `src/styles.css`: responsive app styling.
- `tests/prediction.test.js`: automated coverage for prediction behavior and Kimi fallback.

## Data Flow

The frontend renders data from `src/data.js`. When a user selects a match and clicks predict, it sends the match and optional user rules to `/api/predict`. The server loads the same data model, builds a baseline prediction, optionally asks Kimi to refine it, and returns a normalized prediction object.

## Error Handling

If Kimi is not configured, times out, or returns invalid JSON, the API returns a local rule-based prediction with a note explaining the fallback. The UI keeps the selected match visible and shows the prediction source.

## Testing

Core prediction behavior is tested with Node's built-in test runner. Browser behavior is verified manually through the local site after the server starts.
