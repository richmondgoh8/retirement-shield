import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = await readFile(new URL("../assets/icon.svg", import.meta.url));
const full = sharp(source, { density: 192 });
const sourceText = source.toString();
const bgPathRe =
  /<path\b(?=[^>]*fill="url\(#bg\)")(?=[^>]*d="M0 0h512v512H0z")[^>]*\/>/;
if (!bgPathRe.test(sourceText) || !sourceText.includes("</svg>")) {
  throw new Error(
    "assets/icon.svg is missing expected background path or </svg> tag.",
  );
}
const standard = Buffer.from(
  sourceText
    .replace(
      bgPathRe,
      '<rect width="512" height="512" rx="112" fill="url(#bg)"/><g transform="translate(-25.6 -25.6) scale(1.1)">',
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
    .toFile(fileURLToPath(new URL(`../assets/${name}.png`, import.meta.url)));
}
// Crisp high-legibility Rose-Pink shield + 3 ascending bars for 16px-48px browser tabs.
const favicon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ec4899"/><stop offset="1" stop-color="#e83e8c"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><path d="M32 10l19 8.4v14.4c0 12.6-8.1 23.6-19 27.7-10.9-4.1-19-15.1-19-27.7V18.4L32 10z" fill="none" stroke="#ffffff" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.5 40v-7M32 40V27.5M39.5 40V22.5" fill="none" stroke="#ffffff" stroke-width="4.4" stroke-linecap="round"/></svg>';
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
