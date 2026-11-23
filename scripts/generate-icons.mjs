// Renders the PWA icons from static/favicon.svg. Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile('static/favicon.svg', 'utf8');
// Full-bleed variant (no rounded corners): iOS and Android mask the icon themselves.
const square = Buffer.from(svg.replace('rx="114"', 'rx="0"'));

await sharp(square).resize(180).png().toFile('static/icons/apple-touch-icon.png');
await sharp(square).resize(192).png().toFile('static/icons/icon-192.png');
await sharp(square).resize(512).png().toFile('static/icons/icon-512.png');
// Maskable: keep the glyph inside the 80% safe zone.
const inner = await sharp(square).resize(410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#1a7cf0' } })
	.composite([{ input: inner, gravity: 'center' }])
	.png()
	.toFile('static/icons/icon-maskable-512.png');
console.log('icons written');
