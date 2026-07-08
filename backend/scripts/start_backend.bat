@echo off
setlocal
cd /d "%~dp0.."
set "MPLCONFIGDIR=%CD%\.matplotlib"
if not exist "%MPLCONFIGDIR%" mkdir "%MPLCONFIGDIR%"
".\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
