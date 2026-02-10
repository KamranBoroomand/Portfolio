import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const pngSettings = {
  compressionLevel: 9,
  effort: 10,
  palette: true,
  quality: 80
};

const jpegSettings = {
  quality: 82,
  progressive: true,
  mozjpeg: true
};

const jobs = [
  { file: 'assets/images/my-avatar.PNG', format: 'png' },
  { file: 'assets/images/nullid-site-preview.png', format: 'png' },
  { file: 'assets/images/nullcal-site-preview.png', format: 'png' },
  { file: 'assets/images/pacman-site-preview.png', format: 'png' },
  { file: 'assets/images/project-1.PNG', format: 'png' },
  { file: 'assets/images/project-2.PNG', format: 'png' },
  { file: 'assets/images/project-3.PNG', format: 'png' },
  { file: 'assets/images/project-4.PNG', format: 'png' },
  { file: 'assets/images/project-5.PNG', format: 'png' },
  { file: 'assets/images/web-app-manifest-192x192.png', format: 'png' },
  { file: 'assets/images/web-app-manifest-512x512.png', format: 'png' },
  { file: 'assets/images/apple-touch-icon.png', format: 'png' },
  { file: 'assets/images/favicon-96x96.png', format: 'png' },
  { file: 'assets/images/preview.jpg', format: 'jpeg' }
];

const cwd = process.cwd();
let totalBefore = 0;
let totalAfter = 0;

for (const job of jobs) {
  const filePath = path.resolve(cwd, job.file);
  const original = await fs.readFile(filePath);

  totalBefore += original.length;

  const transformed =
    job.format === 'png'
      ? await sharp(original).png(pngSettings).toBuffer()
      : await sharp(original).jpeg(jpegSettings).toBuffer();

  const candidate = transformed.length < original.length ? transformed : original;
  await fs.writeFile(filePath, candidate);

  totalAfter += candidate.length;

  const beforeKb = (original.length / 1024).toFixed(1);
  const afterKb = (candidate.length / 1024).toFixed(1);
  const status = transformed.length < original.length ? 'optimized' : 'unchanged';
  console.log(`${status.padEnd(9)} ${job.file} ${beforeKb}KB -> ${afterKb}KB`);
}

const savedBytes = totalBefore - totalAfter;
const savedPct = totalBefore > 0 ? ((savedBytes / totalBefore) * 100).toFixed(1) : '0.0';

console.log('');
console.log(`Total before: ${(totalBefore / 1024 / 1024).toFixed(2)}MB`);
console.log(`Total after:  ${(totalAfter / 1024 / 1024).toFixed(2)}MB`);
console.log(`Saved:        ${(savedBytes / 1024 / 1024).toFixed(2)}MB (${savedPct}%)`);
