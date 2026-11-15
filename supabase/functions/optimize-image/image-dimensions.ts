/**
 * Read an image's pixel dimensions from its header, without decoding it.
 *
 * optimize-image used to hand any file straight to ImageMagick (wasm), which
 * allocates the full decoded bitmap. A small, highly compressed PNG can
 * declare 50,000 x 50,000 pixels and take the whole shared Deno process down
 * with it. Reading the header first lets the caller refuse that before any
 * decode. Supports the formats the admin upload accepts: PNG, JPEG, GIF, WebP.
 */

export type ImageHeader = {
  format: 'png' | 'jpeg' | 'gif' | 'webp';
  width: number;
  height: number;
};

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
const ascii = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...Array.from(b.subarray(i, i + n)));

function readJpeg(b: Uint8Array): ImageHeader | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    // Markers without a length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2;
      continue;
    }
    // SOF0..SOF15 carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) don't.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { format: 'jpeg', height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    const len = u16be(b, i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

export function readImageHeader(b: Uint8Array): ImageHeader | null {
  if (b.length < 30) return null;

  // PNG: signature, then IHDR width/height (big-endian).
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    return { format: 'png', width: u32be(b, 16), height: u32be(b, 20) };
  }

  // GIF: logical screen size (little-endian).
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') {
    return { format: 'gif', width: u16le(b, 6), height: u16le(b, 8) };
  }

  // WebP: RIFF container, three chunk flavours.
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8X') {
      return { format: 'webp', width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
    }
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
      return {
        format: 'webp',
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    if (chunk === 'VP8 ') {
      return { format: 'webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
    }
    return null;
  }

  if (b[0] === 0xff && b[1] === 0xd8) return readJpeg(b);

  return null;
}
