@echo off
REM Arranca la API en Windows con Anaconda. Doble clic desde la carpeta api\ del repositorio.
cd /d "%~dp0\.."
set PY=%USERPROFILE%\anaconda3\python.exe
if not exist "%PY%" set PY=python
"%PY%" -m pip install -q -r api\requirements.txt
if not exist api\datos\modelo.joblib (
    echo Preparando el modelo y las tablas de la API...
    "%PY%" -m api.preparar_datos || goto :error
)
echo.
echo API en http://localhost:8000/docs   (Ctrl+C para pararla)
"%PY%" -m uvicorn api.main:app --port 8000
goto :eof
:error
echo No se pudo preparar la API. Revisa que existan data\entrada\historial\ander y \daniel.
pause
