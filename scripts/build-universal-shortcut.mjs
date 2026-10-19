// Developer-only compilation. End users receive the generated file, not a toolchain.
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";

if (!process.argv[2]) throw new Error("Usage: node scripts/build-universal-shortcut.mjs <pinned-cherri-executable>");
const compiler = resolve(process.argv[2]);
const compilerCommit = "bcc0095754e2cc0baaeb4d93dae172b8153b4716";
const revision = spawnSync("git", ["-C", dirname(compiler), "rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true });
if (revision.status !== 0 || revision.stdout.trim() !== compilerCommit) throw new Error("Use the executable built inside the pinned Cherri checkout");
const result = spawnSync(compiler, ["shortcuts/FinanzasBancarias.cherri", "--skip-sign", "--derive-uuids", "--no-ansi"], { stdio: "inherit", windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error("Native compilation failed");
const source = readFileSync("shortcuts/FinanzasBancarias.cherri");
const file = readFileSync("shortcuts/Finanzas Bancarias_unsigned.shortcut");
const xml = file.toString("utf8");
if (!xml.includes("<plist") || /fp_[A-Za-z0-9_-]{43}|pair_[A-Za-z0-9_-]{43}/.test(xml)) throw new Error("Unsafe/incomplete native file");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
copyFileSync("shortcuts/Finanzas Bancarias_unsigned.shortcut", "public/shortcuts/Finanzas-Bancarias_unsigned.shortcut");
writeFileSync("shortcuts/universal-build.json", JSON.stringify({ compiler: "Cherri", compilerCommit, sourceSha256: hash(source), compiledSha256: hash(file), actionCount: (xml.match(/<key>WFWorkflowActionIdentifier<\/key>/g) ?? []).length, appleSigned: false }, null, 2) + "\n");
console.log("Unsigned universal file generated; source/artifact SHA-256 recorded. Apple signature still required.");
