import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
const run = promisify(execFile);

const BIN = 'C:/ffmpeg/ffmpeg-2025-05-29-git-75960ac270-essentials_build/bin';
export const FFMPEG = `${BIN}/ffmpeg.exe`;
export const FFPROBE = `${BIN}/ffprobe.exe`;

export function getDuration(path) {
  try {
    const out = execFileSync(FFPROBE, [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path,
    ]).toString().trim();
    return parseFloat(out) || 0;
  } catch { return 0; }
}

export async function extractPcm(videoPath, outRaw) {
  await run(FFMPEG, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000',
    '-f', 's16le', '-loglevel', 'error', outRaw], { maxBuffer: 1 << 28 });
  return outRaw;
}
