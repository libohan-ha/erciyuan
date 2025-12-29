const express = require('express');
const bcrypt = require('bcryptjs');
const { auth } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const prisma = require('../../config/prisma');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const uploadsRoot = path.resolve(__dirname, '../..', process.env.UPLOAD_PATH || 'uploads');

const resolveUploadsFilePath = (publicUrl) => {
  if (!publicUrl) return null;
  const normalized = String(publicUrl).replace(/\\/g, '/');
  const match = normalized.match(/^\/?uploads\/(.+)$/);
  if (!match) return null;
  const filename = path.basename(match[1]);
  if (!filename) return null;
  return path.join(uploadsRoot, filename);
};

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          username: req.user.username,
          avatarUrl: req.user.avatarUrl,
          createdAt: req.user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/users/me
router.put('/me', auth, async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    const updateData = {};

    if (username.trim() !== req.user.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: username.trim(),
          NOT: { id: userId }
        }
      });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
      }
      updateData.username = username.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }

      // 获取用户密码进行验证
      const userWithPassword = await prisma.user.findUnique({
        where: { id: userId }
      });

      const isValid = await bcrypt.compare(currentPassword, userWithPassword.password);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(newPassword, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Failed to update user profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/users/me/avatar
router.post('/me/avatar', auth, uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please provide an image file' });
    }

    const userId = req.user.id;

    // 删除旧头像文件
    if (req.user.avatarUrl) {
      const oldAvatarPath = resolveUploadsFilePath(req.user.avatarUrl);
      if (oldAvatarPath && fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl }
    });

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: { avatarUrl }
    });
  } catch (error) {
    console.error('Failed to update avatar:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/users/me/avatar
router.delete('/me/avatar', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.user.avatarUrl) {
      return res.status(400).json({ success: false, message: 'Avatar not set' });
    }

    const avatarPath = resolveUploadsFilePath(req.user.avatarUrl);
    if (avatarPath && fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null }
    });

    res.json({ success: true, message: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Failed to delete avatar:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
