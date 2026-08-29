// Self-contained Three.js scene that reproduces the Aaziko Load Calculator's
// 3D container view (transportation/buyer-front `Container3DScene.tsx`, which
// uses react-three-fiber + three + drei). Rendered inside a WebView (native)
// or an <iframe> (web) so the exact same WebGL model works on every platform.
//
// It uses modern three (r160) as ES modules so it gets the SAME rendering
// pipeline react-three-fiber uses: managed sRGB colour, ACES filmic tone
// mapping, soft shadows, and RoomEnvironment image-based lighting (the
// equivalent of drei's <Environment preset="warehouse" />). That pipeline is
// what makes the cargo look richly shaded and vivid instead of flat/matte.
//
// Note: ES-module import maps require iOS 16.4+ / a modern Android WebView /
// any current desktop browser. Three.js is loaded from a CDN, so the 3D needs
// network the first time.

export interface Cargo3DItem {
  name: string;
  packages: number;
  volume: number; // m³ (total for this cargo type)
  weight?: number;
  color: string;
  icon?: string;
  cargoType?: string; // box | bigbags | sacks | barrels | roll | pipes | bulk ...
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
}

export interface LoadCalc3DData {
  cargoItems: Cargo3DItem[];
  containerSize?: '20ft' | '40ft';
  interactive?: boolean; // false = orbit/zoom disabled (inline preview)
  chrome?: boolean; // false = hide the legend / item-count / "3D View" overlays
}

export function buildLoadCalc3dHtml(data: LoadCalc3DData): string {
  const payload = JSON.stringify({
    cargoItems: data.cargoItems || [],
    containerSize: data.containerSize === '40ft' ? '40ft' : '20ft',
    interactive: data.interactive !== false,
    chrome: data.chrome !== false,
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;height:100%;width:100%;background:#f5f6f8;overflow:hidden;}
  #app{position:relative;width:100%;height:100%;}
  #c{display:block;width:100%;height:100%;touch-action:none;}
  .badge{position:absolute;z-index:10;background:rgba(255,255,255,.9);border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px;font:500 10px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#374151;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}
  #legend{position:absolute;top:8px;left:8px;z-index:10;display:flex;flex-wrap:wrap;gap:6px;}
  #legend .it{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.9);border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px;font:500 10px system-ui,sans-serif;color:#4b5563;}
  #legend .dot{width:8px;height:8px;border-radius:50%;}
  #count{bottom:8px;left:8px;}
  #tag{bottom:8px;right:8px;color:#3b82f6;background:#fff;border-radius:8px;padding:4px 8px;box-shadow:0 1px 2px rgba(0,0,0,.08);}
  #err{position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;padding:16px;font:500 12px system-ui,sans-serif;color:#6b7280;}
</style>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
}}
</script>
</head>
<body>
<div id="app">
  <canvas id="c"></canvas>
  <div id="legend"></div>
  <div id="count" class="badge"></div>
  <div id="tag" class="badge">3D View</div>
  <div id="err">3D preview needs an internet connection.</div>
</div>
<script>
  // Fallback: if the module never initialises (old WebView / offline), show a note.
  window.setTimeout(function(){ if(!window.__lc3dReady){ var e=document.getElementById('err'); if(e) e.style.display='flex'; } }, 9000);
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

var DATA = ${payload};

var CONTAINER_DIMS = {
  '20ft': { length:5896, width:2350, height:2392 },
  '40ft': { length:12032, width:2350, height:2392 }
};
var CARGO_TYPE_SHAPE = {
  box:'box', bigbags:'bag', sacks:'bag', barrels:'cylinder', roll:'cylinder-side',
  pipes:'cylinder-side', bulk:'box', 'big-box':'box', crate:'box', carton:'box',
  container:'box', custom:'box', barrel:'cylinder', drum:'cylinder', ibc:'cylinder',
  bag:'bag', 'big-bag':'bag', sack:'bag', pallet:'flat-box', bundle:'box',
  tube:'cylinder-side', cylinder:'cylinder-side'
};
function getShapeType(t){ return CARGO_TYPE_SHAPE[t||'box'] || 'box'; }

var containerSize = DATA.containerSize === '40ft' ? '40ft' : '20ft';
var dims = CONTAINER_DIMS[containerSize];
var cargoItems = DATA.cargoItems || [];

// ---- Cargo bin-packing (ported 1:1 from Container3DScene.tsx) ----
function buildCargoBoxes(){
  var boxes = [];
  var totalAll = 0;
  for (var i=0;i<cargoItems.length;i++) totalAll += (cargoItems[i].packages||0);
  if (totalAll === 0) return boxes;

  var itemSpecs = cargoItems.map(function(item){
    var bL,bW,bH;
    if (item.lengthMm && item.widthMm && item.heightMm){ bL=item.lengthMm; bW=item.widthMm; bH=item.heightMm; }
    else if (item.packages>0 && item.volume>0){ var v=(item.volume/item.packages)*1e9; var side=Math.cbrt(v); bL=side; bW=side; bH=side; }
    else { bL=500; bW=500; bH=500; }
    var shapeType = getShapeType(item.cargoType);
    if (shapeType === 'flat-box'){ bH = Math.min(bH, Math.max(bL,bW)*0.2); }
    return { item:item, bL:bL, bW:bW, bH:bH, shapeType:shapeType };
  });

  var SHAPE_ORDER = { 'flat-box':0, box:1, bag:2, sphere:3, cylinder:4, 'cylinder-side':4 };
  itemSpecs.sort(function(a,b){ return (SHAPE_ORDER[a.shapeType]==null?5:SHAPE_ORDER[a.shapeType]) - (SHAPE_ORDER[b.shapeType]==null?5:SHAPE_ORDER[b.shapeType]); });

  var floorLen = dims.length, floorWid = dims.width, floorOriginX = 0, floorOriginZ = -dims.width/2;

  function findOptimalLayout(n,maxCols,maxRows,maxLayers){
    var cap = maxCols*maxRows;
    var layers = Math.min(maxLayers, Math.max(1, Math.ceil(n/cap)));
    return { cols:maxCols, rows:maxRows, layers:layers };
  }
  function capacityAtScale(s){
    var cap=0, yUsed=0, eX=floorLen, eZ=floorWid;
    for (var i=0;i<itemSpecs.length;i++){
      var it=itemSpecs[i]; if (it.item.packages<=0) continue;
      var pw=it.bL*s, pd=it.bW*s, ph=it.bH*s;
      if (pw<1||pd<1||ph<1) continue;
      var mc=Math.max(1,Math.floor(eX/pw)), mr=Math.max(1,Math.floor(eZ/pd));
      var availH=dims.height-yUsed, ml=Math.floor(availH/ph);
      if (ml<=0) continue;
      var lay=findOptimalLayout(it.item.packages,mc,mr,ml);
      cap += Math.min(it.item.packages, lay.cols*lay.rows*lay.layers);
      yUsed += lay.layers*ph;
      eX=Math.min(eX,lay.cols*pw); eZ=Math.min(eZ,lay.rows*pd);
    }
    return cap;
  }
  function findScale(lo,hi){ for (var i=0;i<30;i++){ var mid=(lo+hi)/2; if (capacityAtScale(mid)>=totalAll) lo=mid; else hi=mid; } return lo; }
  var vScale = capacityAtScale(1.0) >= totalAll ? 1.0 : findScale(0.01,1.0);

  var globalYUsed=0, eX=floorLen, eZ=floorWid;
  for (var k=0;k<itemSpecs.length;k++){
    var sp=itemSpecs[k]; if (sp.item.packages<=0) continue;
    var pw=sp.bL*vScale, pd=sp.bW*vScale, ph=sp.bH*vScale;
    var mca=Math.max(1,Math.floor(eX/pw)), mra=Math.max(1,Math.floor(eZ/pd));
    var availableH=dims.height-globalYUsed, msl=Math.floor(availableH/ph);
    if (msl<=0) continue;
    var lay=findOptimalLayout(sp.item.packages,mca,mra,msl);
    var colsAlong=lay.cols, depthLayers=lay.rows, stackLayers=lay.layers;
    var placed=0, maxSy=0;
    for (var sy=0; sy<stackLayers && placed<sp.item.packages; sy++){
      for (var sz=0; sz<depthLayers && placed<sp.item.packages; sz++){
        for (var sx=0; sx<colsAlong && placed<sp.item.packages; sx++){
          var x=floorOriginX+sx*pw+pw/2, y=globalYUsed+sy*ph+ph/2, z=floorOriginZ+sz*pd+pd/2;
          boxes.push({ position:[x,y,z], size:[pw,ph,pd], color:sp.item.color, shapeType:sp.shapeType });
          placed++; maxSy=Math.max(maxSy,sy+1);
        }
      }
    }
    globalYUsed += maxSy*ph;
    eX=Math.min(eX,colsAlong*pw); eZ=Math.min(eZ,depthLayers*pd);
  }
  return boxes;
}

// ---- Renderer (react-three-fiber-equivalent pipeline) ----
var canvas = document.getElementById('c');
var renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

var scene = new THREE.Scene();

// Image-based lighting — drei's <Environment preset="warehouse" /> equivalent.
var pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

var camera = new THREE.PerspectiveCamera(45, 1, 10, 200000);
// Frame target + a pleasant 3/4 view direction. The distance is computed to
// fit the whole container in the viewport (any box size / aspect ratio), so
// the model is never cropped or tiny — recomputed on resize until the user
// starts interacting.
var camTarget = new THREE.Vector3(dims.length/2, dims.height/3, 0);
var camDir = new THREE.Vector3(0.55, 0.5, 1).normalize();
var fitRadius = 0.5 * Math.sqrt(dims.length*dims.length + dims.height*dims.height + dims.width*dims.width) * 1.06;
function fitCamera(){
  var aspect = camera.aspect || 1;
  var vFov = camera.fov * Math.PI/180;
  var hFov = 2*Math.atan(Math.tan(vFov/2)*aspect);
  var d = Math.max(fitRadius/Math.sin(vFov/2), fitRadius/Math.sin(hFov/2)) * 1.08;
  camera.position.copy(camTarget).add(camDir.clone().multiplyScalar(d));
  camera.near = Math.max(1, d - fitRadius*2);
  camera.far = d + fitRadius*4;
  camera.updateProjectionMatrix();
}

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
var d1 = new THREE.DirectionalLight(0xffffff, 2.2);
d1.position.set(dims.length, dims.height*2, dims.width);
d1.castShadow = true;
d1.shadow.mapSize.set(2048, 2048);
(function(){
  var s = dims.length; var sc = d1.shadow.camera;
  sc.left=-s; sc.right=s; sc.top=s; sc.bottom=-s; sc.near=10; sc.far=s*8; sc.updateProjectionMatrix();
  d1.shadow.bias=-0.0008; d1.shadow.normalBias=25;
})();
scene.add(d1);
var d2 = new THREE.DirectionalLight(0xffffff, 0.8); d2.position.set(-dims.length, dims.height, -dims.width); scene.add(d2);

// ---- Container wireframe + walls + wooden floor ----
var cgroup = new THREE.Group(); cgroup.position.set(dims.length/2, dims.height/2, 0); scene.add(cgroup);
var boxGeo = new THREE.BoxGeometry(dims.length, dims.height, dims.width);
var wire = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), new THREE.LineDashedMaterial({ color:0x96aac8, dashSize:80, gapSize:40, transparent:true, opacity:0.5 }));
wire.computeLineDistances(); cgroup.add(wire);
cgroup.add(new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color:0xc8d7f0, transparent:true, opacity:0.04, side:THREE.DoubleSide, depthWrite:false })));
var floorMargin=60, floorThickness=80;
var floorGeo = new THREE.BoxGeometry(dims.length+floorMargin*2, floorThickness, dims.width+floorMargin*2);
var floorMat = new THREE.MeshStandardMaterial({ color:0x8b6f47, metalness:0.1, roughness:0.85 });
floorMat.envMapIntensity = 0.6;
var floor = new THREE.Mesh(floorGeo, floorMat);
floor.position.set(0, -dims.height/2 - floorThickness/2, 0); floor.receiveShadow = true; cgroup.add(floor);
var floorFrame = new THREE.LineSegments(new THREE.EdgesGeometry(floorGeo), new THREE.LineBasicMaterial({ color:0x1f2937 }));
floorFrame.position.copy(floor.position); cgroup.add(floorFrame);

// ---- Cargo meshes ----
function makeGeo(shapeType,w,h,d){
  if (shapeType==='cylinder'){ var r=Math.min(w,d)/2; return new THREE.CylinderGeometry(r,r,h,16); }
  if (shapeType==='cylinder-side'){ var r2=Math.min(h,d)/2; var g=new THREE.CylinderGeometry(r2,r2,w,16); g.rotateZ(Math.PI/2); return g; }
  if (shapeType==='bag'){ var g2=new THREE.SphereGeometry(1,12,8); g2.scale(w/2,h/2,d/2); return g2; }
  return new THREE.BoxGeometry(w,h,d);
}
var cargoBoxes = buildCargoBoxes();
for (var bi=0; bi<cargoBoxes.length; bi++){
  var b=cargoBoxes[bi];
  var geo=makeGeo(b.shapeType, b.size[0], b.size[1], b.size[2]);
  var cmat = new THREE.MeshStandardMaterial({ color:new THREE.Color(b.color), roughness:0.55, metalness:0.05 });
  cmat.envMapIntensity = 0.85;
  var mesh=new THREE.Mesh(geo, cmat);
  mesh.position.set(b.position[0], b.position[1], b.position[2]);
  mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  if (b.shapeType!=='bag'){
    var ec=new THREE.Color(b.color); ec.multiplyScalar(0.55);
    var eg=new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color:ec }));
    eg.position.copy(mesh.position); scene.add(eg);
  }
}

var controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(camTarget);
controls.enableRotate = true;                    // 360° rotate everywhere
controls.enableZoom = DATA.chrome !== false;     // zoom/pan only in the full view
controls.enablePan = DATA.chrome !== false;
controls.minDistance=1000; controls.maxDistance=60000; controls.maxPolarAngle=Math.PI*0.85;
controls.enableDamping=true; controls.dampingFactor=0.08;
controls.enabled = DATA.interactive !== false;

// Auto-fit until the user starts orbiting; after that, respect their view.
var userMoved = false;
controls.addEventListener('start', function(){ userMoved = true; });

function resize(){
  var w=canvas.clientWidth||1, h=canvas.clientHeight||1;
  renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  if (!userMoved){ fitCamera(); controls.target.copy(camTarget); controls.update(); }
}
window.addEventListener('resize', resize); resize();
function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); }
animate();
window.__lc3dReady = true;

// ---- Overlays (hidden when chrome === false, e.g. the inline preview) ----
if (DATA.chrome === false){
  ['legend','count','tag'].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });
} else {
  var legend=document.getElementById('legend');
  cargoItems.filter(function(i){ return i.packages>0; }).forEach(function(item){
    var shape=getShapeType(item.cargoType);
    var label = shape==='cylinder'?'(Barrel)':shape==='cylinder-side'?'(Roll)':shape==='bag'?'(Bag)':shape==='flat-box'?'(Pallet)':'(Box)';
    var el=document.createElement('span'); el.className='it';
    var dot=document.createElement('span'); dot.className='dot'; dot.style.background=item.color;
    el.appendChild(dot); el.appendChild(document.createTextNode(' '+(item.icon?item.icon+' ':'')+item.name+' '+label));
    legend.appendChild(el);
  });
  document.getElementById('count').textContent = cargoBoxes.length + ' items loaded';
}
</script>
</body>
</html>`;
}
