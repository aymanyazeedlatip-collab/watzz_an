# WATTZAN Navigation and About Update

This update changes only the `frontend/` folder. No backend, dataset, database, or model artifact is modified.

## Navigation changes

The sidebar now contains:

- Overview
- Forecast
  - Short-term Forecast
  - Long-term Forecast
  - Forecast History
- Recommendations
- System Information
  - System Health
  - Model Performance
  - Data Management
- About

Forecast and System Information are accessible collapsible groups. The group containing the active page opens automatically.

## About page

The new About page explains:

- WATTZAN and its municipality-aware forecasting purpose
- The project's short-term and long-term decision-support functions
- Researcher and Developer: Zander Nathan Deatras
- School: Tacurong City National High School
- Institutional ownership of the system by Tacurong City National High School
- The synthetic-data and operational-validation limitations

## Installation

1. Stop the WATTZAN server.
2. Rename the current `frontend` folder to `frontend_backup_before_navigation_update`.
3. Copy the new `frontend` folder into the main WATTZAN project.
4. Start `backend/run_server.bat`.
5. Open `http://127.0.0.1:8000`.
6. Press `Ctrl + F5` to clear the cached frontend.
