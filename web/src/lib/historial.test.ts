import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

import { ErrorHistorial, normalizarPersona, prepararHistorial } from "@/lib/historial";

const zipCon = async (contenidos: Record<string, string>, nombre = "mis_datos.zip") => {
  const zip = new JSZip();
  for (const [ruta, texto] of Object.entries(contenidos)) zip.file(ruta, texto);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new File([bytes], nombre, { type: "application/zip" });
};

const jsonSuelto = (nombre: string) => new File(["[]"], nombre, { type: "application/json" });

const nombresDelZip = async (zip: Blob) => Object.keys((await JSZip.loadAsync(zip)).files);

describe("prepararHistorial", () => {
  it("del zip de Spotify se queda solo con los de audio", async () => {
    const zip = await zipCon({
      "Spotify Extended Streaming History/Streaming_History_Audio_2024.json": "[]",
      "Spotify Extended Streaming History/Streaming_History_Video_2024.json": "[]",
      "Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf": "x",
    });
    const r = await prepararHistorial([zip]);
    expect(r.incluidos).toEqual(["Streaming_History_Audio_2024.json"]);
    expect(r.descartados.map((d) => d.nombre)).toEqual([
      "Streaming_History_Video_2024.json",
      "ReadMeFirst_ExtendedStreamingHistory.pdf",
    ]);
    expect(r.descartados.every((d) => d.motivo === "no es del historial de audio")).toBe(true);
    expect(await nombresDelZip(r.zip)).toEqual(["Streaming_History_Audio_2024.json"]);
    expect(r.bytes).toBe(r.zip.size);
  });

  it("JSON sueltos: empaqueta los de audio y descarta el resto", async () => {
    const r = await prepararHistorial([
      jsonSuelto("Streaming_History_Audio_2023.json"),
      jsonSuelto("Streaming_History_Audio_2024_1.json"),
      jsonSuelto("Streaming_History_Video_2025.json"),
    ]);
    expect(r.incluidos).toEqual(["Streaming_History_Audio_2023.json", "Streaming_History_Audio_2024_1.json"]);
    expect(r.descartados.map((d) => d.nombre)).toEqual(["Streaming_History_Video_2025.json"]);
    expect(await nombresDelZip(r.zip)).toEqual(r.incluidos);
  });

  it("acepta mayúsculas en la extensión", async () => {
    const r = await prepararHistorial([jsonSuelto("Streaming_History_Audio_2024.JSON")]);
    expect(r.incluidos).toEqual(["Streaming_History_Audio_2024.JSON"]);
  });

  it("sin ficheros de audio lanza ErrorHistorial que manda al tutorial", async () => {
    const zip = await zipCon({ "a/Streaming_History_Video_2024.json": "[]" });
    await expect(prepararHistorial([zip])).rejects.toThrow(/Historial ampliado de reproducción/);
    await expect(prepararHistorial([zip])).rejects.toBeInstanceOf(ErrorHistorial);
  });

  it("rechaza mezclar zip y json", async () => {
    const zip = await zipCon({ "Streaming_History_Audio_2024.json": "[]" });
    await expect(prepararHistorial([zip, jsonSuelto("Streaming_History_Audio_2023.json")])).rejects.toThrow(
      "Sube un .zip o los ficheros .json, no los dos a la vez",
    );
  });

  it("rechaza más de un zip", async () => {
    const zip = await zipCon({ "Streaming_History_Audio_2024.json": "[]" });
    await expect(prepararHistorial([zip, zip])).rejects.toThrow("Sube un solo .zip");
  });

  it("zip roto", async () => {
    const roto = new File(["esto no es un zip"], "x.zip");
    await expect(prepararHistorial([roto])).rejects.toThrow("El fichero no es un .zip válido");
  });

  it("descarta nombres que la API rechazaría", async () => {
    const r = await prepararHistorial([
      jsonSuelto("Streaming_History_Audio_2024 (1).json"),
      jsonSuelto("Streaming_History_Audio_2024.json"),
    ]);
    expect(r.incluidos).toEqual(["Streaming_History_Audio_2024.json"]);
    expect(r.descartados.map((d) => d.nombre)).toEqual(["Streaming_History_Audio_2024 (1).json"]);
  });

  it("solo descomprime los ficheros que va a incluir", async () => {
    const zip = await zipCon({
      "a/Streaming_History_Audio_2024.json": "[]",
      "b/Streaming_History_Audio_2024.json": "[]",
      "a/Streaming_History_Video_2024.json": "[]",
      "__MACOSX/._x": "x",
    });
    const entrada = Object.values((await JSZip.loadAsync(await zip.arrayBuffer())).files)[0];
    if (!entrada) throw new Error("zip de prueba vacío");
    const espia = vi.spyOn(Object.getPrototypeOf(entrada), "async");
    const r = await prepararHistorial([zip]);
    expect(r.incluidos).toHaveLength(1);
    expect(r.descartados).toHaveLength(3);
    expect(espia).toHaveBeenCalledTimes(1);
    espia.mockRestore();
  });

  it("duplicados en carpetas distintas", async () => {
    const zip = await zipCon({
      "a/Streaming_History_Audio_2024.json": "[]",
      "b/Streaming_History_Audio_2024.json": "[]",
    });
    const r = await prepararHistorial([zip]);
    expect(r.incluidos).toEqual(["Streaming_History_Audio_2024.json"]);
    expect(r.descartados).toEqual([{ nombre: "Streaming_History_Audio_2024.json", motivo: "duplicado" }]);
  });
});

describe("normalizarPersona", () => {
  it.each([
    [" Ana López ", null],
    ["Ana Lopez", "ana_lopez"],
    ["Aitor", "aitor"],
    ["a", null],
    ["-ab", null],
    ["_ab", null],
    ["ana  lopez", "ana__lopez"],
    ["daniel-2", "daniel-2"],
  ])("normalizarPersona(%j)", (entrada, esperado) => {
    expect(normalizarPersona(entrada)).toBe(esperado);
  });
});
