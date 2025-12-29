const express = require('express');
const { auth } = require('../middleware/auth');
const prisma = require('../../config/prisma');

const router = express.Router();

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

// GET /api/albums - 获取相册列表
router.get('/', auth, async (req, res) => {
  try {
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const { page, limit } = parsePagination(req.query);

    const where = { ownerId: req.user.id };
    if (search && search.trim()) {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy = [{ [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' }];
    if (sortField !== 'createdAt') {
      orderBy.push({ createdAt: 'desc' });
    }

    const [albums, total] = await Promise.all([
      prisma.album.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          coverImage: { select: { id: true, url: true, title: true } },
          _count: { select: { images: true } }
        }
      }),
      prisma.album.count({ where })
    ]);

    // 格式化输出
    const formattedAlbums = albums.map(album => ({
      ...album,
      imageCount: album._count.images,
      _count: undefined
    }));

    res.json({
      success: true,
      data: {
        albums: formattedAlbums,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit) || 1,
          total,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch album list:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/albums/:id/images - 获取相册内图片
router.get('/:id/images', auth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const { sortBy = 'createdAt', sortOrder = 'desc', search } = req.query;
    const { page, limit } = parsePagination(req.query);

    const album = await prisma.album.findFirst({
      where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const where = { albumId: album.id, ownerId: req.user.id };

    if (search && search.trim()) {
      const keyword = search.trim();
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { tags: { has: keyword } }
      ];
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'title'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy = [{ [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' }];

    const [images, total] = await Promise.all([
      prisma.image.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.image.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        album: {
          id: album.id,
          name: album.name,
          description: album.description,
          coverImageId: album.coverImageId
        },
        images,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit) || 1,
          total,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch album images:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/albums/:id - 获取相册详情
router.get('/:id', auth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const album = await prisma.album.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
      include: {
        coverImage: { select: { id: true, url: true, title: true } },
        _count: { select: { images: true } }
      }
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    res.json({
      success: true,
      data: {
        album: {
          ...album,
          imageCount: album._count.images,
          _count: undefined
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch album detail:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/albums - 创建相册
router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;

    const trimmedName = (name || '').trim();
    const trimmedDescription = (description || '').trim();

    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Album name is required' });
    }

    if (trimmedName.length > 50) {
      return res.status(400).json({ success: false, message: 'Album name must be 50 characters or fewer' });
    }

    if (trimmedDescription.length > 200) {
      return res.status(400).json({ success: false, message: 'Album description must be 200 characters or fewer' });
    }

    const existingAlbum = await prisma.album.findFirst({
      where: { ownerId: req.user.id, name: trimmedName }
    });
    if (existingAlbum) {
      return res.status(409).json({ success: false, message: 'Album name already exists' });
    }

    const album = await prisma.album.create({
      data: {
        name: trimmedName,
        description: trimmedDescription,
        ownerId: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      message: 'Album created successfully',
      data: { album }
    });
  } catch (error) {
    console.error('Failed to create album:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Album name already exists' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/albums/:id - 更新相册
router.put('/:id', auth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const { name, description, coverImageId } = req.body;

    const album = await prisma.album.findFirst({
      where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const updateData = {};

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: 'Album name cannot be empty' });
      }
      if (trimmedName.length > 50) {
        return res.status(400).json({ success: false, message: 'Album name must be 50 characters or fewer' });
      }
      const duplicate = await prisma.album.findFirst({
        where: { ownerId: req.user.id, name: trimmedName, NOT: { id: album.id } }
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Album name already exists' });
      }
      updateData.name = trimmedName;
    }

    if (description !== undefined) {
      const trimmedDescription = description ? description.trim() : '';
      if (trimmedDescription.length > 200) {
        return res.status(400).json({ success: false, message: 'Album description must be 200 characters or fewer' });
      }
      updateData.description = trimmedDescription;
    }

    if (coverImageId !== undefined) {
      if (!coverImageId) {
        updateData.coverImageId = null;
      } else {
        if (!isValidUUID(coverImageId)) {
          return res.status(400).json({ success: false, message: 'Invalid cover image id' });
        }
        const image = await prisma.image.findFirst({
          where: { id: coverImageId, ownerId: req.user.id }
        });
        if (!image) {
          return res.status(400).json({ success: false, message: 'Cover image not found or not owned by user' });
        }
        if (image.albumId && image.albumId !== album.id) {
          return res.status(400).json({ success: false, message: 'Image does not belong to this album' });
        }
        updateData.coverImageId = image.id;
      }
    }

    const updatedAlbum = await prisma.album.update({
      where: { id: album.id },
      data: updateData,
      include: { coverImage: { select: { id: true, url: true, title: true } } }
    });

    res.json({
      success: true,
      message: 'Album updated successfully',
      data: { album: updatedAlbum }
    });
  } catch (error) {
    console.error('Failed to update album:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Album name already exists' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/albums/:id - 删除相册
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const album = await prisma.album.findFirst({
      where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    // 将相册内图片的 albumId 设为 null
    await prisma.image.updateMany({
      where: { albumId: album.id, ownerId: req.user.id },
      data: { albumId: null }
    });

    await prisma.album.delete({ where: { id: album.id } });

    res.json({
      success: true,
      message: 'Album deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete album:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/albums/:id/cover - 设置相册封面
router.post('/:id/cover', auth, async (req, res) => {
  try {
    if (!isValidUUID(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const { imageId } = req.body;

    const album = await prisma.album.findFirst({
      where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    if (!imageId) {
      const updatedAlbum = await prisma.album.update({
        where: { id: album.id },
        data: { coverImageId: null },
        include: { coverImage: { select: { id: true, url: true, title: true } } }
      });
      return res.json({
        success: true,
        message: 'Album cover cleared',
        data: { album: updatedAlbum }
      });
    }

    if (!isValidUUID(imageId)) {
      return res.status(400).json({ success: false, message: 'Invalid image id' });
    }

    const image = await prisma.image.findFirst({
      where: { id: imageId, albumId: album.id, ownerId: req.user.id }
    });

    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found in this album' });
    }

    const updatedAlbum = await prisma.album.update({
      where: { id: album.id },
      data: { coverImageId: imageId },
      include: { coverImage: { select: { id: true, url: true, title: true } } }
    });

    res.json({
      success: true,
      message: 'Album cover updated successfully',
      data: { album: updatedAlbum }
    });
  } catch (error) {
    console.error('Failed to set album cover:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

