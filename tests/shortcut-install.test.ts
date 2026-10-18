import { afterEach, describe, expect, it, vi } from "vitest";
import { shortcutInstallConfig, shortcutOrigin, shortcutSetupLink } from "@/lib/shortcut-install";

afterEach(() => vi.unstubAllEnvs());
describe("instalación Apple sin enlaces ni permisos inventados", () => {
  it("desactiva instalación sin enlace publicado y rechaza redirecciones externas", () => {
    for (const value of ["", "https://evil.example/shortcuts/" + "a".repeat(32), "https://www.icloud.com/shortcuts/not-an-id", "https://www.icloud.com/shortcuts/" + "a".repeat(32) + "?redirect=evil", "http://www.icloud.com/shortcuts/" + "a".repeat(32), "https://user:pass@www.icloud.com/shortcuts/" + "a".repeat(32)]) {
      vi.stubEnv("SHORTCUTS_BBVA_INSTALL_URL", value);
      expect(shortcutInstallConfig().installUrl).toBeNull();
    }
    const link = "https://www.icloud.com/shortcuts/" + "a".repeat(32);
    vi.stubEnv("SHORTCUTS_BBVA_INSTALL_URL", link);
    expect(shortcutInstallConfig().installUrl).toBe(link);
  });
  it("envía al atajo solo un código efímero, nunca la credencial permanente", () => {
    const url = new URL(shortcutSetupLink("https://finance.example", "pair_fixture"));
    expect(url.protocol).toBe("shortcuts:");
    expect(url.searchParams.get("name")).toBe("Finanzas BBVA");
    expect(JSON.parse(url.searchParams.get("text")!)).toEqual({ mode: "pair", version: 1, origin: "https://finance.example", code: "pair_fixture" });
    expect(url.href).not.toContain("fp_");
  });
  it("no ofrece el archivo sin firmar como instalador", () => {
    for (const value of ["https://finanzas-personales-lime-two.vercel.app/shortcuts/Finanzas-BBVA_unsigned.shortcut", "https://evil.example/Finanzas-BBVA.shortcut"]) {
      vi.stubEnv("SHORTCUTS_BBVA_INSTALL_URL", value);
      expect(shortcutInstallConfig().installUrl).toBeNull();
    }
  });
  it("no admite origen con credenciales, query ni HTTP remoto", () => {
    for (const value of ["http://evil.example", "https://user:password@finance.example", "https://finance.example/?query=secret", "javascript:alert(1)"]) expect(() => shortcutOrigin(value)).toThrow();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEST_DATABASE_URL", "");
    expect(() => shortcutOrigin("http://localhost:3000")).toThrow();
  });
});
