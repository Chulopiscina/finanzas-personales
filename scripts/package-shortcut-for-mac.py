"""Repackage the original workflow without changing its actions or metadata."""
import argparse
import hashlib
import plistlib
import stat
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
NAME = "Finanzas-Bancarias_unsigned.shortcut"
FOLDER = "Finanzas-Bancarias-para-firmar-corregido"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def binary_workflow(original):
    workflow = plistlib.loads(original)
    if not isinstance(workflow, dict):
        raise ValueError("El plist raiz debe ser un diccionario")
    actions = workflow.get("WFWorkflowActions")
    if not isinstance(actions, list) or not actions:
        raise ValueError("Faltan las acciones del atajo")
    for action in actions:
        if not isinstance(action, dict) or not isinstance(
            action.get("WFWorkflowActionIdentifier"), str
        ):
            raise ValueError("Accion sin identificador valido")
        if not isinstance(action.get("WFWorkflowActionParameters", {}), dict):
            raise ValueError("Parametros de accion invalidos")
    binary = plistlib.dumps(workflow, fmt=plistlib.FMT_BINARY, sort_keys=False)
    restored = plistlib.loads(binary)
    # Compare canonical typed plists, not only action counts or Python equality.
    if plistlib.dumps(restored) != plistlib.dumps(workflow):
        raise ValueError("La conversion ha alterado el workflow")
    return binary, len(actions)


def package(source, output_root):
    with zipfile.ZipFile(source) as archive:
        entries = [i for i in archive.infolist() if Path(i.filename).name == NAME]
        if len(entries) != 1:
            raise ValueError("El ZIP debe contener exactamente un atajo bancario")
        original = archive.read(entries[0])
    binary, count = binary_workflow(original)
    script = (ROOT / "scripts/sign-universal-shortcut.sh").read_bytes()
    script = script.replace(b"\r\n", b"\n")
    if not script.startswith(b"#!/bin/bash\n") or b"\r" in script:
        raise ValueError("El script debe ser UTF-8 sin BOM y usar LF")
    readme = f"""# Finanzas Bancarias: paquete corregido para firmar en Mac

Descomprime el ZIP en Descargas del Mac y ejecuta este unico comando en Terminal:

```bash
bash "$HOME/Downloads/{FOLDER}/firmar-en-Mac.sh"
```

Requiere macOS con Atajos y una sesion iCloud. No requiere Python ni herramientas
de desarrollo. Si lo descomprimes en otra ubicacion, arrastra firmar-en-Mac.sh
a Terminal despues de escribir `bash `.

Resultado: `Finanzas Bancarias.shortcut`, junto al script. El archivo de salida
no se sobrescribe. No instales el archivo `_unsigned` ni lo confundas con uno firmado.

Correccion: el script anterior convertia el XML a un temporal SIN extension
`.shortcut` antes de llamar al firmador. El nuevo conserva esa extension.
El XML original era un plist valido; cambiar solo su nombre no era una conversion.
Este paquete entrega un plist binario real (cabecera `bplist00`). El script vuelve
a validarlo con plutil y firma una copia temporal con extension `.shortcut`.

Se conservan exactamente las {count} acciones, sus parametros y todos los metadatos.
SHA-256 del plist XML original: `{sha256(original)}`
SHA-256 del plist binario: `{sha256(binary)}`

Validado desde Windows: lectura del plist, conversion binaria y comparacion completa
con el original. La firma, importacion y ejecucion real NO se han probado en un Mac.
Si Apple falla, el script muestra su error y no deja una salida final parcial.

`shortcuts sign --mode anyone` envia una copia a Apple para validacion; no ejecuta
las acciones. No hace falta compartir contrasenas ni credenciales bancarias.
Documentacion: https://support.apple.com/es-es/guide/shortcuts-mac/apd455c82f02/mac

El ZIP original y los archivos publicos del proyecto permanecen intactos.
""".encode("utf-8")
    files = {NAME: binary, "firmar-en-Mac.sh": script, "LEEME.md": readme}
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
    parser.add_argument("--source", type=Path, default=ROOT / "outputs/Finanzas-Bancarias-para-firmar.zip")
    parser.add_argument("--output-root", type=Path, default=ROOT / "outputs")
    args = parser.parse_args()
    package(args.source, args.output_root)
