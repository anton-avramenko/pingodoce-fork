/**
 * Dependency-free PWA icon generator.
 *
 * Draws the placeholder app icon (green rounded square with white
 * barcode-style bars) directly as RGBA pixels and encodes PNG files using
 * only Node's built-in zlib — no image library required, so `npm run build`
 * works on any CI runner.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// Brand colors (keep in sync with tailwind.config.ts)
const GREEN = [0x96, 0xc1, 0x1f, 0xff];
const GREEN_DARK = [0x7b, 0xa2, 0x12, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];
const TRANSPARENT = [0, 0, 0, 0];

/** CRC-32 implementation as required by the PNG chunk format. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encodes an RGBA pixel buffer as a PNG file. */
function encodePng(width, height, rgba) {
  // Each scanline is prefixed with filter type 0 (None)
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Renders the icon at the given size.
 * Layout: rounded-square green background with a subtle vertical gradient
 * and a centered group of white vertical bars evoking a barcode.
 */
function renderIcon(size, { opaqueCorners = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = Math.round(size * 0.22);

  // Barcode motif: bar widths as fractions of the icon size
  const barPattern = [2, 1, 3, 1, 1, 2, 1, 3, 1, 2]; // relative widths, gaps between
  const unit = (size * 0.52) / (barPattern.reduce((a, b) => a + b, 0) + barPattern.length - 1);
  const barTop = Math.round(size * 0.32);
  const barBottom = Math.round(size * 0.68);
  const barsStart = Math.round(size * 0.24);

  // Precompute bar x-ranges
  const bars = [];
  let x = barsStart;
  for (const w of barPattern) {
    bars.push([x, x + w * unit]);
    x += (w + 1) * unit;
  }

  const inCorner = (px, py) => {
    const cx = px < radius ? radius : px >= size - radius ? size - radius - 1 : null;
    const cy = py < radius ? radius : py >= size - radius ? size - radius - 1 : null;
    if (cx === null || cy === null) return false;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy > radius * radius;
  };

  for (let py = 0; py < size; py++) {
    // Vertical gradient between the two greens
    const t = py / size;
    const bg = [
      Math.round(GREEN[0] + (GREEN_DARK[0] - GREEN[0]) * t),
      Math.round(GREEN[1] + (GREEN_DARK[1] - GREEN[1]) * t),
      Math.round(GREEN[2] + (GREEN_DARK[2] - GREEN[2]) * t),
      0xff,
    ];
    for (let px = 0; px < size; px++) {
      let color = bg;
      if (inCorner(px, py)) {
        // Maskable icons must be fully opaque edge-to-edge
        color = opaqueCorners ? bg : TRANSPARENT;
      } else if (py >= barTop && py < barBottom) {
        for (const [x0, x1] of bars) {
          if (px >= x0 && px < x1) {
            color = WHITE;
            break;
          }
        }
      }
      rgba.set(color, (py * size + px) * 4);
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'icon-192.png'), renderIcon(192));
writeFileSync(join(OUT_DIR, 'icon-512.png'), renderIcon(512, { opaqueCorners: true }));
writeFileSync(join(OUT_DIR, 'apple-touch-icon.png'), renderIcon(180, { opaqueCorners: true }));
console.log(`PWA icons written to ${OUT_DIR}`);
