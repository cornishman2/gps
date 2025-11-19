/* script.js - all logic with resilient event listeners */
(() => {
  'use strict';

  const STORAGE_KEY='metal_finder_v4_data';
  const NAV_INTERVAL_MS=500;
  const HEADING_SMOOTH=6;

  const $ = (sel,root=document)=>root.querySelector(sel);
  const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));

  const toast=$('#toast');
  const screens={
    home:$('#screen-home'),
    targets:$('#screen-targets'),
    compass:$('#screen-compass'),
    settings:$('#screen-settings')
  };
  const navBtns=$$('.nav-item');
  const surveyListEl=$('#surveyList');
  const targetsListEl=$('#targetsList');
  const btnNewSurvey=$('#btnNewSurvey');
  const btnNewSurveyAdd=$('#btnNewSurveyAdd');
  const btnCloseSurvey=$('#btnCloseSurvey');
  const btnAddTarget=$('#btnAddTarget');
  const btnBatch=$('#btnBatch');
  const detectoristNameEl=$('#detectoristName');
  const detectorUsedEl=$('#detectorUsed');
  const openSurveyNameEl=$('#openSurveyName');
  const btnExport=$('#btnExport');
  const btnImport=$('#btnImport');
  const importFileEl=$('#importFile');
  const btnClear=$('#btnClear');
  const compassTargetName=$('#compassTargetName');
  const headingEl=$('#heading');
  const bearingEl=$('#bearing');
  const bearingTextEl=$('#bearingText');
  const arrowEl=$('#arrow');

  let data=load();
  data.surveys=data.surveys||[];
  let lastPosition=null;
  let batchInterval=null;
  let selectedTargetId=null;
  let headingSamples=[];
  let smoothedHeading=0;
  let lastNav=0;
  let hasVibrated=false;

  function uid(p='id'){return p+Math.random().toString(36).slice(2,9)}
  function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));showToast('💾 Saved')}
  function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(e){return{}}}
  function showToast(msg){toast.textContent=msg;toast.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>toast.style.display='none',1500)}
  function escapeHtml(text){const div=document.createElement('div');div.textContent=text??'';return div.innerHTML;}

  function showScreen(name){
    Object.values(screens).forEach(s=>s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    navBtns.forEach(b=>b.classList.toggle('active',b.dataset.screen===name));
    if(name==='home')renderSurveys();
    if(name==='targets')renderTargets();
  }

  // Nav delegation - RE-ADDED THIS CRITICAL BLOCK
  document.addEventListener('click',(e)=>{
    const el=e.target.closest('.nav-item');
    if(el){ showScreen(el.dataset.screen); }
  });

  function getOpenSurvey(){return data.surveys.find(s=>s.status==='Open'&&!s.archived)}
  function setOnlyOpen(id){data.surveys.forEach(s=>{s.status=(s.id===id)?'Open':(s.status==='Open'?'Closed':s.status)})}

  function createSurvey(name){
    setOnlyOpen(null);
    const s={id:uid('s_'),name:name||('Survey '+new Date().toLocaleString()),createdAt:Date.now(),status:'Open',archived:false,targets:[]};
    data.surveys.push(s);save();renderSurveys();return s;
  }

  function renderSurveys(){
    surveyListEl.innerHTML='';
    const open=data.surveys.filter(s=>s.status==='Open'&&!s.archived);
    const closed=data.surveys.filter(s=>s.status==='Closed'&&!s.archived);
    const archived=data.surveys.filter(s=>s.archived);
    const sortByDate=a=>a.sort((x,y)=>y.createdAt-x.createdAt);
    sortByDate(open).forEach(s=>addSurveyItem(s,'open'));
    sortByDate(closed).forEach(s=>addSurveyItem(s));
    if(archived.length){
      surveyListEl.innerHTML+='<div class="divider">📦 Archived Surveys</div>';
      sortByDate(archived).forEach(s=>addSurveyItem(s,'archived'));
    }
    if(!data.surveys.length){
      surveyListEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">No surveys yet. Create one to get started!</div>';
    }
  }

  function addSurveyItem(s,cls){
    const item=document.createElement('div');
    item.className='survey-item'+(cls?' '+cls:'');
    let actions='';
    if(s.archived){
      actions=`<button class="btn btn-secondary btn-sm" data-action="restore" data-id="${s.id}">Restore</button>`;
    }else{
      actions+=`<button class="btn btn-secondary btn-sm" data-action="view" data-id="${s.id}">View</button>`;
      if(s.status!=='Open')actions+=`<button class="btn btn-secondary btn-sm" data-action="open" data-id="${s.id}">Set Open</button>`;
      if(s.status==='Open')actions+=`<button class="btn btn-secondary btn-sm" data-action="close" data-id="${s.id}">Close</button>`;
      actions+=`<button class="btn btn-secondary btn-sm" data-action="archive" data-id="${s.id}">Archive</button>`;
      actions+=`<button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">Delete</button>`;
    }
    const statusBadge=s.status==='Open'?'<span class="badge badge-success">● Open</span>':'<span class="badge badge-muted">Closed</span>';
    item.innerHTML=`
      <div class="item-header">
        <div>
          <div class="item-title">${escapeHtml(s.name)}</div>
          <div class="item-meta">
            <span>${new Date(s.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>${s.targets.length} targets</span>
            <span>•</span>
            ${statusBadge}
          </div>
        </div>
      </div>
      <div class="item-actions">${actions}</div>
    `;
    surveyListEl.appendChild(item);
  }

  // survey actions
  surveyListEl.addEventListener('click',(e)=>{
    const btn=e.target.closest('button[data-action]'); if(!btn) return;
    const a=btn.dataset.action; const id=btn.dataset.id;
    const s=data.surveys.find(x=>x.id===id); if(!s) return;

    if(a==='view'){showScreen('targets');renderTargets();}
    if(a==='open'){setOnlyOpen(id);save();renderSurveys();showToast('✅ Set as open');}
    if(a==='close'){s.status='Closed';save();renderSurveys();showToast('🔒 Closed');}
    if(a==='archive'){s.archived=true;s.status='Closed';save();renderSurveys();showToast('📦 Archived');}
    if(a==='restore'){s.archived=false;s.status='Closed';save();renderSurveys();showToast('✅ Restored');}
    if(a==='delete'){
