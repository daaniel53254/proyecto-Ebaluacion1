"""Genera el SQL de Hive de las tablas bronze de Kaggle a partir de la cabecera de cada CSV.

Por cada data/entrada/kaggle/<nombre>.csv crea la tabla externa bronze.kaggle_<nombre> sobre
/bronze/kaggle/<nombre>/, con todas las columnas como STRING (bronze guarda el dato en bruto,
incluida la columna sobrante «Unnamed: 0», que pasa a llamarse unnamed_0).
Kaggle ya no entra en el objetivo 1: queda en bronze como fuente documentada.

Uso:  python -I bigdata/kaggle_ddl.py data/entrada/kaggle salida.sql
Escribe en la salida estándar «nombre<TAB>filas» de cada fichero (filas sin la cabecera).
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

csv.field_size_limit(10_000_000)


def nombre_columna(texto: str) -> str:
    limpio = re.sub(r"[^0-9a-z]+", "_", texto.strip().lower()).strip("_")
    return limpio or "columna"


def main() -> int:
    carpeta, salida = Path(sys.argv[1]), Path(sys.argv[2])
    sentencias = ["CREATE DATABASE IF NOT EXISTS bronze;"]
    for f in sorted(carpeta.glob("*.csv")):
        nombre = nombre_columna(f.stem)
        with f.open(encoding="utf-8", newline="") as fh:
            lector = csv.reader(fh)
            cabecera = next(lector)
            filas = sum(1 for _ in lector)
        vistas: dict[str, int] = {}
        columnas = []
        for i, c in enumerate(cabecera):
            # Una cabecera vacía es el índice que guardó pandas: se llama como él la muestra (Unnamed: 0)
            col = nombre_columna(c) if c.strip() else f"unnamed_{i}"
            vistas[col] = vistas.get(col, 0) + 1
            columnas.append(col if vistas[col] == 1 else f"{col}_{vistas[col]}")
        cols = ",\n  ".join(f"`{c}` STRING" for c in columnas)
        sentencias.append(f"""DROP TABLE IF EXISTS bronze.kaggle_{nombre};
CREATE EXTERNAL TABLE bronze.kaggle_{nombre} (
  {cols})
ROW FORMAT SERDE 'org.apache.hadoop.hive.serde2.OpenCSVSerde'
WITH SERDEPROPERTIES ('separatorChar' = ',', 'quoteChar' = '"', 'escapeChar' = '\\\\')
STORED AS TEXTFILE
LOCATION 'hdfs://namenode:9000/bronze/kaggle/{f.stem}'
TBLPROPERTIES ('skip.header.line.count' = '1');""")
        print(f"{nombre}\t{filas}")
    salida.write_text("\n\n".join(sentencias) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
