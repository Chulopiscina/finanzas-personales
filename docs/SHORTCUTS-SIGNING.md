# Diagnóstico de firma de Finanzas Bancarias

## Hallazgo y límites

El ZIP anterior contenía un plist sintácticamente válido con un defecto estructural:
los 13 condicionales anónimos compartían `GroupingIdentifier` y sus 13 salidas
repetían `UUID`. La opción `--derive-uuids` del compilador fijado deriva esos IDs
del nombre vacío del bloque. Desactivada en la generación local y CI; el artefacto
regenerado tiene 111 acciones, 13 grupos y 44 salidas diferentes. Se han comprobado
referencias, anidación, rangos UTF-16 y equivalencia funcional con el archivo previo
(ignorando cambios de identidad UUID y el orden irrelevante de claves JSON).

No se han cambiado acciones, texto, API, Storage ni metadatos de versión. El cliente
sigue siendo `5037.0.17` (destino iOS 27); el mínimo `900` es el emitido por el compilador,
no una certificación de soporte de Storage en versiones antiguas de macOS/iOS.
La presencia del tipo Watch tampoco acredita funcionamiento en Apple Watch.

Este defecto puede afectar al procesamiento del workflow, pero **no demuestra la
causa exacta de los errores 500/502 comunicados**. No se dispone de su stack completo
ni de ejecución en macOS. No interpretar automáticamente un número mostrado bajo
NSURLErrorDomain como un estado HTTP confirmado. [Apple distingue los errores de
respuesta del sistema URL](https://developer.apple.com/documentation/foundation/nsurlerrorbadserverresponse-c.enum.case).

## Un comando en el Mac

Descomprimir `outputs/Finanzas-Bancarias-firma-definitiva.zip` en Descargas:

```bash
bash "$HOME/Downloads/Finanzas-Bancarias-firma-definitiva/firmar-en-Mac.sh"
```

No necesita Python, Node, Xcode, servicios externos ni contraseñas. Solo utiliza
utilidades incluidas en macOS. No ejecuta/importa el workflow ni toca la web.
Verifica hashes y plist/XML, convierte a binario, intenta la firma de un control
sintético de una acción Texto y la del universal. Máximo un reintento por error
transitorio y 90 segundos aproximados por intento. El XML equivalente es una
alternativa limitada si el control pasa o aparece un error de formato.

## Interpretación de RESULTADO.txt

| Resultado | Diagnóstico y siguiente paso |
| --- | --- |
| `FIRMA_PUBLICA_CLI_OK` | Apple CLI terminó correctamente y generó un contenedor AEA1 con hash. Abrirlo en Atajos y aceptar la importación **sin ejecutarlo**. No acredita todavía iPhone/Storage/notificaciones. |
| `FALLO_COMUN_RED_SERVICIO_SESION` | Ambos fallan por red/servidor: entorno de firma, red, sesión o servicio Apple, no evidencia de caída global. Reintentar más tarde o con otra red de confianza; no resetear iCloud. |
| `FALLO_ESPECIFICO_UNIVERSAL` | El control se firma, el universal no. Revisar rechazo por contenido/compatibilidad y remitir el informe; no atribuirlo a una caída general. |
| `DIAGNOSTICO_NO_CONCLUYENTE` | El control tampoco se firma. Al ser sintético, no excluye todas las causas de formato: probar la exportación de un nuevo atajo Texto creado desde la propia app > Archivo > Exportar > Cualquiera. |
| `PLIST_INVALIDO`, `XML_INVALIDO`, `CONVERSION_BINARIA_INVALIDA` | Fallo local antes de firmar. No distribuir ni subir nada. |
| `SALIDA_INVALIDA` en los intentos | El CLI no produjo un contenedor admisible; no se entrega un instalador final. |

El informe queda junto al script en `diagnostico-firma.XXXXXX/RESULTADO.txt`.
Contiene versión de macOS, modo, etapas, categorías de error, códigos y hashes.
Los mensajes brutos de Apple son temporales, con permisos privados, y se eliminan:
pueden contener identificadores de cuenta o URLs. No se recopila el llavero,
contenido de Atajos personales ni variables de entorno de la aplicación.

La comprobación de salida es éxito del comando oficial, cabecera, tamaño y hash;
**no** es una validación criptográfica independiente ni una prueba de importación.
El manifiesto público sigue sin firma y la integración no se activa.

## Alternativas oficiales

Opción explícita `--personal` en el mismo script: modo `people-who-know-me`, con
nombre `Finanzas Bancarias_PERSONAL_NO_DISTRIBUIR.shortcut`. Puede incluir datos de
contacto del firmante y tiene destinatarios restringidos: no enviarlo al mantenedor
ni utilizarlo para la PWA. No se utiliza como fallback automático del modo público.
Si se logra importar en el Mac, se puede intentar exportar desde la app para
«Cualquiera» cuando Apple responda. No hay garantías ni sustitución por firmas de
terceros. [Apple documenta ambos modos de firma](https://support.apple.com/en-au/guide/shortcuts-mac/apd455c82f02/mac)
y la [exportación desde la app](https://support.apple.com/en-euro/guide/shortcuts-mac/apdf01f8c054/mac).

## Pruebas locales, sin web

- `python3 -m unittest discover -s tests -p 'shortcut_*_test.py'`: estructura,
  conversión, empaquetado y simulaciones offline del control de flujo del shell.
- `python3 scripts/verify-shortcut.py public/shortcuts/Finanzas-Bancarias_unsigned.shortcut`.
- `npx vitest run tests/shortcut-native.test.ts` y `bash -n scripts/sign-universal-shortcut.sh`.
- `python3 scripts/package-shortcut-for-mac.py`: crea el nuevo ZIP sin sobrescribir
  paquetes anteriores; rechaza estructuras defectuosas. No regenera UUID al empaquetar.

Las simulaciones reemplazan comandos nativos solo en copias temporales de prueba;
no contactan con Apple ni validan su servicio, macOS, firma o importación reales.
