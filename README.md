# 泡泡龙 H5

一个移动端优先的泡泡龙 H5 小游戏，使用原生 HTML、CSS、JavaScript 和 Canvas 2D 实现。项目目标是做成可以直接在手机浏览器中打开游玩的轻量级静态游戏。

## 当前功能

- 触摸或鼠标拖动瞄准，松开发射泡泡。
- 支持左右墙反弹和辅助瞄准轨迹。
- 顶部泡泡采用错位六边形网格排列。
- 泡泡命中后吸附到最近合法网格位置。
- 同色 3 个及以上连通时消除并计分。
- 消除后检测失去顶部连接的泡泡，并触发掉落加分。
- 支持暂停、继续、重新开始。
- 支持音效开关、震动反馈和调试信息开关。
- 支持炸弹、彩虹、激光三种特殊泡泡。
- 胜利条件为清空所有普通泡泡，失败条件为泡泡触达危险线或超出可玩区域。

## 本地运行

推荐通过本地静态服务器运行，不建议直接双击 `index.html`，因为项目使用了 ES modules。

```sh
python -m http.server 8000
```

然后在浏览器打开：

```text
http://localhost:8000
```

如果 Windows 上 `python` 命令不可用，可以尝试：

```sh
py -3 -m http.server 8000
```

也可以使用 VS Code Live Server 或其他静态文件服务器。

## 操作方式

- 手机端：按住并拖动屏幕瞄准，松开发射。
- 桌面端：使用鼠标拖动或点击发射。
- 游戏中可点击右上角按钮切换音效、调试信息或暂停游戏。

## 项目结构

```text
index.html
styles.css
src/
  main.js       # 初始化、资源加载、游戏循环
  game.js       # 游戏主状态和核心流程
  grid.js       # 六边形网格、坐标换算、连通检测
  physics.js    # 发射、反弹、碰撞和轨迹预览
  render.js     # Canvas 绘制
  input.js      # 指针输入
  assets.js     # 图片素材加载
  scoring.js    # 得分规则
  effects.js    # 消除、掉落和分数动效
  audio.js      # Web Audio 音效和震动反馈
images/
  used/         # 当前运行时直接加载的素材
  source/       # 原始素材
  processed/    # 处理中间素材
  archive/      # 暂存旧素材
```

## 技术方案

- 页面结构：HTML
- 样式与移动端适配：CSS
- 游戏逻辑：原生 JavaScript ES modules
- 渲染：Canvas 2D
- 音效：Web Audio API
- 震动反馈：`navigator.vibrate`

项目目前不依赖打包工具、后端服务、登录系统或排行榜。

## 开发重点

当前优先级是保证核心循环稳定：

1. 瞄准
2. 发射
3. 反弹
4. 吸附
5. 同色消除
6. 挂钩掉落
7. 计分
8. 暂停、重开、胜负结算

后续再考虑更完整的无尽模式、关卡模式、难度曲线和排行榜。

## 测试建议

当前项目还没有自动化测试。每次修改玩法逻辑后，建议至少手动验证：

- 直接命中泡泡后可以正确吸附。
- 反弹后命中泡泡可以正确吸附。
- 3 个及以上同色泡泡可以正确消除。
- 少于 3 个同色泡泡不会误消除。
- 消除连接点后，悬空泡泡会掉落并加分。
- 炸弹、彩虹、激光泡泡触发后不会卡住游戏状态。
- 泡泡触达危险线时进入失败结算。
- 清空普通泡泡时进入胜利结算。
- 暂停、继续、重新开始按钮可用。
- 手机浏览器中页面不滚动，瞄准和发射响应正常。

更详细的验收项见 [AI_ACCEPTANCE_TEST_PLAN.md](./AI_ACCEPTANCE_TEST_PLAN.md)。

## 相关文档

- [GAME_PLAN.md](./GAME_PLAN.md)：游戏设计和开发计划。
- [AI_DEVELOPMENT_ROADMAP.md](./AI_DEVELOPMENT_ROADMAP.md)：阶段路线。
- [AI_PHASE_PROMPTS.md](./AI_PHASE_PROMPTS.md)：分阶段开发提示。
- [AI_ACCEPTANCE_TEST_PLAN.md](./AI_ACCEPTANCE_TEST_PLAN.md)：验收测试清单。
