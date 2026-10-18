import release from "../../shortcuts/bbva-release.json";

export const BBVA_SHORTCUT_NAME = "Finanzas BBVA";

export function shortcutInstallConfig() {
  const value = process.env.SHORTCUTS_BBVA_INSTALL_URL;
  if (!value) return { installUrl: release.appleSigned ? release.origin + release.path : null, name: BBVA_SHORTCUT_NAME };
  try {
    const url = new URL(value);
    const clean = url.protocol === "https:" && !url.port && !url.username && !url.password && !url.search && !url.hash;
    const iCloud = url.hostname === "www.icloud.com" && /^\/shortcuts\/[a-f0-9]{32}$/i.test(url.pathname);
    const bundled = release.appleSigned && url.origin === release.origin && url.pathname === release.path;
    const valid = clean && (iCloud || bundled);
    return { installUrl: valid ? url.href : null, name: BBVA_SHORTCUT_NAME };
  } catch { return { installUrl: null, name: BBVA_SHORTCUT_NAME }; }
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

export function shortcutSetupLink(origin: string, code: string) {
  const params = new URLSearchParams({ name: BBVA_SHORTCUT_NAME, input: "text", text: JSON.stringify({ mode: "pair", version: 1, origin: shortcutOrigin(origin), code }) });
  return `shortcuts://run-shortcut?${params}`;
}
