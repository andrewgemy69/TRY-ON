import canonical from './canonical-face.json';
import triangles from './face-triangles.json';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rigidProjection } from './rigid-fit.js';

export function createGlassesRenderer(canvas, videoRef, matrixRef, landmarksRef, ready, failure, sizingRef) {
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const scene=new THREE.Scene(),camera=new THREE.Camera();
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1;
 scene.add(new THREE.HemisphereLight(0xffffff,0x777788,1.1));
 const key=new THREE.DirectionalLight(0xfff5e8,1.4);key.position.set(-3,5,8);scene.add(key);
 const faceGeometry=new THREE.BufferGeometry();
 const facePositions=new Float32Array(canonical.length*3);
 faceGeometry.setAttribute('position',new THREE.BufferAttribute(facePositions,3).setUsage(THREE.DynamicDrawUsage));
 faceGeometry.setIndex(triangles);
 const occluder=new THREE.Mesh(faceGeometry,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide}));
 occluder.renderOrder=-10;occluder.frustumCulled=false;scene.add(occluder);

 const root=new THREE.Group();root.matrixAutoUpdate=false;scene.add(root);
 let width=1,loaded=false,disposed=false,frame;
 const fitState={};
 new GLTFLoader().load(`${import.meta.env.BASE_URL}models/Glasses.glb`,gltf=>{
  if(disposed)return;
  const model=gltf.scene;model.updateMatrixWorld(true);
  const lenses=[];model.traverse(o=>{if(o.isMesh&&/(?:left|right)_glass$/i.test(o.name))lenses.push(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()));});
  if(lenses.length!==2){failure('Glasses calibration requires two lens meshes.');return;}
  const center=lenses[0].clone().add(lenses[1]).multiplyScalar(.5);width=lenses[0].distanceTo(lenses[1]);
  const frameMesh=model.getObjectByName('Tortoise_Glasses');
  if(!frameMesh)throw new Error('Missing frame mesh for bridge calibration');
  const frameBounds=new THREE.Box3().setFromObject(frameMesh);width=frameBounds.max.x-frameBounds.min.x;
  const vertices=frameMesh.geometry.attributes.position,bridgeBounds=new THREE.Box3(),v=new THREE.Vector3();
  for(let i=0;i<vertices.count;i++){v.fromBufferAttribute(vertices,i).applyMatrix4(frameMesh.matrixWorld);if(Math.abs(v.x-center.x)<width*.035)bridgeBounds.expandByPoint(v);}
  const bridge=bridgeBounds.isEmpty()?center:bridgeBounds.getCenter(new THREE.Vector3());
  model.position.sub(bridge);
  model.traverse(o=>{if(!o.isMesh)return;for(const material of Array.isArray(o.material)?o.material:[o.material]){material.envMapIntensity=.65;if(/(?:left|right)_glass$/i.test(o.name)){material.transparent=true;material.opacity=.72;material.depthWrite=false;material.roughness=.12;material.metalness=0;o.renderOrder=2;}else if('roughness' in material){material.roughness=Math.max(.22,material.roughness);}}});
  root.add(model);loaded=true;ready(true);
 },undefined,e=>failure('GLB loading failed: '+e.message));
 function draw(){if(disposed)return;frame=requestAnimationFrame(draw);try{
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
  const v=videoRef.current;const fit=loaded&&rigidProjection(matrixRef.current,landmarksRef.current,width,v.videoWidth,v.videoHeight,w,h,v.classList.contains('mirrored'),fitState,v.currentTime,sizingRef?.current);
  root.visible=!!fit;occluder.visible=!!fit;
  if(fit){root.matrix.fromArray(fit.model);camera.projectionMatrix.fromArray(fit.projection);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
   const tracked=landmarksRef.current,m=matrixRef.current,projection=fit.projection;
   const cover=Math.max(w/v.videoWidth,h/v.videoHeight),sign=v.classList.contains('mirrored')?-1:1;
   for(let i=0;i<canonical.length;i++){
    const p=canonical[i];const z=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]-.12;
    const depth=-z,ndcX=sign*(tracked[i].x-.5)*2*v.videoWidth*cover/w,ndcY=(.5-tracked[i].y)*2*v.videoHeight*cover/h;
    facePositions[i*3]=(ndcX+projection[8])*depth/projection[0];facePositions[i*3+1]=(ndcY+projection[9])*depth/projection[5];facePositions[i*3+2]=z;
   }
   faceGeometry.attributes.position.needsUpdate=true;
}
  renderer.render(scene,camera);
 }catch(e){failure('Three.js renderer: '+e.message);cancelAnimationFrame(frame);}}
 draw();return()=>{disposed=true;cancelAnimationFrame(frame);scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});environment.dispose();renderer.dispose();};
}
