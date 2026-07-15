# 素材与许可证

## 游戏本体

AI Defense RTS（代码、程序化美术、程序化音效）为私有未授权发布项目（`UNLICENSED`），版权归作者所有。未使用任何第三方游戏（含《星际争霸 II》）的名称、剧情、单位、造型、UI、图标、音乐、音效或素材。

## 自产素材清单

| 素材 | 来源 | 说明 |
| --- | --- | --- |
| 全部单位/建筑/资源造型 | 原创程序化矢量绘制（`src/render/sprites.ts`） | 运行时代码生成，无图像文件 |
| 地图地形/电路/感染区 | 原创程序化绘制（`src/render/terrain.ts`） | 确定性伪随机装饰 |
| UI 图标 | 原创 SVG（`src/ui/Icon.tsx`） | 手工编写 |
| 全部音效 | WebAudio 振荡器/噪声实时合成（`src/audio/audio.ts`） | 无音频文件 |
| 字体 | 系统字体栈（Helvetica Neue / 苹方） | 操作系统自带，随系统许可 |

## 开源依赖（构建期/运行期捆绑）

| 依赖 | 许可证 | 用途 |
| --- | --- | --- |
| Electron | MIT | 桌面应用壳 |
| React / React DOM | MIT | UI 层 |
| TypeScript | Apache-2.0 | 语言工具链 |
| Vite | MIT | 构建工具 |
| vitest | MIT | 测试框架 |
| esbuild | MIT | 打包工具 |
| electron-builder | MIT | 安装包构建 |
| @vitejs/plugin-react | MIT | 构建插件 |

以上依赖以 `npm install` 获取，其许可证全文见各自 `node_modules/<pkg>/LICENSE`。Electron 运行时包含 Chromium 与 Node.js，许可证见 Electron 发布包内 `LICENSE` / `LICENSES.chromium.html`。
