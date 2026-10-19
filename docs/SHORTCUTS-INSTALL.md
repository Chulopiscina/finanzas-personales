# Atajo universal: Finanzas Bancarias

## Instalador oficial disponible (19/10/2026)

El mantenedor ha confirmado firma e importación en macOS de **Finanzas Bancarias**, protocolo 2. Instalador compartido: [enlace oficial de iCloud](https://www.icloud.com/shortcuts/7a5a7b1112824f5fbe3de1e4aa89b06e). Se ha comprobado que Apple muestra ese nombre. La instalación, Storage y las notificaciones en un iPhone físico siguen pendientes de prueba.

La PWA usa ese enlace desde `shortcuts/universal-icloud.json`, sin claves compartidas. `SHORTCUTS_INSTALL_URL` permite sustituirlo solo por un enlace admitido; un valor no seguro bloquea el instalador. `universal-release.json` sigue sin declarar una copia firmada alojada en la web: no se ha recibido ni inventado un binario firmado o su SHA-256. [Fuente](../shortcuts/FinanzasBancarias.cherri), [archivo sin firmar de desarrollo](../public/shortcuts/Finanzas-Bancarias_unsigned.shortcut) y [script Mac de mantenimiento](../scripts/sign-universal-shortcut.sh).

## Preparar sin recibir notificaciones

- `SHORTCUTS_SETUP_ENABLED=true`: permite el asistente, vinculación de un uso, comprobación de conexión y gestión de bancos propios.
- `SHORTCUTS_ENABLED=false`: bloquea `/events` con 503 **antes de leer o guardar el payload**, aunque la credencial sea válida. No se crean notificaciones ni movimientos. El endpoint de comprobación informa `receiptEnabled=false` sin fingir recepción.
- Ambos `false`: desactiva la instalación/vinculación. La revocación de dispositivos propios continúa disponible con sesión.
- La PWA muestra «Recepción desactivada», oculta las credenciales manuales y no invita a activar la automatización tras vincular. Desconectar no borra datos financieros.

La credencial se canjea una sola vez dentro del Atajo y se guarda en su Storage, no en el enlace público ni en el navegador. Cada usuario/dispositivo recibe una credencial independiente; los bancos y cuentas se gestionan con sesión. El Atajo pide confirmar perfil, banco y cuenta antes de guardar la vinculación. Una copia del Atajo conserva una configuración activa: cambiar de perfil la sustituye; no compartir su almacenamiento.

El compilador y los SHA-256 de fuente/archivo se registran en `shortcuts/universal-build.json`. Para regenerar en desarrollo: `node scripts/build-universal-shortcut.mjs <ejecutable-compilado-en-checkout-Cherri-fijado>` y `python3 scripts/verify-shortcut.py public/shortcuts/Finanzas-Bancarias_unsigned.shortcut`. El usuario final no necesita compilador ni Go.

- Un único archivo/enlace para todos los bancos. No contiene bancos, reglas, importes, cuentas ni credenciales preconfiguradas. Añadir un banco requiere actualizar solo el catálogo/reglas del servidor, no el archivo ni su firma.
- BBVA, ING y Trade Republic tienen perfiles y pruebas **con mensajes sintéticos** en catalán, castellano e inglés. **Ninguno está certificado con notificaciones reales de iPhone**. El selector los etiqueta «En pruebas · sin validación en iPhone». No se atribuye a Apple un campo de notificación que no se haya comprobado.
- Hay enlace iCloud real y confirmación del mantenedor en Mac, no certificación iPhone. `shortcuts/universal-release.json` mantiene `appleSigned=false` para el archivo propio no recibido y `physicalIPhoneTested=false`. La PWA nunca ofrece el XML sin firmar como instalador.
- Se conserva el protocolo 1, las credenciales y el archivo BBVA anteriores. No se reutiliza un enlace BBVA para instalar el universal. Para instalar el nuevo, usar su propio nombre; no cambiar el nombre de un atajo antiguo.
- Esta entrega no añade tablas, columnas ni migraciones. El esquema universal ya fue preparado en producción; no repetir SQL ni migraciones anteriores. El build continúa ejecutando solo `prisma generate && next build`.

## Firma en Mac: mantenimiento, no instalación de usuarios

1. Llevar al Mac el nuevo paquete `Finanzas-Bancarias-firma-definitiva.zip` de `outputs/` y descomprimirlo en Descargas. Sustituye a los ZIP anteriores, que se conservan: incluye el universal con UUID corregidos, XML y binario, control mínimo, diagnóstico automático, instrucciones y hashes. No contiene tokens. [Diagnóstico 500/502 y límites](SHORTCUTS-SIGNING.md).
2. En un Mac con Atajos y sesión iCloud, abrir Terminal y ejecutar:

```bash
bash "$HOME/Downloads/Finanzas-Bancarias-firma-definitiva/firmar-en-Mac.sh"
```

El script valida el plist, convierte una copia temporal a binario y ejecuta **únicamente el comando oficial de firma de Apple**. No instala herramientas, no pide contraseñas bancarias, no modifica el original ni sobrescribe una salida existente. Apple recibe una copia del código genérico; no datos financieros. Si falta sesión iCloud, detenerse y abrir la sesión personalmente, sin facilitar credenciales al agente.

La copia temporal mantiene la extensión `.shortcut`. Se verifican XML, binario y hashes y se compara el universal con un control Texto. Solo se entrega una salida AEA1 si Apple termina correctamente; no es validación criptográfica independiente. Los UUID repetidos de los 13 bloques fueron corregidos sin quitar las 111 acciones. El mantenedor ha confirmado después firma e importación en Mac del instalador iCloud publicado; sigue pendiente probar ejecución/notificaciones en iPhone. El diagnóstico se conserva para futuras firmas, sin atribuir los antiguos errores 500/502 a una causa demostrada.

3. Entregar el resultado **Finanzas Bancarias.shortcut** al mantenedor. No hace falta construir acciones, copiar tokens ni crear un enlace iCloud. La firma y la prueba física son cosas distintas.

Si solo se utiliza el archivo sin el paquete, copiarlo a Descargas y ejecutar:

```bash
plutil -convert binary1 "$HOME/Downloads/Finanzas-Bancarias_unsigned.shortcut"
shortcuts sign --mode anyone --input "$HOME/Downloads/Finanzas-Bancarias_unsigned.shortcut" --output "$HOME/Downloads/Finanzas Bancarias.shortcut"
```

## Publicación de esta actualización

1. No ejecutar migraciones: no hay cambios de esquema en esta actualización.
2. En Vercel Production, configurar `SHORTCUTS_SETUP_ENABLED=true` y conservar `SHORTCUTS_ENABLED=false`. No cambiar conexiones, secretos ni contraseñas. El instalador iCloud ya está incluido en el código.
3. Ejecutar pruebas completas y `node scripts/test-local-db.mjs --web --setup-only`, que verifica instalación/vinculación y recepción bloqueada en una base local desechable, tanto en escritorio como en móvil.
4. Con la autorización recibida: commit/push a main y verificar Vercel Ready, login, dashboard y `/notifications`. Un POST a `/events` debe seguir devolviendo 503, sin crear datos.
5. Probar en iPhone instalación desde iCloud y vinculación desde la PWA, sin copiar tokens ni activar aún automatizaciones. La recepción solo se habilitará para la prueba física posterior explícitamente autorizada. No crear gastos de prueba en producción ni provocar pagos bancarios.

La workflow histórica `bbva-shortcut.yml` ahora compila el universal con Cherri fijado a `bcc0095754e2cc0baaeb4d93dae172b8153b4716` (GPL-2.0, compilador no distribuido). Solo publica release si `shortcuts sign` termina correctamente; un run verde con aviso de falta de iCloud **no** significa firma obtenida. No hay firma de terceros ni servicios de pago. Para una release realmente firmada por CI: `node scripts/install-signed-shortcut.mjs <sha-completo>` verifica ejecución, release, SHA-256 y formato, sin afirmar prueba física.

## Pasos inevitables de iOS 27

1. PWA > Notificaciones > **Conectar banco**. Elegir banco, cuenta propia activa EUR y consentimiento.
2. **Instalar atajo** una sola vez, aceptar Añadir atajo con nombre **Finanzas Bancarias** y regresar a la PWA. Si Safari descarga un archivo, abrirlo desde Descargas/Compartir > Atajos.
3. **Vincular este iPhone**: el código de cinco minutos se canjea automáticamente, sin copiar claves. Comprobar en la confirmación nativa el correo del perfil, banco y cuenta devueltos por el servidor; cancelar si no son los propios. Solo después se guarda la credencial. Aceptar los permisos de red de Apple. El regreso puede abrir Safari; volver al icono de la PWA si es necesario.
4. En Atajos > Finanzas Bancarias > Editar > Automatización > **Notificación**, seleccionar la app bancaria. Crear una automatización por app, todas sobre el mismo atajo, sin modificar sus acciones. Desde la web, **Gestionar bancos** permite añadir/cambiar/desvincular las cuentas sin reinstalar ni firmar de nuevo.
5. Esperar una notificación legítima de cada banco y comprobar su contenido en la bandeja, también con pantalla bloqueada. No provocar pagos. Verificar conexión solo acredita el bearer, no la automatización ni el contenido de BBVA/ING/Trade Republic.

No hay instalación silenciosa, permisos concedidos por la PWA ni lectura global del centro de notificaciones. La documentación de Apple describe el disparador, pero no garantiza el contenido concreto entregado por cada banco. Si no aparece el disparador o el aviso oculta datos, no inventarlos: conservar revisión y utilizar PDF/CSV.

## Enrutado y límites explícitos

- El servidor identifica bancos solo con identificadores explícitos: sourceApp/título exacto o etiqueta inicial `BBVA:`, `ING:`, `Trade Republic:` / primera línea con el nombre. No usa menciones a otros bancos en transferencias/comercios. Conflictos o banco no configurado quedan sin cuenta, no en la primera cuenta del usuario.
- El transporte nativo actual conserva el texto que entrega Get Text de Entrada del atajo. **No se asegura que iOS incluya la app en ese texto**. Si la omite, el aviso permanece en «Cuenta pendiente» y se asigna manualmente en la web. Añadir bancos al servidor no cambia esta limitación de Apple.
- Hay una cuenta prevista por banco y dispositivo. Si tienes varias cuentas del mismo banco, el aviso no acredita automáticamente cuál es: revisar antes de conciliar; no se analizan IBAN ni terminaciones de tarjetas inexistentes en el modelo.
- Cambiar un vínculo afecta a futuros avisos. No reasigna antiguos ni cambia su rawPayload. Los reintentos con el mismo eventId devuelven el registro original incluso después de cambiar el vínculo.
- Solo una cuenta propia activa EUR puede vincularse/asignarse. Los avisos sin cuenta no ofrecen candidatos hasta confirmarla. La asignación conserva el original, queda para revisión y no crea movimientos.
- El servidor interpreta signos, idioma, categorías y estados. Solo admite importe EUR inequívoco, no saldo ni varias cantidades. Extrae una fecha del texto solo si es ISO completa, única y etiquetada como fecha bancaria; no usa recepción, archivo, caducidad ni fechas ambiguas DD/MM vs MM/DD. Comercio/referencia solo desde campos o etiquetas explícitas.

## Seguridad y contabilidad

Códigos de un uso/256 bits/cinco minutos, hashes y canje transaccional; bearer de 256 bits/90 días guardado en Storage del atajo, nunca global ni en el archivo compartido. Storage se sincroniza bajo la cuenta Apple y no es Keychain: no compartirlo. Origen HTTPS fijo comprobado antes del canje, 16 KB de cuerpo y 120 solicitudes/hora por credencial. Gestión de bancos, asignación y lecturas requieren sesión y control de origen; el bearer solo envía avisos y comprueba conexión. Cambiar contraseña/rol y desconectar revoca sin borrar datos.

Todo entra en **BankNotification**, nunca en Transaction. No cambia dashboard, presupuesto, planificación, periodos ni ciclos de nómina. Retenciones/preautorizaciones/anulaciones nunca se convierten en gastos definitivos. Devoluciones son posibles devoluciones hasta contrastarlas con extracto, no reembolsos creados automáticamente. Conciliación solo con cuenta/usuario, importe firmado y fecha, identidad suficiente y coincidencia única en ambos sentidos. Sin identidad, mantener revisión. Repeticiones del banco con IDs de transporte distintos pueden repetir avisos, pero nunca crean gastos contables.

## Pruebas y fuentes

Regresión del paquete y simulaciones offline del shell (Python 3, biblioteca estándar): `python3 -m unittest discover -s tests -p 'shortcut_*_test.py'`. Regenerar el ZIP: `python3 scripts/package-shortcut-for-mac.py`; no sobrescribe paquetes anteriores ni un definitivo existente. Comprobar el binario: `python3 scripts/verify-shortcut.py outputs/Finanzas-Bancarias-firma-definitiva/Finanzas-Bancarias_unsigned.shortcut`. Las simulaciones no sustituyen la firma de Apple.

`npm run test:system` crea una base local nueva y prueba las 17 migraciones, cuentas ajenas, rutas/cookies/CSRF, legacy BBVA, varios bancos, mensajes en tres idiomas, duplicados, cambios de vínculo, retenciones, devoluciones, asignación manual y conciliación. Playwright usa escritorio y 390 px, no un iPhone físico. Los mensajes de banco y enlaces iCloud de ceros son fixtures, no ejemplos recibidos ni instaladores reales.

[Apple: notificaciones y Storage](https://developer.apple.com/videos/play/wwdc2026/310/), [disparadores](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios), [firma oficial](https://support.apple.com/en-au/guide/shortcuts-mac/apd455c82f02/mac), [compartir](https://support.apple.com/en-hk/guide/shortcuts/-apdf01f8c054/ios), [ejecución por URL](https://support.apple.com/en-ae/guide/shortcuts/apd624386f42/ios).
