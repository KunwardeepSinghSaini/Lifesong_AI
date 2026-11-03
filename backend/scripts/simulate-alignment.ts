/* Offline accuracy check for the lyric alignment (no network, no API keys).
   Builds songs with a known timeline, corrupts a fake transcript the way a real one
   would be corrupted, then measures how far the recovered timing is from the truth.
   Run: npm run test:align */
import { alignLyricsToWords, AsrWord } from '../src/services/alignment.service';

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

const LYRICS = [
  'Headlights bleeding on the glass tonight', 'Radio hums a song from the past', 'Every mile I leave behind me slowly',
  'Carries me closer to where I belong', 'Take me home through the falling rain', 'Let the city lights remember my name',
  'Take me home through the falling rain', 'Where the quiet streets still know my name', 'Streetlights fade to gold ahead of me',
  'Memories wake like morning thunder', 'Whispering stories I thought were gone', 'Every shadow sings along',
  'Take me home through the falling rain', 'Let the city lights remember my name', 'Take me home through the falling rain',
  'Where the quiet streets still know my name', 'And the last note fades into the dawn', 'Hold the silence until it sings',
];
const SECTIONS = ['Verse 1','Verse 1','Verse 1','Verse 1','Chorus','Chorus','Chorus','Chorus','Verse 2','Verse 2','Verse 2','Verse 2','Chorus','Chorus','Chorus','Chorus','Outro','Outro'];
// seconds of instrumental before each line index (intro, breaks between sections)
const BREAK_BEFORE: Record<number, number> = { 0: 31, 4: 11, 8: 9, 12: 13, 16: 10 };

interface Truth { starts: number[][]; ends: number[][]; duration: number }
function makeTruth(r: () => number): Truth {
  const starts: number[][] = []; const ends: number[][] = [];
  let t = 0;
  LYRICS.forEach((line, i) => {
    t += (BREAK_BEFORE[i] ?? 0) * (0.85 + r() * 0.3) + 0.5 + r() * 0.8;
    const words = line.split(' ');
    const s: number[] = []; const e: number[] = [];
    words.forEach((w) => {
      const dur = 0.22 + w.length * 0.045 + r() * 0.15;
      s.push(t); e.push(t + dur); t += dur + 0.03;
    });
    starts.push(s); ends.push(e);
  });
  return { starts, ends, duration: t + 8 };
}

const STRAY = ['yeah', 'oh', 'the', 'and', 'uh', 'ooh'];
const SOUNDALIKE = (w: string) => (w.length > 4 ? w.slice(0, -2) + 'ed' : w + 's');
function fakeTranscript(truth: Truth, r: () => number, sub: number, del: number, ins: number, jitter: number): AsrWord[] {
  const out: AsrWord[] = [{ text: 'Thanks for watching', start: 1.2, end: 2.4 }]; // typical hallucination
  LYRICS.forEach((line, li) => line.split(' ').forEach((w, wi) => {
    const s = truth.starts[li]![wi]! + gauss(r) * jitter;
    const e = truth.ends[li]![wi]! + gauss(r) * jitter;
    const roll = r();
    if (roll < del) return;
    out.push({ text: roll < del + sub ? SOUNDALIKE(w) : w, start: Math.max(0, s), end: Math.max(s + 0.05, e) });
    if (r() < ins) out.push({ text: STRAY[Math.floor(r() * STRAY.length)]!, start: e + 0.02, end: e + 0.3 });
  }));
  return out;
}

/** The previous method: spread lines evenly across the track. */
function oldEstimate(duration: number) {
  const edge = Math.min(8, duration * 0.06);
  const slot = (duration - edge * 2) / LYRICS.length;
  return LYRICS.map((line, i) => {
    const words = line.split(' ');
    const len = Math.max(0.6, Math.min(Math.min(8, Math.max(2.5, words.length * 0.55 + 1)), slot - 0.2));
    const start = edge + i * slot;
    return words.map((_, w) => start + (len * 0.9 * w) / words.length);
  });
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))]!;

function scenario(name: string, sub: number, del: number, ins: number, jitter: number, runs = 40) {
  const newErr: number[] = []; const matchedErr: number[] = []; const oldErr: number[] = []; const lineErr: number[] = [];
  const oldLineErr: number[] = []; const cov: number[] = []; let invariantFailures = 0; let rejected = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const r = rng(seed * 7919);
    const truth = makeTruth(r);
    const heard = fakeTranscript(truth, r, sub, del, ins, jitter);
    const result = alignLyricsToWords(LYRICS, heard, 'sim', SECTIONS);
    if (!result) { rejected++; continue; }
    cov.push(result.coverage);
    const old = oldEstimate(truth.duration);
    result.lines.forEach((line, li) => {
      const words = LYRICS[li]!.split(' ');
      if (line.wordStarts.length !== words.length) invariantFailures++;
      line.wordStarts.forEach((t, wi) => {
        const e = Math.abs(t - truth.starts[li]![wi]!);
        newErr.push(e); if (line.matched[wi]) matchedErr.push(e);
        oldErr.push(Math.abs(old[li]![wi]! - truth.starts[li]![wi]!));
        if (wi > 0 && t <= line.wordStarts[wi - 1]!) invariantFailures++;
        if (line.wordEnds[wi]! <= t) invariantFailures++;
      });
      lineErr.push(Math.abs(line.wordStarts[0]! - truth.starts[li]![0]!));
      if (process.env.SHOW_OUTLIERS && Math.abs(line.wordStarts[0]! - truth.starts[li]![0]!) > 3) {
        const m = (x?: { matched: boolean[] }) => (x ? `${x.matched.filter(Boolean).length}/${x.matched.length}` : '-');
        console.log(`    outlier: seed ${seed} line ${li} off by ${Math.abs(line.wordStarts[0]! - truth.starts[li]![0]!).toFixed(1)}s | heard this line ${m(line)}, previous ${m(result.lines[li - 1])}, next ${m(result.lines[li + 1])} | break before: ${li in BREAK_BEFORE}`);
      }
      oldLineErr.push(Math.abs(old[li]![0]! - truth.starts[li]![0]!));
      if (li > 0 && line.wordStarts[0]! <= result.lines[li - 1]!.wordStarts.at(-1)!) invariantFailures++;
    });
  }
  console.log(`\n${name}  (misheard ${sub * 100}%, dropped ${del * 100}%, stray ${ins * 100}%, jitter ±${jitter}s)`);
  if (!cov.length) { console.log('  every run was rejected as untrustworthy'); return; }
  console.log(`  words heard & matched : ${(mean(cov) * 100).toFixed(0)}%   runs rejected: ${rejected}/${runs}`);
  console.log(`  OLD even spread  -> line start error: avg ${mean(oldLineErr).toFixed(1)}s, worst ${Math.max(...oldLineErr).toFixed(1)}s`);
  console.log(`  NEW alignment    -> line start error: avg ${mean(lineErr).toFixed(2)}s, 95th pct ${pct(lineErr, 0.95).toFixed(2)}s, worst ${Math.max(...lineErr).toFixed(2)}s`);
  console.log(`  NEW word timing  -> avg ${mean(newErr).toFixed(2)}s (heard words ${mean(matchedErr).toFixed(2)}s), vs OLD avg ${mean(oldErr).toFixed(1)}s`);
  console.log(`  words within 0.9s of truth (the game's "Perfect" window): NEW ${(newErr.filter((e) => e <= 0.9).length / newErr.length * 100).toFixed(0)}%  OLD ${(oldErr.filter((e) => e <= 0.9).length / oldErr.length * 100).toFixed(0)}%`);
  if (invariantFailures) console.log(`  !! ${invariantFailures} ordering/shape violations`);
}

scenario('Clean vocals       ', 0.05, 0.04, 0.02, 0.08);
scenario('Typical sung audio ', 0.12, 0.08, 0.05, 0.15);
scenario('Hard / muddy audio ', 0.25, 0.20, 0.10, 0.25);
scenario('Very poor transcript', 0.40, 0.35, 0.15, 0.30);

console.log('\nFailure handling');
console.log('  empty transcript          ->', alignLyricsToWords(LYRICS, []) === null ? 'rejected (falls back)' : 'ACCEPTED?!');
console.log('  unrelated text            ->', alignLyricsToWords(LYRICS, 'the quick brown fox jumps over the lazy dog again and again'.split(' ').map((t, i) => ({ text: t, start: i, end: i + 0.4 }))) === null ? 'rejected (falls back)' : 'ACCEPTED?!');
const half = fakeTranscript(makeTruth(rng(5)), rng(6), 0.05, 0.04, 0.02, 0.1).filter((w) => w.start < 80);
const partial = alignLyricsToWords(LYRICS, half, 'sim', SECTIONS);
console.log('  transcript stops half way ->', partial ? `${partial.status}, ${(partial.coverage * 100).toFixed(0)}% matched` : 'rejected');
