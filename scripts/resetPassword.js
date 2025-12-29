const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/database');
const User = require('../models/User');

const printUsage = () => {
  console.log('用法:');
  console.log('  node scripts/resetPassword.js --list');
  console.log('  node scripts/resetPassword.js <username> <newPassword>');
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return { help: true };
  if (args.includes('--list') || args.includes('-l')) return { list: true };

  const [username, newPassword] = args;
  return { username, newPassword };
};

const listUsers = async () => {
  const users = await User.find({}, { username: 1, avatarUrl: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .lean();

  if (!users.length) {
    console.log('没有找到任何用户。');
    return;
  }

  console.log('当前用户列表:');
  for (const user of users) {
    console.log(`- ${user.username}`);
  }
};

const resetPassword = async ({ username, newPassword }) => {
  if (!username || !newPassword) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (String(newPassword).length < 6) {
    console.error('新密码至少需要 6 个字符。');
    process.exitCode = 1;
    return;
  }

  const user = await User.findOne({ username });
  if (!user) {
    console.error(`未找到用户: ${username}`);
    console.error('你可以先运行: node scripts/resetPassword.js --list');
    process.exitCode = 1;
    return;
  }

  user.password = String(newPassword);
  await user.save();

  console.log(`密码已重置: ${username}`);
};

const main = async () => {
  const { help, list, username, newPassword } = parseArgs();

  if (help) {
    printUsage();
    return;
  }

  await connectDB();

  try {
    if (list) {
      await listUsers();
      return;
    }

    await resetPassword({ username, newPassword });
  } finally {
    await mongoose.connection.close();
  }
};

main().catch((error) => {
  console.error('重置密码失败:', error);
  process.exit(1);
});

