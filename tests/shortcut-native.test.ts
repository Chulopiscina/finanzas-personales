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
