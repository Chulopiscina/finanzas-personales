#!/bin/bash
# Run only on a Mac signed into iCloud. No bank or application credentials.
set -euo pipefail

if [ "$#" -gt 2 ]; then
  echo "Uso: bash firmar-en-Mac.sh [entrada.shortcut [salida.shortcut]]" >&2
  exit 1
fi

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Este comando requiere un Mac con Atajos y sesion iCloud." >&2
  exit 1
fi
directory=$(cd "$(dirname "$0")" && pwd)
input=${1:-"$directory/Finanzas-Bancarias_unsigned.shortcut"}
output=${2:-"$(dirname "$input")/Finanzas Bancarias.shortcut"}
if [ ! -f "$input" ]; then
  echo "Falta Finanzas-Bancarias_unsigned.shortcut junto al script." >&2
  exit 1
fi
case "$input" in
  *.shortcut) ;;
  *) echo "La entrada debe tener extension .shortcut." >&2; exit 1 ;;
esac
case "$output" in
  *.shortcut) ;;
  *) echo "La salida debe tener extension .shortcut." >&2; exit 1 ;;
esac
if [ -e "$output" ]; then
  echo "Ya existe el archivo de salida. No se sobrescribira: $output" >&2
  exit 1
fi
umask 077
work=$(mktemp -d "${TMPDIR:-/tmp}/finanzas-universal.XXXXXX")
# Keep a native binary plist and .shortcut extension throughout Apple's signing flow.
binary="$work/Finanzas-Bancarias_unsigned.shortcut"
signed="$work/Finanzas Bancarias.shortcut"
cleanup() {
  rm -f "$binary" "$signed"
  rmdir "$work"
}
trap cleanup EXIT
/usr/bin/plutil -lint "$input"
/usr/bin/plutil -convert binary1 -o "$binary" "$input"
/usr/bin/plutil -lint "$binary"
if [ "$(head -c 8 "$binary")" != "bplist00" ]; then
  echo "La conversion no ha generado un plist binario. No se intentara firmar." >&2
  exit 1
fi
echo "Se enviara el atajo a Apple para firmarlo; no se ejecutaran sus acciones."
if ! /usr/bin/shortcuts sign --mode anyone --input "$binary" --output "$signed"; then
  echo "La firma de Apple ha fallado. No se ha creado un archivo final ni modificado el original." >&2
  echo "Conserva el error anterior y comprueba la sesion iCloud en este Mac." >&2
  exit 1
fi
if [ ! -s "$signed" ] || [ "$(head -c 4 "$signed")" != "AEA1" ]; then
  echo "La salida no tiene la cabecera AEA1 esperada. No se distribuira." >&2
  exit 1
fi
# noclobber also protects against an output created while Apple is signing.
(set -o noclobber; cat "$signed" > "$output")
printf '\nArchivo firmado: %s\n' "$output"
/usr/bin/shasum -a 256 "$output"
echo "Devuelve este archivo firmado al mantenedor. No lo renombres al instalar: Finanzas Bancarias."
echo "La firma no acredita una prueba fisica de notificaciones de ningun banco."
