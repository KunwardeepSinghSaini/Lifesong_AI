import { SongData } from '../schemas/song.schema.js';
import type { LyricAlignment } from '../services/alignment.service.js';

export type JobStatus = 
  | 'queued' 
  | 'composing_lyrics' 
  | 'generating_audio' 
  | 'separating_stems' 
  | 'ready' 
  | 'failed';

export interface SongJob {
  id: string;
  status: JobStatus;
  progress: number; // 0 to 100
  story: string;
  genre?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  result?: {
    songData: SongData;
    audioUrl: string;
    provider: string;
    isFallback?: boolean;
    /** Real per-word timing measured from the audio, when available. */
    alignment?: LyricAlignment;
    /** Why alignment is missing or partial, in plain words. */
    alignmentNote?: string;
  };
}