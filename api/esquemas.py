"""Esquemas de entrada y salida (validación con Pydantic). Aparecen documentados en /docs."""
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

TipoDia = Literal["laborable", "fin_semana"]


class Contexto(BaseModel):
    """Contexto del viaje: franja de 4 horas y tipo de día, o una fecha y hora de la que se deducen."""
    franja: Optional[int] = Field(None, ge=0, le=5, description="0 = 0-4h, 1 = 4-8h, 2 = 8-12h, 3 = 12-16h, 4 = 16-20h, 5 = 20-24h")
    tipo_dia: Optional[TipoDia] = Field(None, description="laborable o fin_semana")
    fecha_hora: Optional[datetime] = Field(None, description="alternativa a franja y tipo_dia, p. ej. 2026-11-27T15:30 (hora de Madrid)")

    @model_validator(mode="after")
    def completar(self):
        if not self.necesita_contexto():
            self.franja = self.tipo_dia = self.fecha_hora = None
            return self
        if self.fecha_hora is not None:
            from api.servicio import contexto_de_fecha
            f, t = contexto_de_fecha(self.fecha_hora)
            if self.franja is None: self.franja = f
            if self.tipo_dia is None: self.tipo_dia = t
        if self.franja is None or self.tipo_dia is None:
            raise ValueError("indica «franja» y «tipo_dia», o «fecha_hora»")
        return self

    def necesita_contexto(self) -> bool:
        return True


class FilaPrediccion(Contexto):
    persona: str = Field(..., min_length=1, examples=["ander"])
    track_id: str = Field(..., min_length=1, max_length=64, description="id de Spotify de la canción (sin «spotify:track:»)",
                          examples=["51sjjUw21urcdtgD9HzJK6"])
    artista: Optional[str] = Field(None, description="obligatorio solo si la canción no está en el catálogo")
    album: Optional[str] = None
    cancion: Optional[str] = None


class PeticionPrediccion(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {"filas": [
        {"persona": "ander", "track_id": "51sjjUw21urcdtgD9HzJK6", "franja": 3, "tipo_dia": "laborable"},
        {"persona": "daniel", "track_id": "51sjjUw21urcdtgD9HzJK6", "fecha_hora": "2026-11-28T22:00"}]}})
    filas: list[FilaPrediccion] = Field(..., min_length=1, max_length=1000)


class Prediccion(BaseModel):
    persona: str
    track_id: str
    cancion: str
    artista: str
    franja: int
    franja_horas: str
    tipo_dia: str
    tasa_no_salto_prevista: float = Field(..., description="parte de las veces que se escucharía sin saltarla (0 a 1)")
    en_catalogo: bool
    escuchas_en_contexto: int = Field(..., description="escuchas reales de esa persona en ese contexto en el periodo del modelo")
    tasa_real_en_contexto: Optional[float]


class RespuestaPrediccion(BaseModel):
    modelo: str
    predicciones: list[Prediccion]


class PeticionPlaylist(Contexto):
    model_config = ConfigDict(json_schema_extra={"example": {
        "personas": ["ander", "daniel"], "fecha_hora": "2026-11-27T15:30", "n": 20}})
    personas: list[str] = Field(..., min_length=1, max_length=10, description="miembros del grupo que viajan")
    ignorar_horario: bool = Field(False, description="true: no filtra por franja ni tipo de día; usa todas las escuchas "
                                                     "y pone primero las canciones que conoce todo el grupo")
    historial: Literal["18_meses", "completo"] = Field(
        "18_meses", description="«18_meses»: candidatas y gustos de los últimos 18 meses (regla del notebook 03). "
                                "«completo»: todo el historial (canciones con 3 o más escuchas del grupo), gusto suavizado "
                                "entre lo real y lo previsto, y cada miembro conoce al menos un tercio de la lista")
    n: Optional[int] = Field(50, ge=1, le=500, description="número máximo de canciones")
    duracion_min: Optional[float] = Field(None, gt=0, le=1440, description="duración del viaje en minutos (corta la lista al llegar)")
    excluir_artistas: list[str] = Field(default_factory=list, max_length=50)

    def necesita_contexto(self) -> bool:
        return not self.ignorar_horario


class GustoMiembro(BaseModel):
    gusto: float
    percentil: float
    origen: Literal["real", "mezcla", "prevista"] = Field(..., description="real: 5 o más escuchas; mezcla: 1 a 4 "
                                                         "(solo con historial completo); prevista: sin escuchas o regla de 18 meses")


class CancionPlaylist(BaseModel):
    posicion: int
    track_id: str
    cancion: str
    artista: str
    duracion_s: Optional[int]
    gusto_grupo: float = Field(..., description="mínimo de los percentiles de los miembros")
    desempate: float = Field(..., description="media de los percentiles")
    conocida_por_todos: bool = Field(..., description="todos los miembros tienen gusto real (5 o más escuchas), sin predicción")
    miembros: dict[str, GustoMiembro]


class RespuestaPlaylist(BaseModel):
    personas: list[str]
    franja: Optional[int] = Field(..., description="null si se ignora el horario")
    franja_horas: str
    tipo_dia: str
    historial: Literal["18_meses", "completo"]
    regla: str
    n_canciones: int
    duracion_total_min: float
    canciones: list[CancionPlaylist]


class Error(BaseModel):
    error: str
    detalle: Optional[Any] = None
