import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const cwd = process.cwd();
const outDir = path.resolve(cwd, 'assets/images/responsive');
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

for (const job of dedupedJobs) {
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
