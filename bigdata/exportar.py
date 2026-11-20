"""Convierte la salida TSV de beeline en un CSV correcto para pandas y Excel.

beeline no entrecomilla los campos en su salida CSV, así que los títulos con comas
(«Bzrp Music Sessions, Vol. 34») descolocan las columnas. pipeline.sh exporta en TSV y este
script escribe el CSV con comillas: NULL pasa a vacío, se quita el «.0» final de las marcas de
tiempo y se ordena por las columnas indicadas.

Uso:  python -I bigdata/exportar.py entrada.tsv salida.csv [--orden col1,col2]
Solo usa la biblioteca estándar.
"""
from __future__ import annotations

import argparse
import csv
import re
import sys

csv.field_size_limit(10_000_000)
MARCA_TIEMPO = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.0$")


def limpiar(valor: str) -> str:
    if valor == "NULL":
        return ""
    if MARCA_TIEMPO.match(valor):
        return valor[:-2]
    return valor.strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("entrada")
    ap.add_argument("salida")
    ap.add_argument("--orden", default="")
    a = ap.parse_args()

    with open(a.entrada, encoding="utf-8", newline="") as f:
        filas = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
    if not filas:
        print(f"[ERROR] {a.entrada} está vacío", file=sys.stderr)
        return 1
    cabecera = [c.split(".")[-1] for c in filas[0]]
    datos = [[limpiar(v) for v in fila] for fila in filas[1:]]
    malas = [i for i, fila in enumerate(datos, 2) if len(fila) != len(cabecera)]
    if malas:
        print(f"[ERROR] {len(malas)} filas con columnas de más o de menos (la primera, línea {malas[0]})",
              file=sys.stderr)
        return 1
    if a.orden:
        idx = [cabecera.index(c) for c in a.orden.split(",")]
        datos.sort(key=lambda fila: [fila[i] for i in idx])

    # utf-8-sig: Excel muestra bien las tildes; en pandas hay que leer con encoding="utf-8-sig"
    with open(a.salida, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(cabecera)
        w.writerows(datos)
    print(f"{len(datos)} filas, {len(cabecera)} columnas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
