import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { transform } from "esbuild";

await import("./icons.mjs");

const hash = (data) =>
  createHash("sha256").update(data).digest("hex").slice(0, 12);
await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
await cp("assets", "dist/assets", { recursive: true });
let html = await readFile("index.html", "utf8");
const outputs = [];
for (const [file, loader] of [
  ["styles.css", "css"],
  ["model.js", "js"],
  ["app.js", "js"],
]) {
  const source = await readFile(file, "utf8");
  const { code } = await transform(source, {
    loader,
    minify: true,
    target: ["es2022", "safari17"],
    legalComments: "none",
  });
  const output = `assets/${file.replace(/\.(css|js)$/, "")}.${hash(code)}.${loader}`;
  await writeFile(`dist/${output}`, code);
  html = html.replaceAll(`"${file}"`, `"${output}"`);
  outputs.push(output);
}
for (const file of ["manifest.webmanifest", "favicon.svg", "favicon.ico"])
  await cp(file, `dist/${file}`);
// Preserve readable source HTML while removing indentation from the deployed copy.
html = html
  .replace(/<!--[^]*?-->/g, "")
  .replace(/^\s+/gm, "")
  .replace(/\n{2,}/g, "\n");
await writeFile("dist/index.html", html);
const assets = (await readdir("dist/assets"))
  .filter((file) => file !== "OFL.txt" && file !== "icon.svg")
  .map((file) => `./assets/${file}`);
const precache = [
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./favicon.ico",
  ...assets,
];
let revision = html;
for (const file of precache.filter((file) => file !== "./index.html"))
  revision += hash(await readFile(`dist/${file.slice(2)}`));
const sw = (await readFile("sw.js", "utf8"))
  .replace("__CACHE_VERSION__", hash(revision))
  .replace("__PRECACHE__", JSON.stringify(precache));
await writeFile(
  "dist/sw.js",
  (await transform(sw, { loader: "js", minify: true, target: "es2022" })).code,
);
console.log(
  `Built ${outputs.join(", ")}; offline cache ${hash(revision)} (${precache.length} resources).`,
);
