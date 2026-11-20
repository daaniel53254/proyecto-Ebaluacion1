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

st.set_page_config(page_title="Playlist en grupo · Panel v1", page_icon="🎧", layout="wide")

# Paleta: un color fijo por persona (azul y naranja, validados para daltonismo) y una
# escala secuencial de un solo tono para las tasas.
COLORES = ["#2a78d6", "#eb6834", "#1baf7a"]
SECUENCIAL = "Blues"
GRIS = "#8a8984"


def plantilla(fig, alto: int = 340):
    fig.update_layout(
        height=alto, margin=dict(l=10, r=10, t=80, b=10),
        title=dict(y=0.98, yanchor="top", x=0, xanchor="left"),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0, title=None),
        hoverlabel=dict(font_size=13),
    )
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(gridcolor="rgba(128,128,128,0.15)")
    return fig


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


try:
    sv, o1, cand = silver(), objetivo1(), candidatas()
except FileNotFoundError as e:
    st.error(str(e))
    st.stop()

personas = sorted(o1["persona"].unique())
color_persona = {p: COLORES[i % len(COLORES)] for i, p in enumerate(personas)}

# ---------------------------------------------------------------------------- cabecera

st.title("Playlist perfecta para viajes en grupo")
st.caption(
    "Panel v1 · Entrega 2 · NPD Entertainment · CEBANC. Datos de `data/dataset/` "
    "(silver y gold del pipeline de Hive). Las personas aparecen con su seudónimo."
)

with st.sidebar:
    st.header("Filtros")
    sel_personas = st.multiselect("Personas", personas, default=personas)
    if not sel_personas:
        st.warning("Elige al menos una persona.")
        st.stop()
    anios = sorted(sv["anio"].unique())
    rango = st.select_slider("Años (hábitos)", options=anios, value=(anios[0], anios[-1]))
    st.divider()
    st.caption(
        "Lote 1 = hasta el 30/06/2025 (entrenamiento). Lote 2 = desde el 01/07/2025 (prueba). "
        "No salto = cualquier fin que no sea pasar de canción antes de 30 s."
    )

tab_hab, tab_cal, tab_ctx, tab_pl = st.tabs(
    ["Hábitos por persona", "Calidad de datos", "No salto por contexto", "Playlist de ejemplo"]
)

# ------------------------------------------------------------------------- 1. hábitos

with tab_hab:
    d = sv[sv["persona"].isin(sel_personas) & sv["anio"].between(*rango)]
    res = D.resumen_persona(d)

    for _, fila in res.iterrows():
        st.markdown(f"**{fila['persona']}** · {fila['desde']:%d/%m/%Y} – {fila['hasta']:%d/%m/%Y}")
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
        fig.update_traces(line_width=2, marker_size=7,
                          hovertemplate="%{x}:00 · %{y:.1%}<extra>%{fullData.name}</extra>")
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
        fig.update_traces(hovertemplate="%{x} · %{y:.1%}<extra>%{fullData.name}</extra>")
        fig.update_yaxes(tickformat=".0%")
        st.plotly_chart(plantilla(fig), width="stretch")

    col3, col4 = st.columns(2)
    with col3:
        p = D.reparto(d, "plataforma")
        fig = px.bar(p, y="persona", x="proporcion", color="plataforma", orientation="h",
                     color_discrete_sequence=["#2a78d6", "#eb6834", "#1baf7a", "#eda100", GRIS],
                     labels={"persona": "", "proporcion": "% de sus escuchas"},
                     title="Desde dónde escucha")
        fig.update_traces(marker_line_width=2, marker_line_color="rgba(255,255,255,0.9)",
                          hovertemplate="%{fullData.name} · %{x:.1%}<extra></extra>")
        fig.update_xaxes(tickformat=".0%")
        st.plotly_chart(plantilla(fig, 260), width="stretch")
    with col4:
        cl = D.reparto(d, "clase")
        fig = px.bar(cl, y="persona", x="proporcion", color="clase", orientation="h",
                     category_orders={"clase": D.CLASES},
                     color_discrete_sequence=["#2a78d6", "#1baf7a", "#eda100", "#6250d6", "#eb6834"],
                     labels={"persona": "", "proporcion": "% de sus escuchas"},
                     title="Cómo terminan las canciones")
        fig.update_traces(marker_line_width=2, marker_line_color="rgba(255,255,255,0.9)",
                          hovertemplate="%{fullData.name} · %{x:.1%}<extra></extra>")
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
            pr["etiqueta"] = pr["n"].astype(str) + " · " + pr["regla"]
            pr["texto"] = pr["bronze"].map(miles) + " → " + pr["silver"].map(miles) + " en silver"
            fig = px.bar(pr, y="etiqueta", x="bronze", orientation="h", text="texto",
                         custom_data=["silver"], color_discrete_sequence=["#eb6834"],
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
                st.success("✔ Los 8 problemas del plan de ensuciado quedan a 0 en silver.")
            else:
                st.error("✖ Algún problema sigue presente en silver: " +
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
                          hovertemplate="%{x} · %{customdata[1]}<br>Tasa %{y:.1%}"
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
        fig.update_traces(hovertemplate="%{y} · %{x}<br>Tasa %{z:.1%}<extra></extra>")
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

# ----------------------------------------------------------------- 4. playlist de ejemplo

with tab_pl:
    st.markdown(
        "Playlist para **todo el grupo** en un contexto, con una **regla sencilla** sobre "
        "`gold_candidatas.csv`. No es el modelo de IA (eso llega con el baseline de Ander): sirve para "
        "ver de punta a punta cómo se usará la tabla."
    )
    c = st.columns(5)
    franja = c[0].selectbox("Franja", list(D.FRANJAS), index=4, format_func=D.FRANJAS.get)
    tipo = c[1].selectbox("Tipo de día", list(D.TIPOS_DIA), index=1, format_func=D.TIPOS_DIA.get)
    minutos = c[2].slider("Duración del viaje (min)", 15, 240, 60, step=15)
    umbral = c[3].slider("Umbral de compatibilidad", 0.5, 1.3, 0.9, step=0.05,
                         help="Gusto mínimo normalizado (1 = lo habitual en esa persona).")
    max_art = c[4].number_input("Máx. canciones por artista", 1, 10, 2)
    solo_dato = st.checkbox("Solo canciones con tasa real en el lote 1 para alguna persona", value=True)

    cand_sel = cand[cand["persona"].isin(sel_personas)]
    lista, ev = D.playlist_ejemplo(cand_sel, franja, tipo, minutos, umbral, int(max_art), solo_dato)

    m = st.columns(3)
    m[0].metric("Canciones", ev["canciones"])
    m[1].metric("Minutos", f"{ev['minutos']:.0f}")
    m[2].metric("Pasan el umbral", miles(ev["pasan_umbral"]),
                help=f"De {miles(ev['candidatas_contexto'])} canciones candidatas en este contexto.")
    st.markdown("**Evaluación con el lote 2** (tasa real de no salto de las canciones elegidas "
                "que la persona escuchó al menos 5 veces en ese contexto después del 01/07/2025)")
    m = st.columns(len(ev["por_persona"]) + 1)
    for i, (p, e) in enumerate(ev["por_persona"].items()):
        delta = (None if pd.isna(e["tasa_lote2"])
                 else f"{(e['tasa_lote2'] - e['media_persona']) * 100:+.1f} p.p. vs su media".replace(".", ","))
        m[i].metric(p, pct(e["tasa_lote2"]), delta=delta,
                    help=f"Calculada con {e['con_lote2']} canciones de la lista. "
                         f"Su media en el lote 1 es {pct(e['media_persona'])}.")
        n = e["con_lote2"]
        m[i].caption(f"{n} {'canción' if n == 1 else 'canciones'} con dato")

    if lista.empty:
        st.warning("Ninguna canción pasa el umbral en este contexto. Bájalo o quita el filtro.")
    else:
        cols_g = [c for c in lista.columns if c.startswith("gusto_")]
        vista = lista[["cancion", "artista", "duracion_ms", "duracion_imputada", *cols_g, "puntuacion"]].copy()
        vista["duracion"] = (vista["duracion_ms"] / 60_000).map(
            lambda x: f"{int(x)}:{int(round((x % 1) * 60)):02d}")
        vista.loc[vista["duracion_imputada"], "duracion"] += " *"
        vista = vista.drop(columns=["duracion_ms", "duracion_imputada"])
        vista.insert(0, "#", range(1, len(vista) + 1))
        st.dataframe(
            vista, hide_index=True, width="stretch",
            column_config={
                "cancion": "Canción", "artista": "Artista", "duracion": "Duración",
                **{c: st.column_config.NumberColumn(c.replace("gusto_", "Gusto "), format="%.2f")
                   for c in cols_g},
                "puntuacion": st.column_config.NumberColumn("Mínimo (grupo)", format="%.2f"),
            },
        )
        st.caption("* Duración imputada con la mediana: nadie del grupo escuchó la canción entera.")

    with st.expander("Cómo se calcula"):
        st.markdown(
            """
1. Se toman las candidatas de la franja y el tipo de día elegidos.
2. **Gusto** de cada persona por cada canción: su tasa real de no salto en ese contexto en el
   lote 1 si la escuchó ahí al menos 5 veces; si no, su tasa habitual en ese contexto.
3. Se **normaliza** dividiendo por la tasa media de la persona (`per_tasa_media`): 1 = lo normal
   en ella. Sin esto, la persona que más salta decidiría siempre.
4. La canción vale el **mínimo** entre personas y entra si supera el umbral.
5. Se ordena, se limita el número de canciones por artista y se corta por la duración del viaje.
6. La tasa real del **lote 2** solo se usa para evaluar la lista, nunca para construirla.
"""
        )
