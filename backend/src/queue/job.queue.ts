import { randomUUID } from 'crypto';
import { SongJob, JobStatus } from '../types/job.types.js';
import { parseStoryToSong } from '../services/llm.service.js';
import { generateSongAudio } from '../services/music.service.js';
import { cacheAudio } from '../services/storage.service.js';
import { alignSongLyrics, isAlignmentEnabled, LyricAlignment } from '../services/alignment.service.js';

class JobQueueService {
  private jobs: Map<string, SongJob> = new Map();

  /**
   * Enqueues a new story generation job and initiates background processing.
   */
  public createJob(story: string, genre?: string): SongJob {
    const jobId = randomUUID();
    const job: SongJob = {
      id: jobId,
      status: 'queued',
      progress: 0,
      story,
      ...(genre !== undefined && {genre}),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // Process asynchronously in background
    setImmediate(() => this.processJob(jobId));

    return job;
  }

  /**
   * Retrieves current job status and details.
   */
  public getJob(jobId: string): SongJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Internal state machine transitions.
   */
  private updateJob(jobId: string, updates: Partial<SongJob>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.jobs.set(jobId, {
      ...job,
      ...updates,
      updatedAt: new Date(),
    });
  }

  /**
   * Background Execution Pipeline
   */
  private async processJob(jobId: string): Promise<void> {
    try {
      const job = this.getJob(jobId);
      if (!job) return;

      // Phase 1: LLM Lyric Composition
      this.updateJob(jobId, { status: 'composing_lyrics', progress: 15 });
      const songData = await parseStoryToSong(job.story, job.genre);
      this.updateJob(jobId, { progress: 40 });

      // Phase 2: Audio Synthesis
      this.updateJob(jobId, { status: 'generating_audio', progress: 50 });
      const audioResult = await generateSongAudio(songData);

      // Save a local copy so the browser can play it from our own origin
      const audioUrl = await cacheAudio(jobId, audioResult.audioUrl);

      // Phase 3: Lyric timing. Listen to the finished song and measure when each word is sung.
      // This never fails the job: without it the frontend falls back to estimated timing.
      let alignment: LyricAlignment | undefined;
      let alignmentNote: string | undefined;
      if (audioResult.provider === 'mock') {
        alignmentNote = 'The sample track has no vocals, so lyric timing is estimated.';
      } else if (!isAlignmentEnabled()) {
        alignmentNote = 'Lyric alignment is turned off (ALIGN_LYRICS=false), so timing is estimated.';
      } else {
        this.updateJob(jobId, { status: 'separating_stems', progress: 80 });
        // fal must fetch the audio itself, so give it the provider's public URL (not our localhost copy)
        const outcome = await alignSongLyrics(songData, audioResult.audioUrl);
        if (outcome.ok) alignment = outcome.alignment;
        else alignmentNote = outcome.reason;
      }

      this.updateJob(jobId, {
        status: 'ready',
        progress: 100,
        result: {
          songData,
          audioUrl,
          provider: audioResult.provider,
          ...(alignment && { alignment }),
          ...(alignmentNote && { alignmentNote }),
        },
      });
    } catch (error: any) {
      console.error(`[JobQueue] Job ${jobId} failed:`, error);
      this.updateJob(jobId, {
        status: 'failed',
        progress: 100,
        error: error.message || 'Pipeline execution failed.',
      });
    }
  }
}

export const jobQueue = new JobQueueService();