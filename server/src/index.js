import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOADS_DIR, syncToCloud, refreshFromCloud } from './db.js';
import { errorHandler } from './utils.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import lessonRoutes from './routes/lessons.js';
import studentRoutes from './routes/students.js';
import paymentRoutes from './routes/payments.js';
import questionRoutes from './routes/questions.js';
import forkRoutes from './routes/forks.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import requestRoutes from './routes/requests.js';
import skillRoutes from './routes/skills.js';
import subjectRoutes from './routes/subjects.js';
import { startBackups } from './backup.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));

// Auto-persist database snapshot to cloud on mutating requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let synced = false;

    const doSync = async () => {
      if (!synced && res.statusCode < 400) {
        synced = true;
        await syncToCloud();
      }
    };

    res.json = async function (body) {
      await doSync();
      return originalJson(body);
    };

    res.send = async function (body) {
      await doSync();
      return originalSend(body);
    };

    res.on('finish', () => {
      if (!synced && res.statusCode < 400) {
        syncToCloud();
      }
    });
  }
  next();
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// Another instance (or local dev) may have pushed a newer snapshot: pull it before answering.
app.use('/api', async (req, res, next) => {
  await refreshFromCloud();
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/forks', forkRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

// In production the built client is served from the same origin.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Codrasa API → http://localhost:${PORT}`);
  if (!process.env.VERCEL) {
    startBackups();
  }
});

export default app;
