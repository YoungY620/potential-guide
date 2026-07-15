# AI Defense RTS

一款**完全原创、可离线运行**的桌面单人即时战略游戏（RTS）。你指挥防御型 AI 机体「守望机群」，抵御「自适应入侵体」对网络的吞噬。

- 平台：macOS（当前交付 `AI Defense RTS.app`），Windows 版本可通过同一源码构建（`AI Defense RTS.exe`）
- 技术栈：TypeScript + React + Canvas 2D + Electron
- 完全离线：无任何网络请求，无外部素材依赖，全部美术与音效由程序生成

---

## 一键启动（用户）

1. 解压发布包。
2. 双击 **`AI Defense RTS.app`**（macOS）。无需终端、无需安装 Node.js / Python / 任何依赖、无需环境变量、无需端口或本地服务器。
3. 3 秒内出现窗口，10 秒内进入主菜单。设置（音量、UI 缩放、色觉方案、快捷键改绑）在退出后保留。

> macOS 未签名提示：首次打开如被 Gatekeeper 拦截，在「系统设置 → 隐私与安全性」中允许，或右键 → 打开。

## 游戏内容

- **1 张完整地图**：主基地、两类资源（数据晶片 / 流能）、三处资源区、通路、电路岭阻挡、战争迷雾、三条进攻路线（北线 / 中线 / 南线）。
- **玩家阵营（秩序机器）**：1 个主基地（核心主堡）、3 种功能建筑（制造厂 / 数据链塔 / 电容塔）、1 种防御建筑（防火墙炮塔）、1 种采集单位（接续者）、4 种战斗单位（哨卫 / 壁垒 / 弧光投射者 / 修补匠）、2 项升级（复合装甲 / 超频协议）、2 个主动技能（电磁脉冲 / 纳米修复云）。
- **敌方阵营（自适应入侵体）**：1 个生成节点（瘟巢）、4 种普通敌军（噬虫 / 喷吐者 / 噬建虫 / 母巢虫）、1 种精英敌军（蹂躏者）、最终入侵核心。
- **完整对局 10–15 分钟**：采集、建造、生产、容量限制、升级、战斗、分阶段敌袭、路线选择、至少一次根据玩家军力/防御的兵种适配、暂停、重开、胜利（摧毁入侵核心）与失败（主堡被毁）。同一随机种子下结果可复现。
- **第三阵营（超维协议体）**：首版交付美术规范与 3 个单位概念（见 `docs/ART_SPEC.md`），未实装。

## 操作（默认快捷键）

| 操作 | 按键 |
| --- | --- |
| 选择 / 拖框 / Shift 增减 / 双击选同类 | 鼠标左键 |
| 智能命令（移动/攻击/采集/修复/续建） | 鼠标右键 |
| 攻击移动 / 停止 / 保持 / 巡逻 | A / S / H / P |
| 取消 / 清除选择 / 暂停菜单 | Esc |
| 定位最新警报 | Space |
| 追加命令 | Shift + 命令 |
| 创建编队 / 追加编队 / 选择编队 / 双击定位镜头 | Ctrl+数字 / Shift+数字 / 数字 / 双击数字 |
| 切换单位子组 | Tab |
| 暂停 | F10 |
| 镜头 | 方向键 / 边缘滚屏（可在设置关闭）/ 小地图点击拖动 / 滚轮缩放 |
| 战术技能 | Q（电磁脉冲）/ W（纳米修复云） |
| 建造（选中接续者） | F 制造厂 / U 数据链塔 / C 电容塔 / T 炮塔 |
| 训练（选中建筑） | 见命令卡按钮上的快捷键标注 |

快捷键可在「快捷键」界面改绑，冲突会自动检测并提示。完整表见 `docs/HOTKEYS.md`。

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（vite + electron 热更新）
npm test           # 自动化测试（vitest）
npm run typecheck  # 类型检查
npm run build      # 构建 renderer + electron 主进程
npm run dist       # 打包 release/mac-arm64/AI Defense RTS.app
npm run bake:materials  # 重新生成材质文件 public/assets/materials/*.png
node --expose-gc scripts/bench.mjs   # 性能与内存基准
```

## 发版（CI）

推送版本 tag 即可自动发版（`.github/workflows/release.yml`）：

```bash
git tag v0.1.0
git push origin v0.1.0
```

工作流会先跑类型检查与全部测试，然后在 macOS（arm64）与 Windows 双平台打包，把
`AI-Defense-RTS-macOS-arm64.zip` 与 `AI-Defense-RTS-windows-x64.zip`（含 SHA256 校验文件）
发布到对应的 GitHub Release。

## 目录结构

```
electron/       Electron 主进程（窗口、打包入口）
src/game/       纯模拟层：固定步长、数据驱动单位/建筑/升级/技能、波次 AI
src/game/systems/  移动/指令/战斗/生产系统
src/input/      选择、镜头、快捷键映射与冲突检测
src/render/     Canvas 渲染：程序化矢量美术、地形、迷雾、特效、小地图
src/ui/         React HUD 与界面（命令卡、设置、快捷键、教学、结算）
src/audio/      WebAudio 程序化音效合成
src/state/      设置与按键绑定的本地持久化
tests/          vitest 自动化测试
scripts/        开发启动、构建、性能基准
docs/           设计、快捷键表、美术规范、素材许可、QA 报告
```

## 文档

- `docs/DESIGN.md` — 设计与架构说明
- `docs/HOTKEYS.md` — 完整快捷键表
- `docs/ART_SPEC.md` — 三个阵营的美术规范 + 超维协议体 3 个单位概念
- `docs/LICENSES.md` — 素材与依赖许可证
- `docs/QA_REPORT.md` — 逐项 PASS/FAIL 的 QA 报告（含性能结果与截图）
