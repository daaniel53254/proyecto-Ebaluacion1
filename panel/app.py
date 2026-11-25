"""Panel v1 · Playlist perfecta para viajes en grupo (Entrega 2).

Lanzar desde la raíz del repositorio:
    streamlit run panel/app.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))
import datos as D  # noqa: E402
import tema as T  # noqa: E402

st.set_page_config(page_title="Playlist en grupo, panel v1", page_icon=str(T.LOGO), layout="wide")

# Estilo con la identidad de NPD Entertainment (Hallmark): tipografías, pestañas, foco visible y la animación
# de «cargando», que cambia la de Streamlit (gente haciendo deporte) por un ecualizador de cuatro barras con
# los colores del logo. Los colores de los controles salen de .streamlit/config.toml.
st.html(T.css())

# Paleta validada para daltonismo en fondo oscuro, empezando por el naranja y el verde del logo; un color fijo
# por persona, la referencia en gris y las tasas en una escala secuencial de naranja (ver panel/tema.py).
COLORES = T.COLORES_PERSONA
SECUENCIAL = T.SECUENCIAL
GRIS = T.APAGADO
plantilla = T.plantilla


def pct(x: float) -> str:
    return "—" if pd.isna(x) else f"{x:.1%}".replace(".", ",")


def miles(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


# ------------------------------------------------------------------------------ datos


@st.cache_data(show_spinner="Leyendo silver (spotify_reproducciones.csv)…")
def silver():
    return D.cargar_silver()


@st.cache_data(show_spinner="Leyendo gold.objetivo1…")
def objetivo1():
    return D.cargar_objetivo1()


@st.cache_data(show_spinner="Leyendo gold.candidatas…")
def candidatas():
    return D.cargar_candidatas()


@st.cache_data
def calidad(ruta: str):
    return D.calidad_desde_log(Path(ruta))


def marca(ruta: Path) -> float:
    """Fecha de modificación de un fichero, para recargar si se regenera (0 si no existe).
    Va como argumento normal (sin «_») para que Streamlit la tenga en cuenta en la caché."""
    return ruta.stat().st_mtime if ruta.exists() else 0.0


FUENTE_RIDGE = "Ridge (notebook 03)"
FUENTE_API = "GB absoluto (modelo de la API)"


@st.cache_resource(show_spinner="Cargando el modelo de la API…", max_entries=2)
def servicio_api(carpeta: str, version: float):
    return D.cargar_servicio(Path(carpeta))


@st.cache_data(show_spinner="Calculando los gustos del recomendador…", max_entries=4)
def gustos(fuente: str, version: float):
    if fuente == FUENTE_API:
        return D.gustos_desde_api(servicio_api(str(D.DIR_API_LOTE1), version), candidatas()), "api"
    g = D.cargar_gustos()
    return (g, "notebook") if g is not None else (D.gustos_aproximados(candidatas()), "aproximados")


@st.cache_data(show_spinner="Evaluando las dos listas en los 12 contextos…")
def resumen_contextos(fuente: str, version: float, personas_sel: tuple, n, minutos):
    g, _ = gustos(fuente, version)
    return D.evaluar_todos(g, candidatas(), list(personas_sel), n=n, minutos=minutos)


# Sin los CSV de data/dataset/ (hace falta el pipeline con Docker) el panel sigue funcionando con
# la pestaña «Playlist del grupo», que solo necesita el modelo de la API en api/datos/.
try:
    sv, o1, cand = silver(), objetivo1(), candidatas()
    falta_dataset = None
except FileNotFoundError as e:
    falta_dataset = str(e)
    if not D.hay_modelo_api(D.DIR_API_PRODUCCION):
        st.error(falta_dataset)
        st.stop()

if falta_dataset is None:
    personas = sorted(o1["persona"].unique())
else:
    personas = sorted(D.seudonimos(D.cargar_servicio(D.DIR_API_PRODUCCION).personas.index).values())
color_persona = {p: COLORES[i % len(COLORES)] for i, p in enumerate(personas)}

# ---------------------------------------------------------------------------- cabecera

st.title("Playlist perfecta para viajes en grupo")
st.caption(
    "Panel v1 de la Entrega 2 (NPD Entertainment, CEBANC). Datos de `data/dataset/` "
    "(silver y gold del pipeline de Hive). Las personas aparecen con su seudónimo."
)

with st.sidebar:
    st.image(str(T.LOGO), width=150)
    st.header("Filtros")
    sel_personas = st.multiselect("Personas", personas, default=personas)
    if not sel_personas:
        st.warning("Elige al menos una persona.")
        st.stop()
    if falta_dataset is None:
        anios = sorted(sv["anio"].unique())
        rango = st.select_slider("Años (hábitos)", options=anios, value=(anios[0], anios[-1]))
    st.divider()
    st.caption(
        "Lote 1 = hasta el 30/06/2025 (entrenamiento). Lote 2 = desde el 01/07/2025 (prueba). "
        "No salto = cualquier fin que no sea pasar de canción antes de 30 s."
    )

if falta_dataset is None:
    tab_hab, tab_cal, tab_ctx, tab_pl, tab_api = st.tabs(
        ["Hábitos por persona", "Calidad de datos", "No salto por contexto", "Recomendador",
         "Playlist del grupo"]
    )
else:
    st.warning("Faltan los CSV de `data/dataset/` (salen de `bash bigdata/pipeline.sh` o de Drive), así que "
               "solo se muestra la playlist con el modelo de la API.\n\n" + falta_dataset)
    (tab_api,) = st.tabs(["Playlist del grupo"])

if falta_dataset is None:
    # ------------------------------------------------------------------------- 1. hábitos

    with tab_hab:
        d = sv[sv["persona"].isin(sel_personas) & sv["anio"].between(*rango)]
        res = D.resumen_persona(d)

        for _, fila in res.iterrows():
            st.markdown(f"**{fila['persona']}**, del {fila['desde']:%d/%m/%Y} al {fila['hasta']:%d/%m/%Y}")
            c = st.columns(6)
            c[0].metric("Escuchas", miles(fila["escuchas"]))
            c[1].metric("Horas", miles(fila["horas"]))
            c[2].metric("Canciones", miles(fila["canciones"]))
            c[3].metric("Artistas", miles(fila["artistas"]))
            c[4].metric("Tasa de no salto", pct(fila["tasa_no_salto"]))
            c[5].metric("En aleatorio", pct(fila["pct_shuffle"]))

        col1, col2 = st.columns(2)
        with col1:
            h = D.reparto(d, "hora")
            fig = px.line(h, x="hora", y="proporcion", color="persona", markers=True,
                          color_discrete_map=color_persona,
                          labels={"hora": "Hora local", "proporcion": "% de sus escuchas"},
                          title="¿A qué hora escucha cada persona?")
            fig.update_traces(line_width=2, marker_size=8,
                              hovertemplate="%{x}:00<br>%{y:.1%}<extra>%{fullData.name}</extra>")
            fig.update_yaxes(tickformat=".0%")
            fig.update_xaxes(dtick=2)
            st.plotly_chart(plantilla(fig), width="stretch")
        with col2:
            s = D.reparto(d, "dia_semana")
            s["dia"] = s["dia_semana"].map(D.DIAS)
            fig = px.bar(s, x="dia", y="proporcion", color="persona", barmode="group",
                         color_discrete_map=color_persona,
                         category_orders={"dia": list(D.DIAS.values())},
                         labels={"dia": "", "proporcion": "% de sus escuchas"},
                         title="Reparto por día de la semana")
            fig.update_traces(hovertemplate="%{x}<br>%{y:.1%}<extra>%{fullData.name}</extra>")
            fig.update_yaxes(tickformat=".0%")
            st.plotly_chart(plantilla(fig), width="stretch")

        col3, col4 = st.columns(2)
        with col3:
            p = D.reparto(d, "plataforma")
            fig = px.bar(p, y="persona", x="proporcion", color="plataforma", orientation="h",
                         color_discrete_sequence=[*T.RAMPA[:4], GRIS],
                         labels={"persona": "", "proporcion": "% de sus escuchas"},
                         title="Desde dónde escucha")
            fig.update_traces(marker_line_width=2, marker_line_color=T.FONDO,
                              hovertemplate="%{fullData.name}<br>%{x:.1%}<extra></extra>")
            fig.update_xaxes(tickformat=".0%")
            st.plotly_chart(plantilla(fig, 260), width="stretch")
        with col4:
            cl = D.reparto(d, "clase")
            fig = px.bar(cl, y="persona", x="proporcion", color="clase", orientation="h",
                         category_orders={"clase": D.CLASES},
                         color_discrete_sequence=T.RAMPA,
                         labels={"persona": "", "proporcion": "% de sus escuchas"},
                         title="Cómo terminan las canciones")
            fig.update_traces(marker_line_width=2, marker_line_color=T.FONDO,
                              hovertemplate="%{fullData.name}<br>%{x:.1%}<extra></extra>")
            fig.update_xaxes(tickformat=".0%")
            st.plotly_chart(plantilla(fig, 260), width="stretch")

        st.subheader("Artistas más escuchados")
        cols = st.columns(len(sel_personas))
        for col, p in zip(cols, sel_personas):
            with col:
                st.markdown(f"**{p}**")
                t = D.top_artistas(d, p)
                st.dataframe(
                    t, hide_index=True, width="stretch",
                    column_config={
                        "artista": "Artista",
                        "escuchas": st.column_config.NumberColumn("Escuchas", format="%d"),
                        "horas": st.column_config.NumberColumn("Horas", format="%.1f"),
                        "tasa_no_salto": st.column_config.ProgressColumn(
                            "No salto", format="%.2f", min_value=0, max_value=1),
                    },
                )
        comunes = set(d.loc[d["persona"] == sel_personas[0], "track_id"])
        for p in sel_personas[1:]:
            comunes &= set(d.loc[d["persona"] == p, "track_id"])
        if len(sel_personas) > 1:
            st.info(f"Canciones que han escuchado todas las personas elegidas: **{miles(len(comunes))}**.")

    # ------------------------------------------------------------------- 2. calidad de datos

    with tab_cal:
        log = D.ultimo_log()
        if log is None:
            st.warning("No hay ningún log completo en docs/evidencias/. Ejecuta `bash bigdata/pipeline.sh`.")
        else:
            q = calidad(str(log))
            st.caption(f"Cifras sacadas de `docs/evidencias/{q['log']}` (última ejecución completa del pipeline).")

            c = st.columns(5)
            c[0].metric("Origen (preparado)", miles(q["filas_origen"] or 0))
            c[1].metric("Bronze (ensuciado)", miles(q["filas_bronze"] or 0),
                        delta=None if not (q["filas_bronze"] and q["filas_origen"])
                        else f"+{miles(q['filas_bronze'] - q['filas_origen'])} filas", delta_color="off")
            c[2].metric("Silver (limpio)", miles(q["filas_silver"] or 0),
                        delta=None if not (q["filas_silver"] and q["filas_bronze"])
                        else f"-{miles(q['filas_bronze'] - q['filas_silver'])} filas", delta_color="off")
            c[3].metric("Gold objetivo 1", miles(q["filas_gold"] or 0))
            c[4].metric("Gold candidatas", miles(q["filas_candidatas"] or 0))
            st.caption(
                "Bronze tiene más filas que el origen porque el ensuciado añade duplicados. Silver tiene menos "
                "porque se quitan pódcast, reproducciones de 0 ms o negativas, duplicados y filas sin metadatos."
            )

            pr = q["problemas"]
            if not pr.empty:
                pr["etiqueta"] = pr["n"].astype(str) + ". " + pr["regla"]
                pr["texto"] = pr["bronze"].map(miles) + " → " + pr["silver"].map(miles) + " en silver"
                fig = px.bar(pr, y="etiqueta", x="bronze", orientation="h", text="texto",
                             custom_data=["silver"], color_discrete_sequence=[T.RAMPA[0]],
                             labels={"etiqueta": "", "bronze": "Filas que incumplen la regla en bronze"},
                             title="Filas con cada problema: bronze → silver")
                fig.update_yaxes(autorange="reversed")
                fig.update_traces(textposition="outside", cliponaxis=False,
                                  hovertemplate="%{y}<br>Bronze: %{x:,} filas<br>Silver: "
                                                "%{customdata[0]:,} filas<extra></extra>")
                fig.update_xaxes(range=[0, pr["bronze"].max() * 1.3])
                st.plotly_chart(plantilla(fig, 420), width="stretch")

                todo_ok = (pr["silver"] == 0).all()
                if todo_ok:
                    st.success("Los 8 problemas del plan de ensuciado quedan a 0 en silver.")
                else:
                    st.error("Algún problema sigue presente en silver: " +
                             ", ".join(pr.loc[pr["silver"] > 0, "etiqueta"]))

                tabla = pr[["etiqueta", "bronze", "silver"]].rename(
                    columns={"etiqueta": "Problema", "bronze": "Bronze", "silver": "Silver"})
                if not q["ensuciado"].empty:
                    ens = q["ensuciado"].rename(columns={"pct": "% ensuciado", "tocadas": "Filas tocadas"})
                    tabla["n"] = pr["n"]
                    tabla = tabla.merge(ens[["n", "% ensuciado", "Filas tocadas"]], on="n", how="left") \
                                 .drop(columns="n")
                with st.expander("Ver la tabla"):
                    st.dataframe(tabla, hide_index=True, width="stretch")
                st.caption(
                    "La columna Bronze cuenta lo que detecta la regla de validación, no solo lo ensuciado: "
                    "por ejemplo, en el problema 5 también entran artistas reales escritos en mayúsculas."
                )

        st.subheader("Comprobaciones sobre silver")
        c = st.columns(4)
        c[0].metric("Filas", miles(len(sv)))
        c[1].metric("Nulos en canción o artista", miles(sv[["cancion", "artista"]].isna().any(axis=1).sum()))
        c[2].metric("ms_played ≤ 0", miles((sv["ms_played"] <= 0).sum()))
        c[3].metric("Clases distintas", sv["clase"].nunique())

    # --------------------------------------------------------------- 3. no salto por contexto

    with tab_ctx:
        col_a, col_b = st.columns([1, 3])
        with col_a:
            lote_txt = st.radio("Lote", ["Lote 1 (entrenamiento)", "Lote 2 (prueba)", "Los dos"])
            lote = {"Lote 1 (entrenamiento)": 1, "Lote 2 (prueba)": 2}.get(lote_txt)
            st.caption(
                "Tasa = escuchas que no son salto rápido ÷ escuchas, sumando todas las canciones del "
                "contexto. Contexto = franja de 4 horas × tipo de día (12 en total)."
            )
        t = D.tasa_por_contexto(o1[o1["persona"].isin(sel_personas)], lote)
        t["franja_txt"] = t["franja"].map(D.FRANJAS)
        t["tipo_txt"] = t["tipo_dia"].map(D.TIPOS_DIA)

        with col_b:
            fig = px.line(t, x="franja_txt", y="tasa_no_salto", color="persona", line_dash="tipo_txt",
                          markers=True, color_discrete_map=color_persona,
                          category_orders={"franja_txt": list(D.FRANJAS.values())},
                          custom_data=["n_escuchas", "tipo_txt"],
                          labels={"franja_txt": "Franja horaria", "tasa_no_salto": "Tasa de no salto",
                                  "tipo_txt": "Día"},
                          title="Tasa de no salto por franja y tipo de día")
            fig.update_traces(line_width=2, marker_size=8,
                              hovertemplate="%{x}<br>%{customdata[1]}<br>Tasa %{y:.1%}"
                                            "<br>%{customdata[0]:,} escuchas<extra>%{fullData.name}</extra>")
            fig.update_yaxes(tickformat=".0%")
            fig.update_xaxes(type="category")
            st.plotly_chart(plantilla(fig, 380), width="stretch")

        cols = st.columns(len(sel_personas))
        for col, p in zip(cols, sel_personas):
            tp = t[t["persona"] == p].pivot(index="tipo_txt", columns="franja_txt", values="tasa_no_salto")
            tp = tp.reindex(columns=list(D.FRANJAS.values()))
            fig = px.imshow(tp, text_auto=".0%", color_continuous_scale=SECUENCIAL, zmin=0, zmax=1,
                            aspect="auto", labels={"x": "Franja", "y": "", "color": "Tasa"},
                            title=p)
            fig.update_traces(hovertemplate="%{y}<br>%{x}<br>Tasa %{z:.1%}<extra></extra>")
            fig.update_xaxes(type="category")
            fig.update_layout(coloraxis_colorbar=dict(tickformat=".0%", len=0.8))
            col.plotly_chart(plantilla(fig, 230), width="stretch")

        with st.expander("Ver la tabla"):
            st.dataframe(
                t[["persona", "tipo_txt", "franja_txt", "n_escuchas", "n_no_salto", "tasa_no_salto"]]
                .rename(columns={"tipo_txt": "tipo de día", "franja_txt": "franja"}),
                hide_index=True, width="stretch",
            )
        st.caption(
            "Las dos personas tienen niveles muy distintos (una salta mucho más que la otra), por eso el "
            "recomendador normaliza el gusto de cada una antes de combinarlo."
        )

    # ------------------------------------------------------------------- 4. recomendador

    with tab_pl:
        opciones = [FUENTE_RIDGE] + ([FUENTE_API] if D.hay_modelo_api(D.DIR_API_LOTE1) else [])
        fuente_sel = st.radio(
            "Modelo que predice el gusto cuando no hay tasa real", opciones, horizontal=True,
            index=len(opciones) - 1,
            help="La regla del recomendador es la misma; solo cambia el modelo del objetivo 1.")
        if len(opciones) == 1:
            st.caption("Para comparar con el modelo de la API, genera su versión entrenada hasta el 30/06/2025: "
                       "`python -m api.preparar_datos --hasta 2025-07-01 --salida data/dataset/modelo_api_lote1`.")
        version = (marca(D.DIR_API_LOTE1 / "modelo.joblib") if fuente_sel == FUENTE_API
                   else marca(D.DIR_DATOS / D.ARCHIVO_GUSTOS))
        gu, fuente = gustos(fuente_sel, version)
        pct_real = (gu["origen"] == "real").mean()
        if fuente == "api":
            st.success(
                "Gustos con el modelo de producción del notebook 05 (GB absoluto, ventana de 18 meses) tal y como "
                "lo entrena la API, pero hasta el 30/06/2025, para que el lote 2 siga siendo prueba. "
                f"{pct(pct_real)} son tasas reales del lote 1; el resto, la predicción de ese modelo."
            )
        elif fuente == "notebook":
            st.success(
                f"Gustos del recomendador de `data/dataset/{D.ARCHIVO_GUSTOS}` (notebook 03). "
                f"{pct(pct_real)} son tasas reales del lote 1; el resto, la predicción del modelo del objetivo 1."
            )
        else:
            st.warning(
                f"Falta `data/dataset/{D.ARCHIVO_GUSTOS}`: ejecuta el notebook 03. Mientras tanto, las canciones "
                "sin dato real llevan la tasa habitual de la persona en ese contexto en lugar de la predicción "
                "del modelo, así que la lista del sistema es solo aproximada."
            )
        st.markdown(
            "**Sistema:** cada persona puntúa cada candidata con su percentil de gusto en ese contexto; "
            "la canción vale el **mínimo** del grupo y los empates se resuelven con la **media**. "
            "**Referencia:** las canciones más escuchadas por el grupo en el lote 1. "
            "Las dos se evalúan con lo que pasó de verdad en el lote 2."
        )

        c = st.columns(4)
        franja = c[0].selectbox("Franja", list(D.FRANJAS), index=4, format_func=D.FRANJAS.get)
        tipo = c[1].selectbox("Tipo de día", list(D.TIPOS_DIA), index=1, format_func=D.TIPOS_DIA.get)
        modo = c[2].radio("Cortar por", ["Número de canciones", "Duración del viaje"], horizontal=True)
        if modo == "Número de canciones":
            n_sel = c[3].select_slider("N", options=[10, 20, 30, 50, 75, 100], value=50)
            min_sel = None
        else:
            min_sel = c[3].slider("Minutos", 15, 300, 120, step=15)
            n_sel = None

        sistema, referencia = D.listas_contexto(gu, cand, franja, tipo, sel_personas)
        sistema, referencia = D.cortar(sistema, n_sel, min_sel), D.cortar(referencia, n_sel, min_sel)
        ev_s = D.evaluar(sistema, cand, franja, tipo, sel_personas).set_index("persona")
        ev_r = D.evaluar(referencia, cand, franja, tipo, sel_personas).set_index("persona")

        st.subheader(f"{D.FRANJAS[franja]} h, {D.TIPOS_DIA[tipo].lower()}: evaluación en el lote 2")
        filas = []
        for nombre, ev, lista in [("Sistema", ev_s, sistema), ("Más escuchadas", ev_r, referencia)]:
            for p in sel_personas:
                filas.append({"lista": nombre, "persona": p, "tasa_salto": ev.loc[p, "tasa_salto"],
                              "ndcg": ev.loc[p, "ndcg"], "evaluadas": ev.loc[p, "canciones_evaluadas"],
                              "canciones": len(lista)})
        comp = pd.DataFrame(filas)
        col_g, col_t = st.columns([3, 2])
        with col_g:
            fig = px.bar(comp, x="persona", y="tasa_salto", color="lista", barmode="group",
                         color_discrete_map={"Sistema": T.RAMPA[0], "Más escuchadas": GRIS},
                         custom_data=["evaluadas", "canciones"],
                         labels={"persona": "", "tasa_salto": "Tasa de salto real (lote 2)", "lista": ""},
                         title="Tasa de salto real en el lote 2 (menos es mejor)")
            fig.update_traces(hovertemplate="%{x}<br>Salto %{y:.1%}<br>%{customdata[0]} de "
                                            "%{customdata[1]} canciones evaluadas<extra>%{fullData.name}</extra>")
            fig.update_yaxes(tickformat=".0%", rangemode="tozero")
            st.plotly_chart(plantilla(fig, 320), width="stretch")
        with col_t:
            st.dataframe(
                comp.drop(columns="canciones"), hide_index=True, width="stretch",
                column_config={
                    "lista": "Lista", "persona": "Persona",
                    "tasa_salto": st.column_config.NumberColumn("Salto", format="percent"),
                    "ndcg": st.column_config.NumberColumn("NDCG", format="%.3f"),
                    "evaluadas": st.column_config.NumberColumn(
                        "Evaluadas", format="%d",
                        help="Canciones de la lista que la persona escuchó 5 o más veces en este contexto en el lote 2."),
                },
            )
            st.caption("Solo cuentan las canciones que la persona escuchó al menos 5 veces en este contexto en el "
                       "lote 2; con pocas canciones evaluadas, la cifra es orientativa.")

        st.subheader("Las dos listas")
        col_s, col_r = st.columns(2)
        cols_p = [f"percentil_{p}" for p in sel_personas]

        def duracion_txt(t: pd.DataFrame) -> pd.Series:
            m = t["duracion_ms"] / 60_000
            txt = m.map(lambda x: f"{int(x)}:{int(round((x % 1) * 60)):02d}")
            return txt.where(~t["duracion_imputada"], txt + " *")

        with col_s:
            st.markdown(f"**Sistema**: {len(sistema)} canciones, {sistema['duracion_ms'].sum() / 60_000:.0f} min")
            v = sistema[["cancion", "artista", *cols_p, "gusto_grupo", "desempate"]].copy()
            v.insert(2, "duracion", duracion_txt(sistema))
            v["previstos"] = sistema[[f"origen_{p}" for p in sel_personas]].ne("real").sum(axis=1)
            v.insert(0, "#", range(1, len(v) + 1))
            st.dataframe(
                v, hide_index=True, width="stretch", height=420,
                column_config={
                    "cancion": "Canción", "artista": "Artista", "duracion": "Dur.",
                    **{f"percentil_{p}": st.column_config.NumberColumn(
                        f"Pct. {p.replace('persona_', '')[:4]}", format="%.2f", help=f"Percentil de gusto de {p}")
                       for p in sel_personas},
                    "gusto_grupo": st.column_config.NumberColumn("Mínimo", format="%.2f"),
                    "desempate": st.column_config.NumberColumn("Media", format="%.2f"),
                    "previstos": st.column_config.NumberColumn(
                        "Previstos", format="%d", help="Personas cuyo gusto es previsto, no real."),
                },
            )
        with col_r:
            st.markdown(f"**Más escuchadas**: {len(referencia)} canciones, "
                        f"{referencia['duracion_ms'].sum() / 60_000:.0f} min")
            v = referencia[["cancion", "artista", "escuchas_grupo_l1"]].copy()
            v.insert(2, "duracion", duracion_txt(referencia))
            v.insert(0, "#", range(1, len(v) + 1))
            st.dataframe(
                v, hide_index=True, width="stretch", height=420,
                column_config={"cancion": "Canción", "artista": "Artista", "duracion": "Dur.",
                               "escuchas_grupo_l1": st.column_config.NumberColumn("Escuchas lote 1", format="%d")},
            )
        comunes = len(set(sistema["track_id"]) & set(referencia["track_id"]))
        st.caption(f"Canciones en las dos listas: {comunes}. * Duración imputada con la mediana: nadie del grupo "
                   "escuchó la canción entera.")

        st.subheader("Los 12 contextos")
        st.caption("Misma agregación que el notebook 03: media de cada persona sobre los contextos en los que "
                   "tiene canciones evaluadas y, después, media de las personas.")
        rc = resumen_contextos(fuente_sel, version, tuple(sel_personas), n_sel, min_sel)
        st.dataframe(
            rc.reset_index(), hide_index=True, width="stretch",
            column_config={
                "lista": "Lista",
                "tasa_salto": st.column_config.NumberColumn("Salto (media)", format="percent"),
                "ndcg": st.column_config.NumberColumn("NDCG (media)", format="%.3f"),
                "canciones_evaluadas": st.column_config.NumberColumn("Evaluadas por contexto", format="%.1f"),
                **{f"tasa_salto_{p}": st.column_config.NumberColumn(f"Salto {p}", format="percent")
                   for p in sel_personas},
            },
        )
        s, r = rc.loc["Sistema", "tasa_salto"], rc.loc["Más escuchadas", "tasa_salto"]
        if s < r:
            st.success(f"El sistema salta menos que la lista de las más escuchadas: {pct(s)} frente a {pct(r)}.")
        else:
            st.error(f"Hipótesis sin cumplir todavía: el sistema salta {pct(s)} frente a {pct(r)} de la lista "
                     "de las más escuchadas.")

# ------------------------------------------------------- 5. playlist con el modelo de la API

with tab_api:
    if not D.hay_modelo_api(D.DIR_API_PRODUCCION):
        st.warning("Falta el modelo de la API en `api/datos/`. Genéralo desde la raíz del repositorio con "
                   "`python -m api.preparar_datos` (la API lo hace sola cada vez que alguien sube o borra su zip).")
        st.stop()
    srv = servicio_api(str(D.DIR_API_PRODUCCION), marca(D.DIR_API_PRODUCCION / "modelo.joblib"))
    inf = srv.info

    seud_api = D.seudonimos(srv.personas.index)
    en_api = [p for p in sel_personas if p in seud_api.values()]
    fuera = [p for p in sel_personas if p not in seud_api.values()]
    if fuera:
        st.warning(f"No están en el modelo de la API: {', '.join(fuera)}.")
    if not en_api:
        st.stop()

    st.markdown("### Vuestra playlist para el viaje")
    st.caption("Lo que devolvería la API (`POST /objetivo2/playlist`) con el modelo de producción. Cada canción "
               "vale lo que le gusta **al que menos le gusta** del grupo, para que nadie tenga que saltarla.")

    with st.container(border=True):
        c = st.columns([1, 1, 1.2, 1.6])
        franja_a = c[0].selectbox("Franja", [None, *D.FRANJAS], index=0, key="api_franja",
                                  format_func=lambda f: "Sin importar" if f is None else f"{D.FRANJAS[f]} h",
                                  help="«Sin importar» usa todas las escuchas, sin mirar la hora ni el día, y pone "
                                       "primero las canciones que conoce todo el grupo.")
        sin_horario = franja_a is None
        tipo_a = c[1].selectbox("Día", list(D.TIPOS_DIA), index=1, format_func=D.TIPOS_DIA.get, key="api_tipo",
                                disabled=sin_horario)
        if sin_horario:
            tipo_a = None
        modo_a = c[2].segmented_control("Longitud", ["Canciones", "Minutos"], default="Canciones",
                                        key="api_modo") or "Canciones"
        if modo_a == "Canciones":
            n_a = c[3].select_slider("Número de canciones", options=[10, 20, 30, 50, 75, 100], value=30,
                                     key="api_n")
            min_a = None
        else:
            n_a, min_a = None, c[3].slider("Duración del viaje (min)", 15, 300, 120, step=15, key="api_min")
        hay_completo = getattr(srv, "recuentos_completo", None) is not None
        historial_a = st.segmented_control(
            "Historial", ["18_meses", "completo"], default="18_meses", key="api_historial",
            format_func={"18_meses": "Últimos 18 meses", "completo": "Todo el historial"}.get,
            disabled=not hay_completo,
            help="«Últimos 18 meses»: la regla de siempre. «Todo el historial»: también canciones antiguas (3 o más "
                 "escuchas del grupo), gusto que mezcla lo real con lo previsto y cada uno conoce al menos un tercio "
                 "de la lista." + ("" if hay_completo else " Para activarlo, vuelve a preparar los datos de la API.")
        ) or "18_meses"
        catalogo_a = srv.catalogo_completo if historial_a == "completo" else srv.catalogo
        excluir = st.multiselect("Quitar artistas", sorted(catalogo_a["artista"].dropna().unique()),
                                 key="api_excluir", placeholder="Ninguno")

    lista, cab = D.playlist_api(srv, en_api, franja_a, tipo_a, n=n_a, minutos=min_a, excluir_artistas=excluir,
                                historial=historial_a)
    if lista.empty:
        st.info("No queda ninguna canción con estos filtros.")
        st.stop()
    todos_real = lista[[f"origen_{p}" for p in en_api]].eq("real").all(axis=1).mean()
    minutos_tot = cab["duracion_total_min"]

    k = st.columns(4)
    k[0].metric("Canciones", cab["n_canciones"], border=True)
    k[1].metric("Duración", f"{int(minutos_tot // 60)} h {int(round(minutos_tot % 60)):02d} min", border=True)
    k[2].metric("Artistas distintos", lista["artista"].nunique(), border=True)
    k[3].metric("Con gusto real de todos", pct(todos_real), border=True,
                help="Canciones que todos los miembros han escuchado 5 o más veces "
                     + ("en total" if sin_horario else "en este contexto")
                     + ": su gusto es real, no una predicción del modelo.")

    v = lista[["posicion", "cancion", "artista"]].copy()
    v["duracion"] = lista["duracion_s"].map(lambda s: "—" if pd.isna(s) else f"{int(s) // 60}:{int(s) % 60:02d}")
    for p in en_api:
        v[f"percentil_{p}"] = lista[f"percentil_{p}"]
    v["gusto_grupo"] = lista["gusto_grupo"]
    v["spotify"] = "https://open.spotify.com/track/" + lista["track_id"]
    st.dataframe(
        v, hide_index=True, width="stretch", height=min(38 + 35 * len(v), 640),
        column_config={
            "posicion": st.column_config.NumberColumn("#", format="%d", width="small"),
            "cancion": st.column_config.TextColumn("Canción", width="medium"),
            "artista": st.column_config.TextColumn("Artista", width="medium"),
            "duracion": st.column_config.TextColumn("Dur.", width="small"),
            **{f"percentil_{p}": st.column_config.ProgressColumn(
                p.replace("persona_", "")[:4], min_value=0, max_value=1, format="%.2f", width="small",
                color=color_persona[p],
                help=f"Percentil de gusto de {p} (1 = de sus canciones favoritas en este contexto)")
               for p in en_api},
            "gusto_grupo": st.column_config.ProgressColumn(
                "Grupo", min_value=0, max_value=1, format="%.2f", width="small", color=T.TINTA,
                help="El mínimo de los percentiles: lo que le gusta al que menos le gusta."),
            "spotify": st.column_config.LinkColumn("", display_text="escuchar", width="small"),
        },
    )

    col_g1, col_g2 = st.columns(2, gap="large")
    with col_g1:
        media = pd.DataFrame({"persona": en_api,
                              "gusto": [lista[f"percentil_{p}"].mean() for p in en_api]})
        fig = px.bar(media, x="gusto", y="persona", orientation="h", color="persona",
                     color_discrete_map=color_persona, text="gusto",
                     title="Cuánto le gusta la playlist a cada uno", labels={"gusto": "", "persona": ""})
        fig.update_traces(texttemplate="%{x:.2f}", textposition="outside", showlegend=False,
                          hovertemplate="%{y}<br>Percentil medio %{x:.2f}<extra></extra>")
        fig.update_xaxes(range=[0, 1.12], showticklabels=False)
        fig.update_layout(bargap=0.55)
        st.plotly_chart(plantilla(fig, 110 + 32 * 8), width="stretch")
        st.caption("Percentil medio de las canciones de la lista para cada miembro (1 = sus favoritas en este "
                   "contexto). Si a alguien le sale cerca de 0,5, el modelo no distingue sus gustos.")
    with col_g2:
        art = lista["artista"].value_counts().head(8).sort_values()
        fig = px.bar(x=art.values, y=art.index, orientation="h", title="Artistas que más se repiten",
                     labels={"x": "Canciones", "y": ""})
        fig.update_traces(marker_color=COLORES[0], hovertemplate="%{y}: %{x} canciones<extra></extra>")
        fig.update_xaxes(dtick=1)
        st.plotly_chart(plantilla(fig, 110 + 32 * len(art)), width="stretch")

    with st.expander("Sobre el modelo"):
        m = st.columns(4)
        m[0].metric("Periodo de entrenamiento", f"{inf['periodo']['meses']} meses",
                    help=f"Del {inf['periodo']['desde']} al {inf['periodo']['hasta']}")
        m[1].metric("Filas de entrenamiento", miles(inf["filas_entrenamiento"]))
        m[2].metric("MAE de validación", f"{inf['cv_mae']:.3f}".replace(".", ","))
        m[3].metric("Canciones candidatas", miles(inf["canciones_catalogo"]))
        st.markdown(
            "GB absoluto (el modelo de producción del notebook 05) entrenado con los últimos 18 meses de todos los "
            "historiales. Gusto de cada miembro: su tasa real de no salto si tiene 5 o más escuchas de la canción "
            "en ese contexto y, si no, la predicción del modelo; se pasa a percentil dentro de la persona. "
            "Gusto del grupo = el mínimo; los empates se deshacen con la media. Con la franja «Sin importar» "
            "se suman las escuchas de todos los contextos, la predicción es la media de los 12 contextos y van "
            "primero las canciones con gusto real de todos los miembros."
        )
        st.caption(f"Entrenado del {inf['periodo']['desde']} al {inf['periodo']['hasta']}; preparado el "
                   f"{inf['preparado'].replace('T', ' a las ')} ({srv.origen_modelo}). Como el periodo incluye el "
                   "lote 2, esta lista no se evalúa con él: la comparación con las más escuchadas está en la "
                   "pestaña Recomendador. Para añadir a alguien, sube su zip a la API o copia sus JSON en "
                   "`data/raw/<nombre>/` y ejecuta `python -m api.preparar_datos`; el panel recarga el modelo solo.")
