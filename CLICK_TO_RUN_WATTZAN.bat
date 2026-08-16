@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>nul
title WATTZAN v16.2.8 - One-Click Local Launcher
color 0A

cd /d "%~dp0"
set "ROOT=%CD%"
set "BACKEND=%ROOT%\backend"
set "VENV=%ROOT%\.wattzan_py314"
set "VENV_PY=%VENV%\Scripts\python.exe"
set "REQ=%ROOT%\requirements-local-py314.txt"
set "STAMP=%VENV%\.wattzan_v162_py314_ready"
set "URL=http://127.0.0.1:8000"

cls
echo ================================================================
echo                  WATTZAN v16.2.8 LOCAL
echo                  Python 3.14 One-Click Start
echo ================================================================
echo.
echo This window is the WATTZAN server console.
echo Keep it open while you use the website.
echo.

REM ----------------------------------------------------------------
REM 1. Locate a normal CPython 3.14 installation.
REM ----------------------------------------------------------------
set "PY_EXE="
set "PY_ARGS="
where py >nul 2>nul
if not errorlevel 1 (
    py -3.14 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,14) else 1)" >nul 2>nul
    if not errorlevel 1 (
        set "PY_EXE=py"
        set "PY_ARGS=-3.14"
    )
)

if not defined PY_EXE (
    where python >nul 2>nul
    if not errorlevel 1 (
        python -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,14) else 1)" >nul 2>nul
        if not errorlevel 1 set "PY_EXE=python"
    )
)

if not defined PY_EXE (
    where python3.14 >nul 2>nul
    if not errorlevel 1 (
        python3.14 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,14) else 1)" >nul 2>nul
        if not errorlevel 1 set "PY_EXE=python3.14"
    )
)

if not defined PY_EXE (
    color 0C
    echo ERROR: Python 3.14 was not found.
    echo.
    echo WATTZAN looked for:
    echo   py -3.14
    echo   python
    echo.
    echo Your Python installation must also be available in PATH or the
    echo Windows Python Launcher must be installed.
    echo.
    pause
    exit /b 1
)

echo [1/6] Python detected:
%PY_EXE% %PY_ARGS% --version
if errorlevel 1 goto :failure

REM ----------------------------------------------------------------
REM 2. Create/rebuild the isolated Python 3.14 environment.
REM ----------------------------------------------------------------
if exist "%VENV_PY%" (
    "%VENV_PY%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3,14) else 1)" >nul 2>nul
    if errorlevel 1 (
        echo.
        echo Existing WATTZAN environment uses another Python version.
        echo Rebuilding it for Python 3.14...
        rmdir /s /q "%VENV%"
    )
)

if not exist "%VENV_PY%" (
    echo.
    echo [2/6] Creating the isolated WATTZAN Python 3.14 environment...
    %PY_EXE% %PY_ARGS% -m venv "%VENV%"
    if errorlevel 1 goto :failure
) else (
    echo [2/6] Existing Python 3.14 WATTZAN environment found.
)

REM ----------------------------------------------------------------
REM 3. Install dependencies automatically on the first launch.
REM ----------------------------------------------------------------
if not exist "%STAMP%" (
    echo.
    echo [3/6] First-time setup: installing WATTZAN packages...
    echo This requires an internet connection and may take a few minutes.
    echo Future launches will skip this step.
    echo.
    "%VENV_PY%" -m pip install --disable-pip-version-check --upgrade pip setuptools wheel
    if errorlevel 1 goto :pip_failure
    "%VENV_PY%" -m pip install --disable-pip-version-check --prefer-binary -r "%REQ%"
    if errorlevel 1 goto :pip_failure
    >"%STAMP%" echo WATTZAN v16.2.8 Python 3.14 dependencies installed
) else (
    echo [3/6] WATTZAN packages already installed.
)

REM ----------------------------------------------------------------
REM 4. Create local config automatically.
REM ----------------------------------------------------------------
if not exist "%BACKEND%\.env" (
    copy /y "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo [4/6] Local configuration created automatically.
) else (
    echo [4/6] Existing local configuration preserved.
)

REM ----------------------------------------------------------------
REM 5. Fast preflight: imports + model bundle.
REM ----------------------------------------------------------------
echo [5/6] Checking WATTZAN runtime and trained model files...
"%VENV_PY%" -c "import fastapi, uvicorn, pydantic, pandas, numpy, sklearn, statsmodels, scipy, joblib, sqlmodel; print('      Python scientific runtime: OK')"
if errorlevel 1 goto :failure

"%VENV_PY%" "%ROOT%\scripts\inspect_artifacts.py" > "%ROOT%\wattzan_preflight.log" 2>&1
if errorlevel 1 (
    color 0E
    echo.
    echo WARNING: The model preflight reported a problem.
    echo Details were saved to:
    echo   %ROOT%\wattzan_preflight.log
    echo.
    echo WATTZAN will still try to start so the diagnostics page can show details.
) else (
    echo       Production model bundle: OK
)

REM ----------------------------------------------------------------
REM 6. Make sure the local port is free, then start the server.
REM ----------------------------------------------------------------
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
    color 0E
    echo.
    echo Port 8000 is already in use.
    echo Close the other local server/WATTZAN window, then run this BAT again.
    echo.
    pause
    exit /b 1
)

echo [6/6] Starting WATTZAN...
echo.
echo Website:        %URL%
echo Health check:   %URL%/api/health
echo Diagnostics:    %URL%/api/deployment-diagnostics
echo.
echo Your browser will open automatically when WATTZAN is ready.
echo To stop WATTZAN, close this window or press Ctrl+C.
echo ================================================================
echo.

start "" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$u='%URL%/api/health'; for($i=0;$i -lt 180;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 2; if($r.StatusCode -eq 200){Start-Process '%URL%'; exit 0}}catch{}; Start-Sleep -Seconds 1}; Start-Process '%URL%'" >nul 2>nul

pushd "%BACKEND%"
"%VENV_PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
set "SERVER_EXIT=%ERRORLEVEL%"
popd

if not "%SERVER_EXIT%"=="0" goto :failure
exit /b 0

:pip_failure
color 0C
echo.
echo ================================================================
echo PACKAGE INSTALLATION FAILED
echo ================================================================
echo WATTZAN could not download/install one of its Python packages.
echo.
echo Make sure this computer is connected to the internet, then double-click
echo CLICK_TO_RUN_WATTZAN.bat again. The launcher will retry automatically.
echo.
pause
exit /b 1

:failure
color 0C
echo.
echo ================================================================
echo WATTZAN COULD NOT START
echo ================================================================
echo Read the last error above. You can send a screenshot of this window
echo and I can trace the exact cause.
echo.
pause
exit /b 1
