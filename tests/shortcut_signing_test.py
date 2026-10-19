"""Offline shell-control simulations. No macOS, Apple signing or credentials used."""
import hashlib
import json
import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASH = shutil.which("bash") if os.name != "nt" else "C:/Program Files/Git/bin/bash.exe"

MOCK = r'''
import hashlib, json, os, plistlib, sys, xml.etree.ElementTree as ET
from pathlib import Path
sys.stdout.reconfigure(newline="\n")
sys.stderr.reconfigure(newline="\n")
tool, *args = sys.argv[1:]
if tool == "uname":
    print("Darwin" if args == ["-s"] else "MOCK-ARCH")
elif tool == "sw_vers":
    print("MOCK-NOT-A-MAC")
elif tool == "xmllint":
    ET.fromstring(Path(args[-1]).read_bytes())
elif tool == "shasum":
    if "-c" in args:
        for line in Path(args[-1]).read_text().splitlines():
            expected, file = line.split("  ", 1)
            if hashlib.sha256(Path(file).read_bytes()).hexdigest() != expected:
                sys.exit(1)
    else:
        print(hashlib.sha256(Path(args[-1]).read_bytes()).hexdigest(), args[-1])
elif tool == "plutil":
    if args[0] == "-lint":
        for file in args[1:]: plistlib.loads(Path(file).read_bytes())
    else:
        data = plistlib.loads(Path(args[-1]).read_bytes())
        Path(args[3]).write_bytes(plistlib.dumps(data, fmt=plistlib.FMT_BINARY if args[1] == "binary1" else plistlib.FMT_XML))
elif tool == "shortcuts":
    assert args[0] == "sign", "Must never run/import the workflow"
    source = Path(args[args.index("--input") + 1])
    destination = Path(args[args.index("--output") + 1])
    assert source.suffix == destination.suffix == ".shortcut"
    assert len(plistlib.loads(source.read_bytes())["WFWorkflowActions"]) in (1, 111)
    minimal = "Minimo" in source.name
    xml = source.read_bytes().startswith(b"<?xml")
    mode = args[args.index("--mode") + 1]
    state = Path(os.environ["MOCK_STATE"])
    calls = json.loads(state.read_text()) if state.exists() else []
    seen = sum(c["minimal"] == minimal and c["xml"] == xml for c in calls)
    calls.append({"minimal": minimal, "xml": xml, "mode": mode})
    state.write_text(json.dumps(calls))
    scenario = os.environ["MOCK_SCENARIO"]
    if scenario == "icloud":
        print("You must be signed into iCloud. private@example.test")
        sys.exit(1)
    fail = scenario == "common500" or (scenario == "universal500" and not minimal) or (scenario == "retry" and seen == 0)
    if fail:
        print("NSURLErrorDomain error 502 private@example.test https://private.test/?token=PRIVATE-SECRET")
        sys.exit(1)
    if scenario == "xml" and not minimal and not xml:
        print("The file couldn't be opened because it isn't in the correct format.")
        sys.exit(1)
    destination.write_bytes(b"NOT-A-SIGNATURE" if scenario == "invalid" else b"AEA1-MOCK-NOT-A-REAL-APPLE-SIGNATURE")
'''


@unittest.skipUnless(BASH and Path(BASH).exists(), "Bash is needed for offline shell tests")
class ShortcutSigningTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.script = self.root / "firmar-en-Mac.sh"
        source = (ROOT / "scripts/sign-universal-shortcut.sh").read_text()
        # Substitute native binaries only in a disposable test copy, never production.
        source = source.replace("/usr/bin/", '"$MOCK_BIN"/')
        source = source.replace("$(uname ", '$("$MOCK_BIN"/uname ')
        source = source.replace("sleep 1", "sleep 0.02").replace("sleep 5", "sleep 0.02")
        self.script.write_bytes(source.encode())
        self.mock = self.root / "mock.py"
        self.mock.write_text(MOCK)
        for tool in ["uname", "sw_vers", "plutil", "shasum", "xmllint", "shortcuts"]:
            wrapper = self.bin / tool
            wrapper.write_bytes(f'#!/bin/bash\nexec "{Path(sys.executable).as_posix()}" "{self.mock.as_posix()}" {tool} "$@"\n'.encode())
            wrapper.chmod(0o755)
        self.main = self.root / "Finanzas-Bancarias_unsigned.shortcut"
        self.main.write_bytes((ROOT / "public/shortcuts" / self.main.name).read_bytes())
        self.minimum = self.root / "Diagnostico-Minimo_unsigned.shortcut"
        self.minimum.write_bytes((ROOT / "shortcuts/DiagnosticoFirma.plist").read_bytes())
        self.state = self.root / "state.json"
        self.env = {**os.environ, "MOCK_BIN": self.bin.as_posix(), "MOCK_STATE": str(self.state),
                    "PATH": str(self.bin) + os.pathsep + os.environ.get("PATH", "")}
        # Hashes include the disposable rewritten script to exercise the real guard.
        checksums = "".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n" for path in [self.main, self.minimum, self.script])
        (self.root / "SHA256SUMS").write_text(checksums)

    def run_script(self, scenario, *args):
        result = subprocess.run([BASH, str(self.script), *args], env={**self.env, "MOCK_SCENARIO": scenario},
                                text=True, capture_output=True, timeout=40)
        reports = list(self.root.glob("diagnostico-firma.*/RESULTADO.txt"))
        report = reports[-1].read_text() if reports else ""
        self.assertNotIn("PRIVATE-SECRET", report + result.stdout + result.stderr)
        self.assertNotIn("private@example.test", report + result.stdout + result.stderr)
        self.assertNotIn("https://private.test", report + result.stdout + result.stderr)
        calls = json.loads(self.state.read_text()) if self.state.exists() else []
        return result, report, calls

    def test_both_sign_and_never_execute(self):
        result, report, calls = self.run_script("success")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("RESULTADO=FIRMA_PUBLICA_CLI_OK", report)
        self.assertEqual(len(calls), 2)
        self.assertTrue((self.root / "Finanzas Bancarias.shortcut").exists())

    def test_common_5xx_bounded_retry_and_no_final_file(self):
        result, report, calls = self.run_script("common500")
        self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
        self.assertIn("RESULTADO=FALLO_COMUN_RED_SERVICIO_SESION", report)
        self.assertEqual(len(calls), 4)
        self.assertFalse((self.root / "Finanzas Bancarias.shortcut").exists())

    def test_minimum_signs_but_universal_does_not(self):
        result, report, calls = self.run_script("universal500")
        self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
        self.assertIn("RESULTADO=FALLO_ESPECIFICO_UNIVERSAL", report)
        self.assertEqual(len(calls), 4)
        self.assertTrue(calls[-1]["xml"])

    def test_xml_fallback_does_not_change_workflow(self):
        result, report, calls = self.run_script("xml")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(len(calls), 3)
        self.assertTrue(calls[-1]["xml"])
        self.assertIn("RESULTADO=FIRMA_PUBLICA_CLI_OK", report)

    def test_invalid_container_never_published(self):
        result, report, _ = self.run_script("invalid")
        self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
        self.assertIn("SALIDA_INVALIDA", report)
        self.assertFalse((self.root / "Finanzas Bancarias.shortcut").exists())

    def test_transient_error_recovers(self):
        result, report, calls = self.run_script("retry")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(len(calls), 4)
        self.assertIn("RESULTADO=FIRMA_PUBLICA_CLI_OK", report)

    def test_personal_mode_explicit_and_not_public(self):
        result, report, calls = self.run_script("success", "--personal")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("RESULTADO=FIRMA_PERSONAL_NO_DISTRIBUIR", report)
        self.assertTrue(all(call["mode"] == "people-who-know-me" for call in calls))
        self.assertFalse((self.root / "Finanzas Bancarias.shortcut").exists())
        self.assertTrue((self.root / "Finanzas Bancarias_PERSONAL_NO_DISTRIBUIR.shortcut").exists())

    def test_existing_output_not_overwritten(self):
        output = self.root / "Finanzas Bancarias.shortcut"
        output.write_bytes(b"keep")
        result, _, calls = self.run_script("success")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_bytes(), b"keep")
        self.assertEqual(calls, [])

    def test_hash_mismatch_blocks_every_request(self):
        self.main.write_bytes(self.main.read_bytes() + b" ")
        result, _, calls = self.run_script("success")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])

    def test_icloud_error_is_not_retried_or_reset(self):
        result, report, calls = self.run_script("icloud")
        self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
        self.assertIn("SESION_ICLOUD", report)
        self.assertEqual(len(calls), 2)
        self.assertFalse((self.root / "Finanzas Bancarias.shortcut").exists())

    def test_invalid_plist_blocks_signing_even_with_matching_hash(self):
        self.main.write_bytes(b"not a plist")
        checksums = "".join(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n" for path in [self.main, self.minimum, self.script])
        (self.root / "SHA256SUMS").write_text(checksums)
        result, report, calls = self.run_script("success")
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("PLIST_INVALIDO", report)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
