import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CircleDollarSign } from "lucide-react";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
await mkdir("public", { recursive: true });
const svg = renderToStaticMarkup(createElement(CircleDollarSign, { width: 384, height: 384, color: "#14b8a6", strokeWidth: 1.5 }));
const icon = await sharp(Buffer.from(svg)).extend({ top: 64, bottom: 64, left: 64, right: 64, background: "#111318" }).flatten({ background: "#111318" }).png().toBuffer();
for (const size of [180, 192, 512]) await sharp(icon).resize(size, size).png().toFile(`public/icon-${size}.png`);
