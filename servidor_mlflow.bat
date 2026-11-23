@echo off
REM Servidor de MLflow en local para Windows con Anaconda (sin Docker). Doble clic para arrancarlo.
REM Experimentos y modelos en mlruns\mlflow.db; artefactos en mlruns\. Interfaz en http://localhost:5000
cd /d "%~dp0"
set PY=%USERPROFILE%\anaconda3\python.exe
if not exist "%PY%" set PY=python
if not exist .venv-mlflow\Scripts\python.exe (
    echo Creando .venv-mlflow e instalando MLflow; la primera vez tarda unos minutos...
    "%PY%" -m venv .venv-mlflow || goto :error
    .venv-mlflow\Scripts\python.exe -m pip install -q --upgrade pip
    .venv-mlflow\Scripts\python.exe -m pip install -q "mlflow>=3,<4" || goto :error
)
if not exist mlruns mkdir mlruns
cd mlruns
echo MLflow en http://localhost:5000   (cierra esta ventana o pulsa Ctrl+C para pararlo)
"%~dp0.venv-mlflow\Scripts\python.exe" -m mlflow server --host 127.0.0.1 --port 5000 --backend-store-uri sqlite:///mlflow.db --artifacts-destination ./ --serve-artifacts
goto :eof
:error
echo No se pudo instalar o arrancar MLflow.
pause
