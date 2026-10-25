import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOADS_DIR } from './db.js';
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
import { startBackups } from './backup.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

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
  startBackups();
});
