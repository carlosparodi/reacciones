# Estudio de Reacciones — Versión móvil (sin App Store)

Versión para **iPhone y Android** que se comparte con **un link por WhatsApp** y se instala desde el navegador, sin App Store ni Google Play. Es independiente de la versión de escritorio (no necesita el PC encendido).

## Qué hace

- Eliges el video que vas a comentar desde la galería del celular.
- Te grabas con la cámara frontal (o la trasera) en vertical 9:16: el video va arriba y tú abajo.
- Al pausar apareces en pantalla completa, y cuando el video termina también, para cerrar con tu conclusión.
- Con los dedos mueves y haces zoom en cada parte. Arrastrando la línea del medio cambias el tamaño. Con doble toque se restablece.
- Las grabaciones quedan guardadas en el celular. Con **Guardar / Compartir** las guardas en Fotos o las mandas a TikTok, Instagram o WhatsApp.
- Después de abrirla una vez, funciona **sin internet**.

No trae lo que en el PC hacen yt-dlp, FFmpeg y Whisper: descargar por link, subtítulos automáticos, el editor tipo CapCut ni la exportación a CapCut.

## 1. Publicarla (una sola vez)

La app tiene que estar en internet con **https** (el iPhone no deja usar la cámara sin https). Las dos formas gratis:

**Netlify Drop (la más fácil)**
1. Entra a https://app.netlify.com/drop y crea una cuenta gratis.
2. Arrastra la carpeta **`version-movil`** completa a la página.
3. Te da un link tipo `https://nombre-raro.netlify.app`. En **Site configuration → Change site name** puedes ponerle uno más bonito.

**GitHub Pages** (si el proyecto ya está en GitHub)
1. En el repositorio: **Settings → Pages → Deploy from a branch**, rama `main`, carpeta `/ (root)`.
2. El link queda así: `https://TU-USUARIO.github.io/TU-REPO/version-movil/`.

## 2. Compartirla por WhatsApp

Manda el link. En el celular:

**iPhone**
1. Abre el link en **Safari**. Si WhatsApp lo abre en su propio navegador, toca **⋯ → Abrir en Safari**.
2. Toca **Compartir** (el cuadrado con la flecha ⬆︎) → **Añadir a pantalla de inicio** → **Añadir**.
3. Ábrela desde el ícono nuevo y permite la cámara y el micrófono.

**Android**
1. Abre el link en **Chrome**.
2. Toca **Instalar** en el aviso de la app (o **⋮ → Instalar app / Añadir a pantalla de inicio**).

La app misma muestra estas instrucciones arriba la primera vez.

## 3. Actualizarla

1. Cambia lo que quieras en esta carpeta.
2. En `sw.js` sube el número de versión (`reacciones-v2` → `reacciones-v3`).
3. Vuelve a publicarla igual que antes (en Netlify: **Deploys** → arrastra la carpeta otra vez).

Los celulares toman la versión nueva la próxima vez que abran la app con internet. No hay que reinstalarla.

## Probar en el PC

En la carpeta del proyecto:

```powershell
npx --yes http-server version-movil -p 8792 -c-1
```

Abre http://localhost:8792 en Chrome, con la vista de celular (F12 → ícono de celular).

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Las pantallas de la app. |
| `app.js` | Cámara, grabación, gestos y grabaciones guardadas. |
| `estilos.css` | El diseño. |
| `manifest.webmanifest` | Nombre, ícono y colores al instalarla. |
| `sw.js` | Guarda la app en el celular para que abra sin internet. |
| `iconos/` | Ícono de la pantalla de inicio. |

## Cosas a saber

- **Requisitos:** iPhone con iOS 15 o más nuevo; Android con Chrome actualizado.
- **Dónde quedan los videos:** dentro de la app, en el celular. Si borras la app de la pantalla de inicio (o los datos de Safari), **se borran las grabaciones**, así que guarda las que quieras conservar con **Guardar / Compartir → Guardar video**.
- **Permisos de cámara en iPhone:** si los negaste por error, ve a **Ajustes → Safari → Cámara** y **Micrófono → Permitir**.
- Tiene los mismos colores y letras que la versión de escritorio (grafito, dorado champán, Manrope e Instrument Serif). Las letras se guardan en el celular la primera vez que se abre con internet.
- La carpeta `movil/` sigue siendo la versión con Capacitor para App Store y Google Play. Esta carpeta no la usa ni la cambia.
