# Atajos de iPhone: bandeja bancaria provisional

## Entrega universal local: 19/10/2026

La siguiente firma debe hacerse sobre **Finanzas Bancarias**, no sobre el archivo BBVA antiguo. Instalación, paquete Mac, bancos/cuentas, limitaciones y migración 17 pendiente: [guía universal vigente](SHORTCUTS-INSTALL.md). BBVA, ING y Trade Republic tienen reglas probadas con mensajes sintéticos; ninguno se anuncia como verificado en un iPhone físico. No se ha hecho push ni cambiado producción en esta entrega. Los apartados siguientes describen el contrato anterior y la configuración avanzada que se conserva por compatibilidad.

## Asistente de instalación

La PWA incorpora **Conectar BBVA**, vinculación de un solo uso sin copiar tokens, comprobación y desconexión. El atajo nativo ya está generado; la firma oficial se intentó en macOS y Apple exige una sesión iCloud. Estado real, archivo y única acción del mantenedor: [SHORTCUTS-INSTALL.md](SHORTCUTS-INSTALL.md). Sin una firma/enlace real, el asistente no finge instalación. No hay instalación/automatización silenciosa.

Las **dieciséis migraciones están aplicadas y registradas en producción** (18/10/2026), incluida `20261018210000_shortcut_guided_pairing`, con RLS/permisos verificados y sin tocar tablas financieras. Las instrucciones manuales siguientes se conservan solo como configuración avanzada y contrato del importador; el flujo guiado no requiere copiar tokens.

## Capacidad verificada y límites

Consulta oficial realizada el 18/10/2026: la [guía de Apple para iOS 27](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios) documenta el disparador **Notification**, selección de app y filtros **Message / Subtitle / Title**. La [sesión de Apple WWDC26](https://developer.apple.com/videos/play/wwdc2026/310/) describe automatizaciones disparadas por notificaciones y tratamiento de su contenido.

Esto no prueba qué campos entrega cada banco a la entrada del atajo, ni garantiza ejecución bloqueada, notificaciones completas o identificadores de operación. No se ha probado un iPhone físico. Antes de automatizar, inspeccionar la entrada con una notificación de prueba sin datos sensibles. Si no aparece el disparador o no llega contenido utilizable, detenerse: no hay un lector genérico de notificaciones desde la web ni acceso a datos privados del banco. No usar contraseñas bancarias, APIs de pago ni servicios externos de IA/OCR.

## Activación y mantenimiento

1. No repetir migraciones anteriores: historial 16/16 sincronizado.
2. `SHORTCUTS_ENABLED=true` permite la bandeja provisional. `false` la desactiva sin borrar datos.
3. Publicar una firma Apple real antes de configurar el instalador. No presentar el archivo sin firmar como instalable.
4. Comprobar la primera notificación física por separado; verificación de credencial no prueba el disparador de iOS.

## Configurar el atajo (primero en staging)

1. Abrir **Notificaciones**, seleccionar una cuenta propia EUR y crear una credencial. Copiarla al atajo: solo se muestra una vez, caduca en 90 días y puede revocarse. Crear credenciales separadas para cuentas diferentes.
2. En Atajos, crear automatización **Notificación** para la app bancaria. Usar filtros apropiados de título/mensaje. Comprobar primero el contenido real de **Entrada del atajo** con Vista rápida; no asumir nombres ni propiedades que no aparezcan en el dispositivo.
3. Construir un diccionario JSON con `body` igual al texto recibido. Generar `eventId` (UUID) **una vez por ejecución**, antes de cualquier reintento. Reutilizarlo si se reintenta ese envío; no regenerarlo en cada intento. Apple no garantiza un ID estable para notificaciones repetidas por el banco.
4. Incluir `title`, `subtitle` y `sourceApp` solo si están disponibles. `occurredAt`, `merchant` y `bankReference` son opcionales: enviarlos solo si el banco los proporciona inequívocamente. Nunca sustituir fecha bancaria por fecha de recepción, ni importe por saldo. El servidor no admite importes elegidos por el atajo: los extrae conservadoramente del texto original.
5. Acción **Obtener contenido de URL**, POST a `https://<dominio>/api/integrations/shortcuts/events`, cuerpo JSON, cabeceras `Content-Type: application/json` y `Authorization: Bearer <credencial>`. No pasar credenciales en URL, capturas o logs. No usar credenciales de Supabase ni contraseña de la web.
6. Probar con el iPhone bloqueado/desbloqueado y notificaciones reales de cada banco. El comportamiento en segundo plano y permisos debe confirmarse en el dispositivo; no se entrega un fichero `.shortcut` con parámetros de entrada no comprobados.

Ejemplo **ficticio** de contrato (omitir campos opcionales ausentes):

```json
{
  "eventId": "uuid-generado-antes-de-reintentar",
  "body": "Has pagat 12,30 EUR a SUPERMERCAT",
  "sourceApp": "Banco de prueba",
  "occurredAt": "2026-06-19",
  "merchant": "SUPERMERCAT"
}
```

## Seguridad y comportamiento

- Tokens aleatorios de 256 bits, guardados solo como SHA-256; vinculación servidor a usuario/cuenta, caducidad/revocación y 120 solicitudes/hora por credencial con bloqueo transaccional. Cambiar contraseña o rol revoca credenciales cuando la integración está activa.
- Excepción de middleware únicamente para POST a ese webhook; autentica su propio bearer. Ninguna lectura ni gestión está disponible con ese token. El resto exige sesión y protección de origen. Cuerpo máximo 16 KB; textos limitados y escapados por React.
- Se conserva el texto y payload original, fecha de recepción separada de fecha bancaria opcional. Importes en Decimal/céntimos, solo EUR; varias cantidades, fecha ausente o dirección ambigua requieren revisión. No se inventan cuentas, saldos, objetivos ni gastos fijos.
- Todo entra en `BankNotification`, **nunca directamente en Transaction**. No altera saldo, ingresos, presupuesto, planificación ni ciclos. La etiqueta de categoría es una sugerencia, no una confirmación bancaria.
- Repetir `eventId` y contenido devuelve el mismo registro; reutilizarlo con otro contenido devuelve 409. Notificaciones reenviadas por el banco con UUID distintos pueden quedar duplicadas en la bandeja; no generan duplicados contables.
- Conciliación al recibir/importar: misma cuenta/usuario, importe firmado exacto y fecha a tres días, referencia bancaria coincidente o comercio normalizado exacto; debe haber una única coincidencia en ambos sentidos. Solo estados provisionales completos, nunca retenciones/anulaciones. Los casos ambiguos quedan para confirmación manual.
- Retención de gasolina 100 EUR y cargo definitivo 40 EUR: se mantienen separados hasta confirmar el vínculo manual. El vínculo no cambia el importe bancario. Liberaciones y devoluciones no crean automáticamente reembolsos ni nuevas operaciones.
- Conciliación revisa un máximo de 500 pendientes completos por cuenta en cada recepción/importación; los restantes siguen disponibles en la bandeja paginada y pueden conciliarse manualmente. No hay tareas ocultas en cada visita al dashboard.
- Descartar o quitar vínculo conserva el original y no borra movimientos. Borrar un extracto con movimientos deja sin vínculo las notificaciones, que se muestran para revisión.

## Prueba de aceptación antes de producción

1. Verificar login y que cada usuario solo ve sus credenciales/bandeja.
2. Enviar el JSON ficticio; comprobar respuesta 202 y una fila provisional, sin variación del dashboard.
3. Reenviar exactamente el mismo JSON: 200, misma fila. Con otro importe y mismo ID: 409.
4. Importar un extracto de prueba con una única coincidencia: una sola operación contable, notificación conciliada. Probar también el orden inverso.
5. Probar dos compras iguales, fecha ausente, dos importes/saldo, otra cuenta y divisa distinta: revisión, sin conciliación automática insegura.
6. Probar retención/anulación/devolución; confirmar manualmente el cargo definitivo y comprobar que el importe original del extracto permanece intacto.
7. Revocar la credencial: siguiente POST devuelve 401. Verificar caducidad, limitación y cambio de contraseña.
8. Confirmar en iPhone físico la entrada real de cada banco y ejecución en segundo plano. Sigue siendo un bloqueo de validación, no una garantía del backend.
