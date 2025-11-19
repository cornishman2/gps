/* script.js - all logic with resilient event listeners */
(() => {
  'use strict';

  const STORAGE_KEY='metal_finder_v4_data';
  const NAV_INTERVAL_MS=500;
  const HEADING_SMOOTH=6;
  const THUMBNAILS_PER_ROW=2; // New constant for thumbnail layout

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
  
  // NEW Gallery Modal elements
  const modal = $('#modal');
  const modalImage = $('#modalImage');
  const btnModalPrev = $('#btnModalPrev');
  const btnModalNext = $('#btnModalNext');
  const btnModalDelete = $('#btnModalDelete');
  const btnModalReplace = $('#btnModalReplace');
  const modalTargetName = $('#modalTargetName');
  
  let data=load();
  data.surveys=data.surveys||[];
  let lastPosition=null;
  let batchInterval=null;
  let selectedTargetId=null;
  let headingSamples=[];
  let smoothedHeading=0;
  let lastNav=0;
  let hasVibrated=false;
  
  // NEW Gallery state
  let activeGallery={target:null, index:0}; // Tracks target and current image index in modal

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

  // Nav delegation 
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
      if(!confirm('Delete this survey and all its targets? This cannot be undone.'))return;
      data.surveys=data.surveys.filter(x=>x.id!==id);
      save();renderSurveys();showToast('🗑️ Deleted');
    }
  });

  // quick buttons
  btnNewSurvey.addEventListener('click',()=>{
    const name=prompt('Survey name:','Field '+new Date().toLocaleDateString());
    if(!name)return; createSurvey(name); showToast('✨ Survey created');
  });
  btnNewSurveyAdd.addEventListener('click',()=>{
    if(!lastPosition){alert('⚠️ No GPS fix yet');return;}
    const name=prompt('Survey name:','Field '+new Date().toLocaleDateString()); if(!name)return;
    const s=createSurvey(name);
    const note=prompt('First target name:','')||'';
    s.targets.push({id:uid('t_'),lat:lastPosition.coords.latitude,lng:lastPosition.coords.longitude,notes:note,description:'',createdAt:Date.now(),found:false,images:[]});
    save(); showToast('✅ Survey + target created');
  });
  btnCloseSurvey.addEventListener('click',()=>{
    const o=getOpenSurvey(); if(!o){alert('⚠️ No open survey');return;}
    if(!confirm('Close the current survey?'))return;
    o.status='Closed'; save(); renderSurveys(); showToast('🔒 Survey closed');
  });

  // targets
  function renderTargets(){
    targetsListEl.innerHTML='';
    const open=getOpenSurvey();
    if(!open){ targetsListEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">No open survey.</div>'; openSurveyNameEl.textContent='None'; return; }
    openSurveyNameEl.textContent=open.name;
    if(!open.targets.length){ targetsListEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">No targets yet.</div>'; return; }
    open.targets.forEach(t=>{
      const item=document.createElement('div');
      item.className='target-item';
      const foundBadge=t.found?`<span class="badge badge-success">✓ Found${t.foundNote?' - '+escapeHtml(t.foundNote):''}</span>`:'<span class="badge badge-muted">Not found</span>';
      
      // NEW: Generate thumbnail grid for the target
      let thumbnailsHtml = '';
      if(t.images && t.images.length > 0) {
        thumbnailsHtml = '<div class="image-gallery-grid" style="grid-template-columns: repeat('+THUMBNAILS_PER_ROW+', 1fr);">';
        t.images.forEach((img, index) => {
          thumbnailsHtml += `<div class="image-thumbnail" data-action="view-image" data-target-id="${t.id}" data-index="${index}" style="background-image: url('${img}');"></div>`;
        });
        thumbnailsHtml += '</div>';
      }

      item.innerHTML=`
        <div class="item-header">
          <div style="flex:1">
            <div class="item-title">${escapeHtml(t.notes||'Target')}</div>
            <div style="font-size:13px; color:var(--muted); margin-top:4px">${escapeHtml(t.description||'No description provided.')}</div>
            <div class="target-coords">
              <div class="coord-item"><div class="coord-label">Latitude</div><div class="coord-value">${t.lat.toFixed(6)}</div></div>
              <div class="coord-item"><div class="coord-label">Longitude</div><div class="coord-value">${t.lng.toFixed(6)}</div></div>
            </div>
            <div style="margin-top:8px">${foundBadge}</div>
            <div class="image-gallery" id="gallery-${t.id}">${thumbnailsHtml}</div>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary btn-sm" data-action="goto" data-id="${t.id}">🧭 Navigate</button>
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${t.id}">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${t.id}">Delete</button>
        </div>
      `;
      targetsListEl.appendChild(item);
      
      // Re-add the '+' button logic for adding images
      const gallery=$('#gallery-'+t.id);
      const addBtn=document.createElement('div');
      addBtn.className='add-image-btn';
      addBtn.textContent='📸 +'; 
      addBtn.dataset.target=t.id;
      gallery.appendChild(addBtn);
    });
  }
  renderSurveys();

  targetsListEl.addEventListener('click',(e)=>{
    // Handle button actions (goto, edit, delete)
    const btn=e.target.closest('button[data-action]');
    if(btn){
      const a=btn.dataset.action; const id=btn.dataset.id;
      const open=getOpenSurvey(); if(!open) return;
      const t=open.targets.find(x=>x.id===id); if(!t) return;

      if(a==='goto'){ selectedTargetId=id; showScreen('compass'); compassTargetName.textContent=t.notes||'Target'; updateNavImmediate(); showToast('🧭 Navigation started'); }
      if(a==='edit'){
        const newName=prompt('Name', t.notes||''); if(newName!==null) t.notes=newName;
        const newDesc=prompt('Description', t.description||''); if(newDesc!==null) t.description=newDesc;
        save(); renderTargets(); showToast('✅ Updated');
      }
      if(a==='delete'){
        if(!confirm('Delete this target?'))return;
        open.targets=open.targets.filter(x=>x.id!==id);
        if(selectedTargetId===id)selectedTargetId=null;
        save(); renderTargets(); showToast('🗑️ Deleted');
      }
    }
    
    // Handle clicking the '+' button to add images
    const add=e.target.closest('.add-image-btn');
    if(add){
      const open=getOpenSurvey();
      const target=open?.targets.find(t=>t.id===add.dataset.target);
      if(target) addImageToTarget(target);
    }
    
    // NEW: Handle clicking a thumbnail to view the gallery
    const thumbnail = e.target.closest('.image-thumbnail');
    if(thumbnail) {
      const targetId = thumbnail.dataset.targetId;
      const imageIndex = parseInt(thumbnail.dataset.index, 10);
      const open = getOpenSurvey();
      const target = open.targets.find(t => t.id === targetId);
      if (target) showGallery(target, imageIndex);
    }
  });

  // REVISED btnAddTarget BLOCK to include image prompt
  btnAddTarget.addEventListener('click',async ()=>{
      const open=getOpenSurvey(); 
      if(!open){
          alert('⚠️ No open survey');
          return;
      }
      if(!lastPosition){
          alert('⚠️ No GPS fix yet');
          return;
      }
      
      // 1. Prompt for Target Name (Notes)
      const defaultName = new Date().toLocaleString();
      const notes=prompt('Target Name (e.g., Target, Find, Signal):', defaultName);
      if(notes===null) return; 
      
      // 2. Prompt for Target Description
      const description=prompt('Target Description/Details (e.g., VDI, Depth, Ground Conditions):', '');
      if(description===null) return; 
      
      // 3. Create initial target
      const t={
          id:uid('t_'),
          lat:lastPosition.coords.latitude,
          lng:lastPosition.coords.longitude,
          notes:notes, 
          description:description,
          createdAt:Date.now(),
          found:false,
          images:[]
      };
      
      // 4. Prompt for images (non-blocking)
      await new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file'; 
        input.accept = 'image/*'; 
        input.multiple = true; // Allow multiple files
        
        input.onchange = async (e) => {
          for(const file of e.target.files) {
            const base64 = await readFileAsBase64(file);
            t.images.push(base64);
          }
          resolve();
        };
        input._resolve = resolve; // Save resolve for potential cancel
        input.click();
        // Note: Cannot easily detect file dialog cancellation in all browsers, 
        // so we rely on the user confirming or just continuing with 0 files.
      });

      // 5. Save and render
      open.targets.push(t); 
      save(); 
      renderTargets(); 
      showToast('✅ Target added');
  });
  
  // Utility to read file as Base64 (needed for the new async workflow)
  function readFileAsBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.readAsDataURL(file);
    });
  }

  btnBatch.addEventListener('click',()=>{
    const open=getOpenSurvey(); if(!open){alert('⚠️ No open survey');return;}
    if(!batchInterval){
      btnBatch.innerHTML='⏹️ Stop Batch';
      batchInterval=setInterval(()=>{
        if(lastPosition){
          open.targets.push({id:uid('t_'),lat:lastPosition.coords.latitude,lng:lastPosition.coords.longitude,notes:'',description:'',createdAt:Date.now(),found:false,images:[]});
          save(); renderTargets();
        }
      },3000);
    }else{
      clearInterval(batchInterval); batchInterval=null; btnBatch.innerHTML='🔄 Batch Add';
    }
  });

  // Images
  function addImageToTarget(target){
    const input=document.createElement('input');
    input.type='file'; 
    input.accept='image/*'; 
    input.multiple = true; // Allow multiple files
    
    input.onchange=async (e)=>{
      for(const file of e.target.files) {
        const base64 = await readFileAsBase64(file);
        if(!target.images) target.images=[]; 
        target.images.push(base64); 
      }
      save(); renderTargets(); 
    };
    input.click();
  }
  
  // NEW: Gallery Modal Logic
  function showGallery(target, index) {
    if(!target || !target.images || target.images.length === 0) return;
    
    activeGallery.target = target;
    activeGallery.index = index;
    
    updateGalleryModal();
    modal.classList.add('active'); // Assume modal visibility is handled by CSS class 'active'
  }
  
  function updateGalleryModal() {
    const { target, index } = activeGallery;
    if (!target || !target.images) return;
    
    const total = target.images.length;
    const currentImage = target.images[index];

    // Update image and counter
    modalImage.src = currentImage;
    modalTargetName.textContent = `${target.notes || 'Target'} (${index + 1} of ${total})`;

    // Update navigation buttons state
    btnModalPrev.disabled = index === 0;
    btnModalNext.disabled = index === total - 1;
    
    // Ensure the modal is visible (using 'active' class from assumed CSS)
    modal.style.display = 'flex'; 
  }

  // Modal close button listener (assuming #modalCancel is the close button)
  $('#modalCancel').addEventListener('click', () => {
    modal.classList.remove('active');
    modal.style.display = 'none'; // Explicitly hide the modal
    activeGallery.target = null;
  });

  // Modal navigation listeners
  btnModalPrev.addEventListener('click', () => {
    if (activeGallery.index > 0) {
      activeGallery.index--;
      updateGalleryModal();
    }
  });

  btnModalNext.addEventListener('click', () => {
    if (activeGallery.index < activeGallery.target.images.length - 1) {
      activeGallery.index++;
      updateGalleryModal();
    }
  });

  // Modal delete listener
  btnModalDelete.addEventListener('click', () => {
    const { target, index } = activeGallery;
    if (target && confirm('Are you sure you want to delete this picture?')) {
      target.images.splice(index, 1);
      save();
      
      if (target.images.length === 0) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      } else {
        // Adjust index if necessary (e.g., delete last image)
        activeGallery.index = Math.max(0, index - 1);
        updateGalleryModal();
      }
      renderTargets(); // Update the target list view
      showToast('🗑️ Picture deleted');
    }
  });
  
  // Modal replace listener
  btnModalReplace.addEventListener('click', () => {
    const { target, index } = activeGallery;
    if (!target) return;
    
    const input = document.createElement('input');
    input.type = 'file'; 
    input.accept = 'image/*'; 
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if(file) {
        const base64 = await readFileAsBase64(file);
        target.images[index] = base64; // Replace the image data
        save();
        updateGalleryModal();
        renderTargets();
        showToast('🔄 Picture replaced');
      }
    };
    input.click();
  });

  // Export/Import/Clear
  btnExport.addEventListener('click',()=>{
    const txt=JSON.stringify(data,null,2);
    const blob=new Blob([txt],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='metal_finder_export.json';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},500);
  });
  btnImport.addEventListener('click',()=>importFileEl.click());
  importFileEl.addEventListener('change', async (e)=>{
    const f=e.target.files[0]; if(!f)return;
    const txt=await f.text();
    try{ const obj=JSON.parse(txt); if(obj&&obj.surveys){ data=obj; save(); renderSurveys(); } else alert('Invalid data'); }
    catch(err){ alert('Import failed: '+err.message); }
  });
  btnClear.addEventListener('click',()=>{ if(confirm('Clear ALL data?')){ data={surveys:[]}; save(); renderSurveys(); }});

  // Settings
  detectoristNameEl.value=data.detectoristName||'';
  detectorUsedEl.value=data.detectorUsed||'';
  detectoristNameEl.addEventListener('input',()=>{data.detectoristName=detectoristNameEl.value;save()});
  detectorUsedEl.addEventListener('input',()=>{data.detectorUsed=detectorUsedEl.value;save()});

  // GPS
  function startGPS(){
    if(!navigator.geolocation){ $('#gpsText').textContent='Not supported'; return; }
    navigator.geolocation.watchPosition(p=>{
      lastPosition=p;
      $('#gpsText').textContent='Locked';
      $('#accText').textContent=(p.coords.accuracy||0).toFixed(1)+'m';
      throttledNavUpdate();
    },()=>{$('#gpsText').textContent='No signal';},{enableHighAccuracy:true,maximumAge:1000,timeout:10000});
  }
  startGPS();

  // Compass math
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
    return (toDeg(Math.atan2(y,x))+360)%360;
  }

  function handleOrientation(e){
    let head=null;
    if(typeof e.webkitCompassHeading==='number')head=e.webkitCompassHeading;
    else if(typeof e.alpha==='number')head=(360-e.alpha);
    if(head===null||isNaN(head))return;
    if(head<0) head+=360;
    if(head>=360) head-=360;
    headingSamples.push(head);
    if(headingSamples.length>HEADING_SMOOTH)headingSamples.shift();
    let x=0,y=0;
    for(const h of headingSamples){ x+=Math.cos(toRad(h)); y+=Math.sin(toRad(h)); }
    smoothedHeading=(toDeg(Math.atan2(y,x))+360)%360;
    headingEl.textContent=Math.round(smoothedHeading);
  }
  if(window.DeviceOrientationEvent){ window.addEventListener('deviceorientation',handleOrientation); }

  function throttledNavUpdate(){
    const now=Date.now();
    if(now-lastNav>=NAV_INTERVAL_MS){ lastNav=now; updateNavImmediate(); }
  }
  setInterval(()=>{ if(lastPosition)throttledNavUpdate(); }, NAV_INTERVAL_MS);

  function updateNavImmediate(){
    const open=getOpenSurvey();
    if(!open||!selectedTargetId||!lastPosition) return;
    const t=open.targets.find(x=>x.id===selectedTargetId); if(!t) return;
    const lat=lastPosition.coords.latitude, lon=lastPosition.coords.longitude;
    const d=haversineMeters(lat,lon,t.lat,t.lng);
    const brg=bearingTo(lat,lon,t.lat,t.lng);
    if(bearingEl) bearingEl.textContent=Math.round(brg);
    if(compassTargetName) compassTargetName.textContent=t.notes||'Target';
    const rel=((brg-smoothedHeading)+540)%360-180;
    if(arrowEl) arrowEl.style.transform=`rotate(${rel}deg)`;
    let direction='';
    if(rel>=-10&&rel<=10)direction='Straight ahead';
    else if(rel>10&&rel<=45)direction='Slight right';
    else if(rel>45&&rel<=90)direction='Right';
    else if(rel>90&&rel<=135)direction='Sharp right';
    else if(rel>135||rel<-135)direction='Behind you';
    else if(rel<-90&&rel>=-135)direction='Sharp left';
    else if(rel<-45&&rel>=-90)direction='Left';
    else if(rel<-10&&rel>=-45)direction='Slight left';
    if(bearingTextEl) bearingTextEl.textContent=`${direction} • ${Math.round(d)}m`;
  }

  // Compass controls
  $('#btnFirstTarget').addEventListener('click',()=>{
    const open=getOpenSurvey(); if(!open||!open.targets.length){alert('⚠️ No targets');return;}
    selectedTargetId=open.targets[0].id; showScreen('compass'); updateNavImmediate();
  });
  $('#btnPrevTarget').addEventListener('click',()=>{
    const open=getOpenSurvey(); if(!open||!open.targets.length){alert('⚠️ No targets');return;}
    if(!selectedTargetId){selectedTargetId=open.targets[0].id;}
    else{
      const idx=open.targets.findIndex(x=>x.id===selectedTargetId);
      selectedTargetId = idx>0 ? open.targets[idx-1].id : open.targets[open.targets.length-1].id;
    }
    showScreen('compass'); updateNavImmediate();
  });
  $('#btnNextTarget').addEventListener('click',()=>{
    const open=getOpenSurvey(); if(!open||!open.targets.length){alert('⚠️ No targets');return;}
    if(!selectedTargetId){selectedTargetId=open.targets[0].id;}
    else{
      const idx=open.targets.findIndex(x=>x.id===selectedTargetId);
      selectedTargetId = idx<open.targets.length-1 ? open.targets[idx+1].id : open.targets[0].id;
    }
    showScreen('compass'); updateNavImmediate();
  });
  $('#btnLastTarget').addEventListener('click',()=>{
    const open=getOpenSurvey(); if(!open||!open.targets.length){alert('⚠️ No targets');return;}
    selectedTargetId=open.targets[open.targets.length-1].id; showScreen('compass'); updateNavImmediate();
  });
  $('#btnMarkFound').addEventListener('click',()=>{
    const open=getOpenSurvey(); if(!open||!selectedTargetId){alert('⚠️ Select a target first');return;}
    const t=open.targets.find(x=>x.id===selectedTargetId); if(!t)return;
    const what=prompt('What did you find?', t.foundNote||''); if(what===null) return;
    const desc=prompt('Add details', t.description||''); if(desc===null) return;
    t.found=true; t.foundNote=what; t.description=desc; save(); renderTargets();
  });

})();
