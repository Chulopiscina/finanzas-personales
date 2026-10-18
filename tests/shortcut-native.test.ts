import { readFileSync } from "node:fs";
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
  });
});
