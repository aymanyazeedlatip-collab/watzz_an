# WATTZAN v15.2 Assistant Header Cleanup

## Changes

- Removed the `Dashboard-aware analysis` label from the floating assistant header.
- Hid the green `Assistant ready` badge when the assistant is configured and available.
- Preserved `Setup required` and connection-checking messages so configuration problems remain visible.
- Applied the clean ready-state behavior to both the floating assistant and the Recommendations assistant panel.
- No forecasting, weather, model, database, or backend files were changed.

## Installation

1. Stop WATTZAN with `Ctrl + C`.
2. Extract `WATTZAN_v15_2_Assistant_Header_Cleanup_Update.zip`.
3. Copy the extracted `frontend` folder into your WATTZAN project root.
4. Choose **Replace the files in the destination**.
5. Restart `backend/run_server.bat`.
6. Open `http://127.0.0.1:8000` and press `Ctrl + F5`.

## Expected result

The floating header displays only `WATTZAN Assistant`, followed by the expand and close controls. No green ready badge is displayed. A red setup warning remains available only when configuration requires attention.
