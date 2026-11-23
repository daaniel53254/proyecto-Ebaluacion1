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


def _marca_gustos() -> float:
    """Fecha de modificación del CSV del notebook 03, para recargarlo si Ander lo regenera."""
    ruta = D.DIR_DATOS / D.ARCHIVO_GUSTOS
    return ruta.stat().st_mtime if ruta.exists() else 0.0


@st.cache_data(show_spinner="Leyendo los gustos del recomendador…")
def gustos(_marca: float):
    g = D.cargar_gustos()
    return (g, "notebook") if g is not None else (D.gustos_aproximados(candidatas()), "aproximados")


@st.cache_data(show_spinner="Evaluando las dos listas en los 12 contextos…")
def resumen_contextos(_marca: float, personas_sel: tuple, n, minutos):
    g, _ = gustos(_marca)
    return D.evaluar_todos(g, candidatas(), list(personas_sel), n=n, minutos=minutos)


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
    ["Hábitos por persona", "Calidad de datos", "No salto por contexto", "Recomendador"]
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

# ------------------------------------------------------------------- 4. recomendador

with tab_pl:
    marca = _marca_gustos()
    gu, fuente = gustos(marca)
    pct_real = (gu["origen"] == "real").mean()
    if fuente == "notebook":
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

    st.subheader(f"{D.FRANJAS[franja]} · {D.TIPOS_DIA[tipo]}: evaluación en el lote 2")
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
                     color_discrete_map={"Sistema": "#2a78d6", "Más escuchadas": GRIS},
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
        st.markdown(f"**Sistema** · {len(sistema)} canciones · {sistema['duracion_ms'].sum() / 60_000:.0f} min")
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
        st.markdown(f"**Más escuchadas** · {len(referencia)} canciones · "
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
    rc = resumen_contextos(marca, tuple(sel_personas), n_sel, min_sel)
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
