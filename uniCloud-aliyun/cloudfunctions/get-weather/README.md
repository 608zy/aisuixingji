# get-weather 云函数

通过百度地图天气 API 获取实时天气。失败时返回明确错误，不再用模拟温度、预报或空气质量冒充真实数据。

## 部署配置

上传云函数前，在云函数环境变量中配置：

- `BAIDU_MAP_AK`：百度地图开放平台 AK（必填）

## 请求

```javascript
const res = await uniCloud.callFunction({
  name: 'get-weather',
  data: {
    latitude: 39.9042,
    longitude: 116.4074
  }
})
```

`latitude` 必须在 `-90..90`，`longitude` 必须在 `-180..180`。

## 返回

成功：

```json
{
  "ok": true,
  "data": {
    "now": {
      "temp": "25",
      "text": "晴",
      "code": "0",
      "feelsLike": "27",
      "humidity": "45",
      "windDir": "东南风",
      "windScale": "3",
      "pressure": "1013"
    },
    "city": "北京市"
  }
}
```

失败：

```json
{
  "ok": false,
  "error": "not_configured",
  "message": "请在 get-weather 云函数环境变量中配置 BAIDU_MAP_AK"
}
```

错误代码包括 `invalid_location`、`not_configured`、`upstream_error` 和 `request_failed`。
