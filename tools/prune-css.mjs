import { PurgeCSS } from "purgecss";
import { readFile, writeFile } from "node:fs/promises";
const css = await readFile("styles.css", "utf8");
const [result] = await new PurgeCSS().purge({
  content: ["index.html", "app.js"],
  css: [{ raw: css }],
  safelist: {
    standard: ["is-selected", "sr-status"],
    greedy: [/focus-visible/, /::backdrop/],
  },
  rejected: true,
});
await writeFile("styles.css", result.css);
console.log(
  `CSS: ${Buffer.byteLength(css)} → ${Buffer.byteLength(result.css)} bytes; removed ${result.rejected.length} unused selectors.`,
);
