# Cantera G4

PWA de fútbol base: Benjamín 1.º año, Segona FFCV Alicante, F.C. grupo 4, temporada 2026-2027.

## Publicación
En Settings → Pages → Build and deployment, seleccionar **GitHub Actions**. En Actions → Publicar Cantera G4, ejecutar **Run workflow** si no se ejecuta automáticamente.

Dirección prevista: https://antoine80.github.io/cantera-g4/

## Datos y sincronización
Jornada 1 procedente de la respuesta JSON oficial aportada; jornada 9 parcial de capturas; jornadas 2 a 8 pendientes.
La clasificación local es provisional. No se interpreta un resultado sin disputar como 0-0.

La sincronización automática está desactivada por defecto. Antes de activarla, comprobar acceso al servidor y condiciones para reutilizar los datos FFCV. Para activarla, crear variable de repositorio **FFCV_SYNC_ENABLED=true** en Settings → Secrets and variables → Actions → Variables. La tarea consulta nueve jornadas, valida 36 encuentros y nueve descansos y evita publicar datos incompletos.

No se incluye el HAR original ni cookies, tokens o información personal de menores. Proyecto independiente, no afiliado a FFCV.

## Verificación sin Python ni conexiones externas

En cada cambio de la rama main, GitHub Actions ejecuta `node --test tests/*.test.mjs` antes de publicar. Son pruebas sin peticiones a FFCV, utilizando una muestra JSON de la jornada 1 **sin HAR, cookies ni tokens**. La web sigue mostrando datos parciales hasta completar la importación real. El sincronizador se ejecuta sin escritura con `node scripts/sync_ffcv.mjs` o con escritura explícita `node scripts/sync_ffcv.mjs --write`. La variable FFCV_SYNC_ENABLED sigue desactivada hasta confirmar el derecho de acceso automatizado y la correspondencia de estados finales.

## Importación privada desde un HAR (sin publicar datos en GitHub)

El proyecto incluye un control **Cargar calendario privado** que admite un JSON previamente depurado. El archivo se queda exclusivamente en el almacenamiento local del navegador (`localStorage`) y no se envía a GitHub ni a FFCV. El botón **Eliminar copia local** revierte a los datos públicos. La importación no equivale a actualización automática; el JSON representa la fecha de la captura y puede quedar desactualizado. La caché del sitio continúa siendo pública pero **no incluye** el calendario privado.
