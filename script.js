(function(){
const STORAGE_KEY='metal_finder_v4_data';
const NAV_INTERVAL_MS=500;
const HEADING_SMOOTH=6;

const toast=document.getElementById('toast');
const screens={
  home:document.getElementById('screen-home'),
  targets:document.getElementById('screen-targets'),
  compass:document.getElementById('screen-compass'),
  settings:document.getElementById('screen-settings')
};
const navBtns=[...document.querySelectorAll('.nav-item')];
const compassTargetName=document.getElementById('compassTargetName');
const headingEl=document.getElementById('heading');
const bearingEl=document.getElementById('bearing');
const bearingTextEl=document.getElementById('bearingText');
const arrowEl=document.getElementById('arrow');

let data=load(); data.surveys=data.surveys||[];
let lastPosition=null;
let selectedTargetId=null;
let headingSamples=[];
let smoothedHeading=0;
let orientationAvailable=false;

// ============ Utilities ============
function toRad(v){return v*Math.PI/180}
function toDeg(v){return v*180/Math.PI}
function uid(p='id'){return p+Math.random().toString(36).slice(2,9)}
function showToast(msg){toast.textContent=msg;toast.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>toast.style.display='none',2000)}
function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(e){return{}}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}

// ============ Bearing & Distance ============
function haversineMeters(lat1,lon1,lat2,lon2){
  const R=6371000;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}

function bearingTo(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ_raw = toRad(lon2 - lon1);
  const Δλ = ((Δλ_raw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ============ Debug Panel ============
let debugPanelEl=null;
let debugOpen=true; // show by default
function normalizeDeltaLonDeg(lon2, lon1){return ((lon2 - lon1 + 540) % 360) - 180;}

function initDebugPanel(){
  const host=screens.compass.querySelector('.card')||document.body;
  debugPanelEl=document.createElement('div');
  debugPanelEl.style.cssText='margin-top:10px;padding:10px;background:rgba(0,0,0,0.4);border-radius:10px;font:12px monospace;color:#eee;white-space:pre-wrap';
  const btn=document.createElement('button');
  btn.className='btn btn-secondary btn-sm';
  btn.textContent='🐞 Debug';
  btn.style.marginBottom='6px';
  const content=document.createElement('div');
  content.style.display=debugOpen?'block':'none';
  btn.onclick=()=>{debugOpen=!debugOpen;content.style.display=debugOpen?'block':'none';};
  host.appendChild(debugPanelEl);
  debugPanelEl.appendChild(btn);
  debugPanelEl.appendChild(content);
  debugPanelEl._content=content;
}

function fmtNum(v,n=6){return(typeof v==='number'&&isFinite(v))?v.toFixed(n):'—';}
function fmtDeg(v){return(typeof v==='number'&&isFinite(v))?Math.round(v)+'°':'—';}
function fmtMeters(v){return(typeof v==='number'&&isFinite(v))?Math.round(v)+'m':'—';}

function updateDebugReadout(){
  if(!debugPanelEl||!debugPanelEl._content)return;
  const open=data.surveys.find(s=>s.status==='Open');
  const t=open&&selectedTargetId?open.targets.find(x=>x.id===selectedTargetId):null;
  const userLat=lastPosition?.coords?.latitude??null;
  const userLon=lastPosition?.coords?.longitude??null;
  const acc=lastPosition?.coords?.accuracy??null;
  let brg=null,dist=null,rel=null,dLonNorm=null;
  if(t&&userLat!=null&&userLon!=null){
    dist=haversineMeters(userLat,userLon,t.lat,t.lng);
    brg=bearingTo(userLat,userLon,t.lat,t.lng);
    rel=((brg-smoothedHeading)+540)%360-180;
    dLonNorm=normalizeDeltaLonDeg(t.lng,userLon);
  }
  const lines=[
    '--- COMPASS DEBUG ---',
    `Orientation sensor:   ${orientationAvailable?'✅ active':'❌ none'}`,
    `Heading:              ${fmtDeg(smoothedHeading)}`,
    `Target bearing:       ${fmtDeg(brg)}`,
    `Relative angle:       ${fmtDeg(rel)} (arrow)`,
    `Distance:             ${fmtMeters(dist)}`,
    `Accuracy:             ${acc?acc.toFixed(1)+'m':'—'}`,
    '',
    `Your coords:          ${fmtNum(userLat)}, ${fmtNum(userLon)}`,
    `Target coords:        ${t?fmtNum(t.lat):'—'}, ${t?fmtNum(t.lng):'—'}`,
    `Δlon normalized:      ${dLonNorm!=null?dLonNorm.toFixed(6)+'°':'—'}`,
    '',
    `Survey:               ${open?open.name:'—'}`,
    `Target:               ${t?(t.notes||'Target'):'—'}`
  ];
  debugPanelEl._content.textContent=lines.join('\n');
}

// ============ Orientation & Navigation ============
function handleOrientation(e){
  let head=null;
  if(typeof e.webkitCompassHeading==='number')head=e.webkitCompassHeading;
  else if(typeof e.alpha==='number')head=(360-e.alpha);
  if(head===null||isNaN(head)){orientationAvailable=false;updateDebugReadout();return;}
  orientationAvailable=true;
  headingSamples.push((head+360)%360);
  if(headingSamples.length>HEADING_SMOOTH)headingSamples.shift();
  let x=0,y=0; headingSamples.forEach(h=>{x+=Math.cos(toRad(h));y+=Math.sin(toRad(h));});
  smoothedHeading=(toDeg(Math.atan2(y,x))+360)%360;
  headingEl.textContent=Math.round(smoothedHeading);
  updateNavImmediate();
}
if(window.DeviceOrientationEvent)window.addEventListener('deviceorientation',handleOrientation);

function updateNavImmediate(){
  const open=data.surveys.find(s=>s.status==='Open');
  if(!open||!selectedTargetId||!lastPosition)return;
  const t=open.targets.find(x=>x.id===selectedTargetId);
  if(!t)return;
  const lat=lastPosition.coords.latitude,lon=lastPosition.coords.longitude;
  const d=haversineMeters(lat,lon,t.lat,t.lng);
  const brg=bearingTo(lat,lon,t.lat,t.lng);
  const rel=((brg-smoothedHeading)+540)%360-180;
  bearingEl.textContent=Math.round(brg);
  bearingTextEl.textContent=`${Math.round(d)}m`;
  arrowEl.style.transform=`rotate(${rel}deg)`;
  compassTargetName.textContent=t.notes||'Target';
  updateDebugReadout();
}

// ============ GPS ============
function startGPS(){
  if(!navigator.geolocation){showToast('Geolocation not supported');return;}
  navigator.geolocation.watchPosition(p=>{
    lastPosition=p;
    document.getElementById('gpsText').textContent='Locked';
    document.getElementById('accText').textContent=(p.coords.accuracy||0).toFixed(1)+'m';
    updateNavImmediate();
  },()=>{document.getElementById('gpsText').textContent='No signal';},
  {enableHighAccuracy:true,maximumAge:1000,timeout:10000});
}

// ============ Setup a test target ============
function setupTestSurvey(){
  if(!data.surveys.length){
    const s={id:uid('s_'),name:'Test Survey',status:'Open',targets:[]};
    data.surveys.push(s);
  }
  const s=data.surveys[0];
  if(!s.targets.length){
    const t={id:uid('t_'),lat:50.0,lng:0.0,notes:'Test Target'};
    s.targets.push(t);
  }
  selectedTargetId=s.targets[0].id;
  save();
}

// ============ Init ============
setupTestSurvey();
startGPS();
setTimeout(initDebugPanel,1000); // delay ensures compass DOM exists
})();
