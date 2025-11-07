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
  item.querySelectorAll('button').forEach(b=>b.addEventListener('click',surveyAction));
}

function surveyAction(e){
  const a=e.currentTarget.dataset.action;
  const id=e.currentTarget.dataset.id;
  const s=data.surveys.find(x=>x.id===id);
  if(!s)return;
  
  if(a==='view'){showScreen('targets');renderTargets();}
  if(a==='open'){setOnlyOpen(id);save();renderSurveys();showToast('✅ Set as open');}
  if(a==='close'){s.status='Closed';save();renderSurveys();showToast('🔒 Closed');}
  if(a==='archive'){s.archived=true;s.status='Closed';save();renderSurveys();showToast('📦 Archived');}
  if(a==='restore'){s.archived=false;s.status='Closed';save();renderSurveys();showToast('✅ Restored');}
  if(a==='delete'){
    if(!confirm('Delete this survey and all its targets? This cannot be undone.'))return;
    data.surveys=data.surveys.filter(x=>x.id!==id);
    save();renderSurveys();showToast('🗑️ Deleted');
  }
}

function renderTargets(){
  targetsListEl.innerHTML='';
  const open=getOpenSurvey();
  if(!open){
    targetsListEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">No open survey. Please create or open a survey on the Home screen.</div>';
    openSurveyNameEl.textContent='None';
    return;
  }
  
  openSurveyNameEl.textContent=open.name;
  
  if(!open.targets.length){
    targetsListEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">No targets yet. Add your first target!</div>';
    return;
  }
  
  open.targets.forEach(t=>{
    const item=document.createElement('div');
    item.className='target-item';
    
    const foundBadge=t.found?`<span class="badge badge-success">✓ Found${t.foundNote?' - '+escapeHtml(t.foundNote):''}</span>`:'<span class="badge badge-muted">Not found</span>';
    
    item.innerHTML=`
      <div class="item-header">
        <div style="flex:1">
          <div class="item-title">${escapeHtml(t.notes||'Target')}</div>
          <div class="target-coords">
            <div class="coord-item">
              <div class="coord-label">Latitude</div>
              <div class="coord-value">${t.lat.toFixed(6)}</div>
            </div>
            <div class="coord-item">
              <div class="coord-label">Longitude</div>
              <div class="coord-value">${t.lng.toFixed(6)}</div>
            </div>
          </div>
          <div style="margin-top:8px">${foundBadge}</div>
          ${t.description?`<div class="target-description">${escapeHtml(t.description)}</div>`:''}
          <div class="image-gallery" id="gallery-${t.id}"></div>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-primary btn-sm" data-action="goto" data-id="${t.id}">🧭 Navigate</button>
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${t.id}">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${t.id}">Delete</button>
      </div>
    `;
    
    targetsListEl.appendChild(item);
    
    const gallery=document.getElementById(`gallery-${t.id}`);
    if(t.images&&t.images.length){
      t.images.forEach((img,idx)=>{
        const wrapper=document.createElement('div');
        wrapper.className='gallery-image-wrapper';
        const imgEl=document.createElement('img');
        imgEl.src=img;
        imgEl.className='gallery-image';
        imgEl.dataset.target=t.id;
        imgEl.dataset.index=idx;
        imgEl.alt=`Find photo ${idx+1}`;
        wrapper.appendChild(imgEl);
        gallery.appendChild(wrapper);
      });
    }
    
    const addBtn=document.createElement('div');
    addBtn.className='add-image-btn';
    addBtn.textContent='+';
    addBtn.dataset.target=t.id;
    gallery.appendChild(addBtn);
  });
  
  targetsListEl.querySelectorAll('button').forEach(b=>b.addEventListener('click',targetAction));
  
  targetsListEl.querySelectorAll('.gallery-image').forEach(img=>{
    img.addEventListener('click',()=>{
      const targetId=img.dataset.target;
      const index=parseInt(img.dataset.index);
      const target=open.targets.find(t=>t.id===targetId);
      if(target&&target.images)openLightbox(target.images,index,target);
    });
  });
  
  targetsListEl.querySelectorAll('.add-image-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const targetId=btn.dataset.target;
      const target=open.targets.find(t=>t.id===targetId);
      if(target)addImageToTarget(target);
    });
  });
}

function targetAction(e){
  const a=e.currentTarget.dataset.action;
  const id=e.currentTarget.dataset.id;
  const open=getOpenSurvey();
  if(!open)return;
  const t=open.targets.find(x=>x.id===id);
  if(!t)return;
  
  if(a==='goto'){
    selectedTargetId=id;
    compassTargetName.textContent=t.notes||'Target';
    showScreen('compass');
    updateNavImmediate();
    showToast('🧭 Navigation started');
  }
  if(a==='edit'){
    showEditTargetModal(t);
  }
  if(a==='delete'){
    if(!confirm('Delete this target?'))return;
    open.targets=open.targets.filter(x=>x.id!==id);
    if(selectedTargetId===id)selectedTargetId=null;
    save();renderTargets();showToast('🗑️ Deleted');
  }
}

function showEditTargetModal(target){
  modalTitle.textContent='Edit Target';
  modalBody.innerHTML=`
    <div style="margin-bottom:16px">
      <label style="display:block;margin-bottom:8px;color:var(--muted);font-size:14px">Name</label>
      <input type="text" id="editName" value="${escapeHtml(target.notes||'')}" style="width:100%" />
    </div>
    <div style="margin-bottom:16px">
      <label style="display:block;margin-bottom:8px;color:var(--muted);font-size:14px">Description</label>
      <textarea id="editDesc" style="width:100%">${escapeHtml(target.description||'')}</textarea>
    </div>
  `;
  
  modal.classList.add('active');
  
  modalConfirm.onclick=()=>{
    target.notes=document.getElementById('editName').value;
    target.description=document.getElementById('editDesc').value;
    save();renderTargets();
    modal.classList.remove('active');
    showToast('✅ Updated');
  };
  
  modalCancel.onclick=()=>{
    modal.classList.remove('active');
  };
}

function addImageToTarget(target){
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.multiple=false;
  
  input.onchange=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    
    if(!target.images)target.images=[];
    
    showToast('📸 Processing image...');
    
    const reader=new FileReader();
    reader.onload=(ev)=>{
      target.images.push(ev.target.result);
      save();
      renderTargets();
      showToast('✅ Image added successfully');
    };
    reader.onerror=()=>{
      showToast('❌ Failed to process image');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function openLightbox(images,startIndex,target){
  currentLightboxImages=images;
  currentLightboxIndex=startIndex;
  currentLightboxTarget=target;
  showLightboxImage();
  lightbox.classList.add('active');
}

function showLightboxImage(){
  if(currentLightboxImages.length===0)return;
  lightboxImage.src=currentLightboxImages[currentLightboxIndex];
  lightboxCounter.textContent=`${currentLightboxIndex+1} / ${currentLightboxImages.length}`;
  
  lightboxPrev.style.display=currentLightboxImages.length>1?'flex':'none';
  lightboxNext.style.display=currentLightboxImages.length>1?'flex':'none';
}

lightboxClose.onclick=()=>lightbox.classList.remove('active');
lightbox.onclick=(e)=>{if(e.target===lightbox)lightbox.classList.remove('active')};
lightboxPrev.onclick=()=>{
  currentLightboxIndex=(currentLightboxIndex-1+currentLightboxImages.length)%currentLightboxImages.length;
  showLightboxImage();
};
lightboxNext.onclick=()=>{
  currentLightboxIndex=(currentLightboxIndex+1)%currentLightboxImages.length;
  showLightboxImage();
};

lightboxChange.onclick=()=>{
  if(!currentLightboxTarget)return;
  
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.multiple=false;
  input.onchange=async(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    
    lightbox.classList.remove('active');
    showToast('📸 Processing new image...');
    
    const reader=new FileReader();
    reader.onload=(ev)=>{
      currentLightboxTarget.images[currentLightboxIndex]=ev.target.result;
      save();
      renderTargets();
      showToast('✅ Image changed successfully');
    };
    reader.onerror=()=>{
      showToast('❌ Failed to process image');
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

lightboxDelete.onclick=()=>{
  if(!currentLightboxTarget)return;
  if(!confirm('Delete this image?'))return;
  
  currentLightboxTarget.images.splice(currentLightboxIndex,1);
  save();
  lightbox.classList.remove('active');
  renderTargets();
  showToast('🗑️ Image deleted');
};

btnAddTarget.onclick=()=>{
  const open=getOpenSurvey();
  if(!open){alert('⚠️ No open survey. Please create or open a survey first.');return;}
  if(!lastPosition){alert('⚠️ No GPS fix yet. Please wait for GPS signal.');return;}
  
  modalTitle.textContent='Add New Target';
  modalBody.innerHTML=`
    <div style="margin-bottom:16px">
      <label style="display:block;margin-bottom:8px;color:var(--muted);font-size:14px">Name (optional)</label>
      <input type="text" id="newTargetName" placeholder="e.g., Roman coin signal" style="width:100%" />
    </div>
    <div style="margin-bottom:16px">
      <label style="display:block;margin-bottom:8px;color:var(--muted);font-size:14px">Description (optional)</label>
      <textarea id="newTargetDesc" placeholder="Add notes about this location..." style="width:100%"></textarea>
    </div>
  `;
  
  modal.classList.add('active');
  
  modalConfirm.onclick=()=>{
    const name=document.getElementById('newTargetName').value||'';
    const desc=document.getElementById('newTargetDesc').value||'';
    
    const t={
      id:uid('t_'),
      lat:lastPosition.coords.latitude,
      lng:lastPosition.coords.longitude,
      notes:name,
      description:desc,
      detectorist:data.detectoristName||'',
      detector:data.detectorUsed||'',
      createdAt:Date.now(),
      found:false,
      images:[]
    };
    
    open.targets.push(t);
    save();renderTargets();
    modal.classList.remove('active');
    showToast('✅ Target added');
  };
  
  modalCancel.onclick=()=>{
    modal.classList.remove('active');
  };
};

btnBatch.onclick=()=>{
  const open=getOpenSurvey();
  if(!open){alert('⚠️ No open survey');return;}
  
  if(!batchInterval){
    btnBatch.innerHTML='⏹️ Stop Batch';
    btnBatch.classList.remove('btn-secondary');
    btnBatch.classList.add('btn-danger');
    batchInterval=setInterval(()=>{
      if(lastPosition){
        const t={
          id:uid('t_'),
          lat:lastPosition.coords.latitude,
          lng:lastPosition.coords.longitude,
          notes:'',
          description:'',
          detectorist:data.detectoristName||'',
          detector:data.detectorUsed||'',
          createdAt:Date.now(),
          found:false,
          images:[]
        };
        open.targets.push(t);
        save();renderTargets();
      }
    },3000);
    showToast('🔄 Batch mode started');
  }else{
    clearInterval(batchInterval);
    batchInterval=null;
    btnBatch.innerHTML='🔄 Batch Add';
    btnBatch.classList.remove('btn-danger');
    btnBatch.classList.add('btn-secondary');
    showToast('⏹️ Batch mode stopped');
  }
};

function toRad(v){return v*Math.PI/180}
function toDeg(v){return v*180/Math.PI}
function haversineMeters(lat1,lon1,lat2,lon2){
  const R=6371000;
  const dLat=toRad(lat2-lat1);
  const dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}
function bearingTo(lat1,lon1,lat2,lon2){
  const y=Math.sin(toRad(lon2-lon1))*Math.cos(toRad(lat2));
  const x=Math.cos(toRad(lat1))*Math.sin(toRad(lat2))-Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(toRad(lon2-lon1));
  return(toDeg(Math.atan2(y,x))+360)%360;
}

function handleOrientation(e){
  let head=null;
  if(typeof e.webkitCompassHeading==='number')head=e.webkitCompassHeading;
  else if(typeof e.alpha==='number')head=(360-e.alpha);
  if(head===null||isNaN(head))return;
  headingSamples.push((head+360)%360);
  if(headingSamples.length>HEADING_SMOOTH)headingSamples.shift();
  let x=0,y=0;
  headingSamples.forEach(h=>{x+=Math.cos(toRad(h));y+=Math.sin(toRad(h));});
  smoothedHeading=(toDeg(Math.atan2(y,x))+360)%360;
  headingEl.textContent=Math.round(smoothedHeading);
  // ADD THIS LINE:
  document.getElementById('headingText').textContent=Math.round(smoothedHeading)+'°';
}
function throttledNavUpdate(){
  const now=Date.now();
  if(now-lastNav>=NAV_INTERVAL_MS){
    lastNav=now;
    updateNavImmediate();
  }
}
setInterval(()=>{if(lastPosition)throttledNavUpdate()},NAV_INTERVAL_MS);

function updateNavImmediate(){
  const open=getOpenSurvey();
  if(!open||!selectedTargetId||!lastPosition)return;
  const t=open.targets.find(x=>x.id===selectedTargetId);
  if(!t)return;
  const lat=lastPosition.coords.latitude,lon=lastPosition.coords.longitude;
  const d=haversineMeters(lat,lon,t.lat,t.lng);
  const brg=bearingTo(lat,lon,t.lat,t.lng);
  bearingEl.textContent=Math.round(brg);
  compassTargetName.textContent=t.notes||'Target';
  const rel=((brg-smoothedHeading)+540)%360-180;
  arrowEl.style.transform=`rotate(${rel}deg)`;
  
  let direction='';
  if(rel>=-10&&rel<=10)direction='Straight ahead';
  else if(rel>10&&rel<=45)direction='Slight right';
  else if(rel>45&&rel<=90)direction='Right';
  else if(rel>90&&rel<=135)direction='Sharp right';
  else if(rel>135||rel<-135)direction='Behind you';
  else if(rel<-90&&rel>=-135)direction='Sharp left';
  else if(rel<-45&&rel>=-90)direction='Left';
  else if(rel<-10&&rel>=-45)direction='Slight left';
  bearingTextEl.textContent=`${direction} • ${Math.round(d)}m`;
  
  if(currentScreen==='compass'&&navigator.vibrate&&d<4&&!hasVibrated){
    navigator.vibrate([200,100,200]);
    hasVibrated=true;
    setTimeout(()=>{
      if(d>=5)hasVibrated=false;
    },5000);
  }
  if(d>=5)hasVibrated=false;
}

btnFirstTarget.onclick=()=>{
  const open=getOpenSurvey();
  if(!open){alert('⚠️ No open survey');return;}
  if(!open.targets.length){alert('⚠️ No targets');return;}
  selectedTargetId=open.targets[0].id;
  updateNavImmediate();
  showToast('⏮️ First target');
};

btnPrevTarget.onclick=()=>{
  const open=getOpenSurvey();
  if(!open){alert('⚠️ No open survey');return;}
  if(!open.targets.length){alert('⚠️ No targets');return;}
  if(!selectedTargetId){
    selectedTargetId=open.targets[0].id;
  }else{
    const idx=open.targets.findIndex(x=>x.id===selectedTargetId);
    if(idx>0){
      selectedTargetId=open.targets[idx-1].id;
    }else{
      selectedTargetId=open.targets[open.targets.length-1].id;
    }
  }
  updateNavImmediate();
  const t=open.targets.find(x=>x.id===selectedTargetId);
  showToast('◀️ '+(t.notes||'Target'));
};

btnNextTarget.onclick=()=>{
  const open=getOpenSurvey();
  if(!open){alert('⚠️ No open survey');return;}
  if(!open.targets.length){alert('⚠️ No targets');return;}
  if(!selectedTargetId){
    selectedTargetId=open.targets[0].id;
  }else{
    const idx=open.targets.findIndex(x=>x.id===selectedTargetId);
    if(idx<open.targets.length-1){
      selectedTargetId=open.targets[idx+1].id;
    }else{
      selectedTargetId=open.targets[0].id;
    }
  }
  updateNavImmediate();
  const t=open.targets.find(x=>x.id===selectedTargetId);
  showToast('▶️ '+(t.notes||'Target'));
};

btnLastTarget.onclick=()=>{
  const open=getOpenSurvey();
  if(!open){alert('⚠️ No open survey');return;}
  if(!open.targets.length){alert('⚠️ No targets');return;}
  selectedTargetId=open.targets[open.targets.length-1].id;
  updateNavImmediate();
  showToast('⏭️ Last target');
};

btnMarkFound.onclick=()=>{
  const open=getOpenSurvey();
  if(!open||!selectedTargetId){alert('⚠️ Select a target first');return;}
  const t=open.targets.find(x=>x.id===selectedTargetId);
  if(!t)return;
  
  modalTitle.textContent='Mark as Found';
  modalBody.innerHTML=`
    <div style="margin-bottom:16px">
      <label style="display:block;margin-bottom:8px;color:var(--muted);font-size:14px">What did you find?</label>
      <input type="text" id="foundWhat" value="${escapeHtml(t.foundNote||'')}" placeholder="e.g., Gold ring, Roman coin" style="width:100%" />
    </div>
    <div style="margin-bottom:16px">
      <label style="display:block;margin-bottom:8px;color:var(--muted);font-size:14px">Description</label>
      <textarea id="foundDesc" placeholder="Add details about your find..." style="width:100%">${escapeHtml(t.description||'')}</textarea>
    </div>
  `;
  
  modal.classList.add('active');
  
  modalConfirm.onclick=()=>{
    t.found=true;
    t.foundNote=document.getElementById('foundWhat').value;
    t.description=document.getElementById('foundDesc').value;
    save();renderTargets();
    modal.classList.remove('active');
    showToast('✅ Marked as found!');
    
    if(confirm('📸 Add photos of your find?')){
      addImageToTarget(t);
    }
  };
  
  modalCancel.onclick=()=>{
    modal.classList.remove('active');
  };
};

btnNewSurvey.onclick=()=>{
  const name=prompt('Survey name:','Field '+new Date().toLocaleDateString());
  if(!name)return;
  createSurvey(name);
  showToast('✨ Survey created');
};

btnNewSurveyAdd.onclick=()=>{
  if(!lastPosition){alert('⚠️ No GPS fix yet');return;}
  const name=prompt('Survey name:','Field '+new Date().toLocaleDateString());
  if(!name)return;
  const s=createSurvey(name);
  const note=prompt('First target name:','')||'';
  s.targets.push({
    id:uid('t_'),
    lat:lastPosition.coords.latitude,
    lng:lastPosition.coords.longitude,
    notes:note,
    description:'',
    detectorist:data.detectoristName||'',
    detector:data.detectorUsed||'',
    createdAt:Date.now(),
    found:false,
    images:[]
  });
  save();
  showToast('✅ Survey + target created');
};

btnCloseSurvey.onclick=()=>{
  const o=getOpenSurvey();
  if(!o){alert('⚠️ No open survey');return;}
  if(!confirm('Close the current survey?'))return;
  o.status='Closed';
  save();renderSurveys();
  showToast('🔒 Survey closed');
};

btnExport.onclick=()=>{
  const txt=JSON.stringify(data,null,2);
  const blob=new Blob([txt],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`metal_finder_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},2000);
  showToast('💾 Data exported');
};

btnImport.onclick=()=>importFileEl.click();

importFileEl.onchange=async e=>{
  const f=e.target.files[0];
  if(!f)return;
  try{
    const txt=await f.text();
    const obj=JSON.parse(txt);
    if(obj&&obj.surveys){
      if(!confirm('Import data? This will merge with existing data.'))return;
      data=obj;
      save();
      renderSurveys();
      showToast('✅ Data imported');
    }else{
      alert('Invalid data format');
    }
  }catch(err){
    alert('Import failed: '+err.message);
  }
};

btnClear.onclick=()=>{
  if(!confirm('⚠️ Clear ALL data? This cannot be undone!'))return;
  if(!confirm('Are you absolutely sure?'))return;
  data={surveys:[]};
  save();
  renderSurveys();
  showToast('🗑️ All data cleared');
};

detectoristNameEl.value=data.detectoristName||'';
detectorUsedEl.value=data.detectorUsed||'';
detectoristNameEl.oninput=()=>{data.detectoristName=detectoristNameEl.value;save()};
detectorUsedEl.oninput=()=>{data.detectorUsed=detectorUsedEl.value;save()};

function startGPS(){
  if(!navigator.geolocation){
    document.getElementById('gpsText').textContent='Not supported';
    return;
  }
  watchId=navigator.geolocation.watchPosition(p=>{
    lastPosition=p;
    document.getElementById('gpsText').textContent='Locked';
    document.getElementById('accText').textContent=(p.coords.accuracy||0).toFixed(1)+'m';
    throttledNavUpdate();
  },err=>{
    document.getElementById('gpsText').textContent='No signal';
  },{enableHighAccuracy:true,maximumAge:1000,timeout:10000});
}

renderSurveys();
startGPS();
initializeCompass();
});
