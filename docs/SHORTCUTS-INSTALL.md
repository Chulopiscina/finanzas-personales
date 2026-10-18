# Instalación guiada BBVA

## Estado real de esta entrega

El asistente PWA, las API de vinculación y la verificación están implementados. **No existe todavía un enlace iCloud publicado por este proyecto ni un archivo Apple exportado y validado.** No se presenta una receta JSON como si fuera un `.shortcut` instalable. La instalación completa queda bloqueada hasta completar la publicación Apple descrita abajo.

La [receta mantenida](../shortcuts/bbva.recipe.json) define los tres caminos del atajo (vinculación, comprobación y notificación) y el contrato exacto con la aplicación. Preparar/exportar este atajo es una tarea única del mantenedor, no del usuario final. Windows no dispone de la app ni del comando oficial de firma de Apple. No se han utilizado servicios de terceros para firmar ni credenciales iCloud del usuario.

## Qué permite Apple (consulta 18/10/2026)

- [Compartir mediante iCloud o archivo](https://support.apple.com/en-hk/guide/shortcuts/-apdf01f8c054/ios): el destinatario debe aceptar la incorporación. No hay aquí un mecanismo documentado para instalar en silencio desde una PWA.
- [Ejecutar un atajo instalado desde una URL](https://support.apple.com/en-ae/guide/shortcuts/apd624386f42/ios): permite entregar texto a `shortcuts://run-shortcut`. No instala atajos ni concede permisos.
- [Disparador Notificación](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios): permite seleccionar app y filtros de Message/Subtitle/Title. Esto no acredita qué contenido BBVA proporciona al atajo.
- [Automatización iOS 27](https://support.apple.com/en-euro/guide/shortcuts/apdfbdbd7123/10.0/ios/27): se configura en el atajo, Editar > Automatización. La lista documentada de disparadores automáticos no enumera explícitamente Notificación; no se garantiza ejecución sin confirmación o bloqueada. Debe comprobarse en el iPhone.
- [Exportar/firmar en Mac](https://support.apple.com/en-au/guide/shortcuts-mac/apd455c82f02/mac): Apple valida las copias compartidas. No falsificar firmas, enlaces iCloud ni automatizaciones exportadas.

## Pasos reales del usuario final

1. **Elegir cuenta y autorizar**: PWA > Notificaciones > Conectar BBVA. Cuenta propia activa EUR y consentimiento para enviar el texto a su perfil.
2. **Añadir el atajo**: Instalar atajo > confirmar Añadir atajo en Apple > volver a la PWA > Ya lo he añadido.
3. **Vincular el iPhone**: tocar Vincular este iPhone. El atajo canjea el código, guarda su credencial sin copiarla y comprueba conexión; regresa a la PWA.
4. **Crear la automatización**: abrir Finanzas BBVA > Editar > Automatización > Notificación > BBVA, guardar y aceptar los permisos que solicite iOS.
5. **Verificar un aviso real**: comprobar recepción en la bandeja, también con pantalla bloqueada. No es necesario provocar compras o transferencias para la prueba; esperar una notificación legítima.

Son **cinco pasos de usuario, no cinco toques**. Apple puede añadir confirmaciones de apertura, red y archivos. La PWA no puede omitirlas. El asistente agrupa los primeros cuatro en cuatro pantallas y deja visible la recepción pendiente. El enlace de regreso puede abrir Safari, no la PWA instalada; en ese caso volver al icono de la PWA. No se presupone que Safari comparta su sesión con la PWA ni se transfieren cookies. Si falta el disparador o llega texto oculto/incompleto, informar de la limitación y mantener la importación PDF/CSV como alternativa.

## Publicación única del atajo por el mantenedor

1. En un Mac/iPhone de pruebas con Atajos, construir `Finanzas BBVA` siguiendo la receta. Antes de exportar, fijar **como literal** el origen HTTPS de ese entorno. No aceptar un destino arbitrario del parámetro `origin`: una web maliciosa también puede abrir un esquema `shortcuts://`.
2. Implementar un camino de vinculación para el JSON de entrada (`mode=pair`, `version=1`), otro de comprobación sin notificación, y otro para el texto REAL recibido. No adivinar nombres de propiedades del objeto Notification: inspeccionarlos en el iPhone y confirmar el mensaje entregado por BBVA antes de publicar.
3. Usar las acciones Diccionario/Obtener contenido de URL/Obtener valor del diccionario/Guardar archivo/Obtener archivo/Generar UUID/Abrir URL. Configuración en un archivo privado separado del atajo. **No incrustar tokens** en acciones ni preguntas de importación.
4. El archivo privado de configuración contiene una credencial de escritura provisional. Si se usa iCloud Drive se sincroniza bajo la cuenta Apple del propietario: no es Keychain ni almacenamiento inexpugnable. No compartir esa carpeta/archivo; quien lo lea puede enviar avisos provisionales hasta la revocación/caducidad, pero no leer datos ni operar dinero. No guardar configuración en una carpeta pública.
5. Probar instalación limpia en otro iPhone/cuenta de prueba: vinculación, archivo/permisos, comprobación y regreso a la PWA, notificación BBVA original, repetición con UUID estable, pantalla bloqueada, revocación, caducidad, retención/devolución y conciliación sin doble gasto. Probar un `origin` externo: debe detenerse ANTES de cualquier envío.
6. Exportar para **Anyone/Cualquiera** y compartir > Copiar enlace de iCloud desde Atajos. Si se utiliza Mac, la firma oficial es `shortcuts sign --mode anyone --input <exportado.shortcut> --output <firmado.shortcut>`; no contiene secretos. Apple recibe una copia para validar. No subir una copia que incluya configuración privada.
7. Registrar la versión exportada, hash SHA-256, versión iOS/dispositivo, campos reales recibidos y pruebas en el registro de lanzamiento. Publicar solo después de la verificación física.
8. Configurar **en un futuro despliegue autorizado** `SHORTCUTS_BBVA_INSTALL_URL=https://www.icloud.com/shortcuts/<id-real-de-32-hex>` y `SHORTCUTS_ENABLED=true`. El enlace de staging debe apuntar a un atajo fijado al origen de staging; el de producción a producción. No se ha configurado ninguna variable de producción en esta entrega.

Mientras no haya enlace real, el botón Conectar BBVA abre un estado explícito «El atajo todavía no está disponible». No hay enlaces falsos, instalación silenciosa, tokens manuales en el flujo guiado ni indicador ficticio «automatización activa». El modo avanzado anterior sigue disponible.

## Contrato de vinculación

1. `POST /api/integrations/shortcuts/pairing`, sesión web y mismo origen: `{accountId, consent:true}`. Devuelve `{id, expiresAt, setupUrl}` con un código aleatorio de 256 bits, cinco minutos y un solo uso. Diez altas/hora/usuario. Nueva alta invalida enlaces pendientes de la misma cuenta. El servidor solo almacena SHA-256 del código.
2. La PWA abre `setupUrl`, un esquema local de Atajos. Su texto es `{mode:"pair",version:1,origin,code}`. No contiene el bearer permanente, contraseñas, movimientos ni datos de Supabase. Es una capacidad temporal: no compartir enlaces/capturas y no enviarlos a analítica. No persistirla en localStorage, cookies ni URL HTTP. Se conserva solo en memoria del asistente.
3. El atajo compara `origin` con su origen literal, luego `POST /api/integrations/shortcuts/pairing/exchange` con JSON `{code}`. Sin cookie, no admite `userId`/`accountId` del cliente. Canje bloqueado por transacción; se crea una única credencial de 90 días, solo hash en BD. Devuelve `{pairingId, deviceId, token, expiresAt}` una vez, con `no-store`. Si la respuesta se pierde o no se guarda, iniciar una nueva vinculación, no recuperar el token desde el servidor.
4. El atajo guarda la credencial y llama `POST /api/integrations/shortcuts/check`, `Authorization: Bearer <token>`. Comparte el límite de 120 llamadas/hora con las recepciones. Actualiza `lastVerifiedAt`, **no crea BankNotification ni Transaction**. Regresa al origen fijo `/notifications?pairing=<id-no-secreto>`.
5. La PWA consulta `GET /api/integrations/shortcuts/pairing?id=...` con sesión del propietario: waiting/paired/verified/expired/canceled/disconnected, sin código ni token. Sondeo cada diez segundos solo con asistente visible, durante diez minutos como máximo. Regresar de Atajos actualiza el estado. Verificado solo significa que llegó una comprobación autenticada; recepción real se muestra por separado.
6. Desconectar revoca el bearer conservando notificaciones y movimientos. Cambios de contraseña/rol revocan también enlaces pendientes; el mismo bloqueo de usuario protege el canje concurrente.

La credencial final nunca viaja en enlaces, portapapeles o preguntas de importación. El código temporal sí aparece en el esquema local de Atajos; conlleva riesgo si se comparte durante sus cinco minutos. El enlace de instalación público es genérico y no incorpora códigos de usuario. No se asegura que iOS elimine del historial de su sistema un esquema que se haya abierto.

## Despliegue pendiente

Producción estaba en `73a5682`, con las quince migraciones registradas y Atajos desactivado. Este cambio añade una **decimosexta**: `20261018210000_shortcut_guided_pairing` (tabla ShortcutPairing con RLS y columna nullable ShortcutDevice.lastVerifiedAt). No toca tablas financieras. Solo se ha aplicado en bases locales de pruebas.

Antes de activar esta versión: backup y autorización, verificar 15/15 anteriores, revisar/aplicar la migración aditiva en `app`, comprobar columnas/PK/FK/índices/RLS/permisos, y mantener el historial Prisma sincronizado con `resolve --applied` SOLO si se ejecutó primero su SQL manualmente. No se incluyen migraciones en el build. No usar reset ni editar `_prisma_migrations`.

## Pruebas locales y límites

`npm run test:system` crea una BD local desechable, aplica dieciséis migraciones, prueba API/contabilidad y abre navegador escritorio/móvil. El enlace iCloud de ceros es **solo un fixture**, nunca se abre ni se ofrece en producción. Las pruebas simulan el canje del cliente nativo y no prueban instalación/automatización real de Apple. No sustituir la prueba física por un build correcto.
