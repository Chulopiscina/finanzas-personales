import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const source = readFileSync("shortcuts/FinanzasBBVA.cherri", "utf8");
describe("atajo nativo BBVA distribuible sin credenciales", () => {
  it("fija el origen y valida la vinculación antes de hacer red", () => {
    expect(source).toContain('#define version 27');
    expect(source).toContain('const origin = "https://finanzas-personales-lime-two.vercel.app"');
    expect(source.indexOf("if setupOrigin != origin")).toBeLessThan(source.indexOf("jsonRequest("));
    expect(source).toContain('if version != "1"');
    expect(source).toContain('storeValue("bbva-token", newToken, false)');
    expect(source).not.toMatch(/fp_[A-Za-z0-9_-]{43}|pair_[A-Za-z0-9_-]{43}/);
    expect(source).not.toMatch(/(?:get|set)Clipboard\(|https?:\/\/(?!finanzas-personales-lime-two\.vercel\.app)/i);
  });
  it("no inventa datos bancarios y comprueba sin crear movimientos", () => {
    const event = source.slice(source.lastIndexOf("const response = jsonRequest("));
    expect(event).toContain('"body": "{inputText}"');
    expect(event).not.toMatch(/occurredAt|amount|accountId|balance|merchant/);
    expect(source).toContain('if !inputText {');
    expect(source).toContain('if length > 8000');
    expect(source).toContain("connection");
    expect(source.match(/const eventId =/g)).toHaveLength(1);
  });
  it("firma únicamente con Apple y compila una revisión fijada", () => {
    const workflow = readFileSync(".github/workflows/bbva-shortcut.yml", "utf8");
    expect(workflow).toContain("runs-on: macos-15");
    expect(workflow).toContain("bcc0095754e2cc0baaeb4d93dae172b8153b4716");
    expect(workflow).toContain("shortcuts sign --mode anyone");
    expect(workflow).not.toMatch(/hubsign|signing-server|DATABASE_URL|DIRECT_URL|VERCEL_TOKEN/);
    expect(workflow).toContain("if: steps.apple.outputs.signed == 'true'");
  });
  it("distribuye código nativo sin confundirlo con una instalación firmada", () => {
    const plist = readFileSync("public/shortcuts/Finanzas-BBVA_unsigned.shortcut", "utf8");
    expect(plist).toContain("<plist");
    expect(plist.match(/<key>WFWorkflowActionIdentifier<\/key>/g)).toHaveLength(95);
    expect(plist).not.toMatch(/fp_[A-Za-z0-9_-]{43}|pair_[A-Za-z0-9_-]{43}/);
    const release = JSON.parse(readFileSync("shortcuts/bbva-release.json", "utf8"));
    if (release.appleSigned) {
      const signed = readFileSync("public" + release.path);
      expect(signed.subarray(0, 4).toString()).toBe("AEA1");
      expect(createHash("sha256").update(signed).digest("hex")).toBe(release.sha256);
    } else expect(release.sha256).toBeNull();
  });
});

describe("atajo universal definitivo para firma", () => {
  const universal = readFileSync("shortcuts/FinanzasBancarias.cherri", "utf8");
  it("no contiene bancos ni reglas y mantiene un origen fijo antes del canje", () => {
    expect(universal).toContain("#define name Finanzas Bancarias");
    expect(universal).toContain('if version != "2"');
    expect(universal.indexOf("if setupOrigin != origin")).toBeLessThan(universal.indexOf("jsonRequest("));
    expect(universal).toContain('storeValue("finance-token", newToken, false)');
    expect(universal).not.toMatch(/\b(?:BBVA|ING|Trade Republic)\b|(?:get|set)Clipboard\(/i);
    const event = universal.slice(universal.lastIndexOf("const response = jsonRequest("));
    expect(event).toContain('"body": "{inputText}"');
    expect(event).not.toMatch(/sourceApp|bankId|occurredAt|amount|accountId|balance|merchant/);
    expect(universal).toContain("if length > 6000");
  });
  it("el archivo compilado no lleva credenciales y no se ofrece sin firma", () => {
    const plist = readFileSync("public/shortcuts/Finanzas-Bancarias_unsigned.shortcut", "utf8");
    const build = JSON.parse(readFileSync("shortcuts/universal-build.json", "utf8"));
    expect(build.actionCount).toBeGreaterThan(90);
    expect(plist.match(/<key>WFWorkflowActionIdentifier<\/key>/g)).toHaveLength(build.actionCount);
    expect(createHash("sha256").update(plist).digest("hex")).toBe(build.compiledSha256);
    expect(createHash("sha256").update(universal).digest("hex")).toBe(build.sourceSha256);
    expect(universal.indexOf("if ShortcutInput")).toBeLessThan(universal.indexOf("getText(ShortcutInput)"));
    expect(universal.indexOf("Confirma tu perfil")).toBeLessThan(universal.indexOf('storeValue("finance-token"'));
    expect(universal).toContain('if protocol != "2"');
    expect(plist).not.toMatch(/fp_[A-Za-z0-9_-]{43}|pair_[A-Za-z0-9_-]{43}/);
    const release = JSON.parse(readFileSync("shortcuts/universal-release.json", "utf8"));
    expect(typeof release.physicalIPhoneTested).toBe("boolean");
    if (release.appleSigned) {
      const signed = readFileSync("public" + release.path);
      expect(signed.subarray(0, 4).toString()).toBe("AEA1");
      expect(createHash("sha256").update(signed).digest("hex")).toBe(release.sha256);
    } else expect(release.sha256).toBeNull();
    expect(readFileSync(".github/workflows/bbva-shortcut.yml", "utf8")).toContain("shortcuts/FinanzasBancarias.cherri");
  });
  it("firma un plist binario con extensión nativa y no publica salidas fallidas", () => {
    const script = readFileSync("scripts/sign-universal-shortcut.sh", "utf8");
    expect(script).toContain('binary="$work/Finanzas-Bancarias_unsigned.shortcut"');
    expect(script).toContain('signed="$work/$label-$attempt.shortcut"');
    expect(script).toContain('/usr/bin/plutil -convert binary1 -o "$binary" "$input"');
    expect(script).toContain('/usr/bin/shortcuts sign --mode "$mode" --input "$source" --output "$signed"');
    expect(script).toContain('bplist00');
    expect(script).toContain('AEA1');
    expect(script.indexOf('= AEA1')).toBeLessThan(script.indexOf('cat "$verified_file" > "$output"'));
    expect(script).toContain('set -o noclobber');
    expect(script).toContain('trap cleanup EXIT');
    expect(script).not.toContain("mktemp -t finanzas-universal");
    expect(script).toContain('sign_checked MINIMO "$minimal" 2');
    expect(script).toContain('sign_checked UNIVERSAL_XML "$xml" 1');
    expect(script).toContain('FALLO_COMUN_RED_SERVICIO_SESION');
    expect(script).toContain('FALLO_ESPECIFICO_UNIVERSAL');
    expect(script).toContain('"${1:-}" = "--personal"');
    expect(readFileSync("scripts/build-universal-shortcut.mjs", "utf8")).not.toContain('"--derive-uuids"');
    expect(readFileSync(".github/workflows/bbva-shortcut.yml", "utf8")).not.toContain('--derive-uuids');
  });
});
