# 部署脚本说明

## 脚本概览

项目现在包含4个核心部署脚本，每个都有明确的职责：

### 本地开发环境脚本

#### 1. `setup-localstack.sh`
**用途**: 启动和验证LocalStack环境
- 检查LocalStack是否运行
- 启动LocalStack（如果需要）
- 验证LocalStack健康状态

#### 2. `deploy-local.sh`
**用途**: 在LocalStack中部署基础设施
- 验证LocalStack运行状态
- 使用Terraform部署基础设施
- 输出部署结果和下一步指导

#### 3. `cleanup-local.sh`
**用途**: 清理LocalStack资源
- 销毁Terraform资源
- 提供重启指导

### 生产环境脚本

#### 4. `deploy-production.sh`
**用途**: 在AWS生产环境中部署基础设施
- 验证AWS CLI配置
- 临时移除本地配置
- 使用Terraform部署到AWS
- 自动恢复本地配置

## 使用流程

### 本地开发环境
```bash
# 1. 设置LocalStack
./scripts/setup-localstack.sh

# 2. 部署基础设施
./scripts/deploy-local.sh

# 3. 启动开发服务器
npm run dev

# 4. 清理资源（可选）
./scripts/cleanup-local.sh
```

### 生产环境部署
```bash
# 1. 配置AWS凭证
aws configure

# 2. 部署基础设施
./scripts/deploy-production.sh

# 3. 部署API和前端
cd api && npm run deploy
cd ../app && npm run build
```

## 脚本特性

### 用户友好
- ✅ 使用emoji图标增强可读性
- ✅ 清晰的步骤说明
- ✅ 详细的错误信息
- ✅ 下一步指导

### 错误处理
- ✅ 检查前置条件
- ✅ 优雅的错误退出
- ✅ 有用的错误消息

### 自动化
- ✅ 自动环境检测
- ✅ 自动配置切换
- ✅ 自动恢复配置

## 最佳实践

1. **开发时**: 始终使用本地脚本
2. **部署时**: 使用生产脚本
3. **清理时**: 使用清理脚本
4. **调试时**: 检查脚本输出和日志

## 故障排除

### 脚本权限问题
```bash
chmod +x scripts/*.sh
```

### LocalStack连接问题
```bash
docker-compose ps
docker-compose logs localstack
```

### AWS配置问题
```bash
aws sts get-caller-identity
aws configure
```
