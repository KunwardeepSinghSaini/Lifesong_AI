import { fal } from '@fal-ai/client';
import { SongData } from '../schemas/song.schema';
import { formatLyricsForMusicGen } from '../utils/lyric.formatter';

export interface GeneratedMusicResult {
  audioUrl: string;
  durationMs?: number;
  provider: string;
}

const SUNO_API_BASE = 'https://api.sunor.cc/v1'; // Or your chosen Suno Gateway endpoint
const MOCK_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

function isMockAudioEnabled(): boolean {
  const value = process.env.USE_MOCK_AUDIO?.toLowerCase();
  return value === 'true' || value === '1';
}

/**
 * Entry point used by the job queue.
 *   USE_MOCK_AUDIO=true  -> sample track, no provider is contacted
 *   MUSIC_PROVIDER=fal   -> MiniMax Music on fal.ai (default)
 *   MUSIC_PROVIDER=suno  -> Suno through a third-party gateway
 */
export async function generateSongAudio(songData: SongData): Promise<GeneratedMusicResult> {
  if (isMockAudioEnabled()) {
    console.log(`[Music] Using mock audio for "${songData.songTitle}" (USE_MOCK_AUDIO)`);
    return {
      audioUrl: MOCK_AUDIO_URL,
      durationMs: 372000,
      provider: 'mock',
    };
  }

  const provider = (process.env.MUSIC_PROVIDER || 'fal').toLowerCase();
  if (provider === 'fal') return generateWithFal(songData);
  if (provider === 'suno') return generateWithSuno(songData);
  throw new Error(`Unknown MUSIC_PROVIDER "${provider}". Use "fal" or "suno".`);
}

// ---------------------------------------------------------------------------
// fal.ai (MiniMax Music): sings the supplied lyrics in the requested style.
// ---------------------------------------------------------------------------
const FAL_DEFAULT_MODEL = 'fal-ai/minimax-music/v2';

/** minimax-music v2 calls the lyrics field "lyrics_prompt"; v2.5 and v2.6 call it "lyrics". */
function falLyricsField(model: string): string {
  return /\/v2\.[56]/.test(model) ? 'lyrics' : 'lyrics_prompt';
}

/** fal understands tags like [Verse] and [Chorus], but not numbered ones like "Verse 1". */
function toFalSection(name: string): string {
  const cleaned = name.replace(/[\d]+/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Verse';
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLyricsForFal(lyrics: SongData['lyrics'], maxChars = 3000): string {
  const blocks: string[] = [];
  let current = '';
  let total = 0;
  for (const item of lyrics) {
    const tag = toFalSection(item.section);
    const header = tag !== current ? `${blocks.length ? '\n' : ''}[${tag}]\n` : '';
    const chunk = `${header}${item.line.trim()}\n`;
    if (total + chunk.length > maxChars) break; // stop at a whole line instead of cutting mid-line
    blocks.push(chunk);
    total += chunk.length;
    current = tag;
  }
  return blocks.join('').trim();
}

function buildFalStylePrompt(songData: SongData): string {
  const text = `${songData.genreTags.join(', ')}, ${songData.bpm} BPM, ${songData.emotionalTone}`;
  return text.length > 300 ? text.slice(0, 300) : text.padEnd(10, '.');
}

function extractFalAudioUrl(data: any): string | undefined {
  return data?.audio?.url ?? data?.audio_url ?? data?.audio_file?.url ?? data?.url;
}

function explainFalError(err: any): string {
  const status = err?.status;
  const detail = err?.body?.detail ?? err?.message ?? String(err);
  const detailText = typeof detail === 'string' ? detail : JSON.stringify(detail);
  if (status === 401 || status === 403 || /balance|locked|credit/i.test(detailText)) {
    return `fal rejected the request (${status ?? 'auth error'}). Check FAL_KEY and that your fal account has credit (fal.ai/dashboard/billing). Details: ${detailText}`;
  }
  return `fal music generation failed${status ? ` (${status})` : ''}: ${detailText}`;
}

async function generateWithFal(songData: SongData): Promise<GeneratedMusicResult> {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY is not set. Add it to .env, or set USE_MOCK_AUDIO=true for a sample track.');
  }
  fal.config({ credentials: process.env.FAL_KEY });

  const model = process.env.FAL_MUSIC_MODEL || FAL_DEFAULT_MODEL;
  const input: Record<string, unknown> = {
    prompt: buildFalStylePrompt(songData),
    [falLyricsField(model)]: formatLyricsForFal(songData.lyrics),
  };

  console.log(`[fal] Generating "${songData.songTitle}" with ${model}...`);
  let result: { data: any; requestId: string };
  try {
    result = await fal.subscribe(model, {
      input,
      logs: true,
      onQueueUpdate: (update: any) => {
        if (update.status === 'IN_QUEUE') console.log(`[fal] In queue (position ${update.queue_position ?? '?'})`);
        else if (update.status === 'IN_PROGRESS') console.log('[fal] Generating...');
      },
    } as any);
  } catch (err) {
    throw new Error(explainFalError(err));
  }

  const audioUrl = extractFalAudioUrl(result.data);
  if (!audioUrl) {
    throw new Error(`fal returned no audio URL. Response: ${JSON.stringify(result.data).slice(0, 300)}`);
  }
  console.log(`[fal] Done (request ${result.requestId}).`);
  return { audioUrl, provider: `fal:${model}` };
}

// ---------------------------------------------------------------------------
// Suno through a third-party gateway (set MUSIC_PROVIDER=suno and SUNO_API_KEY).
// ---------------------------------------------------------------------------
async function generateWithSuno(songData: SongData): Promise<GeneratedMusicResult> {
  if (!process.env.SUNO_API_KEY) {
    throw new Error(
      'SUNO_API_KEY is not set. Add it to .env, or set USE_MOCK_AUDIO=true for a sample track.',
    );
  }

  const formattedLyrics = formatLyricsForMusicGen(songData.lyrics);
  const styleTags = songData.genreTags.join(', ') + `, ${songData.bpm} BPM, ${songData.emotionalTone}`;

  console.log(`[Suno API] Triggering track creation for "${songData.songTitle}"...`);

  // 1. Submit Generation Task to Suno Gateway
  const response = await fetch(`${SUNO_API_BASE}/music/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUNO_API_KEY}`,
    },
    body: JSON.stringify({
      custom_mode: true,
      prompt: formattedLyrics, // Custom lyrics with [Verse] / [Chorus] tags
      tags: styleTags,          // Genre, mood, and BPM tags
      title: songData.songTitle,
      model_version: 'v6',      // Suno V6 model
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Suno API request failed: ${response.status} - ${errText}`);
  }

  const taskData = await response.json();
  const taskId = taskData.data?.task_id || taskData.task_id;

  if (!taskId) {
    throw new Error('Suno API did not return a valid task_id.');
  }

  // 2. Poll Task Status Until Completion
  console.log(`[Suno API] Polling status for Task ID: ${taskId}...`);
  const audioUrl = await pollSunoTask(taskId);

  return {
    audioUrl,
    provider: 'suno-v6',
  };
}

// Helper: Poll task status every 3 seconds
async function pollSunoTask(taskId: string, maxAttempts = 30): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds

    const res = await fetch(`${SUNO_API_BASE}/music/task/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.SUNO_API_KEY}`,
      },
    });

    if (!res.ok) continue;

    const data = await res.json();
    const status = data.data?.status || data.status;

    console.log(`[Suno Polling] Attempt ${attempt}/${maxAttempts} - Status: ${status}`);

    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const audioUrl = data.data?.audio_url || data.audio_url || data.data?.clips?.[0]?.audio_url;
      if (audioUrl) return audioUrl;
    } else if (status === 'FAILED') {
      throw new Error(`Suno generation failed: ${data.data?.fail_reason || 'Unknown error'}`);
    }
  }

  throw new Error('Suno music generation timed out after 90 seconds.');
}