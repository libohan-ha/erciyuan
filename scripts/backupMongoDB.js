/**
 * MongoDB 数据备份脚本
 * 将所有数据导出到 JSON 文件，用于迁移到 PostgreSQL
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 导入 models
const User = require('../models/User');
const Album = require('../models/Album');
const Image = require('../models/Image');

const BACKUP_DIR = path.join(__dirname, '../backup');

async function backup() {
  try {
    // 连接 MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/anime-gallery';
    console.log('正在连接 MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB 连接成功！\n');

    // 创建备份目录
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // 备份用户数据
    console.log('正在备份用户数据...');
    const users = await User.find({}).lean();
    fs.writeFileSync(
      path.join(BACKUP_DIR, 'users.json'),
      JSON.stringify(users, null, 2),
      'utf-8'
    );
    console.log(`  ✓ 备份了 ${users.length} 个用户`);

    // 备份相册数据
    console.log('正在备份相册数据...');
    const albums = await Album.find({}).lean();
    fs.writeFileSync(
      path.join(BACKUP_DIR, 'albums.json'),
      JSON.stringify(albums, null, 2),
      'utf-8'
    );
    console.log(`  ✓ 备份了 ${albums.length} 个相册`);

    // 备份图片数据
    console.log('正在备份图片数据...');
    const images = await Image.find({}).lean();
    fs.writeFileSync(
      path.join(BACKUP_DIR, 'images.json'),
      JSON.stringify(images, null, 2),
      'utf-8'
    );
    console.log(`  ✓ 备份了 ${images.length} 张图片`);

    // 创建 ID 映射表（MongoDB ObjectId -> 新 UUID 的映射）
    const idMapping = {
      users: {},
      albums: {},
      images: {}
    };

    users.forEach(u => {
      idMapping.users[u._id.toString()] = null; // 迁移时填充
    });
    albums.forEach(a => {
      idMapping.albums[a._id.toString()] = null;
    });
    images.forEach(i => {
      idMapping.images[i._id.toString()] = null;
    });

    fs.writeFileSync(
      path.join(BACKUP_DIR, 'id_mapping.json'),
      JSON.stringify(idMapping, null, 2),
      'utf-8'
    );

    console.log('\n========================================');
    console.log('✅ 数据备份完成！');
    console.log(`📁 备份目录: ${BACKUP_DIR}`);
    console.log('========================================');
    console.log('备份文件:');
    console.log('  - users.json');
    console.log('  - albums.json');
    console.log('  - images.json');
    console.log('  - id_mapping.json');
    console.log('========================================\n');

  } catch (error) {
    console.error('备份失败:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

backup();

