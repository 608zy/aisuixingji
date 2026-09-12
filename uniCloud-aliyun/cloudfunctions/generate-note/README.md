# generate-note 云函数部署指南

## 功能说明

这个云函数用于调用 AI API 生成旅游游记文案，支持：
- 文本提示词生成
- 图片识别（最多3张）
- 按建议重新生成
- 完整的错误处理

## 部署步骤

### 1. 在 HBuilderX 中部署

1. 打开 HBuilderX
2. 在项目目录中找到 `uniCloud-aliyun/cloudfunctions/generate-note`
3. 右键点击该文件夹
4. 选择 **"上传并部署云函数"**
5. 等待部署完成（会显示部署成功提示）

### 2. 配置并验证

推荐在云函数环境变量中配置 `AI_API_KEY` 和 `AI_API_BASE_URL`，上传部署后再通过小程序生成一篇游记进行验证。

## 云函数参数说明

### 输入参数

```javascript
{
  address: String,        // 必需 - 地点名称
  imageUrls: Array,       // 可选 - 图片 URL 数组（最多3张）
  feedbackText: String,   // 可选 - 改进建议
  apiKey: String,         // 可选 - 未配置 AI_API_KEY 环境变量时使用
  model: String,          // 可选 - 默认 gpt-4o-mini
  baseUrl: String         // 可选 - 未配置 AI_API_BASE_URL 环境变量时使用
}
```

### 返回格式

**成功时**:
```javascript
{
  ok: true,
  content: String,        // 生成的游记内容
  provider: "uniCloud"
}
```

**失败时**:
```javascript
{
  ok: false,
  error: String,          // 错误类型
  message: String,        // 错误详情
  detail: Object          // 详细信息（可选）
}
```

## 错误处理

云函数已包含完整的错误处理：

1. **参数验证**: 检查 address、HTTPS API 地址与输入长度
2. **API 响应验证**: 检查 res.data、choices、message.content
3. **异常捕获**: 捕获所有网络和系统错误
4. **明确错误信息**: 返回详细的错误类型和描述

## 常见问题

### Q: 部署后提示"云函数不存在"
A: 
1. 确认已在 HBuilderX 中上传部署
2. 检查云函数名称是否为 `generate-note`
3. 刷新 HBuilderX 的云函数列表

### Q: 测试连接失败
A:
1. 检查 API Key 是否正确（以 sk- 开头）
2. 检查网络连接
3. 查看云函数日志（HBuilderX -> uniCloud -> 云函数日志）

### Q: 生成失败返回错误
A:
1. 查看返回的 error 字段确定错误类型
2. 常见错误：
   - `missing_address`: 缺少地点参数
   - `api_response_empty`: API 返回为空
   - `api_format_error`: API 返回格式异常
   - `ai_api_error`: AI API 调用失败
   - `system_error`: 系统错误

### Q: 如何查看云函数日志
A:
1. 在 HBuilderX 中打开"运行"菜单
2. 选择"查看云函数日志"
3. 选择 `generate-note` 云函数
4. 查看实时日志输出

## 更新云函数

如果修改了云函数代码：
1. 保存修改
2. 右键 `generate-note` 文件夹
3. 选择"上传并部署云函数"
4. 等待部署完成

## 性能优化

- 超时时间: 120 秒（适合带图片的请求）
- 图片限制: 最多3张（避免请求过大）
- 错误重试: 由前端控制

## 安全说明

- 推荐在云函数环境变量中配置 `AI_API_KEY`、`AI_API_BASE_URL`，避免由前端传递密钥
- 云函数仅作为转发代理
- 所有请求都经过参数验证
- 错误信息不包含敏感数据

## 技术栈

- 运行环境: uniCloud 阿里云版
- Node.js 版本: 由 uniCloud 管理
- 依赖: 无需额外安装（使用 uniCloud.httpclient）

## 联系支持

如遇到问题：
1. 查看云函数日志
2. 检查返回的错误信息
3. 参考主项目的 BUG 修复文档
