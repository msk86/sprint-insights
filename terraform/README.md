# Terraform Configuration Structure

## 文件说明

### 核心配置文件
- **`main.tf`** - 主要的基础设施资源定义
- **`variables.tf`** - 变量定义
- **`outputs.tf`** - 输出值定义
- **`provider.tf`** - 统一的AWS Provider配置（支持LocalStack和AWS）

## 使用方法

### 本地开发环境（LocalStack）
```bash
# 运行本地部署（只创建S3，跳过Lambda和API Gateway）
./scripts/1-deploy-local.sh

# 启动开发服务器
cd api && npm run dev    # 后端API (Express直接运行)
cd app && npm run dev    # 前端应用
```

**注意**: 本地开发默认 `skip_lambda=true`，只创建S3存储。API通过Express直接运行，更快且易于调试。

### 生产环境（AWS）
```bash
# 运行生产部署（创建完整的Lambda + API Gateway + S3）
./scripts/4-deploy-production.sh
```

**注意**: 生产环境自动设置 `skip_lambda=false`，创建完整的无服务器架构。

## 配置说明

### 关键变量

#### `use_localstack`
控制Provider连接目标：
- `true`: 连接LocalStack（本地开发）
- `false`: 连接真实AWS（生产环境）

#### `skip_lambda`
控制是否创建Lambda和API Gateway：
- `true`: 只创建S3存储（本地开发默认）
- `false`: 创建完整架构（生产环境）

### LocalStack模式 (`use_localstack=true`)
- 使用测试凭证 (`test`/`test`)
- 所有AWS服务指向 `http://localhost:4566`
- 跳过凭证验证和元数据API检查
- 适用于本地开发和测试
- **默认 `skip_lambda=true`**: 只创建S3，API直接运行

### 生产模式 (`use_localstack=false`)
- 使用默认AWS凭证（AWS CLI、IAM角色等）
- 连接到真实的AWS服务
- 使用配置的AWS区域
- **强制 `skip_lambda=false`**: 创建Lambda + API Gateway

## 故障排除

### Provider配置错误
如果遇到provider相关错误：
1. 确保`use_localstack`变量设置正确
2. 检查环境变量`TF_VAR_use_localstack`
3. 验证LocalStack服务是否正在运行（本地模式）
4. 如果从旧配置迁移，可能需要删除`.terraform`目录并重新初始化

### 环境切换
在本地和生产环境之间切换时：
1. 使用相应的部署脚本
2. 确保正确的环境变量设置
3. 检查Terraform状态文件
4. 建议使用不同的状态文件或Terraform工作空间来隔离环境

### 状态文件清理
如果从旧的provider配置迁移（使用provider别名）：
```bash
# 删除Terraform缓存和锁定文件
rm -rf .terraform .terraform.lock.hcl

# 重新初始化
terraform init
```

## 最佳实践

1. **开发时**: 设置 `use_localstack=true` 使用LocalStack
2. **部署时**: 设置 `use_localstack=false` 连接AWS
3. **版本控制**: 将所有`.tf`文件提交到版本控制
4. **环境隔离**: 使用不同的Terraform工作空间或状态后端
