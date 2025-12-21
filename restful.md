API接口设计

**A. 用户认证相关 (`/api/auth`)**

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出

**B. 用户相关 (`/api/users`)**

- `GET /api/users/me` - 获取当前登录用户的详细信息
- `PUT /api/users/me` - 更新当前用户信息（如修改密码、头像）

**C. 图片相关 (`/api/images`)**

- `GET /api/images` - 获取图片列表（支持分页、按标签筛选、关键词搜索）

- `GET /api/images/:id` - 获取单张图片的详细信息

- `POST /api/images` - 上传一张新图片

- `PUT /api/images/:id` - 更新图片信息（描述、标签）

- `DELETE /api/images/:id` - 删除一张图片

  

**D. 相册相关 (`/api/albums`)**

- `GET /api/albums` - 获取当前用户的所有相册
- `POST /api/albums` - 创建一个新相册
- `PUT /api/albums/:id` - 更新相册信息（如添加/移除图片）
- `DELETE /api/albums/:id` - 删除一个相册