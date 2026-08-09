# WATTZAN v11 Chatbot Server Error Fix

This release fixes a generic HTTP 500 response in the Gemini assistant path.

Key changes:

- Non-finite dashboard metrics are converted to JSON `null` before the Gemini request.
- Optional forecast-history context can fail without disabling the assistant.
- Gemini response parsing tolerates provider response variations.
- Invalid request-payload serialization becomes a handled WATTZAN error.
- The unnecessary `store` request property was removed.
- Repeated project boilerplate is filtered in the browser rather than in the critical backend response path.
- Unexpected chatbot failures now identify the log-file location instead of returning only a generic server error.

See the update package guide for beginner installation instructions.
