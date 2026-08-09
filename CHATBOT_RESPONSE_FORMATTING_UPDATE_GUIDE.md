# WATTZAN Chatbot Response Formatting Update

## Changes

1. The assistant no longer appends the repeated project identity and synthetic-data paragraph to ordinary answers.
2. Project identity details remain available when the user explicitly asks about the researcher, school, developer, or ownership.
3. Synthetic-data limitations remain available when the question concerns data provenance, official status, real-world validity, or operational use.
4. Assistant replies now safely render common Markdown, including bold text, italics, lists, headings, block quotes, inline code, and fenced code blocks.
5. The frontend does not use unsanitized `innerHTML`; it creates DOM nodes and assigns text through `textContent`.

## Installation

1. Stop `run_server.bat` with `Ctrl + C`.
2. Back up the current WATTZAN folder.
3. Extract `WATTZAN_Chatbot_Response_Formatting_Update.zip`.
4. Copy its `backend` and `frontend` folders into the current WATTZAN project.
5. Choose **Replace the files in the destination**.
6. Do not delete `backend/.env`, `backend/.venv`, `backend/data/processed/wattzan.db`, `backend/artifacts`, or `backend/data/default`.
7. Restart `backend/run_server.bat`.
8. Open `http://127.0.0.1:8000` and press `Ctrl + F5`.

## Verification

Ask the assistant:

`Explain the latest forecast and bold the demand level.`

Expected behavior:

- Bold text is visually bold.
- The `**` characters are not displayed.
- The repeated developer/school/synthetic-data paragraph does not appear unless the question specifically asks for those details.
