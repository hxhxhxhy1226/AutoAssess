@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "ASSESSMENT_DESKTOP_PY="
call :probe "E:\Anaconda3\python.exe"
call :probe "D:\Anaconda3\python.exe"
if not defined ASSESSMENT_DESKTOP_PY for /f "delims=" %%P in ('where.exe python.exe 2^>nul') do call :probe "%%P"
if not defined ASSESSMENT_DESKTOP_PY goto missing
"%ASSESSMENT_DESKTOP_PY%" -B -X utf8 "%~dp0launch.py"
if errorlevel 1 goto failed
exit /b 0

:probe
if defined ASSESSMENT_DESKTOP_PY exit /b 0
if not exist "%~1" exit /b 1
if not exist "%~dp1pythonw.exe" exit /b 1
echo "%~1" | findstr /i /c:"\WindowsApps\" >nul
if not errorlevel 1 exit /b 1
"%~1" -c "import tkinter" >nul 2>&1
if errorlevel 1 exit /b 1
set "ASSESSMENT_DESKTOP_PY=%~1"
exit /b 0

:missing
echo No usable Python with tkinter and pythonw.exe was found.
echo Install Python with Tcl/Tk support, then try again.
:failed
echo Desktop window did not start. See the error above and startup-error.log.
pause
exit /b 1
