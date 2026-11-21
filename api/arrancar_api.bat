@echo off
REM Arranca la API en Windows con Anaconda. Doble clic desde la carpeta api\ del repositorio.
cd /d "%~dp0\.."
set PY=%USERPROFILE%\anaconda3\python.exe
if not exist "%PY%" set PY=python
"%PY%" -m pip install -q -r api\requirements.txt
if not exist api\datos\modelo.joblib (
    echo Preparando el modelo con los historiales de data\entrada\historial...
    "%PY%" -m api.preparar_datos || goto :error
)
echo.
echo API en http://localhost:8000/docs   (Ctrl+C para pararla)
"%PY%" -m uvicorn api.main:app --port 8000
goto :eof
:error
echo No se pudo preparar el modelo. Arranco igual: sube historiales en http://localhost:8000/docs
"%PY%" -m uvicorn api.main:app --port 8000
pause
