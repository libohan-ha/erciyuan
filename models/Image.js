const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, '图片URL是必需的']
  },
  originalName: {
    type: String,
    required: [true, '原始文件名是必需的']
  },
  title: {
    type: String,
    required: [true, '图片标题是必需的'],
    trim: true,
    maxlength: [100, '标题不能超过100个字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, '描述不能超过500个字符']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [20, '标签不能超过20个字符']
  }],
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '图片所有者是必需的']
  },
  albumId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Album',
    default: null
  }
}, {
  timestamps: true // 自动添加 createdAt 和 updatedAt 字段
});

// 索引优化
imageSchema.index({ ownerId: 1, createdAt: -1 }); // 按用户和创建时间排序
imageSchema.index({ tags: 1 }); // 标签索引
imageSchema.index({ title: 'text', description: 'text' }); // 全文搜索索引

module.exports = mongoose.model('Image', imageSchema);