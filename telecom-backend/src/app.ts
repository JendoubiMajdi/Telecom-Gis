import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import networkRoutes from './routes/network.routes';
import aiRoutes from './routes/ai.routes';
import poiRoutes from './routes/poi.routes';
import adminRoutes from './routes/admin.routes';
import notificationRoutes from './routes/notification.routes';
import taskRoutes from './routes/task.routes';
import { ensureAuditTable } from './services/audit.service';
import { ensureAdminSchema } from './services/admin.service';
import { ensureNotificationsTable } from './services/notification.service';
import { ensureTasksTables } from './services/task.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));        // ← was default 100kb, schools send ~2-3mb
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'Telecom GIS Backend API', status: 'running', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.use('/api/auth', authRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/poi', poiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tasks', taskRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);

  ensureAdminSchema()
    .then(() => console.log('✅ Admin schema ready'))
    .catch(err => console.error('❌ Could not prepare users columns:', err.message));

  ensureTasksTables()
    .then(() => console.log('✅ Tasks ready'))
    .catch(err => console.error('❌ Could not prepare tasks tables:', err.message));

  ensureNotificationsTable()
    .then(() => console.log('✅ Notifications ready'))
    .catch(err => console.error('❌ Could not prepare notifications table:', err.message));

  ensureAuditTable()
    .then(() => console.log('✅ Audit log ready'))
    .catch(err => console.error('❌ Could not prepare audit_log table:', err.message));

  // AI recommendation needs this key — report clearly at startup (never prints the key itself)
  const aiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!aiKey) {
    console.warn('⚠️  ANTHROPIC_API_KEY is NOT set — AI upgrade recommendations will fail. Add it to telecom-backend/.env and restart.');
  } else if (!aiKey.startsWith('sk-ant-')) {
    console.warn(`⚠️  ANTHROPIC_API_KEY is set (${aiKey.length} chars) but does not start with "sk-ant-" — check for a copy/paste mistake or quotes.`);
  } else {
    console.log(`🤖 ANTHROPIC_API_KEY loaded (${aiKey.length} chars)`);
  }
});