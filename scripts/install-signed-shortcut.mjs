// Download only a successful native-Apple-signing release of this repository.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const sha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Expected the full signing commit SHA");
const repo = "Chulopiscina/finanzas-personales";
const tag = `universal-shortcut-${sha}`;
async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  return response.json();
}
const runs = await json(`https://api.github.com/repos/${repo}/actions/workflows/bbva-shortcut.yml/runs?head_sha=${sha}`);
const run = runs.workflow_runs.find(r => r.head_sha === sha && r.conclusion === "success");
if (!run) throw new Error("No successful Apple-signing run for this commit; nothing installed");
const release = await json(`https://api.github.com/repos/${repo}/releases/tags/${tag}`);
if (release.draft || release.prerelease) throw new Error("Release is not published");
const base = `https://github.com/${repo}/releases/download/${tag}/`;
async function download(name) {
  const url = base + encodeURIComponent(name);
  if (!release.assets.some(a => a.name === name && a.browser_download_url === url)) throw new Error("Missing release asset");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Asset returned ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
const file = await download("Finanzas Bancarias.shortcut");
const hash = createHash("sha256").update(file).digest("hex");
const sums = (await download("SHA256SUMS")).toString("utf8");
if (!sums.split(/\r?\n/).some(line => line === `${hash}  Finanzas Bancarias.shortcut`)) throw new Error("SHA256 mismatch");
if (file.subarray(0, 4).toString() !== "AEA1") throw new Error("Not an Apple signed archive; refusing unsigned plist");
await mkdir("public/shortcuts", { recursive: true });
await writeFile("public/shortcuts/Finanzas-Bancarias.shortcut", file);
await writeFile("shortcuts/universal-release.json", JSON.stringify({ appleSigned: true, origin: "https://finanzas-personales-lime-two.vercel.app", path: "/shortcuts/Finanzas-Bancarias.shortcut", sha256: hash, sourceCommit: sha, signingRun: run.html_url, physicalIPhoneTested: false }, null, 2) + "\n");
console.log("Signed shortcut installed and checksum verified. Physical iPhone test remains required.");
