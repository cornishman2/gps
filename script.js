(function(){
const STORAGE_KEY='metal_finder_v4_data';
const NAV_INTERVAL_MS=500;
const HEADING_SMOOTH=6;

// Core DOM references
const toast=document.getElementById('toast');
const screens={
  home:document.getElementById('screen-home'),
  targets:document.getElementById('screen-targets'),
  compass:document.getElementById('screen-compass'),
  settings:document.getElementById('screen-settings')
};
const navBtns=[...document.querySelectorAll('.nav-item')];
const surveyListEl=document.getElementById('surveyList');
const targetsListEl=document.getElementById('targetsList');
const btnNewSurvey=document.getElementById('btnNewSurvey');
const btnNewSurveyAdd=document.getElementById('btnNewSurveyAdd');
const btnCloseSurvey=document.getElementById('btnCloseSurvey');
const btnAddTarget=document.getElementById('btnAddTarget');
const btnBatch=document.getElementById('btnBatch');
const detectoristNameEl=document.getElementById('detectoristName');
const detectorUsedEl=document.getElementById('detectorUsed');
const openSurveyNameEl=document.getElementById('openSurveyName');
const btnExport=document.getElementById('btnExport');
const btnImport=document.getElementById('btnImport');
const importFileEl=document.getElementById('importFile');
const btnClear=document.getElementById('btnClear');
const compassTargetName=document.getElementById('compassTargetName');
const headingEl=document.getElementById('heading');
const bearingEl=document.getElementById('bearing');
const bearingTextEl=document.getElementById('bearingText');
const arrowEl=document.getElementById('arrow');
const btnNextTarget=document.getElementById('btnNextTarget');
const btnPrevTarget=document.getElementById('btnPrevTarget');
const btnFirstTarget=document.getElementById('btnFirstTarget');
const btnLastTarget=document.getElementById('btnLastTarget');
const btnMarkFound=document.getElementById('btnMarkFound');

// Data and state
let data=load();
data.surveys=data.surveys||[];
let lastPosition=null;
let watchId=null;
let selectedTargetId=null;
let headingSamples=[];
let smoothedHeading=0;
let lastNav=0;
let hasVibrated=false;
let currentScreen='home';
let orientationAvailable=false;

// =============== UTILITY FUNCTIONS ==================
function uid(p='id'){return p+Math.random().toString(36).slice(2,9)}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));showToast('💾 Saved')}
function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(e){return{}}}
function showToast(msg){toast.textContent=msg;toast.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>toast.style.display='none',2000)}
function toRad(v){return v*Math.PI/180}
function toDeg(v){return v*180/Math.PI}

// =============== BEARING & DISTANCE ==================
function haversineMeters(lat1,lon1,lat2,lon2){
  const R=6371000;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}

// Corrected bearing function (handles all hemispheres & wrap-around)
function bearingTo(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);

  const Δλ_raw = toRad(lon2 - lon1);
  const Δλ = ((Δλ_raw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// =============== DEBUG PANEL ==================
let debugPanelEl=null;
let debugOpen=false; // default hidden

function normalizeDeltaLonDeg(lon2, lon1) {
  return ((lon2 - lon1 + 540) % 360) - 180;
}

function initDebugPanel() {
  if (debugPanelEl) return;
  const host=screens.compass?.querySelector('.card')||document.body;

  debugPanelEl=document.createElement('div');
  debugPanelEl.id='debugPanel';
  debugPanelEl.style.cssText=[
    'margin-top:12px','padding:10px 12px',
    'border:1px solid rgba(255,255,255,0.15)',
    'border-radius:10px',
    'background:rgba(0,0,0,0.35)',
    'font:12px/1.4 monospace',
    'color:#e5e7eb','white-space:pre-wrap','user-select:text'
  ].join(';');

  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='btn btn-secondary btn-sm';
  toggle.textContent='🐞 Debug';
  toggle.style.margin='0 0 8px 0';

  const content=document.createElement('div');
  content.style.display=debugOpen?'block':'none';
  content.innerHTML='Debug ready…';

  toggle.onclick=()=>{
    debugOpen=!debugOpen;
    content.style.display=debugOpen?'block':'none';
  };

  debugPanelEl.appendChild(toggle);
  debugPanelEl.appendChild(content);
  host.appendChild(debugPanelEl);
  debugPanelEl._content=content;
}

function fmtNum(v,n=6){return(typeof v==='number'&&isFinite(v))?v.toFixed(n):'—';}
function fmtDeg(v){return(typeof v==='number'&&isFinite(v))?Math.round(v)+'°':'—';}
function fmtMeters(v){return(typeof v==='number'&&isFinite(v))?Math.round(v)+'m':'—';}

function updateDebugReadout(){
  if(!debugPanelEl||!debugPanelEl._content)return;
  const open=getOpenSurvey();
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
    `Orientation sensor:   ${orientationAvailable ? '✅ active' : '❌ not detected'}`,
    `Heading (smoothed):  ${fmtDeg(smoothedHeading)}`,
    `Target bearing:      ${fmtDeg(brg)}`,
    `Relative angle:      ${fmtDeg(rel)} (arrow rotation)`,
    `Distance:            ${fmtMeters(dist)}`,
    `Accuracy:            ${acc!=null?acc.toFixed(1)+'m':'—'}`,
    '',
    `Your lat, lon:       ${fmtNum(userLat)}, ${fmtNum(userLon)}`,
    `Target lat, lon:     ${t?fmtNum(t.lat):'—'}, ${t?fmtNum(t.lng):'—'}`,
    `Δlon normalized:     ${dLonNorm!=null?dLonNorm.toFixed(6)+'°':'—'}`,
    '',
    `Open survey:         ${open?open.name:'—'}`,
    `Selected target:     ${t?(t.notes||'Target'):'—'}`
  ];

  debugPanelEl._content.textContent=lines.join('\n');
}

// =============== SCREEN HANDLING ==================
function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  navBtns.forEach(b=>b.classList.toggle('active',b.dataset.screen===name));
  currentScreen=name;
  if(name==='home')renderSurveys();
  if(name==='targets')renderTargets();
  updateDebugReadout();
}
navBtns.forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));

// (Simplified) data and survey functions
function getOpenSurvey(){return data.surveys.find(s=>s.status==='Open'&&!s.archived)}
function createSurvey(name){
  data.surveys.forEach(s=>s.status=(s.id===name)?'Open':'Closed');
  const s={id:uid('s_'),name:name||('Survey '+new Date().toLocaleString()),createdAt:Date.now(),status:'Open',targets:[]};
  data.surveys.push(s);save();renderSurveys();return s;
}
function renderSurveys(){
  surveyListEl.innerHTML='';
  if(!data.surveys.length){
    surveyListEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">No surveys yet.</div>';
    return;
  }
  data.surveys.forEach(s=>{
    const div=document.createElement('div');
    div.className='survey-item';
    div.innerHTML=`<div>${s.name}</div>`;
    surveyListEl.appendChild(div);
  });
}

// (Targets render simplified just for testing)
function renderTargets(){
  const open=getOpenSurvey();
  openSurveyNameEl.textContent=open?open.name:'—';
}

// =============== COMPASS & NAVIGATION ==================
function handleOrientation(e){
  let head=null;
  if(typeof e.webkitCompassHeading==='number')head=e.webkitCompassHeading;
  else if(typeof e.alpha==='number')head=(360-e.alpha);
  if(head===null||isNaN(head)){orientationAvailable=false;updateDebugReadout();return;}
  orientationAvailable=true;
  headingSamples.push((head+360)%360);
  if(headingSamples.length>HEADING_SMOOTH)headingSamples.shift();
  let x=0,y=0;
  headingSamples.forEach(h=>{x+=Math.cos(toRad(h));y+=Math.sin(toRad(h));});
  smoothedHeading=(toDeg(Math.atan2(y,x))+360)%360;
  headingEl.textContent=Math.round(smoothedHeading);
  updateDebugReadout();
}
if(window.DeviceOrientationEvent)window.addEventListener('deviceorientation',handleOrientation);

function updateNavImmediate(){
  const open=getOpenSurvey();
  if(!open||!selectedTargetId||!lastPosition)return;
  const t=open.targets.find(x=>x.id===selectedTargetId);
  if(!t)return;
  const lat=lastPosition.coords.latitude,lon=lastPosition.coords.longitude;
  const d=haversineMeters(lat,lon,t.lat,t.lng);
  const brg=bearingTo(lat,lon,t.lat,t.lng);
  bearingEl.textContent=Math.round(brg);
  const rel=((brg-smoothedHeading)+540)%360-180;
  arrowEl.style.transform=`rotate(${rel}deg)`;
  bearingTextEl.textContent=`${Math.round(d)}m`;
  updateDebugReadout();
}

function startGPS(){
  if(!navigator.geolocation){
    document.getElementById('gpsText').textContent='Not supported';
    return;
  }
  watchId=navigator.geolocation.watchPosition(p=>{
    lastPosition=p;
    document.getElementById('gpsText').textContent='Locked';
    document.getElementById('accText').textContent=(p.coords.accuracy||0).toFixed(1)+'m';
    updateNavImmediate();
    updateDebugReadout();
  },err=>{
    document.getElementById('gpsText').textContent='No signal';
  },{enableHighAccuracy:true,maximumAge:1000,timeout:10000});
}

// =============== INIT ==================
renderSurveys();
startGPS();
initDebugPanel();

})();
