import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getDatabase, ref, push, onValue, update, remove, child, get, off } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

const appConfig = {
  apiKey: "AIzaSy...vmuo",
  authDomain: "ainvested-703ec.firebaseapp.com",
  projectId: "ainvested-703ec",
  databaseURL: "https://ainvested-703ec-default-rtdb.asia-southeast1.firebasedatabase.app",
  appId: "1:453797298902:web:a54e8f9da3bf2b9daaff77"
};

let app, auth, db = null;
let firebaseOK = false;
try {
  app = initializeApp(appConfig);
  auth = getAuth(app);
  db  = getDatabase(app);
  firebaseOK = true;
} catch (e) {
  firebaseOK = false;
  console.warn('Firebase init failed, using local mode', e);
}

let uid='', partnerUid='', itemsKey='done_items', listeners=[];
function el(s){ return document.getElementById(s); }
function toast(m){ const t=el('toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }

function storeUid(u){ uid=u; try{ localStorage.setItem('done_uid',u); }catch(e){} }
function storePartner(u){ partnerUid=(u||''); try{ localStorage.setItem('done_partner',partnerUid); }catch(e){} }
function restorePartner(){ partnerUid = localStorage.getItem('done_partner')||''; return partnerUid; }

const qItems=el('new-item'), qCat=el('new-cat'), qAdd=el('btn-add');
const qList=el('list-card'), qTotal=el('total-items'), qDone=el('done-items');
const qChips=el('chip-group');
const qLinkPanel=el('link-panel'), qLinkInput=el('link-input'), qLinkAction=el('btn-link-action');
const qLinkedTo=el('linked-to'), qUidDisplay=el('uid-display'), qUnlink=el('btn-unlink');

let activeCat='All', offlineUid='';

function getOfflineUid(){
  if(offlineUid) return offlineUid;
  let u=localStorage.getItem('done_offline_uid');
  if(!u){ u='off_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); localStorage.setItem('done_offline_uid',u); }
  offlineUid=u; return u;
}

function loadItems(){ try{ return JSON.parse(localStorage.getItem(itemsKey)||'[]'); }catch(e){ return []; } }
function saveItems(arr){ try{ localStorage.setItem(itemsKey, JSON.stringify(arr)); }catch(e){} rebuild(); }

function pathFor(u){ return ref(db, `dones/${u}`); }

function startListening(){
  listeners.forEach(({dbRef,fn})=>{ try{ off(dbRef,'value',fn); }catch(e){} });
  listeners=[];
  if(!firebaseOK || !uid) return;
  listenTo(uid);
  if(partnerUid && partnerUid !== uid) listenTo(partnerUid);
}

function listenTo(u){
  if(!u) return;
  const r = pathFor(u);
  const fn = (snap)=>{
    const val = snap.val()||{};
    const incoming = Object.entries(val).map(([id,v])=>({id,name:v.name||'',cat:v.cat||'Misc',done:!!v.done,createdAt:v.createdAt||0,by:u,touched:Date.now()}));
    const own = loadItems().filter(i=>i.by !== u);
    const merged = [...own, ...incoming];
    try{ localStorage.setItem(itemsKey, JSON.stringify(merged)); }catch(e){}
    rebuild();
  };
  onValue(r, fn);
  listeners.push({dbRef:r,fn});
}

function rebuild(){
  const allItems = loadItems();
  const map=new Map();
  allItems.forEach(i=>{ const k=i.by+'::'+i.id; map.set(k,i); });
  const uniq=Array.from(map.values());
  const cats=new Set(uniq.map(i=>i.cat)); cats.add('All');
  renderChips(Array.from(cats));
  const filtered= activeCat==='All'? uniq : uniq.filter(i=>i.cat===activeCat);
  filtered.sort((a,b)=>{ if(a.done!==b.done) return a.done?1:-1; return (b.createdAt||0)-(a.createdAt||0); });
  renderList(filtered);
  qTotal.textContent=uniq.length;
  qDone.textContent=uniq.filter(i=>i.done).length;
}

function renderChips(cats){
  qChips.innerHTML='';
  cats.forEach(c=>{
    const b=document.createElement('button'); b.className='chip'+(activeCat===c?' active':'');
    const count = c==='All'? loadItems().length: loadItems().filter(i=>i.cat===c).length;
    b.innerHTML=esc(c)+'<span class="chip-badge">'+count+'</span>';
    b.onclick=()=>{ activeCat=c; rebuild(); };
    qChips.appendChild(b);
  });
}

function renderList(items){
  if(!items.length){ qList.innerHTML='<div style="text-align:center;color:var(--muted);padding:18px 0">No items yet.<br>Add something above.</div>'; return; }
  qList.innerHTML='';
  items.forEach(it=>{
    const row=document.createElement('div'); row.className='row';
    const circ=document.createElement('div'); circ.className='check'+(it.done?' on':''); circ.innerHTML='&#10003;';
    circ.onclick=()=>toggleItem(it);
    const name=document.createElement('div'); name.className='name'+(it.done?' done':''); name.textContent=it.name;
    const meta=document.createElement('div'); meta.className='meta'; meta.textContent=(it.by && it.by !== uid)?'partner':'mine';
    const cat=document.createElement('span'); cat.className='tag'; cat.textContent=it.cat||'Misc';
    const del=document.createElement('button'); del.className='btn btn-danger'; del.style.cssText='padding:4px 8px;border-radius:8px;font-size:12px'; del.textContent='Del';
del.onclick=()=>deleteItem(it);
    const act=document.createElement('div'); act.style.cssText='display:flex;gap:6px;align-items:center'; act.appendChild(meta); act.appendChild(cat); act.appendChild(del);
    row.appendChild(circ); row.appendChild(name); row.appendChild(act);
    qList.appendChild(row);
  });
}

function addItem(){
  const name=qItems.value.trim(); if(!name){ toast('Enter item name'); return; }
  const cat=(qCat.value.trim()||'Misc');
  const me = firebaseOK? uid : getOfflineUid();
  const item = { id:'_'+Date.now()+Math.random().toString(36).slice(2,6), name, cat, done:false, createdAt:Date.now(), by:me };
  const list = loadItems(); list.push(item); saveItems(list);
  toast(firebaseOK?'Saved to cloud':'Added (offline)');
  qItems.value=''; qCat.value=''; qItems.focus();
}
qAdd.onclick=addItem; qItems.onkeydown=e=>{ if(e.key==='Enter') addItem(); };
qCat.onkeydown=e=>{ if(e.key==='Enter') addItem(); };

function toggleItem(it){
  if(firebaseOK && it.by===uid){ const target=ref(db,`dones/${it.by}/${it.id}`); update(target,{done:!it.done}); }
  else if(firebaseOK && it.by !== uid){ toast("Can only toggle your own items"); return; }
  const list=loadItems().map(i=>i.id===it.id?{...i,done:!i.done}:i);
  saveItems(list);
}
function deleteItem(it){
  if(firebaseOK && uid && it.by===uid){ const target=ref(db,`dones/${it.by}/${it.id}`); remove(target); }
  const list=loadItems().filter(i=>i.id!==it.id);
  saveItems(list);
}

el('btn-clear').onclick=()=>{
  const done=loadItems().filter(i=>i.done);
  if(!done.length){ toast('Nothing to clear'); return; }
  if(firebaseOK){ done.forEach(it=>{ try{ remove(ref(db,`dones/${it.by}/${it.id}`)); }catch(e){} }); }
  saveItems(loadItems().filter(i=>!i.done));
  toast('Cleared '+done.length);
};

el('btn-link').onclick=()=>{
  qLinkPanel.style.display=qLinkPanel.style.display==='none'?'block':'none';
  updateHeader();
};
function updateHeader(){
  qUidDisplay.textContent = firebaseOK ? uid : getOfflineUid();
  if(partnerUid){ qLinkedTo.textContent='Linked to: '+partnerUid.slice(0,8)+'…'; qUnlink.style.display=''; }
  else { qLinkedTo.textContent='Not linked'; qUnlink.style.display='none'; }
}
qLinkAction.onclick=()=>{
  const p=(qLinkInput.value||'').trim(); if(!p){ toast('Paste a UID'); return; }
  if(!firebaseOK){ toast('Cloud sync not available'); return; }
  if(p===uid){ toast('Cannot link to yourself'); return; }
  get(child(ref(db),`dones/${p}`)).then(snap=>{
    if(!snap.exists()){ toast('No account found'); return; }
    storePartner(p); startListening(); toast('Linked!');
  }).catch(err=>toast('Link failed: '+(err.message||'')));
};
qUnlink.onclick=()=>{ storePartner(''); startListening(); toast('Unlinked'); };

function esc(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

// Boot
restorePartner();
if(firebaseOK){
  onAuthStateChanged(auth, user=>{
    if(user){ storeUid(user.uid); startListening(); toast('Online'); rebuild(); }
    else {
      signInAnonymously(auth).then(cred=>{ storeUid(cred.user.uid); startListening(); toast('Signed in'); })
      .catch(err=>{ console.error(err); toast('Auth failed — offline mode'); firebaseOK=false; rebuild(); });
    }
  });
} else {
  rebuild();
}
