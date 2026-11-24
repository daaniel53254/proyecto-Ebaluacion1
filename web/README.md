# Web de NPD Entertainment: playlist para viajes en grupo

Next.js 15 (App Router, TypeScript estricto, Tailwind v4). Habla directamente con la API FastAPI.

```bash
npm --prefix web install
npm --prefix web run dev     # http://127.0.0.1:3000 (necesita la API en http://127.0.0.1:8000)
npm --prefix web test        # pruebas con Vitest
npm --prefix web run build
```

Lo más cómodo es `arrancar_web.bat` en la raíz, que levanta la API con los datos de demo y la web.

Variables (copiar `.env.example` a `.env.local`): `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`.
