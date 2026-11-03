import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

// Generated audio is saved here and served at /media/<file> (see server.ts).
// Serving it from our own origin avoids browser CORS problems, because the
// frontend routes audio through the Web Audio API for its visualiser.
export const STORAGE_DIR = path.resolve(process.cwd(), 'storage');

/**
 * Downloads a remote audio file into /storage and returns its public path
 * (e.g. "/media/<jobId>.mp3"). Falls back to the original URL if the
 * download fails, so a caching problem never breaks a job.
 */
export async function cacheAudio(jobId: string, remoteUrl: string): Promise<string> {
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await mkdir(STORAGE_DIR, { recursive: true });
    await writeFile(path.join(STORAGE_DIR, `${jobId}.mp3`), Buffer.from(await res.arrayBuffer()));
    return `/media/${jobId}.mp3`;
  } catch (err) {
    console.warn(`[Storage] Could not cache audio for ${jobId}, using remote URL:`, err);
    return remoteUrl;
  }
}
