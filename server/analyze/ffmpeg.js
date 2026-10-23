import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
const run = promisify(execFile);

// ffmpeg location: env override, else bundled Windows path, else system PATH
const WIN_BIN = 'C:/ffmpeg/ffmpeg-2025-05-29-git-75960ac270-essentials_build/bin';
const dir = process.env.FFMPEG_BIN || (fs.existsSync(WIN_BIN) ? WIN_BIN : null);
export const FFMPEG = dir ? `${dir}/ffmpeg` : 'ffmpeg';
export const FFPROBE = dir ? `${dir}/ffprobe` : 'ffprobe';
export const FFMPEG_PATH = process.env.FFMPEG_BIN ? `${process.env.FFMPEG_BIN}/ffmpeg`
  : (fs.existsSync(WIN_BIN) ? `${WIN_BIN}/ffmpeg.exe` : 'ffmpeg');
export const FFPROBE_PATH = process.env.FFMPEG_BIN ? `${process.env.FFMPEG_BIN}/ffprobe`
  : (fs.existsSync(WIN_BIN) ? `${WIN_BIN}/ffprobe.exe` : 'ffprobe');

export function getDuration(path) {
  try {
    const out = execFileSync(FFPROBE_PATH, [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path,
    ]).toString().trim();
    return parseFloat(out) || 0;
  } catch { return 0; }
}

export async function extractPcm(videoPath, outRaw) {
  await run(FFMPEG_PATH, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000',
    '-f', 's16le', '-loglevel', 'error', outRaw], { maxBuffer: 1 << 28 });
  return outRaw;
}
