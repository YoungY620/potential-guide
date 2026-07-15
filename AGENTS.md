# AGENTS.md — AI Defense RTS

原创离线桌面单人 RTS（TypeScript + React + Canvas 2D + Electron）。

## 常用命令

- `npm install` — 安装依赖
- `npm run dev` — 开发模式（vite + electron）
- `npm test` — vitest 全量测试（改动后必须通过）
- `npm run typecheck` — 严格类型检查（必须通过）
- `npm run build` — 构建 renderer + electron 主进程
- `npm run dist` — 打包 `release/mac-arm64/AI Defense RTS.app`
- `node --expose-gc scripts/bench.mjs` — 性能/内存基准

## 架构铁律

- `src/game/` 为纯模拟层：禁止引用 DOM、Canvas、localStorage、墙钟时间；随机性只能来自 `rng.ts`（种子化）。所有系统按实体 id 顺序处理，保证同种子可复现。
- 单位/建筑/升级/技能一律数据驱动（`src/game/data/`），新增内容先加数据再加造型/图标。
- 命令先校验（`validate*` 返回中文原因供 UI 显示）后应用（`applyCommand`）。
- 模拟通过 `GameEvent` 与渲染/音频解耦；渲染层只读 World。

## 仓库约定

- 遵循根目录 AGENTS.md 的 git 规范（禁止任何 AI 署名）。
- QA 证据（截图/日志）存于 `docs/qa/`；QA 报告逐项 PASS/FAIL，禁止通过删测试/降断言制造通过。
