const express = require('express');
const bcrypt = require('bcryptjs');
const { auth } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const User = require('../../models/User');
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
          id: req.user._id,
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
    const user = req.user;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    if (username.trim() !== user.username) {
      const existingUser = await User.findOne({ username: username.trim(), _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username already exists' });
      }
      user.username = username.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }

      const isValid = await user.comparePassword(currentPassword);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      user.password = newPassword;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          updatedAt: user.updatedAt
        }
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

    const user = req.user;

    if (user.avatarUrl) {
      const oldAvatarPath = resolveUploadsFilePath(user.avatarUrl);
      if (oldAvatarPath && fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    user.avatarUrl = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: { avatarUrl: user.avatarUrl }
    });
  } catch (error) {
    console.error('Failed to update avatar:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/users/me/avatar
router.delete('/me/avatar', auth, async (req, res) => {
  try {
    const user = req.user;

    if (!user.avatarUrl) {
      return res.status(400).json({ success: false, message: 'Avatar not set' });
    }

    const avatarPath = resolveUploadsFilePath(user.avatarUrl);
    if (avatarPath && fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    user.avatarUrl = null;
    await user.save();

    res.json({ success: true, message: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Failed to delete avatar:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
