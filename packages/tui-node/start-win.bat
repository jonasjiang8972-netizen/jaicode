@echo off
chcp 65001 >nul
title Jaicode v0.1.0

echo   ⬡ Jaicode v0.1.0 - Starting...
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is required but not found.
    echo Install from https://nodejs.org
    exit /b 1
)

set SCRIPT_DIR=%~dp0
node "%SCRIPT_DIR%src\tui.js"
