// Encode filmed instructor masters -> public/instructor + instructorClips.generated.json.
// Usage: node assets/video/encode.mjs
//
// For each assets/video/<name>.mp4:
//   - copies the mp4 verbatim into public/instructor/
//   - encodes a VP9/Opus public/instructor/<name>.webm fallback-preferred variant
//   - extracts a first-frame public/instructor/<name>.webp poster
//   - probes real duration/dimensions/audio presence via ffprobe
//
// Requires `ffmpeg`/`ffprobe` on PATH (dev-machine only; not run in CI).
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = HERE;
const OUT = path.resolve(HERE, '../../public/instructor');
const MANIFEST = path.resolve(HERE, '../../app/data/instructorClips.generated.json');

async function probe(mp4Path) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_entries', 'stream=codec_type,width,height',
    '-show_entries', 'format=duration',
    mp4Path,
  ]);
  const data = JSON.parse(stdout);
  const videoStream = data.streams.find((s) => s.codec_type === 'video');
  const hasAudio = data.streams.some((s) => s.codec_type === 'audio');
  return {
    duration: Number(Number(data.format.duration).toFixed(3)),
    width: videoStream.width,
    height: videoStream.height,
    hasAudio,
  };
}

async function encodeWebm(mp4Path, webmPath) {
  await run('ffmpeg', [
    '-y', '-i', mp4Path,
    '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-deadline', 'good', '-cpu-used', '2',
    '-c:a', 'libopus', '-b:a', '96k',
    webmPath,
  ]);
}

async function encodePoster(mp4Path, posterPath) {
  await run('ffmpeg', [
    '-y', '-i', mp4Path,
    '-frames:v', '1', '-q:v', '80',
    posterPath,
  ]);
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => f.endsWith('.mp4')).sort();

const manifest = {};
for (const file of files) {
  const name = file.replace(/\.mp4$/, '');
  const srcPath = path.join(SRC, file);
  const mp4Out = path.join(OUT, `${name}.mp4`);
  const webmOut = path.join(OUT, `${name}.webm`);
  const posterOut = path.join(OUT, `${name}.webp`);

  await copyFile(srcPath, mp4Out);
  await encodeWebm(srcPath, webmOut);
  await encodePoster(srcPath, posterOut);
  const info = await probe(srcPath);

  manifest[name] = { name, ...info };
  console.log(`  encoded ${name} (${info.duration}s, ${info.width}x${info.height}, audio=${info.hasAudio})`);
}

await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Done. Wrote ${Object.keys(manifest).length} clip(s) to ${path.relative(process.cwd(), MANIFEST)}.`);
