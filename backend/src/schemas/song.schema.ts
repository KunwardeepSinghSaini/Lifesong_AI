import { z } from 'zod';

export const LyricLineSchema = z.object({
  section: z.string().describe("Section name, e.g., 'Verse 1', 'Chorus', 'Bridge'"),
  line: z.string().describe("A single line of lyric"),
});

export const SongDataSchema = z.object({
  songTitle: z.string().describe("An energetic or meaningful song title based on the story"),
  genreTags: z.array(z.string()).describe("3 to 5 music genre/style tags, e.g. ['synthwave', '80s pop', 'upbeat']"),
  bpm: z.number().int().min(60).max(180).describe("Optimal Beats Per Minute for the track"),
  emotionalTone: z.string().describe("Core mood string, e.g., 'nostalgic', 'triumphant', 'funny'"),
  lyrics: z.array(LyricLineSchema).describe("Line-by-line breakdown of the generated song lyrics"),
  musicPromptString: z.string().describe("Concise prompt optimized for text-to-music AI generators"),
});

export type SongData = z.infer<typeof SongDataSchema>;

export const GenerateSongRequestSchema = z.object({
  story: z
    .string()
    .trim()
    .min(1, 'A text story is required.')
    .max(5000, 'Story must be 5000 characters or fewer.'),
  genre: z.string().trim().min(1).max(80).optional(),
});

export type GenerateSongRequest = z.infer<typeof GenerateSongRequestSchema>;