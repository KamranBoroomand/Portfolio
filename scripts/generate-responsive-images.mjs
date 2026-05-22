import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const cwd = process.cwd();
const outDir = path.resolve(cwd, 'assets/images/responsive');
const scriptPath = fileURLToPath(import.meta.url);
const force = process.argv.includes('--force');
const avifOptions = { quality: 52, effort: 4 };
const webpOptions = { quality: 70, effort: 4 };
await fs.mkdir(outDir, { recursive: true });

const staticJobs = [
  {
    input: 'assets/images/my-avatar.PNG',
    base: 'my-avatar',
    widths: [128, 256, 512],
    fit: 'cover'
  }
];

const projectsDataPath = path.resolve(cwd, 'assets/data/projects.json');
const projectsPayload = JSON.parse(await fs.readFile(projectsDataPath, 'utf8'));
const projectsDataStat = await fs.stat(projectsDataPath);
const scriptStat = await fs.stat(scriptPath);
const projects = Array.isArray(projectsPayload.projects) ? projectsPayload.projects : [];

const projectJobs = projects
  .map((project) => {
    const image = project.image && typeof project.image === 'object' ? project.image : null;
    if (!image) return null;

    const input = String(image.src || '')
      .trim()
      .replace(/^\.\//, '');
    const base = String(image.responsiveBase || '').trim();
    const widths = Array.isArray(image.responsiveWidths) ? image.responsiveWidths : [];
    if (!input || !base || !widths.length) return null;

    return {
      input,
      base,
      widths,
      fit: 'cover'
    };
  })
  .filter(Boolean);

const jobs = [...staticJobs, ...projectJobs];
const dedupedJobs = Array.from(new Map(jobs.map((job) => [job.base, job])).values());

async function isUpToDate(filePath, sourceMtimeMs) {
  try {
    const stat = await fs.stat(filePath);
    return stat.mtimeMs >= sourceMtimeMs;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

for (const job of dedupedJobs) {
  const inputPath = path.resolve(cwd, job.input);
  const inputStat = await fs.stat(inputPath);
  const sourceMtimeMs = Math.max(inputStat.mtimeMs, projectsDataStat.mtimeMs, scriptStat.mtimeMs);

  for (const width of job.widths) {
    const avifPath = path.join(outDir, `${job.base}-${width}.avif`);
    const webpPath = path.join(outDir, `${job.base}-${width}.webp`);
    const avifRelativePath = path.relative(cwd, avifPath);
    const webpRelativePath = path.relative(cwd, webpPath);
    const outputsCurrent =
      !force &&
      (await isUpToDate(avifPath, sourceMtimeMs)) &&
      (await isUpToDate(webpPath, sourceMtimeMs));

    if (outputsCurrent) {
      console.log(`skipped ${avifRelativePath} and ${webpRelativePath}`);
      continue;
    }

    await sharp(inputPath)
      .resize({ width, withoutEnlargement: true, fit: job.fit })
      .avif(avifOptions)
      .toFile(avifPath);

    await sharp(inputPath)
      .resize({ width, withoutEnlargement: true, fit: job.fit })
      .webp(webpOptions)
      .toFile(webpPath);

    console.log(`generated ${avifRelativePath}`);
    console.log(`generated ${webpRelativePath}`);
  }
}
