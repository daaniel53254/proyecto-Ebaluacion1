# Capturas para el informe final

Hechas el 25/11/2026 con la demo local: API en `http://127.0.0.1:8000` y web en `http://127.0.0.1:3000`, ambas con `data/demo` (aitor, ander y daniel), y panel en Streamlit con `data/dataset/` y `api/datos/`. Son de 1440 px de ancho a escala 1,5. Las de la web y la API se repitieron el mismo día después de añadir el paso 4, el momento del día y quitar canciones.

| Fichero | Apartado del informe | Pie de foto propuesto |
|---|---|---|
| `api_1_docs.png` | 19.1 Endpoints | API · documentación interactiva en http://127.0.0.1:8000/docs con los endpoints de historiales, privacidad, información y los dos objetivos. |
| `api_2_playlist_respuesta.png` | 19.3 Ejemplo real | API · `POST /objetivo2/playlist` ejecutado desde /docs: Ander y Daniel, jueves 27/11 a las 15:30 (franja 12-16 h, laborable), 5 canciones. |
| `panel_1_habitos_por_persona.png` | 20.1 (sustituye a la captura antigua) | Panel · pestaña de hábitos por persona, con la identidad de NPD Entertainment. |
| `panel_2_calidad_de_datos.png` | 20.1 | Panel · pestaña de calidad de datos. |
| `panel_3_no_salto_por_contexto.png` | 20.1 | Panel · tasa de no salto por franja y tipo de día. |
| `panel_4_recomendador.png` | 20.1 (sustituye a la captura antigua) | Panel · pestaña del recomendador con el modelo de la API (franja 16-20 en fin de semana, N = 50). |
| `panel_5_playlist_del_grupo.png` | 20.1 (conexión con la API) | Panel · pestaña «Playlist del grupo»: lo que devolvería la API con el modelo de producción. |
| `web_1_portada.png` | 20.2 Web de usuario | Web · portada con el ejemplo de cómo puntúa cada canción y el estado de la API. |
| `web_2_tutorial.png` | 20.2 | Web · paso 1: tutorial para pedir el historial extendido a Spotify. |
| `web_3_subir.png` | 20.2 (y 21, privacidad) | Web · paso 2: subida del historial con la casilla de 16 años y el consentimiento, y la lista de quién está ya en el modelo. |
| `web_4_playlist_filtros.png` | 20.2 | Web · paso 3: filtros de la playlist. Las personas elegidas llevan su color y una marca; momento del día «Tarde» en fin de semana; quitados un artista y una canción, con de quién son. |
| `web_5_playlist_resultado.png` | 20.2 | Web · playlist de aitor, ander y daniel por la tarde en fin de semana: cifras y percentil de cada uno; la barra blanca es la media del grupo. |
| `web_6_playlist_exportar.png` | 20.2 | Web · cuánto le gusta la playlist a cada uno y exportación con «Copiar enlaces» (el botón «Crear en mi Spotify» aparece al dar de alta la app de Spotify). |
| `web_7_cancion_buscar.png` | 20.2 | Web · paso 4, «¿Entraría?»: búsqueda de una canción, con quién del grupo la escucha. |
| `web_8_cancion_respuesta.png` | 20.2 | Web · paso 4: la canción entraría en el puesto 19 de 30 con los filtros del paso 3, y la tasa de no salto de cada persona (objetivo 1). |

Si Ander cambia de dónde saca las canciones el paso 4 (para poder comprobar cualquiera, no solo las del grupo), habrá que repetir `web_7_cancion_buscar.png`.

## Falta: MLflow

En este ordenador no hay ninguna base de datos de MLflow: los modelos se registraron en Colab y en el equipo de Ander. Hacen falta dos capturas de su servidor (`servidor_mlflow.bat`, http://localhost:5000):

1. **Models → playlist_tasa_no_salto**: la lista de versiones con los alias `produccion` (versión 15) y `anterior` (versión 13). Va en el apartado 17.4.
2. **Experimento del notebook 05**: las ejecuciones con sus métricas (MAE de validación y del lote 2). Va en el apartado 17.2 o 17.4.
