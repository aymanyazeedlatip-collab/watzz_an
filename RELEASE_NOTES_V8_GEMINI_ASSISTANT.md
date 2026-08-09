# WATTZAN v8 — Gemini Assistant

## Added

- Secure FastAPI proxy for Google Gemini API
- Default model configuration: `gemini-3.5-flash`
- Floating bottom-right chatbot interface
- Dedicated assistant workspace in Recommendations
- Shared conversation across both assistant views
- Ready-made prompt options
- Live dashboard context snapshot
- Recent saved forecast context verified by the backend
- Request timeout and readable provider errors
- Assistant setup/status endpoint
- API-key placeholder in `backend/.env.example`
- Assistant backend tests and browser interaction test

## Context supplied to the assistant

Depending on availability, WATTZAN sends a bounded snapshot of:

- Current page
- Selected municipality
- Active dataset
- Model readiness and performance
- Latest saved forecast
- Current forecast result
- Recent forecast history
- Demand level, reason codes, and recommended actions
- Short-term form inputs and fetched weather
- Long-term scenario outputs
- Historical consumption summary
- Research limitations

## Security

- Gemini API key remains in `backend/.env`.
- The browser communicates only with `/api/chatbot/*`.
- The API key is never included in frontend source or API responses.
- Context size, message length, and conversation history are bounded.
- Untrusted context is explicitly treated as data rather than instructions.

## Unchanged

- Municipality MLR model
- Direct and residual SARIMA models
- Hybrid calculation
- Peak-demand estimator
- Recommendation classifier
- Open-Meteo workflow
- Current-week recursive scenario
- SQLite forecast records and schema
- Existing forecast endpoints
