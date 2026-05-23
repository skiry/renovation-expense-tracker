// One-off compression script. Run with `node scripts/compress-surprise.mjs`.
// Compresses /web/public/surprise/* in place using ffmpeg-static (video) and
// sharp (photos). Originals are moved to /scripts/_originals/ as backup.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, renameSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const SRC = join(ROOT, 'web/public/surprise');
const BACKUP = join(ROOT, 'scripts/_originals');
mkdirSync(BACKUP, { recursive: true });

function backup(src) {
  const rel = src.slice(SRC.length + 1);
  const dst = join(BACKUP, rel);
  mkdirSync(join(dst, '..'), { recursive: true });
  renameSync(src, dst);
  return dst;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const videos = [...walk(SRC)].filter((p) => p.toLowerCase().endsWith('.mp4'));
for (const v of videos) {
  const backupPath = backup(v);
  console.log(`Compressing video ${v} (orig: ${(statSync(backupPath).size / 1024 / 1024).toFixed(1)} MB)`);
  const r = spawnSync(
    ffmpegPath,
    [
      '-y',
      '-i',
      backupPath,
      '-c:v',
      'libx264',
      '-crf',
      '26',
      '-preset',
      'slow',
      '-vf',
      "scale='min(1080,iw)':-2",
      '-movflags',
      '+faststart',
      '-an',
      v,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  );
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${v}`);
  console.log(`  -> ${(statSync(v).size / 1024 / 1024).toFixed(1)} MB`);
}

const photos = [...walk(SRC)].filter((p) => /\.(jpe?g|png)$/i.test(p));
for (const photo of photos) {
  const backupPath = backup(photo);
  const origSize = statSync(backupPath).size;
  const out = photo.replace(/\.(jpe?g|png)$/i, '.jpg');
  await sharp(backupPath)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(out);
  console.log(
    `${basename(photo)}: ${(origSize / 1024 / 1024).toFixed(2)} -> ${(
      statSync(out).size /
      1024 /
      1024
    ).toFixed(2)} MB`
  );
  if (extname(out).toLowerCase() !== extname(photo).toLowerCase() && existsSync(photo)) {
    // no-op
  }
}

console.log('\nDone. Originals saved under scripts/_originals/.');
