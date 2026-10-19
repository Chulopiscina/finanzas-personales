"""Repackage the original workflow without changing its actions or metadata."""
import argparse
import hashlib
import json
import plistlib
import stat
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from shortcut_structure import validate_workflow


ROOT = Path(__file__).resolve().parent.parent
NAME = "Finanzas-Bancarias_unsigned.shortcut"
FOLDER = "Finanzas-Bancarias-firma-definitiva"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def binary_workflow(original):
    workflow, report = validate_workflow(original)
    binary = plistlib.dumps(workflow, fmt=plistlib.FMT_BINARY, sort_keys=False)
    restored = plistlib.loads(binary)
    # Compare canonical typed plists, not only action counts or Python equality.
    if plistlib.dumps(restored) != plistlib.dumps(workflow):
        raise ValueError("La conversion ha alterado el workflow")
    xml = plistlib.dumps(workflow, fmt=plistlib.FMT_XML, sort_keys=False)
    ET.fromstring(xml)
    if plistlib.dumps(plistlib.loads(xml)) != plistlib.dumps(workflow):
        raise ValueError("La conversion XML ha alterado el workflow")
    return binary, report["actionCount"]


def package(source, output_root):
    if zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            entries = [i for i in archive.infolist() if Path(i.filename).name == NAME]
            if len(entries) != 1:
                raise ValueError("El ZIP debe contener exactamente un atajo bancario")
            original = archive.read(entries[0])
    else:
        original = source.read_bytes()
    binary, count = binary_workflow(original)
    workflow, report = validate_workflow(binary)
    if count != 111 or report["controlBlockCount"] != 13:
        raise ValueError("El universal debe conservar 111 acciones y 13 bloques")
    minimal_source = (ROOT / "shortcuts/DiagnosticoFirma.plist").read_bytes()
    minimal, minimal_count = binary_workflow(minimal_source)
    minimal_workflow, minimal_report = validate_workflow(minimal)
    if minimal_count != 1 or minimal_workflow["WFWorkflowActions"][0]["WFWorkflowActionIdentifier"] != "is.workflow.actions.gettext":
        raise ValueError("El control minimo debe contener solo Texto")
    script = (ROOT / "scripts/sign-universal-shortcut.sh").read_bytes()
    script = script.replace(b"\r\n", b"\n")
    if not script.startswith(b"#!/bin/bash\n") or b"\r" in script:
        raise ValueError("El script debe ser UTF-8 sin BOM y usar LF")
    readme = f"""# Finanzas Bancarias: firma y diagnostico en Mac

Descomprime el ZIP en Descargas del Mac y ejecuta este unico comando en Terminal:

```bash
bash "$HOME/Downloads/{FOLDER}/firmar-en-Mac.sh"
```

Requiere macOS con Atajos e iCloud. No requiere Python, Node, compiladores ni
herramientas adicionales. No cambia iCloud ni ejecuta los atajos. No necesita
contrasenas, tokens o acceso a datos bancarios. Si lo descomprimes en otro lugar,
arrastra firmar-en-Mac.sh a Terminal despues de escribir `bash `.

Resultado: `Finanzas Bancarias.shortcut`, junto al script. El archivo de salida
no se sobrescribe. No instales el archivo `_unsigned` ni lo confundas con uno firmado.

## Defecto estructural corregido

La opcion --derive-uuids del compilador fijado reutilizaba un identificador en
13 bloques condicionales anonimos (y sus salidas). Se ha desactivado esa opcion
y regenerado el archivo: 111 acciones, 13 bloques distintos, anidacion y salidas
unicas, referencias y marcadores UTF-16 contrastados. No se han quitado acciones,
rebajado metadatos iOS 27 ni cambiado la vinculacion, Storage, seguridad o API.
El plist anterior era sintacticamente valido, pero eso no detectaba este defecto.
Este hallazgo NO demuestra por si solo la causa de los errores Apple 500/502.

## Prueba automatica en el Mac

1. Verifica SHA256SUMS, plist, XML y conversion binaria (bplist00).
2. Intenta firmar un control sintetico de UNA accion Texto y el universal.
3. Solo reintenta una vez los errores transitorios, tras 5 segundos. Cada intento
   tiene un limite aproximado de 90 segundos; nunca se ejecuta el contenido.
4. Si el control pasa y el universal falla (o hay error de formato), prueba tambien
   el mismo universal en XML, sin cambiar acciones/metadatos.
5. Solo entrega salida si el comando Apple termina bien y genera un contenedor
   AEA1 no vacio. Guarda su SHA-256, no afirma verificacion criptografica independiente.

El informe compartible `diagnostico-firma.XXXXXX/RESULTADO.txt` no guarda registros
brutos de Apple, cuentas, URLs privadas ni credenciales. Los logs brutos temporales
se borran al terminar. No recoge nombres de atajos personales ni el llavero.

## Interpretar RESULTADO

- FIRMA_PUBLICA_CLI_OK: salida generada para cualquiera. Abrir en Atajos y aceptar
  importacion SIN ejecutarlo. Instalacion/iPhone real siguen pendientes.
- FALLO_COMUN_RED_SERVICIO_SESION: ambos fallan por red/5xx. Apunta al entorno/red/
  sesion/servicio Apple, no acredita una caida global. Probar mas tarde u otra red
  de confianza; no resetear iCloud, contrasenas, llaveros ni desactivar seguridad.
- FALLO_ESPECIFICO_UNIVERSAL: el minimo se firma, pero el universal no. Compartir
  RESULTADO.txt; revisar compatibilidad/rechazo de contenido, no culpar a una caida global.
- DIAGNOSTICO_NO_CONCLUYENTE: falla el control sintetico. Exportar desde Atajos
  un atajo propio con una sola accion Texto > Archivo > Exportar > Cualquiera.
  Si tambien falla, no depende exclusivamente de nuestro archivo. No exportar uno personal.
- PLIST_INVALIDO / XML_INVALIDO / SALIDA_INVALIDA: no distribuir ningun archivo.

Alternativa segura opcional: ejecutar el mismo script con `--personal`. Usa el
modo oficial people-who-know-me SOLO para tus dispositivos/contactos. El resultado
puede incluir informacion de contacto de Apple: NO enviarlo al mantenedor ni
publicarlo. No equivale a firmar para cualquiera ni se activa como fallback oculto.
Si se importa en tu Mac, la exportacion posterior desde la app > Cualquiera puede
servir como alternativa oficial cuando el servicio responda. No hay servicios de terceros.

Se conservan las {count} acciones y su funcionalidad; los UUID se han regenerado.
SHA-256 de la fuente compilada validada: `{sha256(original)}`
SHA-256 del plist binario: `{sha256(binary)}`

Validado desde Windows: XML, estructura, conversion binaria y controles simulados.
La firma, importacion y ejecucion real NO se han probado en un Mac con este paquete.
Las simulaciones no contactan con Apple ni acreditan una firma real.

`shortcuts sign --mode anyone` envia una copia a Apple para validacion; no ejecuta
las acciones. No hace falta compartir contrasenas ni credenciales bancarias.
Documentacion: https://support.apple.com/es-es/guide/shortcuts-mac/apd455c82f02/mac

Los ZIP anteriores se conservan. Este paquete usa el workflow regenerado y validado.
""".encode("utf-8")
    files = {
        NAME: binary,
        "Finanzas-Bancarias_unsigned.plist": plistlib.dumps(workflow, sort_keys=False),
        "Diagnostico-Minimo_unsigned.shortcut": minimal,
        "Diagnostico-Minimo_unsigned.plist": plistlib.dumps(minimal_workflow, sort_keys=False),
        "firmar-en-Mac.sh": script,
        "VALIDACION.json": (json.dumps({"universal": report, "minimal": minimal_report}, indent=2) + "\n").encode(),
        "LEEME.md": readme,
    }
    files["SHA256SUMS"] = "".join(
        f"{sha256(data)}  {name}\n" for name, data in files.items()
    ).encode("ascii")
    output_root.mkdir(parents=True, exist_ok=True)
    folder = output_root / FOLDER
    output_zip = output_root / (FOLDER + ".zip")
    if folder.exists() or output_zip.exists():
        raise FileExistsError("El paquete de salida ya existe; no se sobrescribira")
    folder.mkdir()
    for name, data in files.items():
        (folder / name).write_bytes(data)
    with zipfile.ZipFile(output_zip, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            info = zipfile.ZipInfo(f"{FOLDER}/{name}")
            info.create_system = 3
            mode = 0o755 if name.endswith(".sh") else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    print(f"ZIP: {output_zip}")
    print(f"Acciones conservadas: {count}; formato: bplist00")
    print(f"SHA-256 ZIP: {sha256(output_zip.read_bytes())}")
    print("Firma real en Mac: PENDIENTE")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "public/shortcuts" / NAME)
    parser.add_argument("--output-root", type=Path, default=ROOT / "outputs")
    args = parser.parse_args()
    package(args.source, args.output_root)
