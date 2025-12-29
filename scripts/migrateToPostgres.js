/**
 * MongoDB 到 PostgreSQL 数据迁移脚本
 * 从备份的 JSON 文件读取数据，迁移到 PostgreSQL
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// 使用 Node.js 内置 crypto 生成 UUID
const uuidv4 = () => crypto.randomUUID();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BACKUP_DIR = path.join(__dirname, '../backup');

// ID 映射表: MongoDB ObjectId -> PostgreSQL UUID
const idMapping = {
  users: {},
  albums: {},
  images: {}
};

async function loadBackupData(filename) {
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`备份文件不存在: ${filePath}`);
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data;
}

async function migrateUsers() {
  console.log('\n📦 正在迁移用户数据...');
  const users = await loadBackupData('users.json');
  
  for (const user of users) {
    const newId = uuidv4();
    idMapping.users[user._id] = newId;

    try {
      await prisma.user.create({
        data: {
          id: newId,
          username: user.username,
          password: user.password, // 密码已经是加密的
          avatarUrl: user.avatarUrl || null,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt)
        }
      });
      console.log(`  ✓ 用户 "${user.username}" 迁移成功`);
    } catch (error) {
      if (error.code === 'P2002') {
        // 用户已存在，获取现有用户 ID
        const existingUser = await prisma.user.findUnique({
          where: { username: user.username }
        });
        if (existingUser) {
          idMapping.users[user._id] = existingUser.id;
          console.log(`  ⚠ 用户 "${user.username}" 已存在，使用现有记录`);
        }
      } else {
        console.error(`  ✗ 用户 "${user.username}" 迁移失败:`, error.message);
      }
    }
  }
  console.log(`  共处理 ${users.length} 个用户`);
}

async function migrateAlbums() {
  console.log('\n📦 正在迁移相册数据...');
  const albums = await loadBackupData('albums.json');
  
  for (const album of albums) {
    const newId = uuidv4();
    const ownerId = idMapping.users[album.ownerId];
    
    if (!ownerId) {
      console.log(`  ⚠ 相册 "${album.name}" 的所有者不存在，跳过`);
      continue;
    }

    idMapping.albums[album._id] = newId;

    try {
      await prisma.album.create({
        data: {
          id: newId,
          name: album.name,
          description: album.description || '',
          ownerId: ownerId,
          coverImageId: null, // 稍后更新
          createdAt: new Date(album.createdAt),
          updatedAt: new Date(album.updatedAt)
        }
      });
      console.log(`  ✓ 相册 "${album.name}" 迁移成功`);
    } catch (error) {
      if (error.code === 'P2002') {
        const existingAlbum = await prisma.album.findFirst({
          where: { ownerId, name: album.name }
        });
        if (existingAlbum) {
          idMapping.albums[album._id] = existingAlbum.id;
          console.log(`  ⚠ 相册 "${album.name}" 已存在，使用现有记录`);
        }
      } else {
        console.error(`  ✗ 相册 "${album.name}" 迁移失败:`, error.message);
      }
    }
  }
  console.log(`  共处理 ${albums.length} 个相册`);
}

async function migrateImages() {
  console.log('\n📦 正在迁移图片数据...');
  const images = await loadBackupData('images.json');
  
  for (const image of images) {
    const newId = uuidv4();
    const ownerId = idMapping.users[image.ownerId];
    const albumId = image.albumId ? idMapping.albums[image.albumId] : null;
    
    if (!ownerId) {
      console.log(`  ⚠ 图片 "${image.title}" 的所有者不存在，跳过`);
      continue;
    }

    idMapping.images[image._id] = newId;

    try {
      await prisma.image.create({
        data: {
          id: newId,
          url: image.url,
          originalName: image.originalName,
          title: image.title,
          description: image.description || '',
          tags: image.tags || [],
          ownerId: ownerId,
          albumId: albumId,
          createdAt: new Date(image.createdAt),
          updatedAt: new Date(image.updatedAt)
        }
      });
    } catch (error) {
      console.error(`  ✗ 图片 "${image.title}" 迁移失败:`, error.message);
    }
  }
  console.log(`  ✓ 共迁移 ${images.length} 张图片`);
}

async function updateAlbumCovers() {
  console.log('\n📦 正在更新相册封面...');
  const albums = await loadBackupData('albums.json');

  for (const album of albums) {
    if (!album.coverImageId) continue;

    const albumId = idMapping.albums[album._id];
    const coverImageId = idMapping.images[album.coverImageId];

    if (albumId && coverImageId) {
      try {
        await prisma.album.update({
          where: { id: albumId },
          data: { coverImageId }
        });
      } catch (error) {
        console.log(`  ⚠ 更新相册 "${album.name}" 封面失败`);
      }
    }
  }
  console.log('  ✓ 相册封面更新完成');
}

// 保存 ID 映射表
function saveIdMapping() {
  const mappingPath = path.join(BACKUP_DIR, 'id_mapping_result.json');
  fs.writeFileSync(mappingPath, JSON.stringify(idMapping, null, 2), 'utf-8');
  console.log(`\n📁 ID 映射表已保存到: ${mappingPath}`);
}

async function migrate() {
  console.log('========================================');
  console.log('🚀 开始数据迁移: MongoDB → PostgreSQL');
  console.log('========================================');

  try {
    // 检查备份文件是否存在
    if (!fs.existsSync(BACKUP_DIR)) {
      console.error('❌ 备份目录不存在，请先运行备份脚本: node scripts/backupMongoDB.js');
      process.exit(1);
    }

    // 连接数据库
    await prisma.$connect();
    console.log('✓ PostgreSQL 连接成功');

    // 按顺序迁移
    await migrateUsers();
    await migrateAlbums();
    await migrateImages();
    await updateAlbumCovers();

    // 保存映射表
    saveIdMapping();

    // 统计结果
    const userCount = await prisma.user.count();
    const albumCount = await prisma.album.count();
    const imageCount = await prisma.image.count();

    console.log('\n========================================');
    console.log('✅ 数据迁移完成！');
    console.log('========================================');
    console.log(`  用户: ${userCount}`);
    console.log(`  相册: ${albumCount}`);
    console.log(`  图片: ${imageCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();

