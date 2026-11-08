const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const manifest = JSON.parse(fs.readFileSync('dist/manifest.webmanifest'));

test('install assets have actual declared dimensions and maskable artwork is opaque', async () => {
  for (const icon of manifest.icons) {
    const file = path.join('dist', icon.src);
    const image = sharp(file);
    const meta = await image.metadata();
    assert.equal(`${meta.width}x${meta.height}`, icon.sizes);
    assert.equal(meta.format, 'png');
    if (icon.purpose === 'maskable') assert.equal((await image.stats()).isOpaque, true);
  }
  const apple = await sharp('dist/assets/apple-touch-icon.png').metadata();
  assert.equal(apple.width, 180);assert.equal(apple.height,180);
  assert.equal((await sharp('dist/assets/apple-touch-icon.png').stats()).isOpaque,true);
});
test('manifest identity, scope, launch and shortcuts remain within the app', () => {
  const base = new URL('https://example.test/');
  assert.equal(new URL(manifest.id,base).href,new URL(manifest.start_url,base).href);
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'&&icon.purpose==='any'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='any'));
  for (const shortcut of manifest.shortcuts) assert.equal(new URL(shortcut.url,base).origin,base.origin);
});
test('production HTML and CSS reference existing local files and no external font service', () => {
  const html = fs.readFileSync('dist/index.html','utf8');
  assert.equal(html.includes('fonts.googleapis.com'),false);
  assert.equal(html.includes('fonts.gstatic.com'),false);
  const files = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1]).filter(file=>!file.includes(':'));
  for(const file of files) assert.ok(fs.existsSync(path.join('dist',file)),file);
  const cssFile = files.find(file=>file.endsWith('.css'));
  const css = fs.readFileSync(path.join('dist',cssFile),'utf8');
  for(const match of css.matchAll(/url\(["']?([^)'" ]+)["']?\)/g)) {
    assert.ok(fs.existsSync(path.resolve('dist',path.dirname(cssFile),match[1])),match[1]);
  }
  assert.match(html,/assets\/app\.[a-f0-9]{12}\.js/);
  assert.match(html,/assets\/styles\.[a-f0-9]{12}\.css/);
  assert.equal(fs.existsSync('dist/app.js'),false);
});
test('service worker has a concrete build revision and bounded app cache', () => {
  const sw = fs.readFileSync('dist/sw.js','utf8');
  assert.equal(sw.includes('__PRECACHE__'),false);
  assert.equal(sw.includes('__CACHE_VERSION__'),false);
  assert.ok(sw.includes('retirement-shield-'));
  assert.ok(sw.includes('startsWith('));
  assert.ok(sw.includes('text/html'));
});
