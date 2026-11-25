import { afterEach, describe, expect, it, vi } from "vitest";

import { borrarHistorial, obtenerHistoriales, obtenerSalud, pedirPlaylist, subirHistorial } from "@/lib/api";
import type { PeticionPlaylist } from "@/lib/tipos";

const mockFetch = (status: number, cuerpo: unknown) => {
  const respuesta = new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  const fetchFalso = vi.fn().mockResolvedValue(respuesta);
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
};

const PREPARACION_EN_CURSO = {
  estado: "en_curso",
  motivo: "subida de ana",
  inicio: "2026-11-24T10:00:00",
  fin: null,
  error: null,
  resumen: null,
};

const PLAYLIST_VACIA = {
  personas: ["ana", "luis"],
  franja: null,
  franja_horas: "sin importar",
  tipo_dia: "sin importar",
  regla: "cada canción vale lo que le gusta al que menos le gusta",
  n_canciones: 0,
  duracion_total_min: 0,
  canciones: [],
};

const llamadaDe = (fetchFalso: ReturnType<typeof vi.fn>) => {
  const [url, opciones] = fetchFalso.mock.calls[0] ?? [];
  return { url, opciones };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cliente de la API", () => {
  it("devuelve el JSON si la respuesta es 200", async () => {
    const fetchFalso = mockFetch(200, [{ persona: "ana", ficheros: 2, en_el_modelo: true }]);

    expect(await obtenerHistoriales()).toEqual([{ persona: "ana", ficheros: 2, en_el_modelo: true }]);
    expect(llamadaDe(fetchFalso).url).toBe("http://127.0.0.1:8000/historiales");
  });

  it("lanza ErrorApi con el mensaje de la API", async () => {
    mockFetch(422, { error: "Hace falta el consentimiento para usar el historial", detalle: null });

    await expect(
      subirHistorial({ persona: "ana", consentimiento: false, mayorDe16: true, zip: new Blob(), token: null }),
    ).rejects.toMatchObject({
      codigo: 422,
      message: "Hace falta el consentimiento para usar el historial",
    });
  });

  it("lanza ErrorApi si no hay conexión", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(obtenerSalud()).rejects.toMatchObject({
      codigo: 0,
      message: "No se puede conectar con la API",
    });
  });

  it("pedirPlaylist envía el cuerpo en JSON por POST", async () => {
    const fetchFalso = mockFetch(200, PLAYLIST_VACIA);
    const peticion: PeticionPlaylist = {
      personas: ["ana", "luis"],
      ignorar_horario: true,
      n: 30,
      duracion_min: null,
      excluir_artistas: ["Bad Bunny"],
    };

    await pedirPlaylist(peticion);

    const { url, opciones } = llamadaDe(fetchFalso);
    expect(url).toBe("http://127.0.0.1:8000/objetivo2/playlist");
    expect(opciones).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(String(opciones?.body))).toEqual(peticion);
  });

  it("subirHistorial envía persona, consentimiento, mayor_de_16 y el zip, sin X-Token", async () => {
    const fetchFalso = mockFetch(202, {
      historial: { persona: "ana", ficheros: 1, escuchas: 10, desde: "2024-01-01", hasta: "2024-02-01" },
      preparacion: PREPARACION_EN_CURSO,
    });

    await subirHistorial({ persona: "ana", consentimiento: true, mayorDe16: true, zip: new Blob(["zip"]), token: null });

    const { url, opciones } = llamadaDe(fetchFalso);
    expect(url).toBe("http://127.0.0.1:8000/historiales");
    expect(opciones?.method).toBe("POST");
    const formulario = opciones?.body;
    expect(formulario).toBeInstanceOf(FormData);
    if (!(formulario instanceof FormData)) return;
    expect(formulario.get("persona")).toBe("ana");
    expect(formulario.get("consentimiento")).toBe("true");
    expect(formulario.get("mayor_de_16")).toBe("true");
    expect(opciones?.headers).toBeUndefined();
    const archivo = formulario.get("archivo");
    expect(archivo).toBeInstanceOf(File);
    if (!(archivo instanceof File)) return;
    expect(archivo.name).toBe("historial.zip");
  });

  it("subirHistorial manda el token en X-Token al sustituir un historial", async () => {
    const fetchFalso = mockFetch(202, { historial: { persona: "ana", ficheros: 1, escuchas: 10, desde: "2024-01-01", hasta: "2024-02-01" }, preparacion: PREPARACION_EN_CURSO });

    await subirHistorial({ persona: "ana", consentimiento: true, mayorDe16: true, zip: new Blob(), token: "secreto" });

    expect(llamadaDe(fetchFalso).opciones?.headers).toEqual({ "X-Token": "secreto" });
  });

  it("subirHistorial devuelve el token de una persona nueva", async () => {
    mockFetch(202, { historial: { persona: "ana", ficheros: 1, escuchas: 10, desde: "2024-01-01", hasta: "2024-02-01" }, preparacion: PREPARACION_EN_CURSO, token: "nuevo" });

    const respuesta = await subirHistorial({ persona: "ana", consentimiento: true, mayorDe16: true, zip: new Blob(), token: null });

    expect(respuesta.token).toBe("nuevo");
  });

  it("borrarHistorial usa DELETE con el nombre codificado y el token en X-Token", async () => {
    const fetchFalso = mockFetch(202, { borrado: "ana", preparacion: PREPARACION_EN_CURSO });

    const preparacion = await borrarHistorial("ana", "secreto");

    const { url, opciones } = llamadaDe(fetchFalso);
    expect(url).toBe("http://127.0.0.1:8000/historiales/ana");
    expect(opciones?.method).toBe("DELETE");
    expect(opciones?.headers).toEqual({ "X-Token": "secreto" });
    expect(preparacion?.estado).toBe("en_curso");
  });

  it("borrarHistorial devuelve null si ya no queda nadie y el modelo se retira", async () => {
    mockFetch(202, { borrado: "ana", preparacion: "no quedan historiales: el modelo se ha retirado" });

    expect(await borrarHistorial("ana", "secreto")).toBeNull();
  });

  it("lanza ErrorApi si la respuesta no tiene la forma esperada", async () => {
    mockFetch(200, { otra: "cosa" });

    await expect(obtenerSalud()).rejects.toMatchObject({ codigo: 200, message: "La API devolvió una respuesta inesperada" });
  });

  it("usa un mensaje genérico si el error no trae el formato de la API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad Gateway", { status: 502 })));

    await expect(obtenerSalud()).rejects.toMatchObject({ codigo: 502, message: "La API respondió con un error (502)" });
  });
});
