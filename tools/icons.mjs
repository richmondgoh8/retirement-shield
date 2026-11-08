import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
const source = await readFile(new URL("../assets/icon.svg", import.meta.url));
const full = sharp(source, { density: 192 });
const standard = Buffer.from(
  source
    .toString()
    .replace(
      '<path fill="url(#bg)" d="M0 0h512v512H0z"/>',
      '<rect width="512" height="512" rx="104" fill="url(#bg)"/><g transform="translate(-30.72 -30.72) scale(1.12)">',
    )
    .replace("</svg>", "</g></svg>"),
);
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["icon-maskable-512", 512],
  ["apple-touch-icon", 180],
]) {
  await (
    name === "icon-192" || name === "icon-512"
      ? sharp(standard, { density: 192 })
      : full.clone()
  )
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true, quality: 100 })
    .toFile(new URL(`../assets/${name}.png`, import.meta.url).pathname);
}
// A simpler, larger glyph stays legible in a browser tab at 16px.
const favicon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#11253d"/><path d="m32 8 21 8v16c0 12-9 20-21 25C20 52 11 44 11 32V16z" fill="#a5e68e"/><path d="M22 39V28h10v-9m0 0 8 8m-8-8-8 8" fill="none" stroke="#11253d" stroke-width="5" stroke-linejoin="round"/></svg>';
await writeFile(new URL("../favicon.svg", import.meta.url), favicon + "\n");
const images = await Promise.all(
  [16, 32, 48].map((size) =>
    sharp(Buffer.from(favicon)).resize(size).png().toBuffer(),
  ),
);
let offset = 6 + 16 * images.length;
const header = Buffer.alloc(offset);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
images.forEach((data, i) => {
  const entry = 6 + i * 16,
    size = [16, 32, 48][i];
  header[entry] = size;
  header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(data.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += data.length;
});
await writeFile(
  new URL("../favicon.ico", import.meta.url),
  Buffer.concat([header, ...images]),
);
