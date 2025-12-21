const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '相册名称是必需的'],
    trim: true,
    maxlength: [50, '相册名称不能超过50个字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, '相册描述不能超过200个字符'],
    default: ''
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '相册所有者是必需的']
  },
  coverImageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image',
    default: null
  }
}, {
  timestamps: true
});

albumSchema.index({ ownerId: 1, createdAt: -1 });
albumSchema.index({ ownerId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Album', albumSchema);
