/**
 * #38: writes src/generated/background-images.json from public/backgrounds.
 * Runs in `prebuild`, so a newly added image ships with the next build. The
 * server function bundle has no public/ dir, so the action reads this manifest.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'public', 'backgrounds');
const out = path.join(root, 'src', 'generated', 'background-images.json');

const files = readdirSync(dir)
  .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
  .sort();

if (files.length === 0) {
  console.error(`[generate-background-manifest] no images in ${dir}`);
  process.exit(1);
}

writeFileSync(out, `${JSON.stringify(files, null, 2)}\n`);
console.log(`[generate-background-manifest] wrote ${files.length} images to ${out}`);
