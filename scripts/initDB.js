const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// 导入模型
const User = require('../models/User');
const Image = require('../models/Image');
const Album = require('../models/Album');

// 导入数据库连接
const connectDB = require('../config/database');

const initDB = async () => {
  try {
    console.log('开始初始化数据库...');

    // 连接数据库
    await connectDB();

    // 清空现有数据（可选，根据需要）
    console.log('清空现有数据...');
    await User.deleteMany({});
    await Image.deleteMany({});
    await Album.deleteMany({});

    console.log('数据库初始化完成！');
    console.log('- 用户集合已创建');
    console.log('- 图片集合已创建');
    console.log('- 相册集合已创建');

    // 关闭连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');

  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  initDB();
}

module.exports = initDB;