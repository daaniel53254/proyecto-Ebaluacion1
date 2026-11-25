// Token de cada persona: la API lo devuelve una sola vez al subir un historial nuevo y lo pide
// (cabecera X-Token) para borrarlo o sustituirlo. Se guarda en este navegador para no tener que pegarlo;
// si el almacenamiento no está disponible, simplemente no se recuerda.
const PREFIJO = "npd-token:";

export const leerToken = (persona: string): string | null => {
  try {
    return window.localStorage.getItem(PREFIJO + persona);
  } catch {
    return null;
  }
};

export const guardarToken = (persona: string, token: string): void => {
  try {
    window.localStorage.setItem(PREFIJO + persona, token);
  } catch {
    // Sin almacenamiento: la persona tendrá que pegar su token a mano.
  }
};

export const olvidarToken = (persona: string): void => {
  try {
    window.localStorage.removeItem(PREFIJO + persona);
  } catch {
    // Nada que olvidar.
  }
};
