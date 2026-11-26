# Apartado para el informe final: web de usuario

**Dónde va:** dentro de la sección 20 («Sistema de visualización»). El texto actual del panel pasa a ser el 20.1 y este, el 20.2. Si preferís no tocar la numeración, puede ir como sección propia después de la 20, y entonces hay que renumerar de la 21 en adelante y actualizar el índice.

**Figuras:** están en `docs/capturas/` del repositorio. Cada `[Figura: …]` indica qué fichero va en ese punto, con su pie debajo.

---

## 20.2 Web de usuario

Daniel ha hecho una web para que cualquier persona del grupo use el sistema sin saber nada del modelo: pide su historial a Spotify, lo sube, recibe la playlist del grupo y puede comprobar si una canción concreta entraría en ella. El panel en Streamlit (20.1) sirve para analizar los datos y el modelo; la web es la cara del servicio para el usuario final. Se hizo el 24 de noviembre. El 25 se adaptó a los cambios de privacidad de la API (anexo A.1 a A.3) y se añadieron el paso 4, el momento del día y la opción de quitar canciones. Está en la carpeta `web/` del repositorio (PR 4) y tiene su propio `web/README.md`.

**Tecnología.** Next.js 15 con React 19, TypeScript estricto y Tailwind CSS 4. La web no tiene lógica de servidor ni base de datos propias: todas las llamadas van del navegador a la API de la sección 19. Usa la identidad de NPD Entertainment, la misma que el panel.

**Recorrido en cuatro pasos.**

| Paso | Página | Qué hace |
|---|---|---|
| Portada | `/` | Explica la idea con un ejemplo inventado de cómo puntúa cada canción y dice si la API está conectada y el modelo listo. |
| 1. Pide tu historial | `/tutorial` | Guía con dibujos para pedir a Spotify el historial extendido (Cuenta → Privacidad → Solicitar datos) y descargar el `.zip` cuando llega el correo. |
| 2. Súbelo | `/subir` | Formulario de subida y lista de quién está ya en el modelo, con el botón para borrar sus datos. |
| 3. Vuestra playlist | `/playlist` | Filtros, playlist del grupo y exportación a Spotify. |
| 4. ¿Entraría? | `/cancion` | Busca una canción y dice si entraría en la playlist con esos filtros y cuántas veces la escucharía cada uno sin saltarla. |

[Figura: `web_1_portada.png`]
*Web · portada con el ejemplo de cómo puntúa cada canción y el estado de la API.*

[Figura: `web_2_tutorial.png`]
*Web · paso 1: tutorial para pedir el historial extendido a Spotify.*

**Subida del historial.** Se puede subir el `.zip` tal como llega de Spotify o los JSON sueltos. Antes de enviar nada, el navegador abre el `.zip` (con la librería JSZip) y se queda solo con los ficheros `Streaming_History_Audio_*.json`. El resto (vídeos, podcasts, datos de la cuenta) no sale del ordenador de la persona, y la web enseña qué se sube y qué se descarta. Para poder subir hay que poner un nombre y marcar dos casillas: «Tengo 16 años o más» y el consentimiento para usar el historial (21.2 y anexo A.1). Después, la API vuelve a entrenar el modelo en segundo plano y la web sigue el estado de `GET /preparacion` hasta que la persona aparece «en el modelo».

**Token para borrar o sustituir.** La primera vez que alguien sube su historial, la API devuelve un token una sola vez (anexo A.3). La web se lo enseña para que lo guarde y además lo recuerda en ese navegador. Para borrar los datos («Borrar mis datos», derecho de supresión) o volver a subirlos, la web envía el token en la cabecera `X-Token`. Desde otro navegador lo pide antes de borrar. Si el token no coincide, la API responde 403 y la web lo explica sin borrar nada.

[Figura: `web_3_subir.png`]
*Web · paso 2: subida del historial con la casilla de 16 años y el consentimiento, y la lista de quién está ya en el modelo.*

**Playlist del grupo.** Los filtros son:

- **Quién viaja.** Cada persona del modelo es un botón: si va, lleva su color de fondo y una marca; si no, borde discontinuo y el nombre tachado. Hacen falta al menos dos personas, porque es una playlist de grupo.
- **Momento del día.** «Mañana» (4-12 h), «Tarde» (12-20 h), «Noche» (20-4 h) o «No importa», con el tipo de día (laborable o fin de semana). El modelo trabaja con seis franjas de 4 horas; cada momento junta dos: la API suma las escuchas de las dos franjas y hace la media de la predicción. «No importa» usa todas las escuchas, igual que en el panel.
- **Longitud,** en canciones o en minutos de viaje.
- **Quitar artistas y quitar canciones.** Solo salen los que alguien del grupo tiene en su historial, y al lado pone de quién son (por ejemplo, «Bad Bunny · ander, daniel, aitor»). Las canciones se buscan en la API (`GET /canciones`).

Los filtros se guardan en la sesión del navegador, así que el paso 4 usa los mismos. La web llama a `POST /objetivo2/playlist` y enseña:

- cuatro cifras: canciones, duración, artistas distintos y porcentaje de canciones con gusto real de todos (3 o más escuchas de cada miembro sin horario, 5 con franja; sin predicción);
- para cada canción, una barra por persona con su percentil (sólida si el gusto es real y rayada si es una predicción del modelo) y una barra blanca para el grupo;
- el percentil medio de la lista para cada persona: si a alguien le sale cerca de 50, el modelo no distingue bien sus gustos.

El orden de la playlist es el de la API: el mínimo de los percentiles, con desempate por la media (sección 19). La barra blanca del grupo enseña la **media** de los percentiles, porque se entiende mejor de un vistazo cuánto gusta la canción a todo el grupo. Se probó también a ordenar por la media, pero se mantuvo el mínimo, que es la regla evaluada en los notebooks 03 y 06.

[Figura: `web_4_playlist_filtros.png`]
*Web · paso 3: filtros de la playlist. Las personas elegidas llevan su color y una marca; «Tarde» en fin de semana; quitados un artista y una canción, con de quién son.*

[Figura: `web_5_playlist_resultado.png`]
*Web · playlist de aitor, ander y daniel por la tarde en fin de semana: cifras y percentil de cada uno; la barra blanca es la media del grupo.*

**Exportar a Spotify.** «Copiar enlaces» copia un enlace por canción. Si se pegan dentro de una playlist en Spotify, se añaden todas de una vez. «Crear en mi Spotify» inicia sesión en Spotify con el flujo PKCE (sin Client Secret en la web) y crea la playlist directamente en la cuenta de quien la pide, con los permisos `playlist-modify-private` y `playlist-modify-public`. Este botón solo aparece cuando la app está dada de alta en el panel de desarrolladores de Spotify. En modo de desarrollo, Spotify solo deja usarla a las cuentas que se apuntan en la app, cinco como máximo.

[Figura: `web_6_playlist_exportar.png`]
*Web · cuánto le gusta la playlist a cada uno y exportación con «Copiar enlaces».*

**¿Entraría esta canción? (paso 4).** Une los dos objetivos en una pregunta que se entiende sin saber nada del modelo. Se eligen las personas que viajan, se escribe **cualquier canción** (el título es obligatorio y el artista, opcional, afina el resultado) y la web llama a `POST /objetivo2/entraria`, que devuelve:

- si **entraría** y el motivo: entra si ninguno de los miembros baja del percentil 0,80 frente a las canciones nuevas que escuchó en los últimos 12 meses;
- por cada persona, el **percentil**, la **probabilidad de que la adopte** (la vuelva a escuchar sin saltarla en 90 días) y cuántas veces ha escuchado al artista.

Vale la haya escuchado alguien del grupo o no: si el título está en el catálogo, se saca de ahí el artista; si no, se usa el artista escrito, y sin artista el modelo solo conoce lo general de cada persona (la web avisa). No se comprueba que la canción exista en Spotify. Ander propone hacerlo como mejora futura (`comprobar_cancion_spotify.md`).

[Figura: `web_7_cancion_buscar.png`]
*Web · paso 4, «¿Entraría?»: versión anterior, que solo buscaba canciones conocidas por el grupo (la captura está pendiente de actualizar).*

[Figura: `web_8_cancion_respuesta.png`]
*Web · paso 4: la canción entraría en el puesto 19 de 30 con los filtros del paso 3, y la tasa de no salto de cada persona (objetivo 1).*

**Cambios en la API para la web.** Además de CORS para la web, se añadieron `GET /artistas?por_persona=true` (artistas con las escuchas de cada persona), `GET /canciones` (buscador de canciones conocidas por el grupo), `POST /objetivo2/cancion` (sigue en la API, aunque la web ya no lo usa) y, en la playlist, los campos `franjas` (varias franjas seguidas) y `excluir_canciones`. Sin esos campos, la playlist da exactamente lo mismo que antes.

**Cómo se arranca.** `arrancar_web.bat` arranca la API en `http://127.0.0.1:8000` y la web en `http://127.0.0.1:3000`, y abre el navegador. Usa una carpeta de demo aparte, `data/demo`, con copias de los historiales, para no tocar `data/raw` ni el modelo de `api/datos`. `arrancar_web.bat reiniciar` vuelve a empezar desde cero. La web se abre siempre como `127.0.0.1` y no como `localhost`, porque el token se guarda por dirección y la vuelta del inicio de sesión de Spotify está dada de alta con `127.0.0.1`.

**Pruebas.** 158 pruebas automáticas de la web (Vitest y Testing Library): la lectura del `.zip`, el cliente de la API, la casilla de edad, el token, los filtros (mínimo de dos personas, momentos del día, quitar artistas y canciones), el paso 4, el flujo de inicio de sesión de Spotify (simulado) y las pantallas. A eso se suman las 69 de la API, entre ellas que el puesto del paso 4 coincide con la playlist y que juntar franjas suma las escuchas y promedia la predicción. También pasan ESLint y la comprobación de tipos de TypeScript. A mano, contra la API real, se comprobó que sin la casilla de 16 años no se sube nada, que la subida devuelve el token, que borrar con un token equivocado da 403 y que con el bueno se borra y el modelo se vuelve a entrenar. También se comprobó con un navegador automático, a 1440 px y en móvil (375 px), que una canción quitada desaparece de la playlist al volver a generarla y que el paso 4 recoge los filtros del paso 3.

**Limitaciones.**

- «Crear en mi Spotify» está cubierto por pruebas con Spotify simulado, pero falta probarlo con la app dada de alta y cuentas reales.
- Las personas cuyo historial se copió a la demo desde `data/raw` no tienen token: sus datos solo se pueden borrar o sustituir con el token de administración de la API.
- Es una demo local. No hay cuentas de usuario ni HTTPS, y la API y la web solo escuchan en `127.0.0.1`. Abrirla a otras personas exige lo que se recoge en el apartado 21.6.
- El gusto es el percentil de la tasa de no salto de cada persona. Para quien casi nunca salta, un solo salto baja mucho una canción: con 1 salto de cada 20 escuchas, a Daniel le queda en el percentil 6. Es una limitación del modelo (secciones 15 y 18), no de la web.
