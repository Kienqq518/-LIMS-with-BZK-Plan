import * as THREE from './vendor/three.module.js';
import {LabMaterialLibrary,classifySurface,RENDER_TIERS} from './pbr-lab-materials.js?rev=lab-realistic-v1c';

// Reversible render-only layer: all CAD, component geometry and model transforms remain untouched.
export class RealisticLab{
 constructor(visual){
  this.v=visual;this.enabled=true;this.records=[];this.floors=[];this.graphics=[];this.profileKey='';
  const r=visual.renderer;
  this.original={shadowType:r.shadowMap.type,shadowAuto:r.shadowMap.autoUpdate,exposure:r.toneMappingExposure,toneMapping:r.toneMapping,colorSpace:r.outputColorSpace,environment:visual.scene.environment};
  this.lights=visual.scene.children.filter(o=>o.isLight).map(o=>({o,visible:o.visible,intensity:o.intensity}));
  const rt=visual.reflector.getRenderTarget();this.reflectionOriginal={width:rt.width,height:rt.height,mipmaps:rt.texture.generateMipmaps,minFilter:rt.texture.minFilter};
  this.before=this.snapshot();
  this.library=new LabMaterialLibrary(r);
  this.contact=this.createContactAtlas();
  this.uniforms={labAO:{value:this.contact},labAOBounds:{value:new THREE.Vector4(-1,-1,30,40)},labReflection:{value:rt.texture},labReflectionMatrix:{value:new THREE.Matrix4()},labReflectionActive:{value:0}};
  const seen=new Set(),roots=[visual.overview,visual.detail,...['101','102','103','104','105','107','108','109','110'].map(id=>visual['room'+id]?.group).filter(Boolean)];
  for(const root of roots)root.traverse(mesh=>{
   if(!mesh.isMesh||mesh===visual.reflector||seen.has(mesh))return;seen.add(mesh);
   const b=new THREE.Box3().setFromObject(mesh),size=b.getSize(new THREE.Vector3());
   let p=mesh,isEquipment=false;while(p){if(p.userData?.id){isEquipment=true;break;}p=p.parent;}
   // A low CAD device/ground marker is still a device, never a room-floor surface.
   const floor=!isEquipment&&size.y<.035&&size.x>.8&&size.z>.8&&b.max.y<.055;
   const original=mesh.material,roles=(Array.isArray(original)?original:[original]).map(m=>classifySurface(m,{floor,architecture:!isEquipment}));
   const upgraded=(Array.isArray(original)?original:[original]).map((m,i)=>this.library.get(m,roles[i]));
   if(floor){this.floors.push(mesh);for(const m of upgraded)this.configureFloor(m);}
   if(roles.includes('graphic'))this.graphics.push({mesh,material:original,maps:(Array.isArray(original)?original:[original]).map(m=>m.map)});
   this.records.push({mesh,original,upgraded:Array.isArray(original)?upgraded:upgraded[0],roles,cast:mesh.castShadow,receive:mesh.receiveShadow});
  });
  this.buildLights();
  const fit=visual.fitCamera.bind(visual);visual.fitCamera=(w,h)=>{fit(w,h);this.fitInspection(w,h);this.updateView();};
  const nativeRender=r.render.bind(r);this.nativeRender=nativeRender;
  r.render=(scene,camera)=>{
   if(scene===visual.scene&&this.enabled&&!this.inReflection&&this.tier?.reflectionSize){
    this.inReflection=true;const visibility=this.floors.map(m=>m.visible);
    try{
     for(const m of this.floors)m.visible=false;
     visual.reflector.updateMatrixWorld(true);
     visual.reflector.onBeforeRender(r,scene,camera);
     this.uniforms.labReflectionMatrix.value.copy(visual.reflector.material.uniforms.textureMatrix.value).multiply(new THREE.Matrix4().copy(visual.reflector.matrixWorld).invert());
    }finally{this.floors.forEach((m,i)=>m.visible=visibility[i]);visual.reflector.visible=false;this.inReflection=false;}
   }
   return nativeRender(scene,camera);
  };
  this.installControl();this.apply(true);visual.exportPng=()=>this.exportPng();
 }

 configureFloor(m){
  if(m.userData.labFloorShader)return;m.userData.labFloorShader=true;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,this.uniforms);
   s.vertexShader='varying vec3 labWorld;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlabWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   s.fragmentShader='uniform sampler2D labAO; uniform vec4 labAOBounds; uniform sampler2D labReflection; uniform mat4 labReflectionMatrix; uniform float labReflectionActive; varying vec3 labWorld;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 aoUV=(labWorld.xz-labAOBounds.xy)/labAOBounds.zw;
    aoUV.y=1.-aoUV.y;
    if(aoUV.x>=0.&&aoUV.x<=1.&&aoUV.y>=0.&&aoUV.y<=1.)diffuseColor.rgb*=texture2D(labAO,aoUV).rgb;
   `);
   s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`if(labReflectionActive>.5){
    vec4 rp=labReflectionMatrix*vec4(labWorld,1.);vec2 uv=rp.xy/rp.w;
    if(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.){
     vec2 b=vec2(.003);vec3 rf=texture2D(labReflection,uv,3.).rgb*.4;
     rf+=(texture2D(labReflection,uv+vec2(b.x,0.),3.).rgb+texture2D(labReflection,uv-vec2(b.x,0.),3.).rgb+texture2D(labReflection,uv+vec2(0.,b.y),3.).rgb+texture2D(labReflection,uv-vec2(0.,b.y),3.).rgb)*.15;
     float f=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),3.);
     outgoingLight=mix(outgoingLight,rf,.12+.12*f);
    }
   }\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=> 'lab-floor-ao-reflection-v1';
 }

 createContactAtlas(){
  // One bake from existing 3D equipment, not a stock shadow image or a new visible mesh.
  const v=this.v,r=v.renderer,w=1024,h=1536,scene=new THREE.Scene();
  for(const model of v.modelRoots.values())scene.add(model.clone(true));
  const mat=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,
   vertexShader:'varying float heightLab;void main(){vec4 p=modelMatrix*vec4(position,1.);heightLab=p.y;gl_Position=projectionMatrix*viewMatrix*p;}',
   fragmentShader:'varying float heightLab;void main(){float a=exp(-max(heightLab,0.)*5.);gl_FragColor=vec4(0.,0.,0.,a*.55);}'});
  scene.overrideMaterial=mat;
  const camera=new THREE.OrthographicCamera(-15,15,20,-20,.1,20);camera.position.set(14,12,19);camera.up.set(0,0,-1);camera.lookAt(14,0,19);
  const target=new THREE.WebGLRenderTarget(w,h),oldTarget=r.getRenderTarget(),clear=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha(),shadow=r.shadowMap.enabled;
  r.shadowMap.enabled=false;r.setRenderTarget(target);r.setClearColor(0,0);r.clear();r.render(scene,camera);
  const pixels=new Uint8Array(w*h*4);r.readRenderTargetPixels(target,0,0,w,h,pixels);r.setRenderTarget(oldTarget);r.setClearColor(clear,alpha);r.shadowMap.enabled=shadow;
  const silhouette=document.createElement('canvas');silhouette.width=w;silhouette.height=h;
  const x=silhouette.getContext('2d'),im=x.createImageData(w,h);for(let y=0;y<h;y++)im.data.set(pixels.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);x.putImageData(im,0,0);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
  ctx.globalAlpha=.24;ctx.filter='blur(4px)';ctx.drawImage(silhouette,0,0);ctx.globalAlpha=.32;ctx.filter='blur(1px)';ctx.drawImage(silhouette,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,r.capabilities.getMaxAnisotropy());target.dispose();mat.dispose();return texture;
 }

 buildLights(){
  this.lightGroup=new THREE.Group();this.lightGroup.name='lab-render-only-lighting';
  this.key=new THREE.DirectionalLight('#fffdf8',2.05);this.key.castShadow=true;this.key.shadow.mapSize.set(2048,2048);this.key.shadow.bias=-.00015;this.key.shadow.normalBias=.012;this.key.shadow.radius=4;
  this.fill=new THREE.DirectionalLight('#edf4ff',.35);this.fill.position.set(30,12,3);
  this.hemi=new THREE.HemisphereLight('#ffffff','#9aa9b3',.62);
  this.lightGroup.add(this.key,this.key.target,this.fill,this.hemi);this.v.scene.add(this.lightGroup);
 }

 roomId(){return ['101','102','103','104','105','107','108','109','110'].find(id=>this.v.view.startsWith(id+'-'))||(['close','detail','seating','local-top'].includes(this.v.view)?'106':null);}
 updateView(){
  const v=this.v,r=v.renderer,rid=this.roomId(),tierName=rid?(this.inspection||v.view==='detail'?'inspection':'room'):'panorama';
  this.tierName=tierName;this.tier=RENDER_TIERS[tierName];this.lightGroup.visible=this.enabled;
  for(const s of this.lights){s.o.visible=this.enabled?false:s.visible;s.o.intensity=s.intensity;}
  if(!this.enabled){r.shadowMap.type=this.original.shadowType;r.shadowMap.autoUpdate=this.original.shadowAuto;this.uniforms.labReflectionActive.value=0;return;}
  v.reflector.visible=false;r.shadowMap.type=THREE.PCFShadowMap;r.shadowMap.autoUpdate=false;
  this.uniforms.labReflectionActive.value=this.tier.reflectionSize?1:0;
  const key=rid+'-'+tierName;
  if(this.profileKey===key)return;this.profileKey=key;
  const points=rid?v.g.rooms.find(room=>room.id===rid).points.map(q=>[q[0]*.05,q[1]*.05]):[[0,0],[28,38]];
  const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),cx=(x0+x1)/2,cz=(z0+z1)/2;
  this.key.position.set(cx-16,32,cz+22);this.key.target.position.set(cx,0,cz);this.key.updateMatrixWorld(true);this.key.target.updateMatrixWorld(true);
  const c=this.key.shadow.camera;c.position.copy(this.key.position);c.lookAt(this.key.target.position);c.updateMatrixWorld(true);
  const corners=[];for(const x of[x0-1,x1+1])for(const z of[z0-1,z1+1])for(const y of[0,3.2])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(c.matrixWorldInverse));
  Object.assign(c,{left:Math.min(...corners.map(p=>p.x))-1,right:Math.max(...corners.map(p=>p.x))+1,bottom:Math.min(...corners.map(p=>p.y))-1,top:Math.max(...corners.map(p=>p.y))+1,near:1,far:90});c.updateProjectionMatrix();
  r.shadowMap.needsUpdate=true;
  if(this.tier.reflectionSize){const rt=v.reflector.getRenderTarget();rt.texture.generateMipmaps=true;rt.texture.minFilter=THREE.LinearMipmapLinearFilter;if(rt.width!==this.tier.reflectionSize)rt.setSize(this.tier.reflectionSize,this.tier.reflectionSize);}
 }

 apply(active){
  this.enabled=!!active;this.profileKey='';
  for(const t of this.records){t.mesh.material=this.enabled?t.upgraded:t.original;t.mesh.castShadow=this.enabled&&t.roles.includes('glass')?false:t.cast;t.mesh.receiveShadow=this.enabled&&t.roles.includes('floor')?true:t.receive;}
  if(!this.enabled){const rt=this.v.reflector.getRenderTarget();rt.setSize(this.reflectionOriginal.width,this.reflectionOriginal.height);rt.texture.generateMipmaps=this.reflectionOriginal.mipmaps;rt.texture.minFilter=this.reflectionOriginal.minFilter;}
  this.v.renderer.shadowMap.needsUpdate=true;this.v.render();if(this.button)this.button.value=this.enabled?'realistic':'current';this.audit();
 }

 installControl(){
  const label=document.createElement('label');label.className='select-control presentation-control';label.id='material-106-control';
  label.innerHTML='<span>全区材质</span><select id="material-lab" aria-label="全区材质对照"><option value="current">当前材质</option><option value="realistic" selected>写实材质</option></select><button id="benchmark-lab" type="button">1080p 测试</button>';
  document.querySelector('.display-nav').insertBefore(label,document.querySelector('#reset'));this.button=label.querySelector('select');this.button.onchange=()=>this.apply(this.button.value==='realistic');document.getElementById('benchmark-lab').onclick=()=>this.benchmark();
  const setView=this.v.setView.bind(this.v);
  this.v.setView=view=>{this.inspection=view.startsWith('render-')?view:null;setView(view==='render-device'?'detail':view==='render-glass'?'seating':view);if(view==='render-device'){this.v.yaw=-.78;this.v.elev=.43;this.v.render();}document.getElementById('benchmark-lab').textContent='1080p 测试';this.audit();};
 }
 fitInspection(w,h){
  if(this.inspection!=='render-device')return;const v=this.v,b=new THREE.Box3().setFromObject(v.modelRoots.get('106-05')),target=b.getCenter(new THREE.Vector3());target.y=b.max.y*.5;v.camera=v.perspectiveCamera;const d=3.75/v.zoom;
  v.camera.position.copy(target).add(new THREE.Vector3(-Math.sin(v.yaw)*Math.cos(v.elev)*d,Math.sin(v.elev)*d,Math.cos(v.yaw)*Math.cos(v.elev)*d));v.camera.up.set(0,1,0);v.camera.lookAt(target);v.camera.aspect=w/h;v.camera.updateProjectionMatrix();v.camera.updateMatrixWorld();
 }
 snapshot(){const a=[];this.v.scene.updateMatrixWorld(true);this.v.scene.traverse(o=>{if(!o.isLight&&!o.isCamera)a.push({uuid:o.uuid,matrix:o.matrixWorld.toArray(),geometry:o.geometry?.uuid||null});});return a;}
 cameraState(){const v=this.v;return{view:v.view,inspection:this.inspection||null,yaw:v.yaw,elevation:v.elev,zoom:v.zoom,position:v.camera.position.toArray(),worldMatrix:v.camera.matrixWorld.toArray(),projectionMatrix:v.camera.projectionMatrix.toArray()};}
 audit(){
  const current=new Map(this.snapshot().map(o=>[o.uuid,o])),counts={};for(const t of this.records)for(const role of t.roles)counts[role]=(counts[role]||0)+1;
  const report={revision:'lab-realistic-v1',mode:this.enabled?'realistic':'current',geometryAndTransformsUnchanged:this.before.every(o=>JSON.stringify(current.get(o.uuid))===JSON.stringify(o)),originalObjects:this.before.length,meshes:this.records.length,floorMeshes:this.floors.length,surfaceAssignments:counts,clonedMaterialCounts:this.library.counts,
   protectedGraphics:this.graphics.length,graphicMaterialsAndTexturesUnchanged:this.graphics.every(g=>g.mesh.material===g.material&&(Array.isArray(g.material)?g.material:[g.material]).every((m,i)=>m.map===g.maps[i])),
   currentMaterialsRestored:!this.enabled?this.records.every(t=>t.mesh.material===t.original&&t.mesh.castShadow===t.cast&&t.mesh.receiveShadow===t.receive):null,
   currentLightingAndRendererRestored:!this.enabled?this.lights.every(s=>s.o.visible===s.visible&&s.o.intensity===s.intensity)&&!this.lightGroup.visible&&this.v.renderer.shadowMap.type===this.original.shadowType&&this.v.renderer.shadowMap.autoUpdate===this.original.shadowAuto:null,
   globalToneMappingUnchanged:this.v.renderer.toneMapping===this.original.toneMapping&&this.v.renderer.toneMappingExposure===this.original.exposure&&this.v.renderer.outputColorSpace===this.original.colorSpace,originalSceneEnvironmentPreserved:this.v.scene.environment===this.original.environment,
   tier:this.tierName,settings:this.tier,contactAtlasResolution:[1024,1536],model10303Preserved:!!this.v.modelRoots.get('103-03')?.getObjectByName('103-03-six-station-mainframe'),modelCount:this.v.modelRoots.size};
  let el=document.getElementById('lab-render-audit');if(!el){el=document.createElement('script');el.id='lab-render-audit';el.type='application/json';document.body.append(el);}el.textContent=JSON.stringify(report);
 }

 async exportPng(){
  const v=this.v,r=v.renderer,size=r.getSize(new THREE.Vector2()),ratio=r.getPixelRatio(),auto=r.info.autoReset;
  r.setPixelRatio(1);r.setSize(1920,1080,false);v.fitCamera(1920,1080);r.info.autoReset=false;r.info.reset();const start=performance.now();r.render(v.scene,v.camera);r.getContext().finish();const renderMilliseconds=performance.now()-start;
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const ctx=canvas.getContext('2d');ctx.drawImage(r.domElement,0,0);
  if(v.labelsVisible){const labels=[...v.labels,...['101','102','103','104','105','106','107','108','109','110'].flatMap(id=>v['room'+id]?.labels||[])];for(const l of labels){if(l.div.hidden)continue;const q=l.p.clone().project(v.camera),x=(q.x+1)*960,y=(-q.y+1)*540;if(x<0||x>1920||y<0||y>1080)continue;const text=l.div.textContent;ctx.font='17px "PingFang SC",sans-serif';const w=ctx.measureText(text).width+18;ctx.fillStyle='rgba(255,255,255,.87)';ctx.fillRect(x-w/2,y-15,w,30);ctx.fillStyle='#315267';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);}}
  const data=canvas.toDataURL('image/png'),name='lab-'+(this.enabled?'realistic':'current')+'-'+v.view+'-v1.png';
  let el=document.getElementById('lab-render-export');if(!el){el=document.createElement('script');el.id='lab-render-export';el.type='application/json';document.body.append(el);}el.textContent=JSON.stringify({name,data,width:1920,height:1080,renderMilliseconds,drawCalls:r.info.render.calls,triangles:r.info.render.triangles,camera:this.cameraState(),tier:this.tierName});
  const link=document.createElement('a');link.download=name;link.href=data;link.click();r.info.autoReset=auto;r.setPixelRatio(ratio);r.setSize(size.x,size.y,false);v.render();this.audit();
 }

 async benchmark(){
  if(this.benchmarkRunning)return;this.benchmarkRunning=true;document.getElementById('lab-performance')?.remove();
  const button=document.getElementById('benchmark-lab');button.disabled=true;button.textContent='测试中…';
  const v=this.v,r=v.renderer,gl=r.getContext(),size=r.getSize(new THREE.Vector2()),ratio=r.getPixelRatio(),auto=r.info.autoReset,view=v.view,yaw=v.yaw,enabled=this.enabled,results=[];
  const controls=[...document.querySelectorAll('.display-nav select,.display-nav button')].map(e=>[e,e.disabled]);for(const[e]of controls)e.disabled=true;const pointer=v.renderer.domElement.style.pointerEvents;v.renderer.domElement.style.pointerEvents='none';
  try{
   r.setPixelRatio(1);r.setSize(1920,1080,false);r.info.autoReset=false;v.fitCamera(1920,1080);
   // Also report an explicitly refreshed shadow frame, separate from steady-state cached shadows.
   r.shadowMap.needsUpdate=true;r.info.reset();const refreshStart=performance.now();r.render(v.scene,v.camera);gl.finish();
   const shadowRefreshFrame={milliseconds:performance.now()-refreshStart,drawCalls:r.info.render.calls,triangles:r.info.render.triangles};
   for(const workload of['static','orbit']){
    const samples=[],intervals=[];let previous=0,calls=0,triangles=0;
    for(let i=0;i<120;i++){
     const timestamp=await new Promise(resolve=>requestAnimationFrame(resolve));if(v.view!==view||this.enabled!==enabled)throw new Error('测试期间视角或材质改变，请重试');
     v.yaw=workload==='orbit'?yaw+Math.sin(i*.06)*.10:yaw;v.fitCamera(1920,1080);r.info.reset();const start=performance.now();r.render(v.scene,v.camera);gl.finish();const duration=performance.now()-start;
     if(i>=20){samples.push(duration);if(previous)intervals.push(timestamp-previous);previous=timestamp;calls=r.info.render.calls;triangles=r.info.render.triangles;}
    }
    const sorted=[...samples].sort((a,b)=>a-b),ext=gl.getExtension('WEBGL_debug_renderer_info');
    results.push({mode:enabled?'realistic':'current',view,workload,width:1920,height:1080,pixelRatio:1,warmupFrames:20,measuredFrames:samples.length,medianRenderMs:sorted[50],p95RenderMs:sorted[95],observedRafFPS:1000*intervals.length/intervals.reduce((a,b)=>a+b,0),drawCalls:calls,triangles,tier:this.tierName,settings:enabled?this.tier:{shadowSize:4096,shadowRefresh:'baseline automatic',reflection:'baseline view-dependent'},userAgent:navigator.userAgent,platform:navigator.platform,hardwareConcurrency:navigator.hardwareConcurrency,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),webgl:gl.getParameter(gl.VERSION),samplesMs:samples,frameIntervalsMs:intervals});
   }
   const el=document.createElement('script');el.id='lab-performance';el.type='application/json';el.textContent=JSON.stringify({date:new Date().toISOString(),method:'1920x1080 DPR1; forced shadow-refresh frame, then 20 warmup + 100 measured frames per workload; CPU submission + gl.finish GPU wait; orbit yaw +/-0.1 rad; cached shadows in realistic tier',shadowRefreshFrame,results});document.body.append(el);button.textContent=Math.round(Math.min(...results.map(x=>x.observedRafFPS)))+' FPS';
  }catch(error){button.textContent='测试重试';console.error(error);}
  finally{v.yaw=yaw;r.info.autoReset=auto;r.setPixelRatio(ratio);r.setSize(size.x,size.y,false);for(const[e,disabled]of controls)e.disabled=disabled;v.renderer.domElement.style.pointerEvents=pointer;button.disabled=false;this.benchmarkRunning=false;v.render();this.audit();}
 }
}
