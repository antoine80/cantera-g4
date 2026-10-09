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
