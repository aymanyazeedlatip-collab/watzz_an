@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" scripts\check_gemini_config.py
) else (
  py -3 scripts\check_gemini_config.py
)
echo.
pause
