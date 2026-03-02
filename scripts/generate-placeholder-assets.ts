/**
 * Generate placeholder pixel assets for the Agent Hub pixel office.
 *
 * Creates minimal valid PNG files using only Node built-ins (no canvas dependency).
 * Each PNG is an uncompressed true-color image with a solid color fill.
 *
 * Assets generated:
 *   - office-bg.png        : 960x320, dark background (#18181b)
 *   - guest_anim_1..6.png  : 256x32 spritesheets (8 frames of 32x32), each a different color
 */

import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { join } from "path";

// ── PNG helpers ──────────────────────────────────────────────────────────────

/** Compute CRC32 for a PNG chunk (type + data). */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a single PNG chunk. */
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const payload = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([length, payload, crc]);
}

/** Parse a hex color string like "#18181b" into [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Create a minimal valid PNG with a solid color fill.
 * Uses 8-bit RGB (color type 2, bit depth 8).
 */
function createSolidPng(
  width: number,
  height: number,
  color: string,
): Buffer {
  const [r, g, b] = hexToRgb(color);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width, height, bit depth 8, color type 2 (RGB)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = pngChunk("IHDR", ihdrData);

  // IDAT chunk: raw image data (filter byte 0 + RGB pixels per row)
  const rowBytes = 1 + width * 3; // filter byte + RGB
  const rawData = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }
  const compressed = deflateSync(rawData);
  const idat = pngChunk("IDAT", compressed);

  // IEND chunk
  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const outDir = join(__dirname, "..", "public", "pixel-assets");
mkdirSync(outDir, { recursive: true });

// Office background: 960x320, dark zinc (#18181b)
const bgPng = createSolidPng(960, 320, "#18181b");
writeFileSync(join(outDir, "office-bg.png"), bgPng);
console.log("Created: office-bg.png (960x320)");

// Character spritesheets: 256x32 each (8 frames x 32x32), six distinct colors
const characterColors: Array<{ name: string; color: string }> = [
  { name: "guest_anim_1", color: "#6366f1" }, // indigo
  { name: "guest_anim_2", color: "#22c55e" }, // green
  { name: "guest_anim_3", color: "#ef4444" }, // red
  { name: "guest_anim_4", color: "#f59e0b" }, // amber
  { name: "guest_anim_5", color: "#a855f7" }, // purple
  { name: "guest_anim_6", color: "#3b82f6" }, // blue
];

for (const { name, color } of characterColors) {
  const png = createSolidPng(256, 32, color);
  writeFileSync(join(outDir, `${name}.png`), png);
  console.log(`Created: ${name}.png (256x32, ${color})`);
}

console.log("\nAll placeholder assets generated successfully.");
