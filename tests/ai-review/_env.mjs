import { mkdirSync } from 'node:fs';

export const BASE = (process.env.AIR_BASE || 'http://127.0.0.1:8097').replace(/\/+$/, '');
export const SHOT_DIR = process.env.AIR_SHOT_DIR || '/tmp/air-qa';
try { mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) { /* exists */ }
