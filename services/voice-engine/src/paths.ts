import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory of the compiled or source module tree (src/ under tsx, dist/ when built). */
export const MODULE_ROOT = dirname(fileURLToPath(import.meta.url));

/** services/voice-engine: the parent of src/ and of dist/. */
export const PACKAGE_ROOT = join(MODULE_ROOT, '..');

export const PROMPTS_DIR = join(MODULE_ROOT, 'prompts');
export const TEMPLATES_DIR = join(MODULE_ROOT, 'render', 'templates');
export const FONTS_DIR = join(PACKAGE_ROOT, 'assets', 'fonts');
export const VOICE_FILE = join(PACKAGE_ROOT, 'voice', 'danpearson.voice.json');
