const express = require('express');
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

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const rawLimit = parseInt(query.limit, 10) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  return { page, limit };
};

// 验证 UUID 格式
const isValidUUID = (str) => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// 确保相册封面完整性
const ensureAlbumCoverIntegrity = async (albumId) => {
  if (!albumId) return;
  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album) return;

  if (album.coverImageId) {
    const exists = await prisma.image.findFirst({
      where: { id: album.coverImageId, albumId: album.id }
    });
    if (exists) return;
  }

  const fallback = await prisma.image.findFirst({
    where: { albumId: album.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  });

  await prisma.album.update({
    where: { id: albumId },
    data: { coverImageId: fallback ? fallback.id : null }
  });
};

// 确保相册有封面
const ensureAlbumCoverPresence = async (albumId, candidateImageId) => {
  if (!albumId) return;
  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album) return;

  if (!album.coverImageId) {
    await prisma.album.update({
      where: { id: albumId },
      data: { coverImageId: candidateImageId || null }
    });
    return;
  }

  const exists = await prisma.image.findFirst({
    where: { id: album.coverImageId, albumId: album.id }
  });
  if (!exists) {
    const fallback = await prisma.image.findFirst({
      where: { albumId: album.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });
    await prisma.album.update({
      where: { id: albumId },
      data: { coverImageId: fallback ? fallback.id : null }
    });
  }
};

// GET /api/images - list images with pagination / filters
router.get('/', auth, async (req, res) => {
  try {
    const { tag, search, albumId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const { page, limit } = parsePagination(req.query);

    const where = { ownerId: req.user.id };

    if (tag) {
      where.tags = { has: tag };
    }

    if (search && search.trim()) {
      const keyword = search.trim();
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { tags: { has: keyword } }
      ];
    }

    if (albumId) {
      if (!isValidUUID(albumId)) {
        return res.status(400).json({ success: false, message: 'Invalid album id' });
      }
      where.albumId = albumId;
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'title'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy = [{ [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' }];
    if (sortField !== 'createdAt') {
      orderBy.push({ createdAt: 'desc' });
    }

    const [images, total] = await Promise.all([
      prisma.image.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { album: { select: { id: true, name: true } } }
      }),
      prisma.image.count({ where })
    ]);

    // 转换格式以保持 API 兼容
    const formattedImages = images.map(img => ({
      ...img,
      albumId: img.album ? { _id: img.album.id, name: img.album.name } : null
    }));

    res.json({
      success: true,
      data: {
        images: formattedImages,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit) || 1,
          total,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch image list:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/images/tags/all - fetch tag statistics
router.get('/tags/all', auth, async (req, res) => {
  try {
    const images = await prisma.image.findMany({
      where: { ownerId: req.user.id },
      select: { tags: true }
    });

    // 统计标签
    const tagCounts = {};
    images.forEach(img => {
      img.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const tags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: { tags }
    });
  } catch (error) {
    console.error('Failed to fetch tag statistics:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/images/:id - image detail
router.get('/:id', auth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const image = await prisma.image.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      include: { album: { select: { id: true, name: true, description: true } } }
    });

    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    res.json({
      success: true,
      data: { image }
    });
  } catch (error) {
    console.error('Failed to fetch image detail:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/images - upload image
router.post('/', auth, uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select an image file to upload' });
    }

    const { title, description, tags, albumId } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Image title is required' });
    }

    let targetAlbumId = null;
    if (albumId) {
      if (!isValidUUID(albumId)) {
        return res.status(400).json({ success: false, message: 'Invalid album id' });
      }

      const targetAlbum = await prisma.album.findFirst({
        where: { id: albumId, ownerId: req.user.id }
      });

      if (!targetAlbum) {
        return res.status(400).json({ success: false, message: 'Album not found' });
      }
      targetAlbumId = targetAlbum.id;
    }

    let tagsArray = [];
    if (tags) {
      if (Array.isArray(tags)) {
        tagsArray = tags.map(tag => tag.trim()).filter(Boolean);
      } else {
        tagsArray = String(tags).split(',').map(tag => tag.trim()).filter(Boolean);
      }
    }

    const image = await prisma.image.create({
      data: {
        url: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        title: title.trim(),
        description: description ? description.trim() : '',
        tags: tagsArray,
        ownerId: req.user.id,
        albumId: targetAlbumId
      },
      include: { album: { select: { id: true, name: true } } }
    });

    if (targetAlbumId) {
      await ensureAlbumCoverPresence(targetAlbumId, image.id);
    }

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: { image }
    });
  } catch (error) {
    console.error('Failed to upload image:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/images/:id - update image info
router.put('/:id', auth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const { title, description, tags, albumId } = req.body;

    const image = await prisma.image.findFirst({
      where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const previousAlbumId = image.albumId;
    const updateData = {};

    if (title) {
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : '';
    }

    if (tags !== undefined) {
      let tagsArray = [];
      if (Array.isArray(tags)) {
        tagsArray = tags.map(tag => tag.trim()).filter(Boolean);
      } else if (tags) {
        tagsArray = String(tags).split(',').map(tag => tag.trim()).filter(Boolean);
      }
      updateData.tags = tagsArray;
    }

    let nextAlbumId = previousAlbumId;
    if (albumId !== undefined) {
      if (!albumId) {
        updateData.albumId = null;
        nextAlbumId = null;
      } else {
        if (!isValidUUID(albumId)) {
          return res.status(400).json({ success: false, message: 'Invalid album id' });
        }
        const album = await prisma.album.findFirst({
          where: { id: albumId, ownerId: req.user.id }
        });
        if (!album) {
          return res.status(400).json({ success: false, message: 'Album not found' });
        }
        updateData.albumId = album.id;
        nextAlbumId = album.id;
      }
    }

    const updatedImage = await prisma.image.update({
      where: { id: req.params.id },
      data: updateData,
      include: { album: { select: { id: true, name: true } } }
    });

    if (previousAlbumId && previousAlbumId !== nextAlbumId) {
      await ensureAlbumCoverIntegrity(previousAlbumId);
    }

    if (nextAlbumId) {
      await ensureAlbumCoverPresence(nextAlbumId, updatedImage.id);
    }

    res.json({
      success: true,
      message: 'Image updated successfully',
      data: { image: updatedImage }
    });
  } catch (error) {
    console.error('Failed to update image:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/images/bulk/move - move multiple images between albums
router.post('/bulk/move', auth, async (req, res) => {
  try {
    const { imageIds, targetAlbumId } = req.body;

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Image ids are required' });
    }

    const validIds = imageIds.filter(id => isValidUUID(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid image ids provided' });
    }

    const images = await prisma.image.findMany({
      where: { id: { in: validIds }, ownerId: req.user.id }
    });

    if (images.length === 0) {
      return res.status(404).json({ success: false, message: 'No images found for the given ids' });
    }

    const previousAlbumIds = [...new Set(images.map(img => img.albumId).filter(Boolean))];

    let nextAlbumId = null;
    if (targetAlbumId) {
      if (!isValidUUID(targetAlbumId)) {
        return res.status(400).json({ success: false, message: 'Invalid album id' });
      }
      const targetAlbum = await prisma.album.findFirst({
        where: { id: targetAlbumId, ownerId: req.user.id }
      });
      if (!targetAlbum) {
        return res.status(404).json({ success: false, message: 'Target album not found' });
      }
      nextAlbumId = targetAlbum.id;
    }

    await prisma.image.updateMany({
      where: { id: { in: validIds }, ownerId: req.user.id },
      data: { albumId: nextAlbumId }
    });

    for (const albumId of previousAlbumIds) {
      if (!nextAlbumId || albumId !== nextAlbumId) {
        await ensureAlbumCoverIntegrity(albumId);
      }
    }

    if (nextAlbumId) {
      await ensureAlbumCoverPresence(nextAlbumId, validIds[0]);
    }

    res.json({
      success: true,
      message: nextAlbumId ? 'Images moved to album successfully' : 'Images removed from album successfully'
    });
  } catch (error) {
    console.error('Failed to move images:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/images/:id - delete image
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const image = await prisma.image.findFirst({
      where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // 删除文件
    const imagePath = resolveUploadsFilePath(image.url);
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // 处理相册封面
    if (image.albumId) {
      const album = await prisma.album.findUnique({ where: { id: image.albumId } });
      if (album && album.coverImageId === image.id) {
        const anotherImage = await prisma.image.findFirst({
          where: { albumId: image.albumId, id: { not: image.id } }
        });
        await prisma.album.update({
          where: { id: image.albumId },
          data: { coverImageId: anotherImage ? anotherImage.id : null }
        });
      }
    }

    await prisma.image.delete({ where: { id: image.id } });

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete image:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

