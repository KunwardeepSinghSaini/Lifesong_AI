import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { SongDataSchema, SongData } from '../schemas/song.schema';

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

const SYSTEM_PROMPT = `
You are an expert songwriter and musical director.
Your task is to take a personal story, memory, or poem provided by the user and transform it into an original, engaging song layout.

Rules:
1. Maintain the emotional heart of the user's story.
2. Structure lyrics clearly into Verse 1, Chorus, Verse 2, Chorus, and Outro.
3. Keep lyrics rhythmically consistent and easy to sing along to.
4. Output strict JSON matching the required schema.
`;

function isMockLlmEnabled(): boolean {
  const value = process.env.USE_MOCK_LLM?.toLowerCase();
  return value === 'true' || value === '1';
}

function buildMockSong(userStory: string, preferredGenre?: string): SongData {
  const preview = userStory.trim().slice(0, 80);
  return {
    songTitle: 'Story in the Spotlight',
    genreTags: preferredGenre
      ? [preferredGenre, 'karaoke', 'story-song']
      : ['pop', 'karaoke', 'upbeat'],
    bpm: 108,
    emotionalTone: 'hopeful',
    lyrics: [
      { section: 'Verse 1', line: 'I wrote it down so I would not forget' },
      { section: 'Verse 1', line: preview || 'A memory waiting to be sung' },
      { section: 'Chorus', line: 'Turn the story into sound' },
      { section: 'Chorus', line: 'Sing it back until it feels like home' },
      { section: 'Verse 2', line: 'Every detail still belongs to us' },
      { section: 'Chorus', line: 'Turn the story into sound' },
      { section: 'Outro', line: 'Hold the last note, let the night remember' },
    ],
    musicPromptString: `${preferredGenre ?? 'pop'} karaoke track, hopeful, 108 BPM, clear vocals`,
  };
}

export async function parseStoryToSong(userStory: string, preferredGenre?: string): Promise<SongData> {
  if (isMockLlmEnabled()) {
    console.log('[LLM] Using fixture lyrics (USE_MOCK_LLM)');
    return buildMockSong(userStory, preferredGenre);
  }

  const userPrompt = `
User Story: "${userStory}"
${preferredGenre ? `Preferred Genre/Style: ${preferredGenre}` : ''}
Transform this input into a structured song configuration.
  `;

  const completion = await getOpenAI().chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: zodResponseFormat(SongDataSchema, 'song_data'),
    temperature: 0.7,
  });

  const parsedResponse = completion.choices[0]?.message.parsed;

  if (!parsedResponse) {
    throw new Error('Failed to parse response from OpenAI model.');
  }

  return parsedResponse;
}