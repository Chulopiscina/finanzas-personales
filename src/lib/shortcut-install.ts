import release from "../../shortcuts/bbva-release.json";
import universalRelease from "../../shortcuts/universal-release.json";

export const BBVA_SHORTCUT_NAME = "Finanzas BBVA";
export const UNIVERSAL_SHORTCUT_NAME = "Finanzas Bancarias";
export type ShortcutVariant = "bbva" | "universal";

export function shortcutInstallConfig(variant: ShortcutVariant = "bbva") {
  const artifact = variant === "universal" ? universalRelease : release;
  const name = variant === "universal" ? UNIVERSAL_SHORTCUT_NAME : BBVA_SHORTCUT_NAME;
  const value = variant === "universal" ? process.env.SHORTCUTS_INSTALL_URL : process.env.SHORTCUTS_BBVA_INSTALL_URL;
  if (!value) return { installUrl: artifact.appleSigned ? artifact.origin + artifact.path : null, name };
  try {
    const url = new URL(value);
    const clean = url.protocol === "https:" && !url.port && !url.username && !url.password && !url.search && !url.hash;
    const iCloud = url.hostname === "www.icloud.com" && /^\/shortcuts\/[a-f0-9]{32}$/i.test(url.pathname);
    const bundled = artifact.appleSigned && url.origin === artifact.origin && url.pathname === artifact.path;
    const valid = clean && (iCloud || bundled);
    return { installUrl: valid ? url.href : null, name };
  } catch { return { installUrl: null, name }; }
}

export function shortcutOrigin(value: string) {
  const url = new URL(value);
  let isolatedTest = false;
  try {
    const db = new URL(process.env.TEST_DATABASE_URL ?? "");
    isolatedTest = ["localhost", "127.0.0.1"].includes(db.hostname) && db.pathname === "/finanzas_test" && process.env.TEST_APP_URL === value;
  } catch { /* No isolated test database configured. */ }
  const local = (process.env.NODE_ENV !== "production" || isolatedTest) && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.origin !== value) throw new Error("Origen de vinculación no permitido.");
  return url.origin;
}

export function shortcutSetupLink(origin: string, code: string, variant: ShortcutVariant = "bbva") {
  const params = new URLSearchParams({ name: variant === "universal" ? UNIVERSAL_SHORTCUT_NAME : BBVA_SHORTCUT_NAME, input: "text", text: JSON.stringify({ mode: "pair", version: variant === "universal" ? 2 : 1, origin: shortcutOrigin(origin), code }) });
  // Apple documents percent-encoded spaces, not HTML form '+' encoding.
  return `shortcuts://run-shortcut?${params.toString().replace(/\+/g, "%20")}`;
}
