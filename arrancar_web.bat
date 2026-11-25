@echo off
REM Arranca la API y la web de usuario con una carpeta de demo aparte (data\demo).
REM Los historiales reales de data\raw no se tocan: solo se copian.
REM Uso: arrancar_web.bat            (arranca todo)
REM      arrancar_web.bat reiniciar  (borra data\demo y lo recrea desde data\raw)
cd /d "%~dp0"

REM Python: el entorno virtual del repo, si no Anaconda, si no el del sistema.
set PY=%CD%\.venv\Scripts\python.exe
if not exist "%PY%" set PY=%USERPROFILE%\anaconda3\python.exe
if not exist "%PY%" set PY=python

REM Dependencias antes de preparar los datos: sin ellas la preparacion falla y se borraria data\demo.
"%PY%" -m pip install -q -r api\requirements.txt || echo AVISO: no se pudieron instalar las dependencias de la API ^(sin internet?^).

if /i "%~1"=="reiniciar" (
    echo Borrando data\demo...
    if exist data\demo rmdir /s /q data\demo
)

REM Se decide por el modelo (no por raw): si una preparacion anterior quedo a medias se rehace.
if not exist data\demo\modelo\modelo.joblib (
    if exist data\demo rmdir /s /q data\demo
    echo Copiando los historiales a data\demo\raw...
    xcopy /e /i /q data\raw\daniel data\demo\raw\daniel || goto :error
    xcopy /e /i /q data\raw\ander data\demo\raw\ander || goto :error
    echo Preparando el modelo de la demo...
    "%PY%" -m api.preparar_datos --historial data\demo\raw --salida data\demo\modelo || goto :error
)

set API_HISTORIAL=%CD%\data\demo\raw
set API_DATOS=%CD%\data\demo\modelo
start "API" "%PY%" -m uvicorn api.main:app --host 127.0.0.1 --port 8000

if not exist web\package.json (
    echo La web todavia no esta creada ^(falta web\package.json^). Solo se ha arrancado la API.
    goto :eof
)
if not exist web\node_modules call npm --prefix web install
start "Web" npm --prefix web run dev
REM Espera a que Next arranque antes de abrir el navegador.
timeout /t 5 >nul
start http://127.0.0.1:3000
goto :eof

:error
echo No se pudo preparar la carpeta de demo.
REM Se borra lo parcial para que la proxima vez se prepare desde cero.
if exist data\demo rmdir /s /q data\demo
pause
