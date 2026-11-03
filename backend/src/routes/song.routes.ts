import { Router } from 'express';
import {
  generateSongHandler,
  getJobStatusHandler,
  getSongResultHandler,
} from '../controllers/song.controller.js';

const router = Router();

// Blueprint API Endpoint Contract
router.post('/generate', generateSongHandler);
router.get('/status/:id', getJobStatusHandler);
router.get('/song/:id', getSongResultHandler);

export default router;