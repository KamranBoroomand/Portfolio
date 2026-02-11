import fs from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();

const fileBudgets = [
  { file: 'assets/js/effects.bundle.js', maxKb: 1300 },
  { file: 'assets/css/style.css', maxKb: 120 },
  { file: 'assets/js/script.js', maxKb: 30 },
  { file: 'assets/images/preview.jpg', maxKb: 100 }
];

const criticalImageBudget = {
  files: [
    'assets/images/my-avatar.PNG',
    'assets/images/nullid-site-preview.png',
    'assets/images/nullcal-site-preview.png',
    'assets/images/pacman-site-preview.png'
  ],
  maxKb: 300
};

const responsiveAssets = [
  'assets/images/responsive/my-avatar-128.avif',
  'assets/images/responsive/my-avatar-128.webp',
  'assets/images/responsive/my-avatar-256.avif',
  'assets/images/responsive/my-avatar-256.webp',
  'assets/images/responsive/my-avatar-512.avif',
  'assets/images/responsive/my-avatar-512.webp',
  'assets/images/responsive/nullid-site-preview-480.avif',
  'assets/images/responsive/nullid-site-preview-480.webp',
  'assets/images/responsive/nullid-site-preview-800.avif',
  'assets/images/responsive/nullid-site-preview-800.webp',
  'assets/images/responsive/nullid-site-preview-1200.avif',
  'assets/images/responsive/nullid-site-preview-1200.webp',
  'assets/images/responsive/nullcal-site-preview-480.avif',
  'assets/images/responsive/nullcal-site-preview-480.webp',
  'assets/images/responsive/nullcal-site-preview-800.avif',
  'assets/images/responsive/nullcal-site-preview-800.webp',
  'assets/images/responsive/nullcal-site-preview-1200.avif',
  'assets/images/responsive/nullcal-site-preview-1200.webp',
  'assets/images/responsive/pacman-site-preview-480.avif',
  'assets/images/responsive/pacman-site-preview-480.webp',
  'assets/images/responsive/pacman-site-preview-800.avif',
  'assets/images/responsive/pacman-site-preview-800.webp',
  'assets/images/responsive/pacman-site-preview-1200.avif',
  'assets/images/responsive/pacman-site-preview-1200.webp'
];

let hasFailure = false;

for (const { file, maxKb } of fileBudgets) {
  const fullPath = path.resolve(cwd, file);
  const stat = await fs.stat(fullPath);
  const sizeKb = stat.size / 1024;
  const ok = sizeKb <= maxKb;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${file} ${sizeKb.toFixed(1)}KB <= ${maxKb}KB`);
  if (!ok) {
    hasFailure = true;
  }
}

let criticalTotal = 0;
for (const file of criticalImageBudget.files) {
  const stat = await fs.stat(path.resolve(cwd, file));
  criticalTotal += stat.size;
}

const criticalKb = criticalTotal / 1024;
const criticalOk = criticalKb <= criticalImageBudget.maxKb;
console.log(
  `${criticalOk ? 'PASS' : 'FAIL'} critical image payload ${criticalKb.toFixed(1)}KB <= ${criticalImageBudget.maxKb}KB`
);
if (!criticalOk) {
  hasFailure = true;
}

for (const file of responsiveAssets) {
  try {
    const stat = await fs.stat(path.resolve(cwd, file));
    const sizeKb = stat.size / 1024;
    const ok = sizeKb <= 220;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${file} ${sizeKb.toFixed(1)}KB <= 220KB`);
    if (!ok) {
      hasFailure = true;
    }
  } catch {
    console.log(`FAIL missing responsive asset ${file}`);
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exitCode = 1;
}
