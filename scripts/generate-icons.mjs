// Renders all PWA / favicon assets from src/assets/logo.svg using sharp.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "icons");
const logoSvg = await readFile(path.join(root, "src", "assets", "logo.svg"), "utf8");

const POLYLINE = "14,56 34,56 42,34 54,72 62,46 68,56 86,56";
const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F7CFF"/><stop offset="1" stop-color="#22C3E6"/></linearGradient>`;

/** Maskable variant: full-bleed gradient, pulse mark scaled to 80 % of the canvas. */
function maskableSvg() {
  const scale = 0.8;
  const offset = (100 - 100 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${GRADIENT}</defs>
<rect width="100" height="100" fill="url(#g)"/>
<g transform="translate(${offset} ${offset}) scale(${scale})">
<polyline points="${POLYLINE}" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</g></svg>`;
}

/** Apple touch icon: iOS applies its own mask, so render the mark on a full-bleed gradient. */
function appleSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${GRADIENT}</defs>
<rect width="100" height="100" fill="url(#g)"/>
<polyline points="${POLYLINE}" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

async function render(svg, size) {
  return sharp(Buffer.from(svg), { density: Math.max(72, Math.ceil((size / 100) * 72 * 2)) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Minimal ICO container that embeds PNG images (supported by every modern browser). */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

await mkdir(outDir, { recursive: true });

const outputs = [
  ["icon-192.png", logoSvg, 192],
  ["icon-512.png", logoSvg, 512],
  ["icon-maskable-512.png", maskableSvg(), 512],
  ["apple-touch-icon-180.png", appleSvg(), 180],
  ["favicon-32.png", logoSvg, 32],
];

for (const [name, svg, size] of outputs) {
  await writeFile(path.join(outDir, name), await render(svg, size));
}

const ico = buildIco([
  { size: 16, data: await render(logoSvg, 16) },
  { size: 32, data: await render(logoSvg, 32) },
  { size: 48, data: await render(logoSvg, 48) },
]);
await writeFile(path.join(outDir, "favicon.ico"), ico);

console.log(`Generated ${outputs.length + 1} icons in ${path.relative(root, outDir)}`);
