@echo off
REM Doctor Slot Management Test Script
REM Tests: Create appointment (decrease slots) → Complete appointment (restore slots)

echo.
echo ====================================================================
echo   DOCTOR SLOT MANAGEMENT TEST SUITE
echo   Smart Hospital System
echo ====================================================================
echo.

setlocal enabledelayedexpansion

REM Variables
set API_URL=http://localhost:5000/api
set EMAIL=receptionist@asf.com
set PASSWORD=password123
set TOKEN=
set DOCTOR_ID=
set PATIENT_ID=
set APPOINTMENT_ID=
set INITIAL_SLOTS=

echo [1/5] Logging in as Receptionist...
echo.

for /f "tokens=*" %%i in ('curl -s -X POST %API_URL%/auth/login -H "Content-Type: application/json" -d "{\\"email\\":\\"%EMAIL%\\",\\"password\\":\\"%PASSWORD%\\"}" ^| findstr token') do set TOKEN=%%i

if "!TOKEN!"=="" (
    echo ERROR: Could not authenticate. Check credentials.
    exit /b 1
)

echo Token acquired: %TOKEN:~0,30%...
echo.

echo [2/5] Fetching doctors list...
echo.

REM Get doctors (simplified - extracting first doctor data would require JSON parsing)
curl -s -X GET %API_URL%/users/role/doctor -H "Authorization: Bearer %TOKEN%"

echo.
echo.
echo [3/5] Fetching patients list...
echo.

curl -s -X GET %API_URL%/patients -H "Authorization: Bearer %TOKEN%"

echo.
echo.
echo Test Framework: Ready to accept manual test inputs
echo.
echo Usage:
echo   1. Copy test data from above (Doctor ID, Patient ID)
echo   2. Update variables in script
echo   3. Run full test
echo.
echo For automated testing, use: node tests/slotManagementTest.js
echo.
