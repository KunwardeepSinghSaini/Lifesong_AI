import { fal } from '@fal-ai/client';
import { SongData } from '../schemas/song.schema';

/**
 * Lyric alignment: works out WHEN each lyric word is actually sung.
 *
 * 1. (optional) isolate the vocals with Demucs, which makes transcription far more accurate
 * 2. transcribe with Whisper, asking for word-level timestamps
 * 3. match the heard words to the known lyrics with a sequence alignment, so misheard,
 *    missing and extra words don't derail it, and repeated choruses stay in order
 *
 * The result is timing taken from the real audio, so intros, instrumental breaks and
 * the song's real tempo are all accounted for. Nothing here ever throws into the job
 * pipeline: if anything fails the caller gets a reason and the frontend falls back
 * to estimated timing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AsrWord {
  text: string;
  start: number;
  end: number;
}

export interface AlignedLine {
  /** Seconds at which each word of the line starts being sung. Strictly increasing. */
  wordStarts: number[];
  /** Seconds at which each word stops being sung. */
  wordEnds: number[];
  /** true where the time came from a heard word, false where it was inferred. */
  matched: boolean[];
}

export interface LyricAlignment {
  status: 'aligned' | 'partial';
  /** Share of lyric words that were actually heard, 0 to 1. */
  coverage: number;
  source: string;
  lines: AlignedLine[];
}

export type AlignmentOutcome =
  | { ok: true; alignment: LyricAlignment }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
const MATCH_MIN_SIMILARITY = 0.6; // how alike two words must be to count as the same word
const GAP_LYRIC = -1.0; // cost of a lyric word that was not heard
const GAP_ASR = -0.4; // cost of an extra heard word that is not in the lyrics
const MIN_COVERAGE = 0.3; // below this the alignment is not trusted
const FULL_COVERAGE = 0.7; // at or above this the status is "aligned", otherwise "partial"
const AVG_WORD_SECONDS = 0.42; // used to place words we could not hear
const LINE_GAP_SECONDS = 0.35;
const MAX_WORD_SECONDS = 1.4; // Whisper sometimes stretches a word across a break
const MAX_LAST_WORD_SECONDS = 2.2; // the last word of a line may be held longer
const MIN_STEP = 0.03; // minimum spacing between consecutive word starts

const clean = (word: string): string => word.toLowerCase().replace(/[^a-z0-9]/g, '');

function levenshtein(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

/** 1 = identical, 0 = unrelated. Short words must match exactly so "a" never matches "I". */
export function wordSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) <= 3) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// ---------------------------------------------------------------------------
// Core: match heard words to lyric words and compute a time for every lyric word
// ---------------------------------------------------------------------------
interface LyricWord {
  norm: string;
  line: number;
  /** Lines in the same run of one section label share an id (breaks fall between sections). */
  section: number;
}

const DIAG = 1;
const UP = 2;
const LEFT = 3;

/** Semi-global sequence alignment. Returns, for each lyric word, the index of its heard word or -1. */
function matchWords(lyric: LyricWord[], heard: string[]): number[] {
  const n = lyric.length;
  const m = heard.length;
  const width = m + 1;
  const score = new Float64Array((n + 1) * width);
  const ptr = new Uint8Array((n + 1) * width);

  // Extra heard words before the lyrics start are free (hallucinated intro text, humming...).
  for (let i = 1; i <= n; i++) {
    score[i * width] = i * GAP_LYRIC;
    ptr[i * width] = UP;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = wordSimilarity(lyric[i - 1]!.norm, heard[j - 1]!);
      const diag = score[(i - 1) * width + (j - 1)]! + (sim >= MATCH_MIN_SIMILARITY ? 1 + 2 * sim : -1.5);
      const up = score[(i - 1) * width + j]! + GAP_LYRIC;
      const left = score[i * width + (j - 1)]! + GAP_ASR;
      let best = diag;
      let dir = DIAG;
      if (up > best) { best = up; dir = UP; }
      if (left > best) { best = left; dir = LEFT; }
      score[i * width + j] = best;
      ptr[i * width + j] = dir;
    }
  }

  // Extra heard words after the lyrics end are free too.
  let bestJ = 0;
  for (let j = 1; j <= m; j++) {
    if (score[n * width + j]! > score[n * width + bestJ]!) bestJ = j;
  }

  const result = new Array<number>(n).fill(-1);
  let i = n;
  let j = bestJ;
  while (i > 0) {
    const dir = j === 0 ? UP : ptr[i * width + j]!;
    if (dir === DIAG) {
      if (wordSimilarity(lyric[i - 1]!.norm, heard[j - 1]!) >= MATCH_MIN_SIMILARITY) result[i - 1] = j - 1;
      i--;
      j--;
    } else if (dir === UP) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

/**
 * Places a group of unheard words. Words in the same line as a heard neighbour are packed
 * right next to it (that is where they are sung); whole unheard lines are spread across
 * whatever space remains, so an instrumental break is never filled with made-up singing.
 */
function layoutGroup(
  idxs: number[],
  lyric: LyricWord[],
  t0: number,
  t1: number,
  starts: number[],
  ends: number[],
): void {
  if (!idxs.length) return;
  const lines: number[][] = [];
  for (const k of idxs) {
    const last = lines[lines.length - 1];
    if (last && lyric[last[0]!]!.line === lyric[k]!.line) last.push(k);
    else lines.push([k]);
  }
  const natural = lines.map((l) => l.length * AVG_WORD_SECONDS);
  const total = natural.reduce((a, b) => a + b, 0);
  const space = Math.max(0.1, t1 - t0);
  const scale = Math.min(1, Math.max(0.05, (space - LINE_GAP_SECONDS * (lines.length - 1)) / total));
  const used = total * scale;
  const slack = Math.max(0, space - used);
  const gap = lines.length > 1 ? Math.min(slack / (lines.length - 1), 12) : 0;
  let t = t0;
  lines.forEach((l, li) => {
    const per = (natural[li]! * scale) / l.length;
    l.forEach((k) => {
      starts[k] = t;
      ends[k] = t + per * 0.9;
      t += per;
    });
    t += gap;
  });
}

const MAX_LINE_GAP_SECONDS = 2.5; // words of one line are sung close together
const gapBudget = (skippedWords: number): number => MAX_LINE_GAP_SECONDS + 0.8 * skippedWords;

/**
 * A short word like "and" or "the" can match a stray heard word in the middle of an
 * instrumental break. Words of one line are sung together, so if a line's heard words
 * split into far-apart clusters, keep the biggest cluster and drop the loners.
 */
function pruneStrayMatches(lyric: LyricWord[], heard: AsrWord[], matchIdx: number[]): void {
  let i = 0;
  while (i < lyric.length) {
    let end = i;
    while (end < lyric.length && lyric[end]!.line === lyric[i]!.line) end++;
    const hits: number[] = [];
    for (let k = i; k < end; k++) if (matchIdx[k]! >= 0) hits.push(k);
    if (hits.length >= 2) {
      const clusters: number[][] = [[hits[0]!]];
      for (let h = 1; h < hits.length; h++) {
        const prev = hits[h - 1]!;
        const cur = hits[h]!;
        const gap = heard[matchIdx[cur]!]!.start - heard[matchIdx[prev]!]!.end;
        if (gap > gapBudget(cur - prev - 1)) clusters.push([cur]);
        else clusters[clusters.length - 1]!.push(cur);
      }
      if (clusters.length > 1) {
        // biggest cluster wins; on a tie the later one (sung words are rarely early strays)
        let keep = clusters[0]!;
        for (const c of clusters) if (c.length >= keep.length) keep = c;
        for (const c of clusters) if (c !== keep) c.forEach((k) => { matchIdx[k] = -1; });
      }
    }
    i = end;
  }
}

const groupSpan = (idxs: number[], lyric: LyricWord[]): number =>
  idxs.length * AVG_WORD_SECONDS + LINE_GAP_SECONDS * Math.max(0, new Set(idxs.map((k) => lyric[k]!.line)).size - 1);

function fillTimes(lyric: LyricWord[], heard: AsrWord[], matchIdx: number[]): { starts: number[]; ends: number[] } {
  const n = lyric.length;
  const starts = new Array<number>(n).fill(NaN);
  const ends = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const j = matchIdx[i]!;
    if (j >= 0) {
      starts[i] = heard[j]!.start;
      ends[i] = Math.min(heard[j]!.end, heard[j]!.start + MAX_WORD_SECONDS);
    }
  }

  let i = 0;
  while (i < n) {
    if (!Number.isNaN(starts[i]!)) { i++; continue; }
    let b = i;
    while (b < n && Number.isNaN(starts[b]!)) b++;
    const hasLeft = i > 0;
    const hasRight = b < n;
    const leftEnd = hasLeft ? ends[i - 1]! : NaN;
    const rightStart = hasRight ? starts[b]! : NaN;
    const idxs = Array.from({ length: b - i }, (_, k) => i + k);

    if (hasLeft && hasRight) {
      const leftSec = lyric[i - 1]!.section;
      const rightSec = lyric[b]!.section;
      const leftGroup = leftSec === rightSec ? [] : idxs.filter((k) => lyric[k]!.section === leftSec);
      const rightGroup = leftSec === rightSec ? [] : idxs.filter((k) => lyric[k]!.section === rightSec);
      const middle = idxs.filter((k) => !leftGroup.includes(k) && !rightGroup.includes(k));
      const leftSpan = groupSpan(leftGroup, lyric);
      const rightSpan = groupSpan(rightGroup, lyric);
      const room = rightStart - leftEnd;
      if (leftSec !== rightSec && room >= leftSpan + rightSpan + (middle.length ? 0.3 : 0)) {
        // Different sections: the break sits between them. Words stay glued to their own section.
        layoutGroup(leftGroup, lyric, leftEnd + 0.04, leftEnd + 0.04 + leftSpan, starts, ends);
        layoutGroup(rightGroup, lyric, rightStart - 0.04 - rightSpan, rightStart - 0.04, starts, ends);
        layoutGroup(middle, lyric, leftEnd + 0.04 + leftSpan, rightStart - 0.04 - rightSpan, starts, ends);
      } else {
        // Same section (sung continuously) or not enough room: spread evenly between the neighbours.
        const step = room / (idxs.length + 1);
        idxs.forEach((k, q) => {
          starts[k] = leftEnd + step * (q + 1) - Math.min(step, AVG_WORD_SECONDS) / 2;
          ends[k] = starts[k]! + Math.min(step, AVG_WORD_SECONDS) * 0.9;
        });
      }
    } else if (hasRight) {
      // Unheard words before the first heard word: pack backwards from it.
      const span = groupSpan(idxs, lyric);
      layoutGroup(idxs, lyric, Math.max(0, rightStart - 0.04 - span), rightStart - 0.04, starts, ends);
    } else if (hasLeft) {
      // Unheard words after the last heard word: pack forwards from it.
      const span = groupSpan(idxs, lyric);
      layoutGroup(idxs, lyric, leftEnd + 0.04, leftEnd + 0.04 + span, starts, ends);
    }
    i = b;
  }
  return { starts, ends };
}

/**
 * Aligns lyric lines to heard words. Returns null when too little was heard to be trusted.
 * Exported for tests and for the offline simulation script.
 */
export function alignLyricsToWords(
  lyricLines: string[],
  heard: AsrWord[],
  source = 'whisper',
  sections?: string[],
): LyricAlignment | null {
  const lyric: LyricWord[] = [];
  const wordCounts: number[] = [];
  let sectionId = 0;
  lyricLines.forEach((text, line) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    wordCounts.push(words.length);
    // without labels every line counts as its own section (the safe, previous behaviour)
    if (line > 0 && (!sections || sections[line] !== sections[line - 1])) sectionId++;
    words.forEach((w) => lyric.push({ norm: clean(w), line, section: sectionId }));
  });
  if (!lyric.length) return null;

  const usable = heard
    .filter((w) => clean(w.text) && Number.isFinite(w.start) && Number.isFinite(w.end))
    .sort((a, b) => a.start - b.start);
  if (!usable.length) return null;

  const matchIdx = matchWords(lyric, usable.map((w) => clean(w.text)));
  pruneStrayMatches(lyric, usable, matchIdx);
  const matchedCount = matchIdx.filter((j) => j >= 0).length;
  const coverage = matchedCount / lyric.length;
  if (coverage < MIN_COVERAGE) return null;

  const { starts, ends } = fillTimes(lyric, usable, matchIdx);

  // Final pass: force strictly increasing starts, sensible ends, no negative times.
  for (let k = 0; k < starts.length; k++) {
    if (!Number.isFinite(starts[k]!)) starts[k] = k ? starts[k - 1]! + AVG_WORD_SECONDS : 0;
    if (k > 0 && starts[k]! < starts[k - 1]! + MIN_STEP) starts[k] = starts[k - 1]! + MIN_STEP;
    starts[k] = Math.max(0, starts[k]!);
  }
  for (let k = 0; k < ends.length; k++) {
    const sameLineNext = k + 1 < lyric.length && lyric[k + 1]!.line === lyric[k]!.line;
    const cap = sameLineNext ? starts[k + 1]! : starts[k]! + MAX_LAST_WORD_SECONDS;
    let e = Number.isFinite(ends[k]!) ? ends[k]! : starts[k]! + AVG_WORD_SECONDS;
    e = Math.min(Math.max(e, starts[k]! + 0.05), Math.max(cap, starts[k]! + 0.05));
    ends[k] = e;
  }

  const lines: AlignedLine[] = [];
  let cursor = 0;
  for (const count of wordCounts) {
    lines.push({
      wordStarts: starts.slice(cursor, cursor + count).map(round3),
      wordEnds: ends.slice(cursor, cursor + count).map(round3),
      matched: matchIdx.slice(cursor, cursor + count).map((j) => j >= 0),
    });
    cursor += count;
  }
  return { status: coverage >= FULL_COVERAGE ? 'aligned' : 'partial', coverage: round3(coverage), source, lines };
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// fal.ai pipeline: Demucs (vocals) -> Whisper (word timestamps) -> alignment
// ---------------------------------------------------------------------------
const STAGE_TIMEOUT_MS = 4 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), STAGE_TIMEOUT_MS);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

async function separateVocals(audioUrl: string): Promise<string | null> {
  try {
    console.log('[Align] Isolating vocals (Demucs)...');
    // Only the vocals are needed, so use the 4-stem model and ask for just that stem (cheaper and faster
    // than the default 6-stem model that splits out guitar and piano too).
    const result: any = await withTimeout(
      fal.subscribe('fal-ai/demucs', {
        input: { audio_url: audioUrl, model: 'htdemucs', stems: ['vocals'], output_format: 'mp3' },
      } as any),
      'Demucs',
    );
    const url = result?.data?.vocals?.url;
    if (!url) throw new Error('no vocals in reply');
    return url;
  } catch (err: any) {
    console.warn(`[Align] Vocal separation failed, will use the full mix: ${err?.message ?? err}`);
    return null;
  }
}

/** Reads Whisper chunks into words, tolerating a few output shapes. */
export function chunksToWords(chunks: any[] | undefined): AsrWord[] {
  const words: AsrWord[] = [];
  for (const chunk of chunks ?? []) {
    const text = String(chunk?.text ?? '').trim();
    if (!text) continue;
    let start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : chunk.start;
    let end = Array.isArray(chunk.timestamp) ? chunk.timestamp[1] : chunk.end;
    if (typeof start !== 'number') continue;
    if (typeof end !== 'number' || end < start) end = start + AVG_WORD_SECONDS;
    const parts = text.split(/\s+/);
    if (parts.length === 1) {
      words.push({ text, start, end });
    } else {
      // Got a phrase instead of a word: share its span between the words.
      const step = (end - start) / parts.length;
      parts.forEach((p, i) => words.push({ text: p, start: start + step * i, end: start + step * (i + 1) }));
    }
  }
  return words;
}

async function transcribe(audioUrl: string, language: string | undefined, prompt: string | undefined): Promise<AsrWord[]> {
  const input: Record<string, unknown> = { audio_url: audioUrl, task: 'transcribe', chunk_level: 'word' };
  if (language) input.language = language;
  if (prompt) input.prompt = prompt;
  const result: any = await withTimeout(fal.subscribe('fal-ai/whisper', { input } as any), 'Whisper');
  return chunksToWords(result?.data?.chunks);
}

function looksEnglish(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters.length) return true;
  return letters.replace(/[^a-zA-Z]/g, '').length / letters.length > 0.9;
}

export function isAlignmentEnabled(): boolean {
  const v = process.env.ALIGN_LYRICS?.toLowerCase();
  return !(v === 'false' || v === '0');
}

/** Never throws. */
export async function alignSongLyrics(songData: SongData, audioUrl: string): Promise<AlignmentOutcome> {
  try {
    if (!process.env.FAL_KEY) return { ok: false, reason: 'FAL_KEY is not set, so lyric timing could not be measured.' };
    fal.config({ credentials: process.env.FAL_KEY });

    const usableRows = songData.lyrics.filter((l) => l.line && l.line.trim());
    const rows = usableRows.map((l) => l.line);
    const sections = usableRows.map((l) => l.section);
    const allText = rows.join(' ');
    const language = looksEnglish(allText) ? 'en' : undefined;
    const prompt = process.env.ALIGN_WHISPER_PROMPT?.toLowerCase() === 'true' ? allText.slice(0, 600) : undefined;

    const attempts: Array<{ label: string; url: string }> = [];
    const skipSeparation = process.env.ALIGN_SEPARATE_VOCALS?.toLowerCase() === 'false';
    const vocals = skipSeparation ? null : await separateVocals(audioUrl);
    if (vocals) attempts.push({ label: 'vocals', url: vocals });
    attempts.push({ label: 'full mix', url: audioUrl });

    let best: LyricAlignment | null = null;
    let lastError = 'nothing was heard in the audio';
    for (const attempt of attempts) {
      try {
        console.log(`[Align] Transcribing ${attempt.label} (Whisper)...`);
        const heard = await transcribe(attempt.url, language, prompt);
        console.log(`[Align] Heard ${heard.length} words.`);
        const result = alignLyricsToWords(rows, heard, `whisper:${attempt.label}`, sections);
        if (result && (!best || result.coverage > best.coverage)) best = result;
        if (result && result.status === 'aligned') break; // good enough, skip the retry
        if (!result) lastError = `could not match the lyrics to the ${attempt.label} (heard ${heard.length} words)`;
      } catch (err: any) {
        lastError = `${attempt.label}: ${err?.message ?? err}`;
        console.warn(`[Align] Transcribing ${attempt.label} failed: ${lastError}`);
      }
    }

    if (!best) return { ok: false, reason: `Lyric timing unavailable (${lastError}).` };
    console.log(`[Align] ${best.status}, ${Math.round(best.coverage * 100)}% of lyric words matched (${best.source}).`);
    return { ok: true, alignment: best };
  } catch (err: any) {
    return { ok: false, reason: `Lyric timing unavailable (${err?.message ?? err}).` };
  }
}
