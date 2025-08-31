@echo off
setlocal

echo Installing dependencies...
pnpm install --recursive

echo Checking for buf (codegen)...
where buf >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
  echo Running buf generate...
  cd packages\proto
  buf generate
  cd ..\..
) ELSE (
  echo buf not found; skipping codegen. (Install from https://buf.build if needed)
)

echo Starting backend and frontend...
pnpm dev

endlocal
pause
