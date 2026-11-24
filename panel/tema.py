"""Tema del panel: identidad de NPD Entertainment (logo en panel/img/npd_logo.png).

Único sitio con los colores y las fuentes en Python. Son los mismos valores que `panel/estilo.css`
(variables de :root) y `.streamlit/config.toml`; si cambias uno, cambia los tres.
Colores sacados del logo: negro de fondo, naranja de las barras, verde de la onda y blanco del nombre.
"""

from __future__ import annotations

from pathlib import Path

# ------------------------------------------------------------------------------ tokens

FONDO = "#040708"        # --color-paper (el negro del logo)
FONDO_2 = "#0d1112"      # --color-paper-2
FONDO_3 = "#161b1c"      # --color-paper-3
TINTA = "#f4f4f2"        # --color-ink (el blanco del nombre)
TINTA_2 = "#c9cccb"      # --color-ink-2
APAGADO = "#8f9594"      # --color-muted
LINEA = "#222829"        # --color-rule
LINEA_2 = "#3a4243"      # --color-rule-2
NARANJA = "#df4e32"      # --color-accent (barras del logo)
NARANJA_OSCURO = "#c8432a"  # --color-accent-deep (rellenos con texto blanco encima, contraste 4,8)
VERDE = "#6ca67d"        # --color-accent-2 (onda del logo)
TRANSPARENTE = "rgba(0,0,0,0)"

FUENTE_CUERPO = "Onest, ui-sans-serif, system-ui, sans-serif"
FUENTE_TITULOS = "Montserrat, ui-sans-serif, system-ui, sans-serif"

# Datos (skill dataviz): paleta categórica en orden fijo, nunca rotada. Empieza por el naranja y el verde
# del logo, ajustados a la banda de luminosidad del modo oscuro (OKLCH L 0,48-0,67, C >= 0,10), y sigue con
# azul, ámbar y ciruela. Validada con validate_palette.js --mode dark --surface #040708: pasa las seis
# comprobaciones; peor par para daltonismo (naranja-verde, deuteranopía) ΔE 9,9.
# La serie de referencia (las más escuchadas) va en APAGADO. Los colores de estado (st.success, st.error)
# son los de Streamlit y nunca se usan para series.
RAMPA = ["#d23f18", "#52ab69", "#3a84ca", "#b98a00", "#993f94"]
COLORES_PERSONA = RAMPA[:3]
# Secuencial: un solo tono (naranja), de oscuro (cerca del fondo) a claro, sin el escalón que se confunde
# con el fondo.
SECUENCIAL = ["#432621", "#6f3226", "#9c3d2b", "#c94830", "#e25d43",
              "#e77a64", "#ed9885", "#f2b5a7", "#f8d3c8"]

LOGO = Path(__file__).with_name("img") / "npd_logo.png"
CSS = Path(__file__).with_name("estilo.css")


def css() -> str:
    """La hoja de estilo, lista para `st.html`."""
    return f"<style>{CSS.read_text(encoding='utf-8')}</style>"


def plantilla(fig, alto: int = 340):
    """Aspecto común de los gráficos de Plotly (skill dataviz): fondo transparente, rejilla fina y continua,
    líneas de 2 px, puntos de 8 px o más con anillo de 2 px del color del fondo, barras con extremo
    redondeado de 4 px y 2 px de hueco del color del fondo entre barras; títulos con Montserrat y números
    con Onest."""
    titulo = fig.layout.title.text
    fig.update_layout(
        height=alto, margin=dict(l=10, r=10, t=80, b=10),
        paper_bgcolor=TRANSPARENTE, plot_bgcolor=TRANSPARENTE,
        font=dict(family=FUENTE_CUERPO, color=TINTA_2, size=13),
        title=dict(text=titulo or None, y=0.98, yanchor="top", x=0, xanchor="left",
                   font=dict(family=FUENTE_TITULOS, color=TINTA, size=17, weight=700)),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0, title=None,
                    font=dict(color=TINTA_2), bgcolor=TRANSPARENTE),
        hoverlabel=dict(font_size=13, font_family=FUENTE_CUERPO, bgcolor=FONDO_3,
                        bordercolor=LINEA_2, font_color=TINTA),
        barcornerradius=4,
    )
    fig.update_traces(marker_line_width=2, marker_line_color=FONDO, selector=dict(type="bar"))
    for t in fig.select_traces(selector=dict(type="scatter")):
        if t.mode and "markers" in t.mode:
            t.marker.size = max(t.marker.size or 8, 8)
            t.marker.line = dict(width=2, color=FONDO)
        if t.mode and "lines" in t.mode:
            t.line.width = 2
    fig.update_xaxes(showgrid=False, linecolor=LINEA, zerolinecolor=LINEA,
                     tickfont=dict(color=APAGADO), title_font=dict(color=APAGADO))
    fig.update_yaxes(gridcolor=LINEA, zerolinecolor=LINEA, linecolor=LINEA,
                     tickfont=dict(color=APAGADO), title_font=dict(color=APAGADO))
    return fig
