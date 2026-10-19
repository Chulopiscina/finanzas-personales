#!/bin/bash
# Apple-native signing only. Never executes, imports or enables the banking workflow.
set -euo pipefail

mode=anyone
if [ "${1:-}" = "--personal" ]; then
  mode=people-who-know-me
  shift
fi
if [ "$#" -gt 2 ]; then
  echo "Uso: bash firmar-en-Mac.sh [--personal] [entrada.shortcut [salida.shortcut]]" >&2
  exit 1
fi

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Este diagnostico requiere macOS con Atajos. No se ha intentado ninguna firma." >&2
  exit 1
fi
directory=$(cd "$(dirname "$0")" && pwd)
input=${1:-"$directory/Finanzas-Bancarias_unsigned.shortcut"}
name="Finanzas Bancarias.shortcut"
if [ "$mode" != anyone ]; then
  name="Finanzas Bancarias_PERSONAL_NO_DISTRIBUIR.shortcut"
  echo "Firma PERSONAL: puede incluir tu informacion de contacto Apple. NO es un instalador publico."
fi
output=${2:-"$(dirname "$input")/$name"}
case "$input:$output" in
  *.shortcut:*.shortcut) ;;
  *) echo "Entrada y salida deben tener extension .shortcut." >&2; exit 1 ;;
esac
if [ ! -f "$input" ] || [ ! -f "$directory/Diagnostico-Minimo_unsigned.shortcut" ]; then
  echo "Falta el atajo o el control minimo. Descomprime el ZIP definitivo completo." >&2
  exit 1
fi
if [ -e "$output" ]; then
  echo "Ya existe la salida; no se sobrescribira. Conserva el archivo o elige otra salida." >&2
  exit 1
fi
umask 077
if [ -f "$directory/SHA256SUMS" ]; then
  if ! (cd "$directory" && /usr/bin/shasum -a 256 -c SHA256SUMS); then
    echo "El paquete no coincide con sus hashes. No se enviara nada a Apple." >&2
    exit 1
  fi
fi
diagnostics=$(mktemp -d "$directory/diagnostico-firma.XXXXXX")
report="$diagnostics/RESULTADO.txt"
work=$(mktemp -d "${TMPDIR:-/tmp}/finanzas-firma.XXXXXX")
sign_pid=""
cleanup() {
  if [ -n "$sign_pid" ] && kill -0 "$sign_pid" 2>/dev/null; then
    kill "$sign_pid" 2>/dev/null || true
    wait "$sign_pid" 2>/dev/null || true
  fi
  rm -f "$work/"*.shortcut "$work/"*.plist "$work/"*.log
  rmdir "$work" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM
log() { printf '%s\n' "$*" | tee -a "$report"; }
finish() { log "Informe sin credenciales: $report"; }
log "DIAGNOSTICO FINANZAS BANCARIAS"
log "macOS: $(/usr/bin/sw_vers -productVersion); arquitectura: $(uname -m); modo: $mode"
log "No se ejecutan acciones ni se leen llaveros, notificaciones, cuentas o variables de la web."
log "Se envia a Apple solamente el codigo generico para firmarlo."
if [ "$mode" != anyone ]; then log "PRIVACIDAD: la salida personal puede incluir informacion de contacto; no compartirla."; fi

binary="$work/Finanzas-Bancarias_unsigned.shortcut"
xml="$work/Finanzas-Bancarias-XML_unsigned.shortcut"
minimal="$work/Diagnostico-Minimo_unsigned.shortcut"
if ! /usr/bin/plutil -lint "$input" "$directory/Diagnostico-Minimo_unsigned.shortcut" \
  || ! /usr/bin/plutil -convert binary1 -o "$binary" "$input" \
  || ! /usr/bin/plutil -convert xml1 -o "$xml" "$binary" \
  || ! /usr/bin/plutil -convert binary1 -o "$minimal" "$directory/Diagnostico-Minimo_unsigned.shortcut" \
  || ! /usr/bin/plutil -lint "$binary" "$xml" "$minimal"; then
  log "RESULTADO=PLIST_INVALIDO. No se ha intentado firmar."
  finish; exit 2
fi
if [ "$(head -c 8 "$binary")" != bplist00 ] || [ "$(head -c 8 "$minimal")" != bplist00 ]; then
  log "RESULTADO=CONVERSION_BINARIA_INVALIDA. No se ha intentado firmar."
  finish; exit 2
fi
if ! /usr/bin/xmllint --nonet --noout "$xml"; then
  log "RESULTADO=XML_INVALIDO. No se ha intentado firmar."
  finish; exit 2
fi
log "XML y plist binario: validos. SHA-256 de entrada: $(/usr/bin/shasum -a 256 "$input" | cut -d ' ' -f 1)"
log "El control sintetico solo contiene Texto; no tiene red ni Storage. No es un archivo exportado por Apple."

# Do not persist raw Apple logs: they may contain account identifiers or private URLs.
error_kind() {
  if grep -Eqi 'correct format|format.*invalid|NSPropertyList' "$1"; then echo FORMATO
  elif grep -Eqi 'must be signed into iCloud|not signed into iCloud' "$1"; then echo SESION_ICLOUD
  elif grep -Eqi '([Ee]rror|[Cc]ode|HTTP(/[0-9.]+)?|[Ss]tatus)[^0-9-]{0,12}(500|502|503|504|-1001|-1005|-1009)([^0-9]|$)' "$1"; then echo RED_O_SERVICIO
  elif grep -Eqi 'permission denied|not permitted|access denied' "$1"; then echo PERMISOS_LOCALES
  elif grep -q 'TIEMPO_AGOTADO' "$1"; then echo TIEMPO_AGOTADO
  else echo NO_CLASIFICADO; fi
}
verified_file=""
last_kind=""
sign_checked() {
  local label=$1 source=$2 attempts=$3 attempt=1 signed raw status elapsed details
  while [ "$attempt" -le "$attempts" ]; do
    signed="$work/$label-$attempt.shortcut"
    raw="$work/$label-$attempt.log"
    /usr/bin/shortcuts sign --mode "$mode" --input "$source" --output "$signed" > "$raw" 2>&1 &
    sign_pid=$!
    elapsed=0
    while kill -0 "$sign_pid" 2>/dev/null; do
      if [ "$elapsed" -ge 90 ]; then
        kill "$sign_pid" 2>/dev/null || true
        sleep 1
        kill -KILL "$sign_pid" 2>/dev/null || true
        printf '\nTIEMPO_AGOTADO\n' >> "$raw"
        break
      fi
      sleep 1
      elapsed=$((elapsed + 1))
    done
    status=0
    wait "$sign_pid" || status=$?
    sign_pid=""
    if [ "$status" -eq 0 ] && [ -s "$signed" ] && [ "$(head -c 4 "$signed")" = AEA1 ] \
      && [ "$(wc -c < "$signed" | tr -d ' ')" -gt 8 ]; then
      log "$label intento $attempt: CLI_OK, contenedor AEA1 no vacio."
      verified_file=$signed
      return 0
    fi
    last_kind=$(error_kind "$raw")
    if [ "$status" -eq 0 ]; then last_kind=SALIDA_INVALIDA; fi
    details=$(grep -Eo 'NS[A-Za-z]+ErrorDomain|[Ee]rror[: =]+-?[0-9]+|Code[=: ]+-?[0-9]+' "$raw" | sort -u | tr '\n' ' ' || true)
    log "$label intento $attempt: $last_kind; codigo CLI $status; ${details:-sin codigo publico}."
    if [ "$last_kind" != RED_O_SERVICIO ] || [ "$attempt" -eq "$attempts" ]; then break; fi
    log "Un unico reintento tras 5 segundos; no se reinicia iCloud ni se cambian permisos."
    sleep 5
    attempt=$((attempt + 1))
  done
  return 1
}

minimal_ok=false
minimal_kind=""
if sign_checked MINIMO "$minimal" 2; then minimal_ok=true; else minimal_kind=$last_kind; fi
main_ok=false
if sign_checked UNIVERSAL_BINARIO "$binary" 2; then
  main_ok=true
elif [ "$minimal_ok" = true ] || [ "$last_kind" = FORMATO ]; then
  log "Comparando el mismo workflow en XML, sin cambiar acciones ni metadatos."
  if sign_checked UNIVERSAL_XML "$xml" 1; then main_ok=true; fi
fi
if [ "$main_ok" = true ]; then
  if ! (set -o noclobber; cat "$verified_file" > "$output"); then
    log "RESULTADO=SALIDA_NO_PUBLICADA. No se sobrescriben archivos existentes."
    finish; exit 3
  fi
  log "Archivo: $output"
  log "SHA-256: $(/usr/bin/shasum -a 256 "$output" | cut -d ' ' -f 1)"
  if [ "$mode" = anyone ]; then log "RESULTADO=FIRMA_PUBLICA_CLI_OK"; else log "RESULTADO=FIRMA_PERSONAL_NO_DISTRIBUIR"; fi
  if [ "$minimal_ok" != true ]; then log "Aviso: el control minimo fallo; el universal si se firmo. Posible intermitencia o rechazo del control."; fi
  log "Comprobados: exito del comando Apple, cabecera AEA1, tamano y hash. No es verificacion criptografica independiente."
  log "PENDIENTE: abrir el archivo en Atajos y aceptar la importacion sin ejecutarlo. La firma no prueba Storage/iOS 27 ni un iPhone real."
  finish; exit 0
fi
if [ "$minimal_ok" = true ]; then
  log "RESULTADO=FALLO_ESPECIFICO_UNIVERSAL"
  log "El control se firma y el universal no. Revisar el archivo, compatibilidad de macOS/iOS y el rechazo por contenido; no atribuirlo a una caida global."
elif [ "$minimal_kind" = RED_O_SERVICIO ] && [ "$last_kind" = RED_O_SERVICIO ]; then
  log "RESULTADO=FALLO_COMUN_RED_SERVICIO_SESION"
  log "Ambos archivos fallan con errores de red/servidor. Apunta al entorno de firma, red, sesion o servicio Apple; no demuestra por si solo una caida global."
else
  log "RESULTADO=DIAGNOSTICO_NO_CONCLUYENTE"
  log "El control minimo tampoco se firma ($minimal_kind). No puede culparse solo al workflow; revisar el informe y probar exportar Texto desde la app Atajos."
fi
log "No se ha creado un instalador final. No usar servicios de firma de terceros ni cerrar/resetear iCloud."
log "Alternativa opcional: --personal firma para tus dispositivos/contactos y puede incluir tus datos de contacto. Nunca distribuir como instalador publico."
finish
exit 4
