"""Standard-library packaging tests; these do NOT emulate or validate Apple signing."""
import hashlib
import importlib.util
import plistlib
import stat
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from shortcut_structure import validate_workflow
spec = importlib.util.spec_from_file_location(
    "shortcut_package", ROOT / "scripts/package-shortcut-for-mac.py"
)
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class ShortcutPackageTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.original = (ROOT / "public/shortcuts" / packager.NAME).read_bytes()

    def source_zip(self, copies=1):
        source = self.root / "original.zip"
        with zipfile.ZipFile(source, "w") as archive:
            for index in range(copies):
                archive.writestr(f"original-{index}/{packager.NAME}", self.original)
            # Never extract untrusted ZIP paths, scripts or unrelated files.
            archive.writestr("../../unexpected.txt", b"not part of the package")
            archive.writestr("original/firmar-en-Mac.sh", b"old broken script")
        return source

    def test_binary_conversion_preserves_entire_native_workflow(self):
        binary, count = packager.binary_workflow(self.original)
        self.assertEqual(binary[:8], b"bplist00")
        self.assertEqual(count, 111)
        self.assertEqual(
            plistlib.dumps(plistlib.loads(binary)),
            plistlib.dumps(plistlib.loads(self.original)),
        )
        self.assertEqual(packager.binary_workflow(binary)[0], binary)

    def test_rejects_invalid_or_empty_workflows(self):
        for workflow in [[], {}, {"WFWorkflowActions": []}, {"WFWorkflowActions": [{}]},
                         {"WFWorkflowActions": [{"WFWorkflowActionIdentifier": "test", "WFWorkflowActionParameters": []}]}]:
            with self.subTest(workflow=workflow):
                with self.assertRaises(ValueError):
                    packager.binary_workflow(plistlib.dumps(workflow))
        with self.assertRaises(plistlib.InvalidFileException):
            packager.binary_workflow(b"not a shortcut")

    def test_zip_uses_binary_shortcut_current_lf_script_and_verified_checksums(self):
        source = self.source_zip()
        before = source.read_bytes()
        output = self.root / "output"
        packager.package(source, output)
        self.assertEqual(source.read_bytes(), before)
        with zipfile.ZipFile(output / (packager.FOLDER + ".zip")) as archive:
            self.assertEqual(len(archive.infolist()), 8)
            prefix = packager.FOLDER + "/"
            binary = archive.read(prefix + packager.NAME)
            self.assertEqual(binary[:8], b"bplist00")
            self.assertEqual(plistlib.loads(binary), plistlib.loads(self.original))
            self.assertEqual(plistlib.loads(archive.read(prefix + "Finanzas-Bancarias_unsigned.plist")), plistlib.loads(binary))
            minimal, report = validate_workflow(archive.read(prefix + "Diagnostico-Minimo_unsigned.shortcut"))
            self.assertEqual(report["actionCount"], 1)
            self.assertEqual(minimal["WFWorkflowActions"][0]["WFWorkflowActionIdentifier"], "is.workflow.actions.gettext")
            script = archive.read(prefix + "firmar-en-Mac.sh")
            self.assertTrue(script.startswith(b"#!/bin/bash\n"))
            self.assertNotIn(b"\r", script)
            self.assertEqual(script, (ROOT / "scripts/sign-universal-shortcut.sh").read_bytes().replace(b"\r\n", b"\n"))
            self.assertEqual(stat.S_IMODE(archive.getinfo(prefix + "firmar-en-Mac.sh").external_attr >> 16), 0o755)
            for line in archive.read(prefix + "SHA256SUMS").decode().splitlines():
                checksum, name = line.split("  ", 1)
                data = archive.read(prefix + name)
                self.assertEqual(hashlib.sha256(data).hexdigest(), checksum)
                self.assertEqual((output / packager.FOLDER / name).read_bytes(), data)
            self.assertIn("NO se han probado en un Mac", archive.read(prefix + "LEEME.md").decode())
        self.assertFalse((self.root / "unexpected.txt").exists())

    def test_refuses_ambiguous_or_missing_shortcut(self):
        for copies in [0, 2]:
            with self.subTest(copies=copies):
                with self.assertRaises(ValueError):
                    packager.package(self.source_zip(copies), self.root / "output")

    def test_refuses_overwrite(self):
        source = self.source_zip()
        output = self.root / "output"
        packager.package(source, output)
        original_zip = (output / (packager.FOLDER + ".zip")).read_bytes()
        with self.assertRaises(FileExistsError):
            packager.package(source, output)
        self.assertEqual((output / (packager.FOLDER + ".zip")).read_bytes(), original_zip)

    def test_validates_unique_blocks_outputs_references_and_tokens(self):
        import copy
        workflow, report = validate_workflow(self.original)
        self.assertEqual(report["controlBlockCount"], 13)
        self.assertGreater(report["uniqueOutputCount"], 13)
        mutations = []
        duplicate = copy.deepcopy(workflow)
        blocks = [a["WFWorkflowActionParameters"] for a in duplicate["WFWorkflowActions"] if a.get("WFWorkflowActionParameters", {}).get("WFControlFlowMode") == 0]
        blocks[1]["GroupingIdentifier"] = blocks[0]["GroupingIdentifier"]
        mutations.append(duplicate)
        duplicate = copy.deepcopy(workflow)
        outputs = [a["WFWorkflowActionParameters"] for a in duplicate["WFWorkflowActions"] if "UUID" in a.get("WFWorkflowActionParameters", {})]
        outputs[1]["UUID"] = outputs[0]["UUID"]
        mutations.append(duplicate)
        duplicate = copy.deepcopy(workflow)
        duplicate["WFWorkflowActions"][0]["WFWorkflowActionParameters"]["input"] = {"OutputUUID": "missing"}
        mutations.append(duplicate)
        duplicate = copy.deepcopy(workflow)
        duplicate["WFWorkflowActions"][0]["WFWorkflowActionParameters"]["input"] = {"WFSerializationType": "WFTextTokenString", "Value": {"string": "abc", "attachmentsByRange": {"{0, 1}": {}}}}
        mutations.append(duplicate)
        for mutated in mutations:
            with self.assertRaises(ValueError):
                validate_workflow(plistlib.dumps(mutated))

    def test_rejects_unclosed_controls_and_existing_credentials(self):
        workflow = plistlib.loads(self.original)
        workflow["WFWorkflowActions"].pop(-2)
        with self.assertRaises(ValueError):
            validate_workflow(plistlib.dumps(workflow))
        workflow = plistlib.loads(self.original)
        workflow["secret"] = "fp_" + "a" * 43
        with self.assertRaises(ValueError):
            validate_workflow(plistlib.dumps(workflow))


if __name__ == "__main__":
    unittest.main()
