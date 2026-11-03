import { Request, Response } from 'express';
import { jobQueue } from '../queue/job.queue.js';

/**
 * POST /api/generate
 * Accepts user story, enqueues job, and returns 202 Accepted with job_id
 */
export async function generateSongHandler(req: Request, res: Response): Promise<void> {
  const { text, story, genre } = req.body;
  const rawStory = text || story; // Supports both contract payload variations

  if (!rawStory || typeof rawStory !== 'string' || rawStory.trim().length === 0) {
    res.status(400).json({ error: 'A valid text story is required in the request body.' });
    return;
  }

  const job = jobQueue.createJob(rawStory.trim(), genre);

  res.status(202).json({
    success: true,
    message: 'Song generation job enqueued.',
    job_id: job.id,
    status: job.status,
  });
}

/**
 * GET /api/status/:id
 * Polls job progress and state machine status
 */
export async function getJobStatusHandler(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    res.status(400).json({ error: 'Job ID parameter is required.' });
    return;
  }

  const job = jobQueue.getJob(id);

  if (!job) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  res.json({
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    ...(job.error ? { error: job.error } : {}),
  });
}

/**
 * GET /api/song/:id
 * Retrieves final generated lyrics, metadata, and audio URL once job is 'ready'
 */
export async function getSongResultHandler(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    res.status(400).json({ error: 'Song job ID parameter is required.' });
    return;
  }

  const job = jobQueue.getJob(id);

  if (!job) {
    res.status(404).json({ error: 'Song job not found.' });
    return;
  }

  if (job.status !== 'ready') {
    res.status(400).json({
      error: 'Song generation is not complete.',
      status: job.status,
      progress: job.progress,
    });
    return;
  }

  res.json({
    job_id: job.id,
    song: job.result?.songData,
    audio: {
      audio_url: job.result?.audioUrl,
      provider: job.result?.provider,
    },
    alignment: job.result?.alignment ?? null,
    ...(job.result?.alignmentNote ? { alignment_note: job.result.alignmentNote } : {}),
  });
}