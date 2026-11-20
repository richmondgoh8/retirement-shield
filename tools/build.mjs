import {
  readFile,
  writeFile,
  mkdir,
  rm,
  cp,
  readdir,
  access,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { transform, build } from "esbuild";

const assertReplace = (source, pattern, replacement, label) => {
  const matched =
    typeof pattern === "string"
      ? source.includes(pattern)
      : pattern.test(source);
  if (!matched) {
    throw new Error(`Build marker not found for ${label}`);
  }
  return typeof pattern === "string"
    ? source.replaceAll(pattern, replacement)
    : source.replace(pattern, replacement);
};

// Only generate icons during build if any required icon asset is missing.
const requiredIcons = [
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png",
  "assets/apple-touch-icon.png",
  "favicon.svg",
  "favicon.ico",
];
let missingIcon = false;
for (const iconPath of requiredIcons) {
  try {
    await access(iconPath);
  } catch {
    missingIcon = true;
    break;
  }
}
if (missingIcon) {
  await import("./icons.mjs");
}

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
  let code;
  if (file === "app.js") {
    const result = await build({
      entryPoints: [file],
      bundle: true,
      format: "iife",
      minify: true,
      target: ["es2022", "safari17"],
      legalComments: "none",
      write: false,
    });
    code = result.outputFiles[0].text;
  } else {
    let source = await readFile(file, "utf8");
    if (file === "styles.css") {
      source = source.replace(
        /url\((["']?)\.\/assets\/([^"')]+)\1\)/g,
        "url(./$2)",
      );
    }
    ({ code } = await transform(source, {
      loader,
      minify: true,
      target: ["es2022", "safari17"],
      legalComments: "none",
    }));
  }
  const output = `assets/${file.replace(/\.(css|js)$/, "")}.${hash(code)}.${loader}`;
  await writeFile(`dist/${output}`, code);
  const attrName = loader === "css" ? "href" : "src";
  if (file === "app.js") {
    html = assertReplace(
      html,
      `<script type="module" src="${file}"></script>`,
      `<script src="${output}" defer></script>`,
      `HTML asset ${file}`,
    );
  } else {
    html = assertReplace(
      html,
      `${attrName}="${file}"`,
      `${attrName}="${output}"`,
      `HTML asset ${file}`,
    );
  }
  outputs.push(output);
}
for (const file of ["manifest.webmanifest", "favicon.svg", "favicon.ico"])
  await cp(file, `dist/${file}`);
// Preserve readable source HTML while removing indentation from the deployed copy.
html = html
  .replace(/<!--[^]*?-->/g, "")
  .replace(/^\s+/gm, "")
  .replace(/\n{2,}/g, "\n");
const collectFiles = async (dir, prefix = "") => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(`${dir}/${entry.name}`, rel)));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  }
  return files.sort();
};
const assets = (await collectFiles("dist/assets"))
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
const buildRev = hash(revision);
html = assertReplace(
  html,
  /<meta name="app-revision" content="[^"]*"/,
  `<meta name="app-revision" content="${buildRev}"`,
  "app-revision meta tag",
);
await writeFile("dist/index.html", html);
let sw = await readFile("sw.js", "utf8");
sw = assertReplace(
  sw,
  /const CACHE_NAME = "retirement-shield-[^"]*";/,
  `const CACHE_NAME = "retirement-shield-${buildRev}";`,
  "SW CACHE_NAME",
);
sw = assertReplace(
  sw,
  /const APP_SHELL = \[[\s\S]*?\];/,
  `const APP_SHELL = ${JSON.stringify(precache)};`,
  "SW APP_SHELL",
);
await writeFile(
  "dist/sw.js",
  (
    await transform(sw, {
      loader: "js",
      minify: true,
      target: ["es2022", "safari17"],
    })
  ).code,
);
console.log(
  `Built ${outputs.join(", ")}; offline cache ${buildRev} (${precache.length} resources).`,
);
