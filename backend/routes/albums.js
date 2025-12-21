const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const Album = require('../../models/Album');
const Image = require('../../models/Image');

const router = express.Router();

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const rawLimit = parseInt(query.limit, 10) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  return { page, limit };
};

const buildSortObject = (sortBy = 'createdAt', sortOrder = 'desc', allowedFields = ['createdAt']) => {
  const defaultField = allowedFields[0] || 'createdAt';
  const field = allowedFields.includes(sortBy) ? sortBy : defaultField;
  const direction = sortOrder === 'asc' ? 1 : -1;
  const sort = { [field]: direction };
  if (field !== 'createdAt') {
    sort.createdAt = -1;
  }
  return sort;
};

router.get('/', auth, async (req, res) => {
  try {
    const { search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const { page, limit } = parsePagination(req.query);

    const match = { ownerId: req.user._id };
    if (search && search.trim()) {
      match.name = { $regex: search.trim(), $options: 'i' };
    }

    const sort = buildSortObject(sortBy, sortOrder, ['createdAt', 'updatedAt', 'name', 'imageCount']);

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'images',
          let: { albumId: '$_id', ownerId: '$ownerId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$albumId', '$$albumId'] },
                    { $eq: ['$ownerId', '$$ownerId'] }
                  ]
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'imageStats'
        }
      },
      {
        $addFields: {
          imageCount: { $ifNull: [{ $first: '$imageStats.count' }, 0] }
        }
      },
      { $project: { imageStats: 0 } },
      { $sort: sort },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ];

    const [albums, total] = await Promise.all([
      Album.aggregate(pipeline),
      Album.countDocuments(match)
    ]);

    await Album.populate(albums, { path: 'coverImageId', select: 'url title' });

    res.json({
      success: true,
      data: {
        albums,
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

router.get('/:id/images', auth, async (req, res) => {
  try {
    const { sortBy = 'createdAt', sortOrder = 'desc', search } = req.query;
    const { page, limit } = parsePagination(req.query);

    const album = await Album.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const query = {
      albumId: album._id,
      ownerId: req.user._id
    };

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { tags: { $in: [new RegExp(search.trim(), 'i')] } }
      ];
    }

    const sort = buildSortObject(sortBy, sortOrder, ['createdAt', 'updatedAt', 'title']);

    const [images, total] = await Promise.all([
      Image.find(query)
        .sort(sort)
        .limit(limit)
        .skip((page - 1) * limit)
        .lean(),
      Image.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        album: {
          id: album._id,
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

router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const album = await Album.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    })
      .populate('coverImageId', 'url title')
      .lean();

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    const imageCount = await Image.countDocuments({
      albumId: album._id,
      ownerId: req.user._id
    });

    res.json({
      success: true,
      data: {
        album: {
          ...album,
          imageCount
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch album detail:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

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

    const existingAlbum = await Album.findOne({ ownerId: req.user._id, name: trimmedName });
    if (existingAlbum) {
      return res.status(409).json({ success: false, message: 'Album name already exists' });
    }

    const album = await Album.create({
      name: trimmedName,
      description: trimmedDescription,
      ownerId: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Album created successfully',
      data: { album }
    });
  } catch (error) {
    console.error('Failed to create album:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Album name already exists' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, coverImageId } = req.body;

    const album = await Album.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: 'Album name cannot be empty' });
      }
      if (trimmedName.length > 50) {
        return res.status(400).json({ success: false, message: 'Album name must be 50 characters or fewer' });
      }
      const duplicate = await Album.findOne({
        ownerId: req.user._id,
        name: trimmedName,
        _id: { $ne: album._id }
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Album name already exists' });
      }
      album.name = trimmedName;
    }

    if (description !== undefined) {
      const trimmedDescription = description ? description.trim() : '';
      if (trimmedDescription.length > 200) {
        return res.status(400).json({ success: false, message: 'Album description must be 200 characters or fewer' });
      }
      album.description = trimmedDescription;
    }

    if (coverImageId !== undefined) {
      if (!coverImageId) {
        album.coverImageId = null;
      } else {
        const image = await Image.findOne({
          _id: coverImageId,
          ownerId: req.user._id
        });
        if (!image) {
          return res.status(400).json({ success: false, message: 'Cover image not found or not owned by user' });
        }
        if (image.albumId && image.albumId.toString() !== album._id.toString()) {
          return res.status(400).json({ success: false, message: 'Image does not belong to this album' });
        }
        album.coverImageId = image._id;
      }
    }

    await album.save();

    const populated = await Album.findById(album._id).populate('coverImageId', 'url title');

    res.json({
      success: true,
      message: 'Album updated successfully',
      data: { album: populated }
    });
  } catch (error) {
    console.error('Failed to update album:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Album name already exists' });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const album = await Album.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    await Image.updateMany(
      { albumId: album._id, ownerId: req.user._id },
      { $set: { albumId: null } }
    );

    await Album.deleteOne({ _id: album._id });

    res.json({
      success: true,
      message: 'Album deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete album:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/:id/cover', auth, async (req, res) => {
  try {
    const { imageId } = req.body;

    const album = await Album.findOne({
      _id: req.params.id,
      ownerId: req.user._id
    });

    if (!album) {
      return res.status(404).json({ success: false, message: 'Album not found' });
    }

    if (!imageId) {
      album.coverImageId = null;
      await album.save();
      const populated = await Album.findById(album._id).populate('coverImageId', 'url title');
      return res.json({
        success: true,
        message: 'Album cover cleared',
        data: { album: populated }
      });
    }

    const image = await Image.findOne({
      _id: imageId,
      albumId: album._id,
      ownerId: req.user._id
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found in this album'
      });
    }

    album.coverImageId = imageId;
    await album.save();

    const updatedAlbum = await Album.findById(album._id).populate('coverImageId', 'url title');

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






