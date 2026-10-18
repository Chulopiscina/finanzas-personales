const marker = "finanzas:base64:v1:";

export function storeOriginalFile(buffer: Buffer) { return marker + buffer.toString("base64"); }
export function originalFile(content: string, mimeType: string | null) {
  if (content.startsWith(marker)) return Buffer.from(content.slice(marker.length), "base64");
  return mimeType?.includes("pdf") ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
}
export function decodeBankCsv(buffer: Buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder("utf-16le", { fatal: true }).decode(buffer);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder("utf-16be", { fatal: true }).decode(buffer);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { return new TextDecoder("windows-1252").decode(buffer); }
}
