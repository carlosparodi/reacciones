# Estudio de Reacciones — Versión móvil (sin App Store)

Versión para **iPhone y Android** que se comparte con **un link por WhatsApp** y se instala desde el navegador, sin App Store ni Google Play. Es independiente de la versión de escritorio (no necesita el PC encendido).

## Qué hace

Tiene las opciones del estudio de escritorio, ordenadas para el celular:

**Barra de la derecha del estudio** (lo que más se usa, a un toque)
- **Girar**: cámara frontal o trasera. **Espejo**: te ves como en un espejo.
- **Yo abajo / Yo arriba**: dónde sales tú y dónde el video.
- **Intro**: con ella, al grabar sales tú en pantalla completa para presentarte y el video arranca cuando tocas ▶. Sin ella, el video empieza apenas grabas.
- **Fondo**: pone un fondo detrás de ti recortando tu silueta (borroso, grafito, dorado, noche o una foto o video de tu galería).
- **Ajustes**: todo lo demás, en pestañas.

**Barra del video** (aparece al elegir un video): quitar el video, adelantar o retroceder, y en pausa el botón para salir tú solo o ver el video.

**Ajustes**
- *Grabación*: introducción, qué pasa al pausar (sales tú solo o el video se queda quieto), dónde sales tú, cámara, espejo y restablecer todo.
- *Encuadre*: tu espacio en pantalla dividida, zoom del video y de tu cámara, centrar, y cómo te ves cuando sales tú solo (cerca, normal o lejos).
- *Sonido*: volumen del video, volumen de tu voz, medidor del micrófono, evitar que el video se oiga doble y reducir ruido.
- *Video*: fondo detrás del video (llenar, negro, borroso o una imagen), tamaño del video y recortes de los lados y de arriba y abajo.
- *Tu fondo*: el mismo de la barra de la derecha.
- *Marca de agua*: texto (sombra, contorno o caja) o tu logo, con posición, tamaño y opacidad. Queda en todas tus grabaciones.
- *Subtítulos*: lo que dices aparece escrito y queda en la grabación (usa el reconocimiento de voz del celular).

Mientras ajustas, la vista previa se achica encima de la hoja para que veas el resultado entero. Los ajustes, tu logo y tus fondos quedan guardados en el celular.

Además:
- Con los dedos mueves y haces zoom en cada parte. Arrastrando la línea blanca cambias el tamaño. Con doble toque se restablece.
- Las grabaciones quedan guardadas en el celular. Con **Guardar / Compartir** las guardas en Fotos o las mandas a TikTok, Instagram o WhatsApp.
- La pantalla no se apaga mientras estás en el estudio.
- Después de abrirla una vez, funciona **sin internet** (el recorte de silueta y los subtítulos necesitan internet la primera vez o mientras los usas).

No trae lo que en el PC depende del computador: usar la cámara del celular (ya estás en él), descargar por link (yt-dlp), subtítulos con Whisper, el editor tipo CapCut ni la exportación a CapCut.

## 1. Dónde está publicada

**Link para compartir:** https://carlosparodi.github.io/reacciones/

Está en GitHub Pages, en el repositorio [carlosparodi/reacciones](https://github.com/carlosparodi/reacciones), que es público. Esta carpeta `version-movil` es ese mismo repositorio en el PC.

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
2. En `sw.js` sube el número de versión (`reacciones-v4` → `reacciones-v5`) y en `index.html` el número de `?v=` de `app.js` y `estilos.css`.
3. Súbela a GitHub desde esta carpeta:

```powershell
git add -A; git commit -m "Cambios"; git push
```

En 1 o 2 minutos GitHub Pages publica la versión nueva en el mismo link. Los celulares la toman la próxima vez que abran la app con internet. No hay que reinstalarla.

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
