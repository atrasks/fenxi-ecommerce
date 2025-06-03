# 分析电子商务平台

一个功能完善的电子商务平台，支持国际物流跟踪、订单管理、产品管理等功能。

## 项目结构

```
├── backend/                # 后端服务
│   ├── src/
│   │   ├── config/        # 配置文件
│   │   ├── controllers/   # 控制器
│   │   ├── middleware/    # 中间件
│   │   ├── models/        # 数据模型
│   │   ├── routes/        # 路由
│   │   ├── services/      # 服务
│   │   ├── utils/         # 工具函数
│   │   └── app.js         # 应用入口
│   ├── package.json
│   └── README.md
├── frontend/              # 前端应用
│   ├── public/
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── pages/         # 页面
│   │   ├── services/      # API服务
│   │   ├── utils/         # 工具函数
│   │   └── App.js         # 应用入口
│   ├── package.json
│   └── README.md
└── README.md              # 项目说明
```

## 主要功能

- **用户管理**：注册、登录、个人信息管理
- **产品管理**：产品分类、产品列表、产品详情
- **订单管理**：购物车、下单、支付、订单跟踪
- **国际物流**：支持多种物流公司（DHL、UPS、17Track等）的物流跟踪
- **数据分析**：销售统计、用户行为分析

## 国际物流跟踪功能

系统支持多种国际物流公司的跟踪服务，包括：

- DHL
- UPS
- 17Track
- 菜鸟物流
- 云途物流

物流跟踪功能支持以下特性：

- 实时查询物流状态
- 物流状态历史记录
- 预计送达时间
- 物流事件通知
- 管理员手动更新物流状态

## 技术栈

### 后端

- Node.js
- Express
- MongoDB
- Mongoose
- JWT认证

### 前端

- React
- Redux
- Ant Design
- Axios

## 安装与运行

### 后端

```bash
cd backend
npm install
npm start
```

### 前端

```bash
cd frontend
npm install
npm start
```

## API文档

后端API文档通过Swagger提供，启动后端服务后访问：

```
http://localhost:5000/api-docs
```

## 贡献指南

欢迎提交问题和功能请求。对于重大更改，请先开issue讨论您想要更改的内容。

## 许可证

[MIT](LICENSE)
