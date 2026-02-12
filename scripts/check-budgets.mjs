import fs from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();

const fileBudgets = [
  { file: 'assets/js/effects.bundle.js', maxKb: 320 },
  { file: 'assets/css/style.css', maxKb: 120 },
  { file: 'assets/js/script.js', maxKb: 40 },
  { file: 'assets/images/preview.jpg', maxKb: 100 }
];

const projectsDataPath = path.resolve(cwd, 'assets/data/projects.json');
const projectsPayload = JSON.parse(await fs.readFile(projectsDataPath, 'utf8'));
const projects = Array.isArray(projectsPayload.projects) ? projectsPayload.projects : [];

const projectImageConfigs = projects
  .map((project) => {
    const image = project.image && typeof project.image === 'object' ? project.image : null;
    if (!image) return null;

    const src = String(image.src || '')
      .trim()
      .replace(/^\.\//, '');
    const responsiveBase = String(image.responsiveBase || '').trim();
    const responsiveWidths = Array.isArray(image.responsiveWidths) ? image.responsiveWidths : [];
    if (!src || !responsiveBase || !responsiveWidths.length) return null;

    return { src, responsiveBase, responsiveWidths };
  })
  .filter(Boolean);

const criticalImageBudget = {
  files: Array.from(
    new Set(['assets/images/my-avatar.PNG', ...projectImageConfigs.map((image) => image.src)])
  ),
  maxKb: 300
};

const responsiveAssets = [
  'assets/images/responsive/my-avatar-128.avif',
  'assets/images/responsive/my-avatar-128.webp',
  'assets/images/responsive/my-avatar-256.avif',
  'assets/images/responsive/my-avatar-256.webp',
  'assets/images/responsive/my-avatar-512.avif',
  'assets/images/responsive/my-avatar-512.webp',
  ...projectImageConfigs.flatMap((image) =>
    image.responsiveWidths.flatMap((width) => [
      `assets/images/responsive/${image.responsiveBase}-${width}.avif`,
      `assets/images/responsive/${image.responsiveBase}-${width}.webp`
    ])
  )
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
