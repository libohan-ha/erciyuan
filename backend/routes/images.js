const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const Image = require('../../models/Image');
const Album = require('../../models/Album');
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

const ensureAlbumCoverIntegrity = async (albumId) => {
  if (!albumId) return;
  const album = await Album.findById(albumId);
  if (!album) return;

  if (album.coverImageId) {
    const exists = await Image.exists({
      _id: album.coverImageId,
      albumId: album._id
    });
    if (exists) {
      return;
    }
  }

  const fallback = await Image.findOne({ albumId: album._id })
    .sort({ createdAt: -1 })
    .select('_id');

  album.coverImageId = fallback ? fallback._id : null;
  await album.save();
};

const ensureAlbumCoverPresence = async (albumId, candidateImageId) => {
  if (!albumId) return;
  const album = await Album.findById(albumId);
  if (!album) return;

  if (!album.coverImageId) {
    album.coverImageId = candidateImageId || null;
    await album.save();
    return;
  }

  const exists = await Image.exists({ _id: album.coverImageId, albumId: album._id });
  if (!exists) {
    const fallback = await Image.findOne({ albumId: album._id })
      .sort({ createdAt: -1 })
      .select('_id');
    album.coverImageId = fallback ? fallback._id : null;
    await album.save();
  }
};

const normalizeObjectIdArray = (ids) => {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
};

// GET /api/images - list images with pagination / filters
router.get('/', auth, async (req, res) => {
  try {
    const {
      tag,
      search,
      albumId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const { page, limit } = parsePagination(req.query);

    const query = { ownerId: req.user._id };

    if (tag) {
      query.tags = { $in: [tag] };
    }

    if (search && search.trim()) {
      const keyword = search.trim();
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { tags: { $in: [new RegExp(keyword, 'i')] } }
      ];
    }

    if (albumId) {
      if (!mongoose.Types.ObjectId.isValid(albumId)) {
        return res.status(400).json({ success: false, message: 'Invalid album id' });
      }
      query.albumId = albumId;
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'title'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortDirection };
    if (sortField !== 'createdAt') {
      sort.createdAt = -1;
    }

    const [images, total] = await Promise.all([
      Image.find(query)
        .sort(sort)
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('albumId', 'name')
        .exec(),
      Image.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        images,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit) || 1,
          total,
          limit
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch image list:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/images/tags/all - fetch tag statistics
router.get('/tags/all', auth, async (req, res) => {
  try {
    const tags = await Image.aggregate([
      { $match: { ownerId: req.user._id } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        tags: tags.map(tag => ({
          name: tag._id,
          count: tag.count
        }))
      }
    });
  } catch (error) {
    console.error('Failed to fetch tag statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/images/:id - image detail
router.get('/:id', auth, async (req, res) => {
  try {
    const image = await Image.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    }).populate('albumId', 'name description');

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.json({
      success: true,
      data: { image }
    });
  } catch (error) {
    console.error('Failed to fetch image detail:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/images - upload image
router.post('/', auth, uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select an image file to upload'
      });
    }

    const { title, description, tags, albumId } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Image title is required'
      });
    }

    let targetAlbum = null;
    if (albumId) {
      if (!mongoose.Types.ObjectId.isValid(albumId)) {
        return res.status(400).json({ success: false, message: 'Invalid album id' });
      }

      targetAlbum = await Album.findOne({
        _id: albumId,
        ownerId: req.user._id
      });

      if (!targetAlbum) {
        return res.status(400).json({
          success: false,
          message: 'Album not found'
        });
      }
    }

    let tagsArray = [];
    if (tags) {
      if (Array.isArray(tags)) {
        tagsArray = tags.map((tag) => tag.trim()).filter(Boolean);
      } else {
        tagsArray = String(tags)
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
      }
    }

    const assignedAlbumId = targetAlbum ? targetAlbum._id : null;

    const image = new Image({
      url: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      title: title.trim(),
      description: description ? description.trim() : '',
      tags: tagsArray,
      ownerId: req.user._id,
      albumId: assignedAlbumId
    });

    await image.save();

    if (assignedAlbumId) {
      await ensureAlbumCoverPresence(assignedAlbumId.toString(), image._id);
    }

    const populatedImage = await Image.findById(image._id).populate('albumId', 'name');

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: { image: populatedImage }
    });
  } catch (error) {
    console.error('Failed to upload image:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PUT /api/images/:id - update image info
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, tags, albumId } = req.body;

    const image = await Image.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      });
    }

    const previousAlbumId = image.albumId ? image.albumId.toString() : null;
    let nextAlbumId = previousAlbumId;

    if (title) {
      image.title = title.trim();
    }

    if (description !== undefined) {
      image.description = description ? description.trim() : '';
    }

    if (tags !== undefined) {
      let tagsArray = [];
      if (Array.isArray(tags)) {
        tagsArray = tags.map((tag) => tag.trim()).filter(Boolean);
      } else if (tags) {
        tagsArray = String(tags)
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
      }
      image.tags = tagsArray;
    }

    if (albumId !== undefined) {
      if (!albumId) {
        image.albumId = null;
        nextAlbumId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(albumId)) {
          return res.status(400).json({ success: false, message: 'Invalid album id' });
        }
        const album = await Album.findOne({
          _id: albumId,
          ownerId: req.user._id,
        });

        if (!album) {
          return res.status(400).json({
            success: false,
            message: 'Album not found',
          });
        }

        image.albumId = album._id;
        nextAlbumId = album._id.toString();
      }
    }

    await image.save();

    if (previousAlbumId && previousAlbumId !== nextAlbumId) {
      await ensureAlbumCoverIntegrity(previousAlbumId);
    }

    if (nextAlbumId) {
      await ensureAlbumCoverPresence(nextAlbumId, image._id);
    }

    const populatedImage = await Image.findById(image._id).populate('albumId', 'name');

    res.json({
      success: true,
      message: 'Image updated successfully',
      data: { image: populatedImage },
    });
  } catch (error) {
    console.error('Failed to update image:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/images/bulk/move - move multiple images between albums
router.post('/bulk/move', auth, async (req, res) => {
  try {
    const { imageIds, targetAlbumId } = req.body;
    const normalizedIds = normalizeObjectIdArray(imageIds);

    if (!normalizedIds.length) {
      return res.status(400).json({ success: false, message: 'Image ids are required' });
    }

    const images = await Image.find({
      _id: { $in: normalizedIds },
      ownerId: req.user._id,
    });

    if (!images.length) {
      return res.status(404).json({ success: false, message: 'No images found for the given ids' });
    }

    const previousAlbumIds = [...new Set(images
      .map((img) => (img.albumId ? img.albumId.toString() : null))
      .filter((id) => Boolean(id))
    )];

    let nextAlbumId = null;
    let targetAlbum = null;

    if (targetAlbumId) {
      if (!mongoose.Types.ObjectId.isValid(targetAlbumId)) {
        return res.status(400).json({ success: false, message: 'Invalid album id' });
      }
      targetAlbum = await Album.findOne({
        _id: targetAlbumId,
        ownerId: req.user._id,
      });

      if (!targetAlbum) {
        return res.status(404).json({ success: false, message: 'Target album not found' });
      }

      nextAlbumId = targetAlbum._id.toString();
    }

    await Image.updateMany(
      { _id: { $in: normalizedIds }, ownerId: req.user._id },
      { $set: { albumId: targetAlbum ? targetAlbum._id : null } }
    );

    for (const albumId of previousAlbumIds) {
      if (!nextAlbumId || albumId !== nextAlbumId) {
        await ensureAlbumCoverIntegrity(albumId);
      }
    }

    if (nextAlbumId) {
      await ensureAlbumCoverPresence(nextAlbumId, normalizedIds[0]);
    }

    res.json({
      success: true,
      message: nextAlbumId ? 'Images moved to album successfully' : 'Images removed from album successfully',
    });
  } catch (error) {
    console.error('Failed to move images:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
// DELETE /api/images/:id - delete image
router.delete('/:id', auth, async (req, res) => {
  try {
    const image = await Image.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    const imagePath = resolveUploadsFilePath(image.url);
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    if (image.albumId) {
      const album = await Album.findById(image.albumId);
      if (album && album.coverImageId && album.coverImageId.toString() === image._id.toString()) {
        const anotherImage = await Image.findOne({
          albumId: image.albumId,
          _id: { $ne: image._id }
        });

        album.coverImageId = anotherImage ? anotherImage._id : null;
        await album.save();
      }
    }

    await Image.findByIdAndDelete(image._id);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete image:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;




