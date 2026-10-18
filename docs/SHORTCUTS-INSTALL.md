# Instalación guiada BBVA

## Estado verificado el 18/10/2026

- Backend, vinculación sin copiar tokens, asistente PWA y desconexión implementados y probados en PostgreSQL aislado y navegadores escritorio/móvil.
- Supabase producción: **16/16 migraciones sincronizadas**. Se aplicó `20261018210000_shortcut_guided_pairing` en una transacción, se verificaron las nueve columnas de ShortcutPairing, cuatro índices, tres FK, RLS y permisos/bypass del rol postgres. Se registró con `prisma migrate resolve --applied`; status correcto. No se modificaron tablas financieras ni URLs/contraseñas de producción.
- Atajo **nativo generado**, no una receta: [fuente](../shortcuts/FinanzasBBVA.cherri), [archivo compilado sin firmar](../public/shortcuts/Finanzas-BBVA_unsigned.shortcut). Inspección: 95 acciones, cuatro POST al origen fijado, sin tokens ni preguntas de importación.
- **Firma Apple bloqueada**: el runner macOS estándar ejecutó el comando oficial y Apple respondió `In order to do this, you must be signed into iCloud.` [Ejecución real](https://github.com/Chulopiscina/finanzas-personales/actions/runs/39167233727/job/117792610502). No se solicitaron credenciales Apple ni se usó un servicio de firma externo.
- **No existe todavía un archivo firmado ni un enlace iCloud publicado. No se ha probado un iPhone físico.** El asistente no permite iniciar una instalación/vinculación guiada sin un instalador configurado. No presenta el XML sin firmar como instalable.
- Se configuró únicamente `SHORTCUTS_ENABLED=true` en Production de Vercel, sin cambiar conexiones/secretos. Tiene efecto en el siguiente despliegue; la instalación guiada sigue bloqueada por la ausencia de firma.
- Validación local final: 123 tests de backend, 10 pruebas Playwright escritorio/móvil, lint, typecheck, Prisma validate, build y vercel-build correctos; audit de dependencias de producción sin vulnerabilidades. Incluye revocación durante desactivación para que los tokens no reaparezcan al reactivar.

## Única dependencia del mantenedor: firma Apple

En un **Mac con sesión iCloud**, descargar [el archivo generado](https://finanzas-personales-lime-two.vercel.app/shortcuts/Finanzas-BBVA_unsigned.shortcut) en Descargas y ejecutar:

```bash
shortcuts sign --mode anyone --input "$HOME/Downloads/Finanzas-BBVA_unsigned.shortcut" --output "$HOME/Downloads/Finanzas BBVA.shortcut"
```

Entregar el archivo firmado al mantenedor de la web. Mantener el nombre **Finanzas BBVA** al importarlo, ya que es el usado por el enlace de vinculación. No hace falta construir/programar el atajo, copiar tokens, dar contraseñas Apple a Codex ni crear un enlace iCloud. También puede compartirse un enlace iCloud REAL desde Atajos después de importar la copia firmada.

Apple recibe únicamente el código genérico al firmarlo. No tiene datos financieros ni credenciales. El archivo sin firmar no se puede instalar directamente en un iPhone. No intentar omitir la validación de Apple.

## Publicación del archivo firmado

La PWA acepta un enlace iCloud válido mediante `SHORTCUTS_BBVA_INSTALL_URL`, o una copia firmada del mismo origen indicada en `shortcuts/bbva-release.json`. No habilitar un manifiesto firmado hasta recibir y comprobar el archivo real.

La CI compila con Cherri GPL-2.0, revisión fijada `bcc0095754e2cc0baaeb4d93dae172b8153b4716`; no distribuimos el compilador ni copiamos su implementación en la app. Usa el runner macOS estándar gratuito del repositorio público, sin servicios de pago. Si Apple exige sesión, publica un aviso de bloqueo y **no publica release**. Un run verde acredita la compilación; la firma solo existe cuando el paso Apple tiene `signed=true` y se ha publicado el asset.

Si una ejecución autorizada logra firmar en Apple, descargar y verificar su release con:

```bash
node scripts/install-signed-shortcut.mjs <sha-completo-del-commit-firmado>
```

El script exige ejecución de CI correcta, release publicada de este repositorio, checksum SHA-256 y contenedor AEA1. Incorpora binario y manifiesto sin afirmar una prueba física. Ejecutar después tests/build y publicar ambos. Para una firma manual, verificar su procedencia/instalación con Apple antes de incorporar el binario y su hash; no basta renombrar un plist.

## Pasos del usuario final (tras publicar la firma)

1. PWA > **Notificaciones > Conectar BBVA**: elegir cuenta propia activa EUR y autorizar envío de avisos provisionales.
2. **Instalar atajo**: aceptar Añadir atajo en Apple y regresar a la PWA. Si Safari descarga el archivo, abrirlo desde Descargas/Compartir > Atajos.
3. **Vincular este iPhone**: aceptar la confirmación. El atajo guarda su credencial individual en Storage del propio atajo (iOS 27), nunca global, en acciones exportadas o portapapeles. Regresa a la web; si abre Safari, volver al icono PWA.
4. En Atajos, **Finanzas BBVA > Editar > Automatización > Notificación > BBVA**. Guardar y aceptar permisos de red que solicite Apple. No hay instalación ni automatización silenciosa.
5. Esperar un aviso BBVA legítimo y comprobar la bandeja, desbloqueado y bloqueado. No provocar pagos para probar. Vinculación verificada no significa automatización verificada.

Son cinco pasos, no cinco toques. No hace falta programar acciones ni copiar claves. Falta confirmar en un iPhone real si BBVA entrega texto completo y cómo funciona bloqueado. Si no entrega contenido útil, se detiene o queda para revisión; PDF/CSV sigue disponible. La PWA no puede conceder los permisos de Apple.

## Seguridad y contrato

- Origen HTTPS fijado como literal en el atajo. Se rechaza un origen ajeno antes de enviar el código. No se aceptan destinos elegidos por enlaces externos.
- Código `pair_` aleatorio 256 bits, cinco minutos, un uso y hash en servidor; API normal exige sesión, consentimiento, propiedad de cuenta y mismo origen. Diez altas/hora/usuario y bloqueo transaccional contra canjes simultáneos.
- Canje nativo devuelve una sola vez credencial `fp_` de 256 bits y 90 días. Solo permite escribir avisos/comprobar conexión; nunca leer movimientos o ejecutar operaciones bancarias. Solo SHA-256 en BD. No compartir el almacenamiento del atajo; se sincroniza bajo la cuenta Apple y no es Keychain.
- `/check` devuelve `connection: verified` textual para evitar conversiones booleanas localizadas. No crea notificaciones ni movimientos y no finge la primera recepción real.
- El atajo manda texto original, sourceApp y un ID de transporte creado una vez. No inventa cuenta, comercio, fecha bancaria, importe o saldo. Sin fecha inequívoca no hay conciliación automática.
- El servidor conserva original y separa recepción de fecha bancaria. Idempotencia por credencial/eventId; mismo ID con otro contenido es 409. Recibir dos avisos bancarios con IDs distintos puede duplicar la bandeja, **nunca los gastos contables**.
- Todo entra en BankNotification, no en Transaction. Retenciones, preautorizaciones, anulaciones, devoluciones y datos ambiguos requieren revisión. Conciliación con extractos solo con identidad suficiente y coincidencia única en ambas direcciones, mismo propietario/cuenta/importe firmado.
- Desconectar/caducar/cambiar contraseña revoca credenciales; se conservan movimientos, documentos y avisos. Cambiar de vinculación local no revoca por sí solo otro dispositivo: desconectarlo en la web.
- `SHORTCUTS_ENABLED=false` sigue siendo el interruptor de emergencia. El build no ejecuta migraciones.

## Fuentes y límites

[Apple: notificaciones y Storage en iOS 27](https://developer.apple.com/videos/play/wwdc2026/310/), [firma oficial](https://support.apple.com/en-au/guide/shortcuts-mac/apd455c82f02/mac), [compartir archivos/iCloud](https://support.apple.com/en-hk/guide/shortcuts/-apdf01f8c054/ios), [ejecución por URL](https://support.apple.com/en-ae/guide/shortcuts/apd624386f42/ios).

`npm run test:system` usa una BD local nueva, pruebas HTTP y navegador 1600/390 px. Simula el cliente nativo: **no sustituye una instalación, permisos o notificación BBVA físicos**. El fixture iCloud de ceros solo aparece en pruebas y nunca se ofrece en producción.
