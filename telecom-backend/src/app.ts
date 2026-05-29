import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import networkRoutes from './routes/network.routes';
import aiRoutes from './routes/ai.routes';
import poiRoutes from './routes/poi.routes';

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

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});