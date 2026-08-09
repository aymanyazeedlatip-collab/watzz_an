# WATTZAN Gemini Model Update

Google rejected `gemini-2.5-flash` for this API project. WATTZAN now uses the current stable free-tier model `gemini-3.5-flash` and automatically retries `gemini-3.1-flash-lite` when the primary model is unavailable.

## Existing installation

1. Stop `run_server.bat`.
2. Merge the update files into the current WATTZAN folder.
3. Open `backend/.env`.
4. Replace the old model line with:

```env
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite
```

5. Keep the existing `GEMINI_API_KEY` unchanged.
6. Restart the server.
7. Open `http://127.0.0.1:8000/api/chatbot/status`.
8. Confirm that `model` is `gemini-3.5-flash`.
9. Force-refresh the website and send a test message.

Even when an older `.env` still says `gemini-2.5-flash`, the backend maps it to `gemini-3.5-flash` before making the request. Editing `.env` is still recommended so the local configuration accurately describes the active model.
