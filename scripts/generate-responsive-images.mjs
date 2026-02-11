import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const cwd = process.cwd();
const outDir = path.resolve(cwd, 'assets/images/responsive');
await fs.mkdir(outDir, { recursive: true });

const jobs = [
  {
    input: 'assets/images/my-avatar.PNG',
    base: 'my-avatar',
    widths: [128, 256, 512],
    fit: 'cover'
  },
  {
    input: 'assets/images/nullid-site-preview.png',
    base: 'nullid-site-preview',
    widths: [480, 800, 1200],
    fit: 'cover'
  },
  {
    input: 'assets/images/nullcal-site-preview.png',
    base: 'nullcal-site-preview',
    widths: [480, 800, 1200],
    fit: 'cover'
  },
  {
    input: 'assets/images/pacman-site-preview.png',
    base: 'pacman-site-preview',
    widths: [480, 800, 1200],
    fit: 'cover'
  }
];

for (const job of jobs) {
  const inputPath = path.resolve(cwd, job.input);
  for (const width of job.widths) {
    const avifPath = path.join(outDir, `${job.base}-${width}.avif`);
    const webpPath = path.join(outDir, `${job.base}-${width}.webp`);

    await sharp(inputPath)
      .resize({ width, withoutEnlargement: true, fit: job.fit })
      .avif({ quality: 52, effort: 8 })
      .toFile(avifPath);

    await sharp(inputPath)
      .resize({ width, withoutEnlargement: true, fit: job.fit })
      .webp({ quality: 70, effort: 6 })
      .toFile(webpPath);

    console.log(`generated ${path.relative(cwd, avifPath)}`);
    console.log(`generated ${path.relative(cwd, webpPath)}`);
  }
}
