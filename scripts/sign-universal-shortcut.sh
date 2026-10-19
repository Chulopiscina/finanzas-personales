#!/bin/bash
# Run only on a Mac signed into iCloud. No bank or application credentials.
set -eu

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
if [ -e "$output" ]; then
  echo "Ya existe el archivo de salida. No se sobrescribira: $output" >&2
  exit 1
fi
work=$(mktemp -t finanzas-universal)
trap 'rm -f "$work"' EXIT
/usr/bin/plutil -lint "$input"
/usr/bin/plutil -convert binary1 -o "$work" "$input"
/usr/bin/shortcuts sign --mode anyone --input "$work" --output "$output"
if [ "$(head -c 4 "$output")" != "AEA1" ]; then
  echo "Apple no ha generado un contenedor firmado valido. No lo distribuyas." >&2
  exit 1
fi
printf '\nArchivo firmado: %s\n' "$output"
/usr/bin/shasum -a 256 "$output"
echo "Devuelve este archivo firmado al mantenedor. No lo renombres al instalar: Finanzas Bancarias."
echo "La firma no acredita una prueba fisica de notificaciones de ningun banco."
