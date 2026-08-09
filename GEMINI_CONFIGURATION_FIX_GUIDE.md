# WATTZAN Gemini Configuration Fix

This update fixes the case where the assistant still says **Setup required** after a Gemini key has been saved.

## What changed

The old backend read only `backend/.env` once when Python started. The new loader:

- checks `backend/.env` first;
- recognizes the common Windows mistake `backend/.env.txt`;
- checks a project-root `.env` as a fallback;
- handles UTF-8 BOMs and quoted values;
- reloads Gemini settings whenever the status or message endpoint is called;
- never exposes the API key;
- reports the file path from which the key was detected;
- adds `backend/check_gemini_config.bat`.

## Correct key location

The recommended location remains:

```text
WATTZAN_PROJECT/backend/.env
```

The file should contain:

```env
GEMINI_API_KEY=YOUR_REAL_KEY
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite
```

Do not put the key in `.env.example` or any frontend file.

## Test

Double-click:

```text
backend/check_gemini_config.bat
```

A correct result says:

```text
Configured: True
Detected key length: <non-zero number>
```

Then open:

```text
http://127.0.0.1:8000/api/chatbot/status
```

Confirm `configured` is `true` and inspect `configuration_source`.
