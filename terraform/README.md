# Terraform Configuration Structure

## 文件说明

### 核心配置文件
- **`main.tf`** - 主要的基础设施资源定义
- **`variables.tf`** - 变量定义
- **`outputs.tf`** - 输出值定义

### 环境特定配置
- **`local.tf`** - LocalStack开发环境配置
- **`production.tf`** - AWS生产环境配置

## 使用方法

### 本地开发环境（LocalStack）
```bash
# 设置环境变量
export TF_VAR_use_localstack=true

# 运行本地部署
./scripts/deploy-local.sh
```

### 生产环境（AWS）
```bash
# 设置环境变量
export TF_VAR_use_localstack=false

# 运行生产部署
./scripts/deploy-production.sh
```

## 配置说明

### 动态Provider选择
Terraform使用`use_localstack`变量来动态选择正确的provider：
- `use_localstack=true`: 使用`aws.localstack` provider
- `use_localstack=false`: 使用`aws.production` provider

### LocalStack配置 (`local.tf`)
- 使用别名`localstack`
- 使用测试凭证 (`test`/`test`)
- 所有AWS服务指向 `http://localhost:4566`
- 跳过凭证验证和元数据API检查

### 生产环境配置 (`production.tf`)
- 使用别名`production`
- 使用默认AWS凭证（AWS CLI、IAM角色等）
- 连接到真实的AWS服务
- 使用配置的AWS区域

## 故障排除

### Provider配置错误
如果遇到provider相关错误：
1. 确保`use_localstack`变量设置正确
2. 检查环境变量`TF_VAR_use_localstack`
3. 验证provider别名配置

### 环境切换
在本地和生产环境之间切换时：
1. 使用相应的部署脚本
2. 确保正确的环境变量设置
3. 检查Terraform状态文件

## 最佳实践

1. **开发时**: 始终使用 `local.tf` 配置
2. **部署时**: 使用 `production.tf` 配置
3. **版本控制**: 将 `local.tf` 和 `production.tf` 都提交到版本控制
4. **环境隔离**: 使用不同的Terraform状态文件或工作空间
