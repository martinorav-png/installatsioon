import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoftWhale, type Binding } from './physics';
import { clamp, createLattice, createSurface, section, smooth } from './shape';
import { backFragment, depthMaterial, floorFragment, floorVertex, heightFragment, jellyFragment, shadowFragment, surfaceVertex } from './shaders';

type BoundProp={object:THREE.Object3D;binding:Binding};
const palette=['#3a8ef0','#5fcaf2','#6a6cf0'];
export type WhaleState={inflation:number;paused:boolean;dark:boolean;volume:number;nodes:number;tets:number;renderer:string;grabbed:boolean;time:number;color:string;firmness:number;damping:number};
export function createWhale(host:HTMLElement){
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
  if(!context)throw new Error('This material study requires WebGL2.');
  const renderer=new THREE.WebGLRenderer({canvas,context,antialias:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NeutralToneMapping;
  renderer.autoClear=false;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Blue Whale Jelly. Drag the whale to stretch it. Drag the background to orbit. Scroll to zoom, or to twist while holding. G: swell, R: reset, L: lights out, Space: pause, 1–3: colour, M: mesh, S: slow motion. Double-click to return to the studio view.');
  host.appendChild(canvas);

  const backgroundScene=new THREE.Scene(),frontScene=new THREE.Scene(),shadowScene=new THREE.Scene(),heightScene=new THREE.Scene(),backScene=new THREE.Scene(),copyScene=new THREE.Scene();
  backgroundScene.background=new THREE.Color(1,1,1);
  const camera=new THREE.PerspectiveCamera(34,1,.1,60);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;
  controls.minDistance=4.3;controls.maxDistance=19;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.20;
  const defaultView=()=>{
    const aspect=host.clientWidth/Math.max(1,host.clientHeight);
    const distance=Math.max(8.7,6.1/(2*Math.tan(THREE.MathUtils.degToRad(17))*aspect*.85));
    controls.maxDistance=distance*2;
    controls.target.set(.10,.57,0);
    camera.position.copy(controls.target).add(new THREE.Vector3(-.43,.38,.92).normalize().multiplyScalar(distance));
    controls.update();
  };
  const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4,depthBuffer:true});
  const backTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const shadowTarget=new THREE.WebGLRenderTarget(1024,1024,{type:THREE.HalfFloatType});
  const heightTarget=new THREE.WebGLRenderTarget(768,512,{type:THREE.HalfFloatType});
  const shadowCamera=new THREE.OrthographicCamera(-4.4,4.4,3.5,-3.5,.1,15);
  shadowCamera.position.set(-3.3,6.4,4.0);shadowCamera.lookAt(0,.4,0);shadowCamera.updateMatrixWorld();
  const heightCamera=new THREE.OrthographicCamera(-3.6,3.6,2.1,-2.1,.1,8);
  heightCamera.position.set(0,6,0);heightCamera.up.set(0,0,-1);heightCamera.lookAt(0,0,0);heightCamera.updateMatrixWorld();
  const shadowMatrix=new THREE.Matrix4().multiplyMatrices(shadowCamera.projectionMatrix,shadowCamera.matrixWorldInverse);
  const heightMatrix=new THREE.Matrix4().multiplyMatrices(heightCamera.projectionMatrix,heightCamera.matrixWorldInverse);

  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.03);room.dispose();pmrem.dispose();
  frontScene.environment=environment.texture;
  const frontKey=new THREE.DirectionalLight(0xffffff,3.3),frontFill=new THREE.HemisphereLight(0xffffff,0xb0c8dc,2.4);
  frontKey.position.set(-3,6,4);frontScene.add(frontKey,frontFill);

  const soft=new SoftWhale(createLattice(.12));
  const surface=createSurface(.055);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(surface.positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.computeVertexNormals();
  const surfaceBinding=soft.bind(surface.positions);
  const shared={darkness:{value:0}};
  const material=new THREE.ShaderMaterial({vertexShader:surfaceVertex,fragmentShader:jellyFragment,uniforms:{...shared,sceneTexture:{value:sceneTarget.texture},backTexture:{value:backTarget.texture},resolution:{value:new THREE.Vector2()},jellyColor:{value:new THREE.Color(palette[0])}}});
  const body=new THREE.Mesh(geometry,material);body.frustumCulled=false;frontScene.add(body);
  const shadowMaterial=depthMaterial(shadowFragment),heightMaterial=depthMaterial(heightFragment,THREE.BackSide),backMaterial=depthMaterial(backFragment,THREE.BackSide);
  [new THREE.Mesh(geometry,shadowMaterial)].forEach(m=>{m.frustumCulled=false;shadowScene.add(m);});
  const heightMesh=new THREE.Mesh(geometry,heightMaterial);heightMesh.frustumCulled=false;heightScene.add(heightMesh);
  const backMesh=new THREE.Mesh(geometry,backMaterial);backMesh.frustumCulled=false;backScene.add(backMesh);
  const floorMaterial=new THREE.ShaderMaterial({vertexShader:floorVertex,fragmentShader:floorFragment,uniforms:{...shared,shadowTexture:{value:shadowTarget.texture},heightTexture:{value:heightTarget.texture},shadowMatrix:{value:shadowMatrix},heightMatrix:{value:heightMatrix}}});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),floorMaterial);floor.rotation.x=-Math.PI/2;backgroundScene.add(floor);
  const copyCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const copyMaterial=new THREE.MeshBasicMaterial({map:sceneTarget.texture,toneMapped:false,depthTest:false,depthWrite:false});
  const copyMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),copyMaterial);copyScene.add(copyMesh);

  const boundProps:BoundProp[]=[];
  const eyeMaterial=new THREE.MeshPhysicalMaterial({color:'#061d2a',roughness:.15,clearcoat:1,envMapIntensity:2});
  const eyeGeometry=new THREE.SphereGeometry(.034,20,14);
  for(const side of [-1,1]){
    const x=-1.18,y=.87,[w,h,cy]=section(x),z=side*w*Math.sqrt(Math.max(0,1-((y-cy)/h)**2));
    const eye=new THREE.Mesh(eyeGeometry,eyeMaterial);frontScene.add(eye);boundProps.push({object:eye,binding:soft.embed(x,y,z+.013*side)});
  }
  let time=0,accumulator=0,lastTime=performance.now(),frame=0,disposed=false;
  let gulpStart=-100,paused=false,slow=false,dark=false,darkness=0,wire=false;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inflation=0;
  const gulp=()=>{
    if(time-gulpStart<2)return;
    gulpStart=time;soft.impulse(-.6,.62,0);
  };
  const reset=()=>{soft.reset();soft.firmness=1;soft.damping=1.5;material.uniforms.jellyColor.value.set(palette[0]);grabbing=false;controls.enabled=true;touchPoints.clear();if(pointerId>=0&&canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);pointerId=-1;canvas.style.cursor='grab';time=0;gulpStart=-100;inflation=0;paused=false;dark=false;darkness=0;shared.darkness.value=0;slow=false;wire=false;material.wireframe=false;defaultView();updateSkins();};
  const keydown=(event:KeyboardEvent)=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    const k=event.key.toLowerCase();
    if([' ','g','r','l','m','s','1','2','3','arrowup','arrowdown','[',']'].includes(k))event.preventDefault();
    if(k==='g')gulp();if(k==='r')reset();if(k==='l')dark=!dark;if(k===' ')paused=!paused;
    if(k==='m'){wire=!wire;material.wireframe=wire;}
    if(k==='s')slow=!slow;
    if(['1','2','3'].includes(k))material.uniforms.jellyColor.value.set(palette[Number(k)-1]);
    if(k==='arrowup')soft.firmness=Math.min(4,soft.firmness+.15);if(k==='arrowdown')soft.firmness=Math.max(.2,soft.firmness-.15);
    if(k==='[')soft.damping=Math.max(.2,soft.damping-.2);if(k===']')soft.damping=Math.min(8,soft.damping+.2);
  };
  window.addEventListener('keydown',keydown);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(),hitPoint=new THREE.Vector3(),direction=new THREE.Vector3();
  let grabbing=false,pointerId=-1;
  const touchPoints=new Map<number,THREE.Vector2>();let touchAngle=0;const pressPoint=new THREE.Vector3();
  const setRay=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);raycaster.setFromCamera(pointer,camera);};
  const down=(e:PointerEvent)=>{
    touchPoints.set(e.pointerId,new THREE.Vector2(e.clientX,e.clientY));
    if(touchPoints.size===2&&grabbing){const [a,b]=[...touchPoints.values()];touchAngle=Math.atan2(b.y-a.y,b.x-a.x);return;}
    if(e.button!==0)return;
    setRay(e);
    const hit=raycaster.intersectObject(body,false)[0];
    if(!hit)return;
    e.stopImmediatePropagation();controls.enabled=false;grabbing=true;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
    const point=hit.point;
    pressPoint.copy(point);
    camera.getWorldDirection(direction);plane.setFromNormalAndCoplanarPoint(direction,point);
    soft.startGrab(point.x,point.y,point.z);
  };
  const move=(e:PointerEvent)=>{
    if(touchPoints.has(e.pointerId))touchPoints.set(e.pointerId,new THREE.Vector2(e.clientX,e.clientY));
    if(!grabbing){setRay(e);canvas.style.cursor=raycaster.intersectObject(body,false).length?'grab':'default';return;}
    if(touchPoints.size>1&&soft.grab){const [a,b]=[...touchPoints.values()],angle=Math.atan2(b.y-a.y,b.x-a.x);soft.grab.twist+=angle-touchAngle;touchAngle=angle;}
    if(e.pointerId!==pointerId)return;
    setRay(e);if(!raycaster.ray.intersectPlane(plane,hitPoint))return;
    hitPoint.y=Math.max(.06,hitPoint.y);
    if(soft.grab){hitPoint.copy(pressPoint).add(hitPoint.clone().sub(pressPoint).clampLength(0,1.35));const delta=hitPoint.clone().sub(new THREE.Vector3(...soft.grab.target)).clampLength(0,.3);soft.grab.target[0]+=delta.x;soft.grab.target[1]+=delta.y;soft.grab.target[2]+=delta.z;}
  };
  const up=(e:PointerEvent)=>{
    touchPoints.delete(e.pointerId);if(e.pointerId!==pointerId)return;
    grabbing=false;soft.grab=null;controls.enabled=true;canvas.style.cursor='grab';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  };
  const wheel=(e:WheelEvent)=>{if(!soft.grab)return;e.preventDefault();e.stopImmediatePropagation();soft.grab.twist+=clamp(e.deltaY,-100,100)*.008;};
  const doubleClick=()=>defaultView();
  // Capture the whale grab before OrbitControls receives the same pointer event.
  canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',up,true);canvas.addEventListener('wheel',wheel,{capture:true,passive:false});canvas.addEventListener('dblclick',doubleClick);
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();const size=renderer.getDrawingBufferSize(new THREE.Vector2());sceneTarget.setSize(size.x,size.y);backTarget.setSize(size.x,size.y);material.uniforms.resolution.value.copy(size);defaultView();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let renderCounter=0;
  const updateSkins=()=>{
    soft.skin(surfaceBinding,surface.positions);geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
    for(const prop of boundProps)prop.object.position.set(...soft.evaluate(prop.binding));
    geometry.computeBoundingSphere();
  };
  updateSkins();
  const animate=(now:number)=>{
    if(disposed)return;
    frame=requestAnimationFrame(animate);
    const wallDt=Math.max(0,Math.min((now-lastTime)/1000,.5));const realDt=Math.min(wallDt,.06);lastTime=now;
    const dt=paused?0:realDt*(slow?.25:1);time+=dt;accumulator=Math.min(accumulator+dt,1/20);
    const age=time-gulpStart;
    inflation=age<0?0:age<.65?smooth(0,.65,age):age<2.6?1:1-smooth(2.6,10.5,age);
    while(accumulator>=1/60){soft.step(1/60,inflation);accumulator-=1/60;}
    if(!paused)updateSkins();
    darkness+=(Number(dark)-darkness)*(1-Math.exp(-wallDt*5));shared.darkness.value=darkness;
    (backgroundScene.background as THREE.Color).setRGB(1-darkness*.994,1-darkness*.991,1-darkness*.984);
    frontKey.intensity=3.3*(1-darkness*.95);frontFill.intensity=2.4*(1-darkness*.96);
    controls.update();
    if(renderCounter++%2===0||grabbing){
      renderer.setRenderTarget(shadowTarget);renderer.setClearColor(0xffffff,1);renderer.clear();renderer.render(shadowScene,shadowCamera);
      renderer.setRenderTarget(heightTarget);renderer.setClearColor(new THREE.Color(8,8,8),1);renderer.clear();renderer.render(heightScene,heightCamera);
    }
    renderer.setRenderTarget(sceneTarget);renderer.clear();renderer.render(backgroundScene,camera);
    renderer.setRenderTarget(backTarget);renderer.setClearColor(new THREE.Color(30,30,30),1);renderer.clear();renderer.render(backScene,camera);
    renderer.setRenderTarget(null);renderer.setClearColor(0xffffff,1);renderer.clear();renderer.render(copyScene,copyCamera);renderer.clearDepth();renderer.render(frontScene,camera);
    host.dataset.ready='true';
  };
  if(!reducedMotion){frame=requestAnimationFrame(animate);}else{paused=true;frame=requestAnimationFrame(animate);}
  return {
    gulp,reset,
    state:():WhaleState=>({inflation,paused,dark,volume:soft.volume(),nodes:soft.rest.length/3,tets:soft.tets.length/4,renderer:THREE.REVISION,grabbed:grabbing,time,color:material.uniforms.jellyColor.value.getHexString(),firmness:soft.firmness,damping:soft.damping}),
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();window.removeEventListener('keydown',keydown);
      canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',up,true);canvas.removeEventListener('wheel',wheel,true);canvas.removeEventListener('dblclick',doubleClick);
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      for(const s of [backgroundScene,frontScene,shadowScene,heightScene,backScene,copyScene])s.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());[sceneTarget,backTarget,shadowTarget,heightTarget,environment].forEach(t=>t.dispose());renderer.dispose();canvas.remove();
    }
  };
}
