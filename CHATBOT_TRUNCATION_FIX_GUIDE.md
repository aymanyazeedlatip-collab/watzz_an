# WATTZAN Chatbot Truncation Fix

The previous Gemini configuration used only 1,200 output tokens while Gemini 3.5 Flash used medium thinking by default. The provider could return `finishReason: MAX_TOKENS` after consuming most of the budget in thinking, but WATTZAN displayed the partial visible text as a complete answer.

This release uses 4,096 tokens, low thinking, and one automatic retry with 8,192 tokens and minimal thinking. It refuses to display a still-incomplete second response.

Add or update these lines in `backend/.env`:

```env
GEMINI_MAX_OUTPUT_TOKENS=4096
GEMINI_RETRY_OUTPUT_TOKENS=8192
GEMINI_THINKING_LEVEL=low
```

Restart FastAPI after editing the file.
