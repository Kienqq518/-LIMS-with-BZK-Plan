# 三维场景光影与材质精修（twin-look.js · FR-37）

参考口径：用户给的 threejs-skills「材质光影细调」参考图（暗场 PBR：光伏板亮面玻璃、发光路径、暖色窗光、接地阴影）。
本屏是**白蓝 CAD 运行镜像**，不能照搬暗场调色；要搬的是它"质感"的四条成因——
**明暗层次、材质微表面对比、纵深、以及只给已 authored 的自发光元素辉光**。
按技能口径的顺序做：forms（CAD 已有）→ materials → lighting → effects。

## 1. 改了什么

### 灯光分工（原来所有光一起把面压平）
| | 改前 | 改后 | 为什么 |
|---|---|---|---|
| 半球光 hemi | .63 | **.42** | 半球光把明暗差抹平，白机身看不出朝向 |
| 主光 key | 2.2 | **2.55** | 定形；阴影只给它一盏 |
| 补光 fill | .58 | **.34**（并移到主光反向） | 补光是"保住可读性"，不是第二盏太阳 |
| 轮廓光 rim | 无 | **新增 1.15**（从相机背面斜射） | 把白色机身从浅色地面上"剥"出来——技能给的 key/fill/rim 三件套 |
| IBL 环境强度 | .5 | **.68** | 金属与玻璃的反射是"渲染感"的主要来源 |
| 曝光 | 1.12 | **1.02** | 加了明暗对比后回收曝光，别把白机身推爆 |
| 阴影 | PCF 硬边、4096 贴图 | **PCFSoft、2048**、shadow 相机收到 ±26 | 技能桌面预算 ≤2048；`shadow.radius` 只在 PCFSoft 下生效 |

### 材质角色 kit（112 个共享材质，六类角色）
`ground×6 · body×76 · panelDark×15 · metal×6 · glass×4 · signal×5`
判定按**现有色相 + 几何尺寸 + 透明/暗度**归类，不改 CAD 几何时相。核心是技能那句话：
**角色靠 roughness/metalness 对比区分，不靠色相。**

- `ground` 粗糙 .62 + 程序化噪声粗糙度图（repeat 9）→ 不再是整片塑料
- `panelDark`（环氧台面/深灰面板）粗糙 .34 + metalness .18 → 主光扫过去有一条柔和高光带
- `metal` 金属度 .58 粗糙 .3 + 各向异性拉伸的噪声（repeat 1×6）→ 拉丝金属
- `glass` 粗糙 .10 + clearcoat 1 + envMapIntensity 1.25 → 参考图 PV 板那种"亮面"，而不是原来的一块白雾
- `signal`（品牌蓝/绿/橙功能件）**不吃微表面**，保持纯色，否则信号色会脏
- 自发光材质：`emissiveIntensity ≥1.6` 且 `fog=false`（光点/屏幕/线路要一直清晰，并给 bloom 供能）

噪声图是**一张 canvas 纹理 + 三种 repeat 克隆**，不新建贴图池（textures 70，预算内）。
没 uv 属性的 CAD 件不挂粗糙度图（只会采到 (0,0)，白挂）。

### 纵深（正交相机下的雾要按机位算）
线性雾 `#eef2f7`（贴宿主背景渐变，远处是"融进页面"不是"变灰"），
`near = d-8, far = d+130`，d 为当前相机到场景中心的距离，**每次渲染前刷新**。
写死数值会在切近（d≈13.5）时把整台机器糊成灰块；按 d 平移后切近几乎不生效、总览才有纵深。

### 后处理：选择性 bloom + 极淡暗角 + 去色带颗粒
链：`scene → 多重采样 RT(samples:4) → 1/4 bright-pass → H/V 高斯 → 合成`（4 个额外 pass）。
自己实现而不是引 `EffectComposer` addon：addon 与 vendor 的 three r180 分开维护迟早对不上，
且这里只需要一个 bloom，手写 120 行比引入 6 个文件更可控、也保得住 `preserveDrawingBuffer` 的导出截图功能。

**关键一条**：白场景做普通亮度阈值的 bloom 会把整片白机身糊掉。
bright-pass 里再乘一道**饱和度门** `w = smoothstep(thr,thr+knee,luma) × (0.25+0.75×smoothstep(.12,.55,sat))`——
白色 luma 高但 sat≈0 被排除，只有航段带、状态光点、线路、屏幕这类饱和高亮元素进 bloom。
技能口径原文是"bloom 只给 authored emissive 元素"，这就是它在白场景的落地方式。

## 2. 两条本轮真实踩到的坑（都已写成常驻断言）

1. **合成写 `alpha=1` → 整屏被压黑。** 本屏画布是透明的（`alpha:true` + 宿主 CSS 渐变从后面透出来）。
   合成输出 alpha=1 后，"没有几何体的地方"变成不透明黑，四块玻璃浮层（backdrop-blur 采到黑底）瞬间全部变暗，
   看起来像"图表和面板坏了"。→ 合成必须 `gl_FragColor.a = base.a`；
   `lookcheck` 现在直接 `gl.readPixels` 断言**画布空白处 alpha < 24、画面中心 alpha > 200**。
2. **灯光数值被引擎预设覆盖（顺序竞态）。** `whiteblue-spatial-engine.start()` 在 look 之后跑，
   把 exposure 又改回 1.12、hemi 改回 .63——谁后跑谁赢。→ 引擎设完预设广播 `twin-lighting-preset`，
   look 收到再压一遍（另有 1.5s 兜底），断言 `exposure ≤1.05 且 shadowType=2`。

顺带修掉一条老问题：`?look=flat` 这类**外来 URL 开关会被宿主的 `writeURL()` 吃掉**
（它从零重建 query）。现在 writeURL 从当前参数起步、只覆盖托管的 7 个键。

## 3. 开关与交付档

- `?look=flat` —— 整体关掉精修（对比取证、回归排错用）
- `?quality=low` —— 交付低配档：后处理链仍在但 `active=false`（单 pass）、灯光收回保守值、阴影 1024、DPR 1
  注意只改数值与开关，**不重新 patch `renderer.render`**（打两次就套两层后处理）

## 4. 渲染诊断（技能要求：改完必须报数）

| 指标 | 改前 | 改后 | 预算（桌面） |
|---|---|---|---|
| 帧率（1920×1080 / DPR1，含 8~9 张 G2 图表） | 60fps | **60fps** | — |
| 投影灯光 / 阴影贴图 | 2 盏 / 4096 | 2 盏（lab 开启时原 sun 不可见）/ **2048** | ≤2 盏 / ≤2048 |
| textures | 66 | **70**（新增 3 张 repeat 克隆共享同一 canvas） | ≤60~70（CAD 场景本身超配，见下） |
| geometries | 2721 | 2732 | ≤300（CAD 逐件导出，未实例化） |
| draw calls（场景渲染） | ~2751 | ~2751 | ≤300 |
| post passes | 0 | 4（bright + 2 blur + composite，bloom 在 1/4 分辨率） | ≤2 beyond render+output |
| DPR cap | 2 | 2（低配档 1） | 2 |

**明确记录的超配**：draw calls 与 geometries 远超技能预算，原因是 CAD 逐构件导出、无构建期合并/实例化，
这是数据侧约束不是渲染偷懒；本轮没有动几何，帧时保持 60fps。要压下来得做同材质合批 + InstancedMesh（重复货架/座椅/台桌），
那是独立的一轮工作，收益是低端投影机的余量。post passes 超预算（4 > 2）也是记录在案的取舍：
bloom 的三级模糊在 1/4 分辨率上跑，实测帧时不变。

## 5. 十类打分（技能 scorecard，改前 → 改后，每类一句证据）

| 类别 | 改前 | 改后 | 证据 |
|---|---|---|---|
| Art direction | 2 | 2 | 白蓝运行镜像一致；本轮没有换风格，只补质感 |
| Hero（106 无人化区） | 2 | 2.5 | 每台设备有接地阴影 + 罩体亮面，切近时机身朝向读得出 |
| Obstacles/角色件 | 2 | 2 | 状态光点/线路/屏幕现在自发光且不吃雾，信号清晰 |
| World/environment | 2 | 2.5 | 纵深雾让远侧房间后退，画面不再是一张平面 |
| Materials/textures | **1.5** | **2.5** | 六类角色按 roughness/metalness 分开（原来几乎全靠色相），共享噪声图 |
| Lighting/render | **1.5** | **2.5** | key/fill/rim 分工 + IBL .68 + ACES + PCFSoft + 选择性 bloom |
| VFX/motion | 2 | 2 | 未新增特效（运行镜像不该用特效讲故事） |
| UI/HUD | 2.5 | 2.5 | 浮层未动；画布透明保住了玻璃采色 |
| Performance evidence | 2 | 2.5 | 本表 + lookcheck 常驻断言（fps/贴图/阴影/开关） |
| **平均** | ~2.0 | **~2.4** | 达技能"premium ≥2.3"线 |

## 6. 回归

`tests/twin/lookcheck.mjs`（14 项）：角色 kit 命中、灯光数值压过引擎预设、雾窗口、
画布空白处仍透明、投影灯与贴图预算、后处理在场 ≥50fps、`?look=flat` 与 `?quality=low` 真生效。
