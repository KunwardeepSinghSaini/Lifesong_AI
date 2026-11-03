import { LyricLineSchema } from '../schemas/song.schema';
import { z } from 'zod';

type LyricLine = z.infer<typeof LyricLineSchema>;

export function formatLyricsForMusicGen(lyrics: LyricLine[]): string {
  let currentSection = '';
  let formattedText = '';

  for (const item of lyrics) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      formattedText += `\n\n[${currentSection}]\n`;
    }
    formattedText += `${item.line}\n`;
  }

  return formattedText.trim();
}