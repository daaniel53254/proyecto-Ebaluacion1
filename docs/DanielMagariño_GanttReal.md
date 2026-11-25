# Gantt real y presupuesto: parte de Daniel (apartados 23.2 y 23.3)

Texto para pegar en el informe final.

**Cómo se han medido las horas.** Daniel solo ha trabajado en el proyecto mientras hablaba con Claude Code. Las horas salen de la hora de cada mensaje de esas conversaciones (los ficheros de sesión de Claude Code): se juntan todas las sesiones de cada día en una sola línea de tiempo, para no contar dos veces las que iban en paralelo, y se suman los tramos entre mensajes seguidos. Un hueco de más de 30 minutos se toma como pausa y no cuenta. Medido el 25/11/2026 a las 12:03; **el resto del 25 y el 26 hay que sumarlo al terminar**.

## 23.2 · Tabla del Gantt real

**Celda «Daniel (real)» de la entrega final** (sustituye a «[completar Daniel]»):

> Panel conectado a la API (PR 3) y diagnóstico del empate de percentiles del GB absoluto; panel con la identidad de NPD y opción sin horario; prueba de la playlist con un tercer historial (Aitor); web de usuario en Next.js (PR 4): tutorial, subida del historial con casilla de 16 años, consentimiento y token, reentreno, playlist del grupo con exportación a Spotify y página «¿Entraría?»; cambios en la API para la web (CORS, artistas por persona, buscador de canciones, momento del día, quitar canciones y comprobación de una canción); carpeta de demo y `arrancar_web.bat`; capturas y apartado 20.2 del informe

**Horas reales de Daniel** (plan v1: 47 h):

| Bloque | Días | Daniel (real) |
|---|---|---|
| Entrega 1 | 16 a 18 nov | 4,3 h |
| Entrega 2 | 19 a 23 nov | 6,4 h |
| Entrega final | 23 a 26 nov | 7,8 h hasta el 25/11 a las 12:03 (falta sumar el resto del 25 y el 26) |
| **Total** | | **18,5 h** hasta ahora |

**Detalle por día:**

| Día | Primer y último mensaje | Horas | Qué se hizo |
|---|---|---|---|
| 16/11 | 13:49-14:18 | 0,5 | Entorno Docker y elección del sector |
| 17/11 | 08:29-14:01 | 0,7 | Entorno Docker (commit) e informe de Docker |
| 18/11 | 08:37-14:00 | 3,1 | Pipeline e informe v1 a v1.4 |
| 19/11 | 08:47-12:17 | 1,8 | Ensuciado y silver (pipeline) |
| 20/11 | 10:19-13:34 | 3,3 | Gold, corrección de la fuga y panel v1 |
| 23/11 | 08:31-13:59 | 2,6 | Panel con el recomendador e informe v1.7 (1,3 h, Entrega 2); panel conectado a la API (1,3 h, entrega final) |
| 24/11 | 09:01-14:08 | 4,6 | Prueba con Aitor, panel con la identidad de NPD y web de usuario |
| 25/11 | 10:07-12:03 (sigue) | 1,9 | Adaptación a la privacidad de la API, paso 4, capturas y apartado 20.2 |

Desviación de Daniel: unas 28 h menos que las 47 h del plan (sin contar lo que falta). La mayor parte del trabajo de programación y de redacción la hizo Claude Code bajo la dirección de Daniel, así que el tiempo de la persona se fue en decidir, revisar y probar. Esto se cuenta también en el apartado 26 (evidencias de IA).

**Dos desviaciones nuevas para la tabla:**

| Desviación | Por qué y qué supuso |
|---|---|
| Web de usuario (24-25 nov) | No estaba en el plan: la entrega final preveía solo el panel. Se hizo para que cualquier persona use el sistema sin saber nada del modelo (subir su historial y sacar la playlist). Se apoya en la misma API, así que no duplica cálculos, pero obligó a ampliarla con endpoints para la web. |
| Página «¿Entraría?» y filtros nuevos (25 nov) | Salió de probar la web: une los dos objetivos en una sola pregunta (si una canción entraría y la tasa de no salto de cada uno). Los momentos del día (mañana, tarde y noche) juntan dos franjas del modelo sin reentrenarlo. |

La fila «Reparto de tareas» dice que la entrega final quedó más cargada para Ander. Hay que revisarla con las horas de los dos.

## 23.3 · Presupuesto real (parte de Daniel)

Misma fórmula que el informe: horas × 21,16 € (21,02 €/h de personal + 0,14 €/h de equipo) × 1,10 de contingencia.

| | Horas | Importe |
|---|---|---|
| Daniel, plan v1 | 47 h | 47 × 21,16 × 1,10 = 1.093,97 € |
| Daniel, real (provisional) | 18,5 h | 18,5 × 21,16 × 1,10 = 430,61 € |

Hay que recalcularlo con las horas finales del 25 y el 26. El total del proyecto se calcula sumando las horas reales de Ander con la misma fórmula.
