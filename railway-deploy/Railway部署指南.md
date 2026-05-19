# 🚀 Railway 部署指南（推荐方案）

## 为什么选择 Railway？
- ✅ 免费额度：每月$5（完全够用）
- ✅ 不休眠：24小时在线
- ✅ 速度快：全球CDN加速
- ✅ 简单：图形界面操作
- ✅ 稳定：专业云平台

---

## 第一步：注册GitHub账号（5分钟）

### 1. 访问GitHub
```
https://github.com/signup
```

### 2. 填写信息
- Username: 自定义用户名
- Email: 您的邮箱
- Password: 设置密码

### 3. 验证邮箱
- GitHub会发送验证邮件
- 点击邮件中的验证链接

---

## 第二步：创建GitHub仓库（3分钟）

### 1. 登录GitHub后
点击右上角的 "+" 号，选择 "New repository"

### 2. 填写仓库信息
```
Repository name: leave-management
Description: 班级请假管理系统
Visibility: ✅ Public（公开，免费）

⚠️ 不要勾选 "Add a README file"
⚠️ 不要选择 .gitignore
⚠️ 不要选择 license
```

### 3. 创建仓库
点击绿色按钮 "Create repository"

---

## 第三步：上传项目代码（2分钟）

### 方式A：网页上传（推荐，最简单）

1. 在新创建的仓库页面，点击 **"uploading an existing file"**

2. 打开文件夹：
   ```
   D:\程序\班级请假管理系统\railway-deploy\
   ```

3. 将以下文件**拖拽**到上传区域：
   ```
   server.js
   package.json
   Procfile
   public 文件夹（包含3个html文件）
   ```

4. 在下方填写：
   - Commit message: "初始提交"

5. 点击绿色按钮 "Commit changes"

---

## 第四步：连接Railway（3分钟）

### 1. 访问 Railway
```
https://railway.app
```

### 2. 登录
- 点击右上角 **"Start a New Project"**
- 选择 **"Login with GitHub"**
- 授权 Railway 访问您的 GitHub

### 3. 创建项目
- 点击 **"New Project"**
- 选择 **"Deploy from GitHub repo"**
- 选择刚才创建的仓库：**leave-management**
- 点击 **"Deploy Now"**

---

## 第五步：配置环境（1分钟）

### 1. 等待部署
Railway会自动：
- 检测到 Node.js 项目
- 安装依赖
- 启动服务

### 2. 查看日志
点击服务名称，查看 "Logs" 标签页：
```
Installing dependencies...
npm install
...
Server running on port 3000
数据库初始化完成
```

### 3. 生成域名
- 点击 "Settings" 标签页
- 向下滚动到 "Domains"
- 点击 "Generate Domain"
- 会得到类似地址：
  ```
  https://leave-management-production-xxxx.up.railway.app
  ```

---

## 第六步：访问系统 🎉

### 1. 点击生成的域名

### 2. 看到登录页面！

### 3. 测试登录
| 身份 | 账号 | 密码 |
|------|------|------|
| 学生 | student1 | 123456 |
| 教师 | teacher1 | 123456 |

---

## 📱 分享给班级

将 Railway 生成的网址发送给同学即可！

例如：
```
https://leave-management-production-abc123.up.railway.app
```

---

## 🔧 常见问题

### Q: 显示 "Build Failed"？
A: 检查 package.json 和 Procfile 是否上传

### Q: 访问显示 404？
A: 等待1-2分钟让服务完全启动

### Q: 如何查看日志？
A: Railway控制台 → 项目 → 服务 → Logs

### Q: 如何重启服务？
A: Settings → 点击 "Redeploy"

### Q: 免费额度用完怎么办？
A: 删除项目后重新创建，额度会重置

---

## 💡 进阶技巧

### 自定义域名（可选）

如果您有自己的域名：
1. Settings → Domains
2. 点击 "Custom Domain"
3. 输入您的域名
4. 按提示配置DNS

### 查看资源使用

Dashboard → 查看项目资源使用情况：
- CPU使用率
- 内存使用
- 网络流量

---

## 📞 需要帮助？

- Railway文档：https://docs.railway.app
- Railway Discord：https://discord.gg/railway

---

## ✅ 部署成功检查清单

- [ ] GitHub账号已注册
- [ ] GitHub仓库已创建
- [ ] 项目代码已上传
- [ ] Railway已连接GitHub
- [ ] 项目已部署
- [ ] 域名已生成
- [ ] 可以正常访问
- [ ] 登录功能正常

全部打勾就成功了！🎉
