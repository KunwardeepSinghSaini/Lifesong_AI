/* Browser-independent cue lookup and one-attempt-per-line scoring. */
(function (root) {
  const clean = (word) => String(word).toLowerCase().replace(/[^a-z0-9]/g, '');
  function cueAt(song, time, offset = 0) {
    const t = time - offset;
    const index = song.lines.findIndex((line) => t >= line.start && t < line.end);
    if (index < 0) return { index: -1, line: null, progress: 0, word: -1 };
    const line = song.lines[index];
    const words = line.text.split(/\s+/);
    const progress = Math.max(0, Math.min(1, (t - line.start) / (line.end - line.start)));
    const word = line.wordTimes
      ? Math.max(0, line.wordTimes.findLastIndex((at) => t >= at))
      : Math.min(words.length - 1, Math.floor(progress * words.length));
    return { index, line, progress, word };
  }
  function targetTime(line) {
    return line.wordTimes ? line.wordTimes[line.targetIndex] :
      line.start + (line.end - line.start) * line.targetIndex / line.text.split(/\s+/).length;
  }
  class Score {
    constructor(song) { this.song = song; this.reset(); }
    reset() { this.points = 0; this.combo = 0; this.bestCombo = 0; this.hits = 0; this.perfect = 0; this.attempted = new Map(); }
    attempt(index, answer, time, offset = 0) {
      const line = this.song.lines[index];
      const t = time - offset;
      if (!line || t < line.start || t >= line.end || this.attempted.has(index)) return null;
      const correct = clean(answer) === clean(line.text.split(/\s+/)[line.targetIndex]);
      if (!correct) { this.combo = 0; this.attempted.set(index, false); return { correct: false, grade: 'Keep the groove', points: 0 }; }
      const perfect = Math.abs(t - targetTime(line)) <= 0.9;
      this.combo++; this.hits++; this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (perfect) this.perfect++;
      const multiplier = Math.min(4, 1 + Math.floor((this.combo - 1) / 4));
      const points = (perfect ? 250 : 100) * multiplier;
      this.points += points; this.attempted.set(index, true);
      return { correct: true, grade: perfect ? 'Perfect!' : 'Good match!', points, multiplier };
    }
    miss(index) { if (index >= 0 && !this.attempted.has(index)) { this.attempted.set(index, false); this.combo = 0; } }
  }
  const api = { clean, cueAt, targetTime, Score };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KaraokeCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
