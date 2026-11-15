import { assertEquals } from '../_shared/test-asserts.ts';
import { readImageHeader } from './image-dimensions.ts';

function pad(bytes: number[], len = 64): Uint8Array {
  const out = new Uint8Array(Math.max(len, bytes.length));
  out.set(bytes);
  return out;
}
const str = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

Deno.test('PNG dimensions come from IHDR, including huge declared sizes', () => {
  const png = pad([
    0x89,
    ...str('PNG'),
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0,
    0,
    0,
    13,
    ...str('IHDR'),
    0x00,
    0x00,
    0xc3,
    0x50, // 50000
    0x00,
    0x00,
    0xc3,
    0x50,
  ]);
  assertEquals(readImageHeader(png), { format: 'png', width: 50000, height: 50000 });
});

Deno.test('GIF dimensions are little-endian', () => {
  const gif = pad([...str('GIF89a'), 0x40, 0x01, 0xf0, 0x00]);
  assertEquals(readImageHeader(gif), { format: 'gif', width: 320, height: 240 });
});

Deno.test('JPEG dimensions come from the first SOF marker after other segments', () => {
  const jpeg = pad([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00, // APP0, length 4
    0xff,
    0xc4,
    0x00,
    0x03,
    0x00, // DHT must be skipped, not read as SOF
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    0x04,
    0x38,
    0x07,
    0x80, // SOF0 1080 x 1920
  ]);
  assertEquals(readImageHeader(jpeg), { format: 'jpeg', width: 1920, height: 1080 });
});

Deno.test('WebP VP8X canvas size', () => {
  const webp = pad([
    ...str('RIFF'),
    0,
    0,
    0,
    0,
    ...str('WEBP'),
    ...str('VP8X'),
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0x7f,
    0x07,
    0x00, // 1919 -> 1920
    0x37,
    0x04,
    0x00, // 1079 -> 1080
  ]);
  assertEquals(readImageHeader(webp), { format: 'webp', width: 1920, height: 1080 });
});

Deno.test('unknown formats return null', () => {
  assertEquals(readImageHeader(pad(str('not an image at all, just some text'))), null);
  assertEquals(readImageHeader(new Uint8Array(4)), null);
});
