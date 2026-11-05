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
| 地面反射 | 无 | 0.15 弱反射 | M（Reflector 或 env） |
| 背景虚化 | 纯色底 | FogExp2 0.012 | S |
| 阴影 | 无/硬 | PCFSoft 五层光栈 | M（需重调 exposure） |
| Grade 描边 | CSS 红框近似 | OutlinePass 世界空间 | M（接相机投影） |
| 相机 | 透视可自由转 | 正交 + 有限环绕 + S1/S2 机位 | S |
