// tsc only emits .js. The prompts and slide templates are read from disk at
// runtime relative to the compiled module, so they have to travel to dist/.
import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const dir of ['prompts', 'render/templates']) {
  cpSync(join(root, 'src', dir), join(root, 'dist', dir), { recursive: true });
}
