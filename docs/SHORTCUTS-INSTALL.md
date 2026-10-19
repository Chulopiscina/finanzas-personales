# Atajo universal: Finanzas Bancarias

## Estado de esta entrega local (19/10/2026)

El atajo definitivo para la siguiente firma es **Finanzas Bancarias**, protocolo 2. [Fuente](../shortcuts/FinanzasBancarias.cherri), [archivo nativo sin firmar](../public/shortcuts/Finanzas-Bancarias_unsigned.shortcut) y [script Mac](../scripts/sign-universal-shortcut.sh).

El compilador y los SHA-256 de fuente/archivo se registran en `shortcuts/universal-build.json`. Para regenerar en desarrollo: `node scripts/build-universal-shortcut.mjs <ejecutable-compilado-en-checkout-Cherri-fijado>` y `python3 scripts/verify-shortcut.py public/shortcuts/Finanzas-Bancarias_unsigned.shortcut`. El usuario final no necesita compilador ni Go.

- Un único archivo/enlace para todos los bancos. No contiene bancos, reglas, importes, cuentas ni credenciales preconfiguradas. Añadir un banco requiere actualizar solo el catálogo/reglas del servidor, no el archivo ni su firma.
- BBVA, ING y Trade Republic tienen perfiles y pruebas **con mensajes sintéticos** en catalán, castellano e inglés. **Ninguno está certificado con notificaciones reales de iPhone**. El selector los etiqueta «En pruebas · sin validación en iPhone». No se atribuye a Apple un campo de notificación que no se haya comprobado.
- No hay firma Apple ni enlace iCloud inventado. El manifiesto `shortcuts/universal-release.json` mantiene `appleSigned=false` y `physicalIPhoneTested=false`. La PWA no ofrece el XML sin firmar como instalador.
- Se conserva el protocolo 1, las credenciales y el archivo BBVA anteriores. No se reutiliza un enlace BBVA para instalar el universal. Para instalar el nuevo, usar su propio nombre; no cambiar el nombre de un atajo antiguo.
- **Sin push ni cambios en producción.** La migración 17 solo se aplica en bases locales desechables durante las pruebas. Según la comprobación de la entrega anterior, producción tiene 16/16, no 11/14.

## Acción exacta en un Mac

1. Llevar al Mac el nuevo paquete `Finanzas-Bancarias-para-firmar-corregido.zip` de `outputs/` y descomprimirlo en Descargas. Sustituye al ZIP anterior: contiene el mismo workflow universal, ahora como **plist binario real** (`bplist00`), script con finales LF, instrucciones y sumas SHA-256. No contiene tokens. El ZIP original se conserva sin modificar.
2. En un Mac con Atajos y sesión iCloud, abrir Terminal y ejecutar:

```bash
bash "$HOME/Downloads/Finanzas-Bancarias-para-firmar-corregido/firmar-en-Mac.sh"
```

El script valida el plist, convierte una copia temporal a binario y ejecuta **únicamente el comando oficial de firma de Apple**. No instala herramientas, no pide contraseñas bancarias, no modifica el original ni sobrescribe una salida existente. Apple recibe una copia del código genérico; no datos financieros. Si falta sesión iCloud, detenerse y abrir la sesión personalmente, sin facilitar credenciales al agente.

La copia temporal también mantiene la extensión `.shortcut`; el script anterior la perdía. Se comprueba la cabecera binaria antes de firmar y solo se entrega una salida no vacía con cabecera AEA1 si el comando de Apple termina correctamente. Esa cabecera por sí sola no verifica criptográficamente la firma. **La corrección de formato y las 111 acciones se han verificado en Windows; la firma, importación y ejecución de este paquete siguen pendientes de prueba real en macOS/iPhone.** No se afirma que el mensaje de formato del Mac tenga una única causa demostrada.

3. Entregar el resultado **Finanzas Bancarias.shortcut** al mantenedor. No hace falta construir acciones, copiar tokens ni crear un enlace iCloud. La firma y la prueba física son cosas distintas.

Si solo se utiliza el archivo sin el paquete, copiarlo a Descargas y ejecutar:

```bash
plutil -convert binary1 "$HOME/Downloads/Finanzas-Bancarias_unsigned.shortcut"
shortcuts sign --mode anyone --input "$HOME/Downloads/Finanzas-Bancarias_unsigned.shortcut" --output "$HOME/Downloads/Finanzas Bancarias.shortcut"
```

## Publicación posterior, todavía no autorizada

1. Revisar y aplicar **solo** `20261019100000_universal_shortcut_banks` tras autorización y backup. No repetir las 16 anteriores. Crea ShortcutBankBinding con RLS, añade campos de versión/banco y permite cuenta nula únicamente en la bandeja provisional. No modifica User, Account, Transaction, saldos ni extractos. No usar reset ni editar `_prisma_migrations`.
2. Si se ejecuta primero el SQL manualmente, verificar su estructura y después `prisma migrate resolve --applied 20261019100000_universal_shortcut_banks`. Si se aplica por Prisma, no ejecutar su SQL aparte. Nunca duplicar ambos caminos. El build sigue sin migraciones.
3. Incorporar y comprobar la procedencia de la copia firmada, guardar su hash en `shortcuts/universal-release.json` y el archivo en `public/shortcuts/Finanzas-Bancarias.shortcut`. El nombre de descarga debe ser **Finanzas Bancarias.shortcut**. Probar instalación limpia en iPhone con ese nombre antes de anunciar compatibilidad real. No considerar el prefijo AEA1 por sí solo prueba criptográfica de autenticidad.
4. Mantener `SHORTCUTS_ENABLED` como interruptor. Usar un solo instalador universal: archivo firmado del mismo origen o `SHORTCUTS_INSTALL_URL` con un enlace iCloud REAL. La antigua `SHORTCUTS_BBVA_INSTALL_URL` se conserva solo para el legado.
5. Solo con autorización: tests/build, commit/push y comprobar Vercel Ready, login, dashboard, movimientos y bandeja. El dominio del atajo está fijado a producción; no usar la copia productiva para enviar datos a staging.

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

Regresión del paquete (Python 3, solo biblioteca estándar): `python3 -m unittest discover -s tests -p shortcut_package_test.py`. Regenerar el ZIP conservando el original: `python3 scripts/package-shortcut-for-mac.py`; no sobrescribe un paquete corregido existente. Comprobar el binario: `python3 scripts/verify-shortcut.py outputs/Finanzas-Bancarias-para-firmar-corregido/Finanzas-Bancarias_unsigned.shortcut`. Estas pruebas no simulan ni sustituyen la firma de Apple.

`npm run test:system` crea una base local nueva y prueba las 17 migraciones, cuentas ajenas, rutas/cookies/CSRF, legacy BBVA, varios bancos, mensajes en tres idiomas, duplicados, cambios de vínculo, retenciones, devoluciones, asignación manual y conciliación. Playwright usa escritorio y 390 px, no un iPhone físico. Los mensajes de banco y enlaces iCloud de ceros son fixtures, no ejemplos recibidos ni instaladores reales.

[Apple: notificaciones y Storage](https://developer.apple.com/videos/play/wwdc2026/310/), [disparadores](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios), [firma oficial](https://support.apple.com/en-au/guide/shortcuts-mac/apd455c82f02/mac), [compartir](https://support.apple.com/en-hk/guide/shortcuts/-apdf01f8c054/ios), [ejecución por URL](https://support.apple.com/en-ae/guide/shortcuts/apd624386f42/ios).
