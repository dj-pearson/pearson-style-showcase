import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

export const MEDIA_BUCKET = 'voice-media';

/** Where rendered images and videos go, and where uploaded assets come from. */
export interface Media {
  /** Store bytes at `path` inside the bucket and return the public URL. */
  upload(path: string, data: Buffer, contentType: string): Promise<string>;
  /** Public URL of an object already in the bucket. */
  publicUrl(path: string): string;
  /** Bytes of an object already in the bucket. */
  read(path: string): Promise<Buffer>;
}

export class SupabaseMedia implements Media {
  constructor(private readonly db: SupabaseClient) {}

  async upload(path: string, data: Buffer, contentType: string): Promise<string> {
    const { error } = await this.db.storage
      .from(MEDIA_BUCKET)
      .upload(path, data, { contentType, upsert: true, cacheControl: '31536000' });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
    return this.publicUrl(path);
  }

  publicUrl(path: string): string {
    return this.db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async read(path: string): Promise<Buffer> {
    const { data, error } = await this.db.storage.from(MEDIA_BUCKET).download(path);
    if (error || !data) throw new Error(`download ${path}: ${error?.message ?? 'no data'}`);
    return Buffer.from(await data.arrayBuffer());
  }
}

/** Writes to a local folder. Used by `npm run preview` and by tests. */
export class LocalMedia implements Media {
  readonly written: string[] = [];

  constructor(private readonly root: string) {}

  async upload(path: string, data: Buffer): Promise<string> {
    const file = join(this.root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
    this.written.push(path);
    return this.publicUrl(path);
  }

  publicUrl(path: string): string {
    return pathToFileURL(join(this.root, path)).href;
  }

  read(path: string): Promise<Buffer> {
    return readFile(join(this.root, path));
  }
}
