document.addEventListener('DOMContentLoaded', function() {
const STORAGE_KEY='metal_finder_v4_data';
const NAV_INTERVAL_MS=500;
const HEADING_SMOOTH=6;

const toast=document.getElementById('toast');
const lightbox=document.getElementById('lightbox');
const lightboxImage=document.getElementById('lightboxImage');
const lightboxClose=document.getElementById('lightboxClose');
const lightboxPrev=document.getElementById('lightboxPrev');
const lightboxNext=document.getElementById('lightboxNext');
const lightboxCounter=document.getElementById('lightboxCounter');
const lightboxChange=document.getElementById('lightboxChange');
const lightboxDelete=document.getElementById('lightboxDelete');
const modal=document.getElementById('modal');
const modalTitle=document.getElementById('modalTitle');
const modalBody=document.getElementById('modalBody');
const modalCancel=document.getElementById('modalCancel');
const modalConfirm=document.getElementById('modalConfirm');
const permissionBanner=document.getElementById('permissionBanner');

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

let data=load();
data.surveys=data.surveys||[];
let lastPosition=null;
let watchId=null;
let batchInterval=null;
let selectedTargetId=null;
let headingSamples=[];
let smoothedHeading=0;
let lastNav=0;
let hasVibrated=false;
let currentScreen='home';
let currentLightboxImages=[];
let currentLightboxIndex=0;
let currentLightboxTarget=null;
let compassInitialized=false;

function uid(p='id'){return p+Math.random().toString(36).slice(2,9)}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));showToast('💾 Saved')}
function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(e){return{}}}
function showToast(msg){toast.textContent=msg;toast.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>toast.style.display='none',2000)}
function escapeHtml(text){const div=document.createElement('div');div.textContent=text;return div.innerHTML;}

async function initializeCompass(){
  if(compassInitialized)return true;
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
    try{
      const permission=await DeviceOrientationEvent.requestPermission();
      if(permission==='granted'){
        compassInitialized=true;
        permissionBanner.classList.remove('show');
        window.addEventListener('deviceorientation',handleOrientation,true);
        showToast('🧭 Compass enabled');
        return true;
      }else{
        showToast('⚠️ Compass permission denied');
        return false;
      }
    }catch(error){
      console.error('Error requesting compass permission:',error);
      showToast('⚠️ Could not enable compass');
      return false;
    }
  }else{
    compassInitialized=true;
    window.addEventListener('deviceorientation',handleOrientation,true);
    return true;
  }
}

function checkCompassPermission(){
  if(!compassInitialized&&typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
    permissionBanner.classList.add('show');
  }
}

permissionBanner.addEventListener('click',async()=>{
  await initializeCompass();
});

function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  navBtns.forEach(b=>b.classList.toggle('active',b.dataset.screen===name));
  currentScreen=name;
  if(name==='home')renderSurveys();
  if(name==='targets')renderTargets();
  if(name==='compass'){
    checkCompassPermission();
    if(!compassInitialized)initializeCompass();
  }else{
    hasVibrated=false;
    permissionBanner.classList.remove('show');
  }
}
navBtns.forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));

function getOpenSurvey(){return data.surveys.find(s=>s.status==='Open'&&!s.archived)}
function setOnlyOpen(id){data.surveys.forEach(s=>{s.status=(s.id===id)?'Open':(s.status==='Open'?'Closed':s.status)})}

function createSurvey(name){
  setOnlyOpen(null);
  const s={id:uid('s_'),name:name||('Survey '+new Date().toLocaleString()),createdAt:Date.now(),status:'Open',archived:false,targets:[]};
  data.surveys.push(s);save();renderSurveys();return s;
}
  //End of Part 1.

                          
