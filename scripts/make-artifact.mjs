// Turns the Vite build into one self-contained page for hosting as a claude.ai Artifact:
// CSS and JS are inlined (the host only loads scripts from a few CDNs), fonts come from Google Fonts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const jsFile = html.match(/src="\.?\/?(assets\/[^"]+\.js)"/)[1];
const cssFile = html.match(/href="\.?\/?(assets\/[^"]+\.css)"/)[1];
const js = readFileSync(join(dist, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(dist, cssFile), 'utf8').replace(/<\/style/gi, '<\\/style');

const page = `<title>Hostel Allotment</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>:root{color-scheme:light}${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;

const outDir = join(root, '..', 'publish');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'hostel-allotment.html'), page);
console.log(`Wrote publish/hostel-allotment.html (${(page.length / 1024).toFixed(0)} KB)`);
