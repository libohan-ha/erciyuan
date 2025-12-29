const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const prisma = require('../config/prisma');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const imageRoutes = require('./routes/images');
const albumRoutes = require('./routes/albums');

const app = express();
const PORT = process.env.PORT || 3000;

// 测试数据库连接
prisma.$connect()
  .then(() => console.log('PostgreSQL Connected'))
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_PATH || 'uploads');
app.use('/uploads', express.static(uploadDir));

const frontendStaticDir = path.join(__dirname, '../frontend');
app.use('/frontend', express.static(frontendStaticDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/albums', albumRoutes);

app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

const spaRoutes = ['/', '/login', '/register', '/upload', '/profile', '/image-detail'];
app.get(spaRoutes, (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('*', (req, res) => {
  if (req.path.includes('.')) {
    return res.status(404).send('File not found');
  }

  res.sendFile(path.join(__dirname, '../index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API root: http://localhost:${PORT}/api`);
});

