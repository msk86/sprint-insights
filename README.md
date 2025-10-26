# Sprint Insights

一个集成LLM能力的交付迭代数据展示和分析单页应用。

## 功能特性

- **团队配置管理**: 支持JIRA和Buildkite集成配置
- **迭代数据展示**: 实时获取和展示Sprint数据
- **历史趋势分析**: 多迭代数据对比和趋势图表
- **AI智能分析**: 基于Claude Sonnet 4的迭代数据分析
- **自由LLM交互**: 与AI助手进行自然语言对话

## 技术栈

### 后端
- **TypeScript** + **Express** + **AWS Lambda**
- **AWS Bedrock** (Claude Sonnet 4)
- **AWS S3** (数据存储和缓存)
- **AWS API Gateway**

### 前端
- **React** + **TypeScript**
- **Material-UI (MUI)**
- **Recharts** (数据可视化)
- **Vite** (构建工具)

### 基础设施
- **AWS** (生产环境)
- **LocalStack** (本地开发)
- **Terraform** (基础设施即代码)

## 快速开始

### 环境要求

- Node.js 18+
- Docker & Docker Compose
- AWS CLI (用于部署)
- Terraform (用于基础设施)

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd sprint-insights
```

2. **安装依赖**
```bash
npm install
```

3. **启动LocalStack并部署基础设施**
```bash
# 设置LocalStack环境
chmod +x scripts/setup-localstack.sh
./scripts/setup-localstack.sh

# 部署基础设施
chmod +x scripts/deploy-local.sh
./scripts/deploy-local.sh
```

5. **配置环境变量**
```bash
cp env.template .env.development
# 编辑 .env.development 文件，填入你的JIRA和Buildkite配置
```

6. **启动开发服务器**
```bash
npm run dev
```

访问 http://localhost:3000 查看应用。

### 部署到AWS

1. **配置AWS凭证**
```bash
aws configure
```

2. **部署基础设施**
```bash
# 使用生产环境部署脚本
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh

# 或者使用原始部署脚本
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 项目结构

```
sprint-insights/
├── api/                    # 后端API
│   ├── src/
│   │   ├── controllers/    # API控制器
│   │   ├── services/       # 业务服务
│   │   ├── utils/          # 工具函数
│   │   └── types/          # 类型定义
│   └── serverless.yml      # Serverless配置
├── app/                    # 前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API服务
│   │   └── types/          # 类型定义
│   └── vite.config.ts     # Vite配置
├── terraform/              # 基础设施代码
├── scripts/                # 部署脚本
└── docker-compose.yml      # LocalStack配置
```

## API接口

### 团队管理
- `GET /api/teams` - 获取团队列表
- `POST /api/teams` - 创建团队
- `PUT /api/teams/:teamId` - 更新团队
- `DELETE /api/teams/:teamId` - 删除团队

### 迭代数据
- `GET /api/sprints` - 获取迭代数据
- `GET /api/sprints/history` - 获取历史迭代数据

### LLM分析
- `POST /api/llm/analyze` - 迭代数据分析
- `POST /api/llm/chat` - 自由对话

## 数据模型

### 团队配置
```typescript
interface TeamConfig {
  team: string;
  JIRA_EMAIL: string;
  JIRA_TOKEN: string;        // 加密存储
  JIRA_PROJECT: string;
  JIRA_BOARD_ID: string;
  BUILDKITE_TOKEN: string;    // 加密存储
  BUILDKITE_PIPELINES: string;
}
```

### 迭代数据
```typescript
interface SprintData {
  sprint: SprintMeta;
  columns: SprintColumn[];
  issues: Issue[];
  builds: Build[];
}
```

## 环境变量

### 开发环境 (.env.development)
```bash
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022
S3_BUCKET_NAME=sprint-insights-data
LOCALSTACK_ENDPOINT=http://localhost:4566
ENCRYPTION_KEY=your-32-character-secret-key-here!
JIRA_BASE_URL=https://your-domain.atlassian.net
BUILDKITE_ORG_SLUG=your-org-slug
FRONTEND_URL=http://localhost:3000
```

### 生产环境
```bash
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022
S3_BUCKET_NAME=your-s3-bucket
ENCRYPTION_KEY=your-32-character-secret-key
JIRA_BASE_URL=https://your-domain.atlassian.net
BUILDKITE_ORG_SLUG=your-org-slug
FRONTEND_URL=https://your-frontend-domain.com
```

## 开发指南

### 添加新功能

1. **后端API**: 在 `api/src/` 下添加新的控制器和服务
2. **前端组件**: 在 `app/src/components/` 下添加新的React组件
3. **类型定义**: 在相应的 `types/` 目录下更新TypeScript类型

### 测试

```bash
# 运行API测试
cd api && npm test

# 运行前端测试
cd app && npm test
```

### 代码规范

- 使用TypeScript严格模式
- 遵循ESLint和Prettier配置
- 编写单元测试
- 使用语义化提交信息

## 故障排除

### 常见问题

1. **LocalStack连接失败**
   - 确保Docker服务正在运行
   - 检查端口4566是否被占用

2. **API调用失败**
   - 检查环境变量配置
   - 确认LocalStack服务状态

3. **LLM分析失败**
   - 验证Bedrock模型ID
   - 检查AWS凭证配置

## 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请创建Issue或联系开发团队。
