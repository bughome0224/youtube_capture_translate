# YouTube截图翻译

在 YouTube 播放器中提供页面内「译」按钮，框选视频中的任意区域，使用腾讯云 OCR 识别文字，并通过有道智云翻译为中文。

## 功能

- 仅在 `youtube.com` 生效（watch / Shorts / embed）
- 在 YouTube 播放器控制栏点击「译」按钮，或按 `Alt+Shift+S` 后框选截图区域
- 自动暂停视频，确认区域后识别画面文字并翻译
- 使用可见页面截图裁切，支持只翻译画面中的指定区域
- 识别和翻译结果直接以页面弹窗展示，支持复制原文和译文
- 点击浏览器工具栏中的扩展图标会打开设置页，保存后自动关闭

## 开发

```bash
npm install
npm run dev
```

开发模式下，Chrome 加载 `dist` 目录（`npm run dev` 会监听变更并自动重建）。

生产构建：

```bash
npm run build
```

## 安装到 Chrome

1. 执行 `npm run build`
2. 打开 `chrome://extensions`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目下的 `dist` 目录

## 配置

在扩展设置页填写：

| 字段 | 来源 |
|------|------|
| 腾讯云 SecretId / SecretKey | [文字识别控制台](https://console.cloud.tencent.com/ocr) |
| 有道 appKey / appSecret | [有道智云控制台](https://ai.youdao.com/) |

首次使用前需勾选隐私说明。

## 使用

1. 打开任意 YouTube 视频页面
2. 停在需要识别的画面（插件也会自动暂停）
3. 点击播放器控制栏中的「译」按钮，或按 `Alt+Shift+S`
4. 拖拽选择要翻译的区域，点击「确认翻译」
5. 在页面弹窗中查看截图、原文与中文译文，按需复制

## 限制

- 不支持画中画窗口内截图
- 广告播放中会提示稍后重试
- API 密钥保存在本机，截图会上传至腾讯云与有道服务器
