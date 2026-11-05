import * as THREE from '../vendor/three.module.js';
// One authorized brand decal, attached to the EXISTING 101-06 wall surface.
// Original equipment geometry, transforms, graphic textures and materials stay untouched.
export async function installBrand101(v){
 const wall=v.modelRoots.get('101-06');if(!wall)throw new Error('101 展示墙未找到');
 const texture=await new THREE.TextureLoader().loadAsync('assets/yingmin.png');texture.colorSpace=THREE.SRGBColorSpace;
 const aspect=texture.image.width/texture.image.height;
 const logo=new THREE.Mesh(new THREE.PlaneGeometry(.91,.91/aspect),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
 logo.name='yingmin-official-wall-decal';logo.rotation.y=Math.PI;logo.position.set(0,2.225,-.086);logo.renderOrder=5;
 // Decal sits on the broad wall face ABOVE the screen (top 2.05 m, wall top 2.35 m).
 wall.add(logo);
 // Authorized V1.1 addition: a flat brand graphic within the EMPTY area beside 101.
 // No CAD footprint, wall, equipment or circulation geometry is changed.
 const empty=v.g.rooms.find(r=>r.id==='EMPTY'),xs=empty.points.map(p=>p[0]*.05),zs=empty.points.map(p=>p[1]*.05);
 const width=12,height=width/aspect;
 const groundLogo=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
 groundLogo.name='yingmin-official-empty-area-decal';groundLogo.rotation.x=-Math.PI/2;
 groundLogo.position.set((Math.min(...xs)+Math.max(...xs))/2,.035,(Math.min(...zs)+Math.max(...zs))/2);groundLogo.renderOrder=5;v.overview.add(groundLogo);
 return{logo,groundLogo,source:'assets/yingmin.png',parent:'101-06',localPosition:logo.position.toArray(),worldPosition:logo.getWorldPosition(new THREE.Vector3()).toArray()};
}
