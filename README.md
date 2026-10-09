# Cantera G4 — Fútbol base Alicante

Web instalable (PWA) para **Segona FFCV Benjamí 1r. any Alacant · F.C. Grup 4 · Temporada 2026–2027**.

- Web: https://antoine80.github.io/cantera-g4/
- Datos: `data/league.json`, generados directamente en el despliegue.
- Sin base de datos, servidor propio, Python, contraseñas ni cifrado.
- **El sitio en GitHub Pages es público.** No incluyas datos personales, cookies ni HAR en el repositorio.

## Cómo se actualiza

El flujo `.github/workflows/publish.yml` obtiene un token temporal de la propia página pública de competiciones de FFCV y consulta las nueve jornadas en su API mediante la cabecera `X-FFCV-Page-Token`. Esta petición ha sido comprobada desde GitHub Actions, con **nueve jornadas, 36 encuentros y nueve descansos**.

El token se usa solo durante la sincronización, y **nunca se guarda en archivos o registros**. El importador verifica los códigos de temporada, competición y grupo, la fecha y los nueve participantes en cada jornada. Un fallo detiene el despliegue: se conserva la versión anterior de GitHub Pages.

Los datos nuevos se guardan solamente en el artefacto publicado de GitHub Pages. **No se generan commits de resultados** en el repositorio. No existe base de datos.

### Frecuencia

- Lunes a viernes: **07:20 y 17:20 UTC**.
- Sábados y domingos: **07:20, 10:20, 13:20, 16:20 y 19:20 UTC**.

GitHub puede retrasar ejecuciones programadas. Para forzar una actualización: [Actions → Publicar Cantera G4 → Run workflow](https://github.com/antoine80/cantera-g4/actions/workflows/publish.yml).

Los resultados se actualizan según lo que FFCV haya publicado en el momento de la consulta, no necesariamente en tiempo real. La clasificación mostrada es **provisional**, calculada con resultados conocidos, y puede no incluir ajustes oficiales.

### Lectura en navegador

Al abrir o pulsar **Actualizar**, la web descarga la última versión de `data/league.json`. Cuando el JSON remoto tenga fecha posterior al HAR importado localmente, se descarta esa copia anterior. Siguen disponibles los favoritos almacenados localmente.

## Importación HAR (opcional)

El botón **Importar HAR / JSON privado** es únicamente una alternativa manual si FFCV deja de ser accesible. Los HAR se leen en el navegador, no se envían a GitHub. No se debe publicar el HAR.

## Avisos y condiciones

Proyecto independiente, sin afiliación con FFCV. El usuario debe comprobar las condiciones de acceso y redistribución de los datos federativos antes de seguir ofreciendo una web pública. La ejecución programada puede requerir cambios si la Federación modifica su servicio.
