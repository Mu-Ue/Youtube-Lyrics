@echo off
setlocal
pushd "%~dp0"

if not exist node_modules (
    echo Installing dependencies...
    call npm ci
    if errorlevel 1 goto :fail
)

echo Building...
call npm run build
if errorlevel 1 goto :fail

popd
exit /b 0

:fail
echo.
echo ERROR: Build failed.
popd
exit /b 1
