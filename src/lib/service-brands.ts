import brands from "@/lib/service-brands.json";

const names: Record<string, RegExp> = {
  netflix: /\bnetflix\b/,
  spotify: /\bspotify\b/,
  disney: /\bdisney\b/,
  digi: /\bdigi\b/,
  movistar: /\b(?:mi\s*)?movistar\b/,
  "google-one": /\bgoogle[\s._-]*one\b/,
  chatgpt: /\bchat\s*gpt\b|\bopenai\b/,
  synergym: /\bsynergym\b/,
};

export function serviceBrand(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matches = brands.filter((brand) => names[brand.id]?.test(normalized));
  // Ambiguous or unknown names must never be assigned another service's identity.
  return matches.length === 1 ? matches[0] : null;
}
