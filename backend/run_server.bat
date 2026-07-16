@echo off
setlocal EnableExtensions

REM ================================================================
REM WATTZAN municipality-aware launcher for Windows
REM ================================================================
REM This launcher:
REM   1. Finds Python 3.14 first, then any available Python 3.
REM   2. Creates an isolated virtual environment named .venv.
REM   3. Installs or refreshes requirements only when needed.
REM   4. Creates .env from .env.example when missing.
REM   5. Starts FastAPI and the dashboard at http://127.0.0.1:8000

cd /d "%~dp0"

set "PYTHON_CMD="

where py >nul 2>nul
if not errorlevel 1 (
    py -3.14 --version >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_CMD=py -3.14"
    ) else (
        py -3 --version >nul 2>nul
        if not errorlevel 1 set "PYTHON_CMD=py -3"
    )
)

if not defined PYTHON_CMD (
    where python >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
    echo.
    echo ERROR: No usable Python 3 installation was found.
    echo Install Python 3.14 or another supported Python 3 release,
    echo then reopen this folder and run this file again.
    echo.
    pause
    exit /b 1
)

echo Using Python:
%PYTHON_CMD% --version
if errorlevel 1 goto :failure

if not exist ".venv\Scripts\python.exe" (
    echo.
    echo Creating the WATTZAN virtual environment...
    %PYTHON_CMD% -m venv .venv
    if errorlevel 1 goto :failure
)

set "VENV_PYTHON=.venv\Scripts\python.exe"
set "REQUIREMENTS_STAMP=.venv\.requirements-installed"

if not exist "%REQUIREMENTS_STAMP%" goto :install_requirements
for %%F in (requirements.txt) do set "REQUIREMENTS_TIME=%%~tF"
for %%F in ("%REQUIREMENTS_STAMP%") do set "STAMP_TIME=%%~tF"
if not "%REQUIREMENTS_TIME%"=="%STAMP_TIME%" goto :install_requirements
goto :requirements_ready

:install_requirements
echo.
echo Preparing Python packages. This can take several minutes on the first run...
"%VENV_PYTHON%" -m pip install --upgrade pip setuptools wheel
if errorlevel 1 goto :failure
"%VENV_PYTHON%" -m pip install --prefer-binary -r requirements.txt
if errorlevel 1 goto :failure
copy /b requirements.txt "%REQUIREMENTS_STAMP%" >nul

:requirements_ready
if not exist ".env" (
    echo Creating .env from .env.example...
    copy .env.example .env >nul
)

echo.
echo Checking Gemini configuration...
"%VENV_PYTHON%" scripts\check_gemini_config.py

echo.
echo Starting WATTZAN municipality-aware server...
echo Keep this window open while using the website.
echo Open http://127.0.0.1:8000 after you see "Application startup complete".
echo API documentation: http://127.0.0.1:8000/docs
echo.
"%VENV_PYTHON%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
if errorlevel 1 goto :failure
exit /b 0

:failure
echo.
echo WATTZAN stopped because an error occurred.
echo Read the final error message above.
echo.
pause
exit /b 1
