import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import brands from "@/lib/service-brands.json";
import { serviceBrand } from "@/lib/service-brands";

describe("logos oficiales locales, sin búsquedas externas por datos financieros", () => {
  it.each([
    ["NETFLIX.COM", "netflix"], ["Spotify Familiar", "spotify"], ["Disney+", "disney"],
    ["Disney Plus", "disney"], ["MiMovistar", "movistar"], ["DIGI Fibra", "digi"],
    ["Google One", "google-one"], ["CHATGPT Plus", "chatgpt"], ["OpenAI", "chatgpt"], ["Synergym", "synergym"],
  ])("%s usa la marca %s", (name, id) => expect(serviceBrand(name)?.id).toBe(id));
  it.each(["Pago digital", "Seguro de coche", "Mi servicio", "Disneyland", "Netflix y Spotify", ""]) ("no inventa una marca para %s", (name) => {
    expect(serviceBrand(name)).toBeNull();
  });
  it("todos los logos tienen fuente oficial y archivos de imagen reales", () => {
    for (const brand of brands) {
      expect(brand.src).toMatch(/^\/service-logos\/[a-z-]+\.(png|jpg)$/);
      expect(brand.sourcePage).toMatch(/^https:\/\//);
      expect(brand.owner).toBeTruthy();
      const file = readFileSync(path.join(process.cwd(), "public", brand.src));
      expect(file.length).toBeGreaterThan(1000);
      expect(file.length).toBeLessThan(100_000);
      expect(file.subarray(0, brand.src.endsWith("png") ? 8 : 3).toString("hex"))
        .toBe(brand.src.endsWith("png") ? "89504e470d0a1a0a" : "ffd8ff");
    }
  });
});
