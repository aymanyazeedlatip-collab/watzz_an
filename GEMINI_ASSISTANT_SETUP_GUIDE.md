# WATTZAN Gemini Assistant Setup Guide

## What this update adds

WATTZAN now includes a Gemini-powered assistant that can explain the current dashboard outputs.

The same conversation appears in two places:

1. A floating Assistant button in the bottom-right corner of every page.
2. A full-width WATTZAN Assistant panel at the bottom of the Recommendations page.

The assistant receives a compact context snapshot containing relevant current WATTZAN outputs, including the selected municipality, latest forecast, demand level, reasons, recommended actions, model metrics, data coverage, visible forecast inputs, fetched weather, recent saved forecasts, and long-term scenario results.

The assistant must not be treated as a replacement for the trained forecasting models. Gemini explains the results produced by WATTZAN; it does not replace the MLR, SARIMA, hybrid, peak-demand, or recommendation calculations.

## Security design

The Gemini API key is read only by FastAPI from:

```text
backend/.env
```

The key is never returned by the API and is never stored in:

```text
frontend/index.html
frontend/styles.css
frontend/app.js
```

Do not paste the key into any frontend file.

## Step 1: Get a Gemini API key

1. Sign in to Google AI Studio.
2. Open the API key page.
3. Choose **Create API key**.
4. Copy the generated key.
5. Keep the key private. Do not publish it in GitHub, screenshots, research appendices, or shared ZIP files.

Official key page:

```text
https://aistudio.google.com/app/apikey
```

## Step 2: Add the key to the current WATTZAN project

1. Keep the WATTZAN server closed.
2. Open the project folder.
3. Open the `backend` folder.
4. Find the file named `.env`.
5. Right-click `.env`, choose **Open with**, then select Notepad.

If hidden files are not visible:

1. Open File Explorer.
2. Select **View**.
3. Select **Show**.
4. Enable **Hidden items**.

Add these lines at the bottom of `.env`:

```env
GEMINI_API_KEY=PASTE_YOUR_REAL_KEY_HERE
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite
GEMINI_TIMEOUT_SECONDS=45
GEMINI_MAX_OUTPUT_TOKENS=1200
GEMINI_MAX_CONTEXT_CHARS=28000
```

Replace only:

```text
PASTE_YOUR_REAL_KEY_HERE
```

Do not add quotation marks around the key.

Save with `Ctrl + S`, then close Notepad.

### When `.env` does not exist

Copy:

```text
backend/.env.example
```

Rename the copy to:

```text
.env
```

Then paste the real key into the `GEMINI_API_KEY` line.

## Step 3: Start WATTZAN

Open:

```text
backend/run_server.bat
```

Wait for:

```text
Application startup complete
```

Open:

```text
http://127.0.0.1:8000
```

Press:

```text
Ctrl + F5
```

## Step 4: Confirm the assistant is configured

Open:

```text
http://127.0.0.1:8000/api/chatbot/status
```

A correct setup shows:

```json
{
  "configured": true,
  "available": true,
  "provider": "Google Gemini API",
  "model": "gemini-3.5-flash"
}
```

When it says `configured: false`, check the following:

- The file is named exactly `.env`, not `.env.txt`.
- The key is on the `GEMINI_API_KEY=` line.
- The server was restarted after editing `.env`.
- There are no spaces before the key.

## Step 5: Test the floating assistant

1. Open any WATTZAN page.
2. Click **Assistant** in the bottom-right corner.
3. Confirm that the status displays `gemini-3.5-flash`.
4. Choose **Latest forecast**, or type:

```text
Summarize the latest saved forecast and explain what it means.
```

5. Click **Send**.
6. Confirm that the assistant answers and the page remains responsive.

## Step 6: Test the Recommendations assistant

1. Open **Recommendations**.
2. Scroll below the charts.
3. Find **WATTZAN Assistant**.
4. Confirm that the earlier floating-chat messages also appear there.
5. Ask:

```text
Why was the current demand level assigned, and what should operators monitor?
```

6. Open the floating widget again and confirm that the new message is also present there.

## Ready prompt options

The interface includes prompts for:

- Summarizing the latest saved forecast
- Explaining the current demand level
- Comparing MLR, SARIMA, and hybrid model results
- Explaining the selected municipality results for a research presentation

## API endpoints

```text
GET  /api/chatbot/status
POST /api/chatbot/message
```

The message endpoint accepts:

```json
{
  "message": "Explain the latest result.",
  "history": [],
  "current_page": "Recommendations",
  "context": {}
}
```

The frontend automatically creates the context object. Normal users do not need to construct it manually.

## Context and limitations

The assistant can use values currently available in WATTZAN, but it cannot create missing forecasts or official utility records.

It is instructed to state that:

- Municipality daily values are research-grade synthetic development data.
- Capacity shortage conclusions require an available-capacity value.
- Recommendation thresholds remain provisional until expert validation.
- Long-term outputs are planning scenarios.
- Missing information must not be guessed.

The question and compact dashboard context are transmitted to Google Gemini to generate a response. Do not enter passwords, private keys, personal records, or other confidential material into the chat.

## Troubleshooting

### Setup required

Cause: `GEMINI_API_KEY` is absent or still contains the placeholder.

Fix: Add the key to `backend/.env` and restart WATTZAN.

### Gemini rejected the configured API key

Cause: The key is invalid, disabled, restricted incorrectly, or copied with extra characters.

Fix: Create a new key in Google AI Studio and replace the old value.

### Free-tier rate limit reached

Cause: Too many requests were sent during the current rate-limit period.

Fix: Wait, then try again. Avoid repeatedly clicking Send.

### Gemini assistant took too long to respond

Cause: Slow or unavailable internet connection, or temporary provider delay.

Fix: Check the internet connection and retry. The request automatically stops after the configured timeout.

### Backend could not be reached

Cause: FastAPI is closed.

Fix: Start `backend/run_server.bat` and wait for application startup to complete.

## Files added or modified

Backend:

```text
backend/app/api/chatbot.py
backend/app/schemas/chatbot.py
backend/app/services/chatbot_service.py
backend/app/config.py
backend/app/main.py
backend/app/utils/exceptions.py
backend/.env.example
backend/tests/test_chatbot.py
```

Frontend:

```text
frontend/index.html
frontend/styles.css
frontend/app.js
```

No trained model artifact, municipality dataset, forecasting formula, SARIMA parameter, or SQLite schema was changed.
