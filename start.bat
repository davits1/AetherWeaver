@echo off
setlocal
title AetherWeaver - NovelAI Studio

:: Ir a la carpeta del proyecto
cd /d "%~dp0"

:: Detectar Node.js (PATH o rutas habituales de instalacion)
set "NODE_EXE=node"
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :run

if exist "D:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=D:\Program Files\nodejs\node.exe"
    goto :run
)

if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    goto :run
)

if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    goto :run
)

echo [ERROR] No se encontro Node.js instalado o en el PATH.
echo Por favor verifica que Node.js este instalado.
echo.
pause
exit /b 1

:run
echo ======================================================
echo   Iniciando AetherWeaver Proxy ^& Servidor Web...
echo ======================================================
echo.

:: Abrir el navegador automaticamente a los 2 segundos
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8787/"

:: Ejecutar el servidor proxy
"%NODE_EXE%" proxy.mjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] El servidor se detuvo.
    pause
)
