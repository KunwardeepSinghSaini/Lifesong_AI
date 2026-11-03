/* Lifesong backend client and song builder.
   - generateSong(): submits a story, polls the job, returns the finished result.
   - buildSong(): converts the backend result into the cue format game.js plays.
   Change the backend address by setting window.LIFESONG_API_ORIGIN before this
   script loads, e.g. <script>window.LIFESONG_API_ORIGIN='https://api.example.com'</script> */
(function (root) {
  'use strict';
  const ORIGIN = (root.LIFESONG_API_ORIGIN || 'http://localhost:4000').replace(/\/+$/, '');
  const API = ORIGIN + '/api';
  const POLL_MS = 2000;
  const TIMEOUT_MS = 5 * 60 * 1000;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clean = (word) => String(word).toLowerCase().replace(/[^a-z0-9]/g, '');

  async function request(path, options) {
    let res;
    try {
      res = await fetch(API + path, options);
    } catch (_e) {
      throw new Error(`Can't reach the backend at ${ORIGIN}. Is it running? (npm run dev in /backend)`);
    }
    let body = null;
    try { body = await res.json(); } catch (_e) { /* non-JSON error body */ }
    if (!res.ok) throw new Error((body && body.error) || `Backend returned ${res.status}.`);
    return body;
  }

  /** Submit a story and wait for the finished song. onProgress({status, progress}) is optional. */
  async function generateSong(text, genre, onProgress) {
    const payload = { text };
    if (genre) payload.genre = genre;
    const { job_id } = await request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const started = Date.now();
    while (true) {
      const s = await request(`/status/${job_id}`);
      if (onProgress) onProgress(s);
      if (s.status === 'ready') break;
      if (s.status === 'failed') throw new Error(s.error || 'Song generation failed.');
      if (Date.now() - started > TIMEOUT_MS) throw new Error('Song generation took too long. Try again.');
      await wait(POLL_MS);
    }
    return request(`/song/${job_id}`);
  }

  /** The backend may return a path like /media/x.mp3 or a full URL. */
  function resolveAudioUrl(url) {
    return new URL(url, ORIGIN + '/').href;
  }

  /** Pick the word to hide: the longest word, preferring later ones on ties.
      Only words that were actually heard in the audio are eligible, when we know which those are. */
  function pickTarget(words, matched) {
    const pick = (onlyMatched) => {
      let best = -1, bestLen = -1;
      words.forEach((word, i) => {
        if (onlyMatched && matched && !matched[i]) return;
        const len = clean(word).length;
        if (len > 0 && len >= bestLen) { best = i; bestLen = len; }
      });
      return best;
    };
    const heard = matched ? pick(true) : -1;
    if (heard >= 0) return heard;
    const any = pick(false);
    return any >= 0 ? any : 0;
  }

  const r3 = (n) => Math.round(n * 1000) / 1000;

  /** Is the backend's alignment complete and well-formed for exactly these lyric rows? */
  function alignmentUsable(alignment, wordLists) {
    if (!alignment || !Array.isArray(alignment.lines) || alignment.lines.length !== wordLists.length) return false;
    return alignment.lines.every((line, i) => {
      const n = wordLists[i].length;
      return Array.isArray(line.wordStarts) && Array.isArray(line.wordEnds) &&
        line.wordStarts.length === n && line.wordEnds.length === n &&
        line.wordStarts.every(Number.isFinite) && line.wordEnds.every(Number.isFinite);
    });
  }

  // How long a line is shown before its first word is sung, and kept after its last word.
  const LEAD_IN = 0.8;
  const TAIL_OUT = 0.5;

  /** Real timing: each line's window wraps the moments it is actually sung, so intros and
      instrumental breaks fall into the gaps between windows. */
  function linesFromAlignment(rows, wordLists, alignment, total) {
    const n = rows.length;
    const first = alignment.lines.map((l) => l.wordStarts[0]);
    const lastStart = alignment.lines.map((l) => l.wordStarts[l.wordStarts.length - 1]);
    const lastEnd = alignment.lines.map((l) => l.wordEnds[l.wordEnds.length - 1]);
    const starts = first.map((t) => Math.max(0, t - LEAD_IN));
    const ends = lastEnd.map((t, i) => Math.max(lastStart[i] + 0.05, Math.min(total, t + TAIL_OUT)));

    for (let i = 0; i < n - 1; i++) {
      if (ends[i] > starts[i + 1]) {
        // Windows would overlap: cut in the silence between the last word and the next line's first word,
        // never before this line's last word starts or after the next line's first word starts.
        const mid = (lastEnd[i] + first[i + 1]) / 2;
        const cut = Math.min(first[i + 1] - 0.015, Math.max(lastStart[i] + 0.015, mid));
        ends[i] = cut;
        starts[i + 1] = Math.min(Math.max(starts[i + 1], cut), first[i + 1]);
      }
    }

    return rows.map((row, i) => {
      const words = wordLists[i];
      return {
        section: row.section,
        text: words.join(' '),
        start: r3(starts[i]),
        end: r3(ends[i]),
        targetIndex: pickTarget(words, alignment.lines[i].matched),
        wordTimes: alignment.lines[i].wordStarts.map(r3),
      };
    });
  }

  /** Fallback when the audio could not be analysed: spread lines evenly across the track.
      These are guesses, so the song is labelled "estimated". */
  function linesFromEstimate(rows, wordLists, total) {
    const edge = Math.min(8, total * 0.06);
    const slot = (total - edge * 2) / rows.length;
    return rows.map((row, i) => {
      const words = wordLists[i];
      const want = Math.min(8, Math.max(2.5, words.length * 0.55 + 1));
      const len = Math.max(0.6, Math.min(want, slot - 0.2));
      const start = edge + i * slot;
      return {
        section: row.section,
        text: words.join(' '),
        start: r3(start),
        end: r3(start + len),
        targetIndex: pickTarget(words),
        wordTimes: words.map((_, w) => r3(start + (len * 0.9 * w) / words.length)),
      };
    });
  }

  /** Turns the backend result into the cue format game.js plays. */
  function buildSong(result, duration) {
    const rows = result.song.lyrics.filter((l) => l.line && l.line.trim());
    if (!rows.length) throw new Error('The song came back without lyrics.');
    const total = Number.isFinite(duration) && duration > 0 ? duration : 180;
    const wordLists = rows.map((row) => row.line.trim().split(/\s+/));

    let lines, timingStatus;
    if (alignmentUsable(result.alignment, wordLists)) {
      lines = linesFromAlignment(rows, wordLists, result.alignment, total);
      timingStatus = result.alignment.status === 'aligned' ? 'synced' : 'partly synced';
    } else {
      lines = linesFromEstimate(rows, wordLists, total);
      timingStatus = 'estimated';
    }

    return {
      title: result.song.songTitle,
      artist: 'Made with Lifesong',
      genre: (result.song.genreTags || []).slice(0, 2).join(', '),
      duration: total,
      timingStatus,
      timingNote: result.alignment_note || '',
      offset: 0,
      lines,
    };
  }

  root.LifesongAPI = { ORIGIN, generateSong, resolveAudioUrl, buildSong };
})(window);