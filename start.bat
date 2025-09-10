@echo off
REM InsulinLog Backend Startup Script for Windows

echo 🚀 Starting InsulinLog Backend...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install --production
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies.
        pause
        exit /b 1
    )
)

REM Check if .env file exists
if not exist ".env" (
    echo ❌ .env file not found. Please ensure .env file is present.
    pause
    exit /b 1
)

REM Start the application
echo ✅ Starting application...
node server.js
pause