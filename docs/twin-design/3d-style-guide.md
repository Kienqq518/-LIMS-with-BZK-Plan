# 3D 风格指南 V1（3d-style-guide.md）

> 输入：《视觉语言提取 V1.md》§1/§3 + 参考图；方法：threejs-aaa-graphics-builder（先形体后材质再光照后特效的次序、key/fill/rim/practical/contact 五层光栈、cookbook 实测链参数）
> 目标气质：**高调白（high-key）实验室沙盘**——亮、净、柔，靠描边与浮卡传达状态，不靠戏剧性光影。

## 1. 渲染器
```ts
renderer = new WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));   // 大屏 4K 也封顶 2
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;                     // 高调白关键参数：1.05–1.15 区间微调
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
scene.background = new Color('#FBFCFE');
scene.fog = new FogExp2('#F6F8FB', 0.012);               // 背景淡出=「设备突出、背景虚化」的低成本实现
```

## 2. 光照配置（五层，全部冷白系，禁彩色补光）
| 层 | 实现 | 参数 |
|---|---|---|
| 环境 | HemisphereLight | sky `#FFFFFF` ground `#E8ECF2` intensity `0.9` |
| key | DirectionalLight | `#FFFFFF` intensity `1.2`，pos `(18, 26, 14)`，castShadow，map 2048，bias `-0.0004`，normalBias `0.02`，shadow.camera 覆盖全实验室 |
| fill | DirectionalLight | `#F2F6FF` intensity `0.35`，对侧低角度，不投影 |
| rim/back | DirectionalLight | `#FFFFFF` intensity `0.5`，反打轮廓，把白设备从白背景里剥出来 |
| practical/contact | 设备指示灯 emissive + 地面 blob 阴影贴图 | 见 §3；阴影只给 hero 设备与房间大件，其余用 contact blob |

## 3. 材质参数（角色靠 roughness/metalness 对比区分，不靠色相）
```ts
// 设备主体（白机身，占 80% 面积）
MeshStandardMaterial({ color: 0xF4F6F8, roughness: 0.45, metalness: 0.05, envMapIntensity: 0.6 });
// 设备细节（面板/观察窗/屏幕）
MeshStandardMaterial({ color: 0x2A2F36, roughness: 0.30, metalness: 0.15 });   // 屏幕 emissive 0x111418 微亮
// 玻璃隔断（参考图通透感；性能不足时退 transparent 0.18 + roughness 0.1）
MeshPhysicalMaterial({ transmission: 0.9, roughness: 0.05, thickness: 0.02, color: 0xEFF3F8, transparent: true });
// 地面（白 + 弱反射：Reflector 或 env 采样，强度 0.15，禁止镜面级）
MeshStandardMaterial({ color: 0xFAFBFC, roughness: 0.30, metalness: 0.0 });
// 浅金引导线（不照亮、不受光：MeshBasic 贴花/Line，永远 #E8D77A）
MeshBasicMaterial({ color: 0xE8D77A, transparent: true, opacity: 0.9 });
// 指示灯（唯一吃 bloom 的 emissive 源，基色压暗保证只有光在读）
MeshStandardMaterial({ color: 0x101010, emissive: 0x2878FF, emissiveIntensity: 2.2, roughness: 0.4 });
```
墙体：`#EDF0F4` roughness 0.6，剖切高度按参考图（远墙留 1/3 高，近墙全切）。

## 4. 相机（正交轴测，固定视角族）
```ts
camera = new OrthographicCamera(...);  // zoom 制，不用透视（穿模与形变更少，贴合参考图）
// S1 全景：俯角 38°，方位 45°（等距），target = 实验室中心 (x:18.8*0.5, 0, z:6.5*0.5 量级，按包围盒现算)
// S2 106 特写：俯角 42°，target = 106 包围盒中心，zoom = 全景 ×1.9，允许 ±8° 有限环绕
near/far：按包围盒收紧（禁用默认 0.1/2000 浪费深度精度）
resize：同步 camera frustum + composer + CSS 变量（三处一次调用）
```

## 5. 高亮实现（OutlinePass 参数）
```ts
outlinePass = new OutlinePass(resolution, scene, camera);
// Grade A 设备告警
{ edgeStrength: 3.2, edgeGlow: 0.35, edgeThickness: 2.0, pulsePeriod: 1.2,
  visibleEdgeColor: '#E5484D', hiddenEdgeColor: '#8A2B2B' }
// Grade B 瓶颈：edgeStrength 2.8 / '#F76B15'；Grade C：2.6 / '#F59E0B'
// 选中（非告警）：edgeStrength 1.8 / '#2878FF' / glow 0.2
```
- 告警对象同时挂**贴地色块**（半透明矩形 8% 填充 + 描边，世界空间投影）——描边给形体、色块给地面，两级可读性。
- 约束：selected 数组同屏 ≤3；hidden 边只保留暗色不发光；OutlinePass 在 fog 之后仍清晰（这是选它而非描边 shader 的原因）。

## 6. 后处理链（顺序固定，OutputPass 永远最后）
```ts
composer: RenderPass → OutlinePass → UnrealBloomPass(res, 0.22, 0.3, 0.90) → ShaderPass(Vignette 0.25/0.72) → OutputPass
```
- **Bloom 强度 0.22**（cookbook 区间 0.35–0.6 的下沿再降）：高调白场景里只让指示灯/光晕吃 bloom，阈值 0.90 卡死白背景不进辉光——白场景 bloom 过大=糊。
- **SSAO：默认关闭**。白底+柔影风格里 SSAO 易脏（0.25 强度起步只在 profile 证明需要时开，半径 0.35，仅室内角落）；优先用烘焙感 AO 贴图替代。
- 降级次序（性能不足时，按 skill 规则）：先砍 post（bloom→vignette→outline 降 thickness）→ 再砍阴影 caster 数量 → 最后降 DPR。
- `prefers-reduced-motion`：关 pulsePeriod 与 bloom 呼吸，保留静态描边。

## 7. 与现有 whiteblue 包的差距清单
| 项 | 现状 | 目标 | 工作量 |
|---|---|---|---|
| 地面引导线 | 无 | #E8D77A 通道贴花 | S（新增 decal 层） |
| 墙体处理 ✅(V2 桥接层已实现) | 前侧外墙压至 10cm 地脚带（按相机朝向逐段重算）、玻璃 rail 框 #788c97→#c9d4da、玻璃 opacity .16→.08、柱子降对比 0.92、每房间淡分区色块+边界线 | 见 §8 |
| 地面反射 | 无 | 0.15 弱反射 | M（Reflector 或 env） |
| 背景虚化 | 纯色底 | FogExp2 0.012 | S |
| 阴影 | 无/硬 | PCFSoft 五层光栈 | M（需重调 exposure） |
| Grade 描边 | CSS 红框近似 | OutlinePass 世界空间 | M（接相机投影） |
| 相机 | 透视可自由转 | 正交 + 有限环绕 + S1/S2 机位 | S |

## 8. 墙体处理实施记录（V2 桥接层，2026-11-05）

实现位置：`twin/future-lab/twin-scene-bridge.js`（`?v2=1` 门禁，tour-lab/tour-space 原入口零影响）。

- **前侧外墙**：示意墙为单 mesh、每段 18 floats（6 顶点两三角）。按 `camera.getWorldDirection` 求相机外方向，段中点相对实验室中心 `dot>0.30` 判定为相机侧 → 顶部三点 y 压至 0.10m 地脚带；背侧保留全高作背景。视角切换/拖拽后重算（`space-view-change`/`lab-view-change`/`pointerup`）。
- **玻璃隔断**：rail 材质 `#788c97`(metalness .75) → `#c9d4da`(.18/.55)，玻璃面板 opacity .16→.08——边界保留、不抢设备。
- **柱子**：`visual.columns` 克隆材质降对比（#dde3e6、opacity .92、去 clearcoat），保留空间锚定作用。
- **地面分区**：按 `cad_geometry.rooms` 每房间生成极淡交替色块（opacity .34）+ `#c8d3dc` 边界线（opacity .8），AMR 浅金引导线保留。
- 实测：S1 2676 dc / S2 542 dc，0 运行错误；墙体处理不增加 draw call 负担（材质复用+静态层）。

## 9. 材质 pass 与设备状态分级实施记录（V2 桥接层，2026-11-05）

**材质基调：浅色工业产品展示**。关键不是全变白，而是重建明度阶梯：背景 `#F3F5F8`（页面 CSS）> 设备主体 `#f6f8f9` > 地面 `#e4e9ee`（106）/`#e4ecf2`（其余房间）> 侧壁 `#d3dbe2`。灰蒙蒙病根＝106 地面 `#c2c9cd` 过深 + Reflector 系数 `0x959da0` 压暗，已分别提亮至 `#e4e9ee` / `#d7dde3`。设备面板深灰/近黑不动（对比锚点）。

**设备状态分级（克制版，无发光线/光圈/透明面板）**：

| 状态 | 顶部光点（Ø9cm emissive 小球） | 动效 |
|---|---|---|
| working | 蓝 `#2878FF` | 1.5±0.7 慢呼吸（≈3s） |
| ready | 绿 `#16A34A` | 静态 1.2 |
| standby | 灰 `#94A3B8` | 静态 0.35 |
| stopped | 深灰 `#64748B` | 静态 0.35 |
| alarm | 红 `#E5484D` | 2.0±1.4 快脉冲 + 既有描边脉冲 |

光点挂在 `modelRoots` 设备包围盒顶心；`modelRoots` 里没有的对象（如 107 的电桥节点）**不放光点**——诚实降级。动画环 15fps（66ms 节流）：机器人位置向宿主推送的目标 progress 插值（消跳点）+ 光点呼吸，实测 S1 2685 dc / S2 550 dc，0 错误。


## 墙体剖切=固定渲染行为（2026-11-06）

原「剖墙」图层开关已移除（icon 从 4 个减到 3 个：路径/标签/热力）。原因：这个开关没有中间态——剖了才看得清设备，不剖就被 2.7m 高外墙与玻璃隔断挡住，等于关掉就不可用。
因此 `fadeFrontWalls()`（前侧外墙压成 10cm 地脚带、随相机朝向每帧重算）+ 玻璃弱化（`#788c97 → #c9d4da`、面板透明度 0.16→0.08）+ 柱子降对比，全部作为**常开渲染管线**在 `treatArchitecture()` 里执行；`restoreWalls()` 与 `LAYERS.walls` 删除。旧链接里的 `walls`/`zones` 图层参数会被忽略且不报错。
