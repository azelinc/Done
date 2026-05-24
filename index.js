import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, update, remove, child, get, off } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

const CFG = {
  apiKey: "AIzaSyC2fezwrXSOeDCytG84RES-dJ04teLvmuo",
  authDomain: "ainvested-703ec.firebaseapp.com",
  projectId: "ainvested-703ec",
  databaseURL: "https://ainvested-703ec-default-rtdb.asia-southeast1.firebasedatabase.app",
  appId: "1:453797298902:web:a54e8f9da3bf2b9daaff77"
};

let app, auth, db;
let firebaseOK = false;
try {
  app = initializeApp(CFG);
  auth = getAuth(app);
  db  = getDatabase(app);
  firebaseOK = true;
} catch (e) {
  firebaseOK = false;
  console.warn('Firebase init failed', e);
}

// ── DOM refs ──
function el(s) { return document.getElementById(s); }
function toast(m) { const t = el('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }

// login panel
const qLoginEmail = el('login-email'), qLoginPass = el('login-password'), qLoginErr = el('login-error');
const qBtnLogin = el('btn-login'), qBtnSignup = el('btn-signup');
const qLoginPanel = el('login-panel');
// main panel
const qMainPanel = el('main-panel'), qUserDisp = el('user-email-display');
const qItems = el('new-item'), qCat = el('new-cat'), qAdd = el('btn-add');
const qList  = el('list-card'),  qTotal = el('total-items'), qDone = el('done-items');
const qChips = el('chip-group');
const qLinkPanel = el('link-panel'), qLinkInput = el('link-input'), qLinkAction = el('btn-link-action');
const qLinkedTo = el('linked-to'), qUidDisplay = el('uid-display'), qUnlink = el('btn-unlink');
const qLogout  = el('btn-logout'),  qLinkBtn = el('btn-link');

// ── State ──
let uid = '', partnerUid = '', itemsKey = 'done_items', listeners = [], activeCat = 'All';

function storeUid(u) { uid = u; try { localStorage.setItem('done_uid', u); } catch(e){} }
function storePartner(u) { partnerUid = (u || ''); try { localStorage.setItem('done_partner', partnerUid); } catch(e){} }
function restorePartner() { partnerUid = localStorage.getItem('done_partner') || ''; return partnerUid; }

restorePartner();

// ── Data helpers ──
function loadItems() { try { return JSON.parse(localStorage.getItem(itemsKey) || '[]'); } catch(e) { return []; } }
function saveItems(arr) { try { localStorage.setItem(itemsKey, JSON.stringify(arr)); } catch(e){} rebuild(); }

function pathFor(u) { return ref(db, `users/${u}/done`); }

function startListening() {
  listeners.forEach(({ dbRef, fn }) => { try { off(dbRef, 'value', fn); } catch(e){} });
  listeners = [];
  if (!firebaseOK || !uid) return;
  listenTo(uid);
  if (partnerUid && partnerUid !== uid) listenTo(partnerUid);
}

function listenTo(u) {
  if (!u) return;
  const r = pathFor(u);
  const fn = (snap) => {
    const val = snap.val() || {};
    const incoming = Object.entries(val).map(([id, v]) => ({
      id, name: v.name || '', cat: v.cat || 'Misc', done: !!v.done,
      createdAt: v.createdAt || 0, by: u
    }));
    const local = loadItems().filter(i => i.by !== u);
    saveItems([...local, ...incoming]);
  };
  onValue(r, fn);
  listeners.push({ dbRef: r, fn });
}

// ── Rebuild UI ──
function rebuild() {
  const all = loadItems();
  const map = new Map();
  all.forEach(i => { map.set(i.by + '::' + i.id, i); });
  const uniq = Array.from(map.values());

  const cats = new Set(uniq.map(i => i.cat));
  cats.add('All');
  renderChips(Array.from(cats));

  const filtered = activeCat === 'All' ? uniq : uniq.filter(i => i.cat === activeCat);
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  renderList(filtered);
  qTotal.textContent = uniq.length;
  qDone.textContent = uniq.filter(i => i.done).length;
}

function renderChips(cats) {
  qChips.innerHTML = '';
  cats.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (activeCat === c ? ' active' : '');
    const count = c === 'All' ? loadItems().length : loadItems().filter(i => i.cat === c).length;
    b.innerHTML = esc(c) + '<span class="chip-badge">' + count + '</span>';
    b.onclick = () => { activeCat = c; rebuild(); };
    qChips.appendChild(b);
  });
}

function renderList(items) {
  if (!items.length) {
    qList.innerHTML = '<div style="text-align:center;color:var(--muted);padding:18px 0">No items yet.<br>Add something above.</div>';
    return;
  }
  qList.innerHTML = '';
  items.forEach(it => {
    const row = document.createElement('div'); row.className = 'row';
    const circ = document.createElement('div'); circ.className = 'check' + (it.done ? ' on' : ''); circ.innerHTML = '&#10003;';
    circ.onclick = () => toggleItem(it);
    const name = document.createElement('div'); name.className = 'name' + (it.done ? ' done' : ''); name.textContent = it.name;
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = (it.by && it.by !== uid) ? 'partner' : 'mine';
    const cat = document.createElement('span'); cat.className = 'tag'; cat.textContent = it.cat || 'Misc';
    const del = document.createElement('button'); del.className = 'btn btn-danger'; del.style.cssText = 'padding:4px 8px;border-radius:8px;font-size:12px'; del.textContent = 'Del';
    del.onclick = () => deleteItem(it);
    const act = document.createElement('div'); act.style.cssText = 'display:flex;gap:6px;align-items:center';
    act.appendChild(meta); act.appendChild(cat); act.appendChild(del);
    row.appendChild(circ); row.appendChild(name); row.appendChild(act);
    qList.appendChild(row);
  });
}

// ── Item actions ──
function addItem() {
  const name = qItems.value.trim(); if (!name) { toast('Enter item name'); return; }
  const cat = (qCat.value.trim() || 'Misc');
  const ts = Date.now();

  // Generate Firebase key first (syncs local + remote IDs)
  const r = firebaseOK ? push(pathFor(uid)) : null;
  const id = r ? r.key : ('_' + ts + Math.random().toString(36).slice(2, 6));
  const item = { id: id, name, cat, done: false, createdAt: ts, by: uid };

  const list = loadItems();
  list.push(item);
  saveItems(list);

  if (r) {
    set(r, { name, cat, done: false, createdAt: ts, by: uid })
      .catch(e => console.error('Push failed:', e));
  }
  toast('Added');
  qItems.value = ''; qCat.value = ''; qItems.focus();
}

function toggleItem(it) {
  const newDone = !it.done;
  const list = loadItems().map(i => i.id === it.id ? { ...i, done: newDone } : i);
  saveItems(list);
  if (firebaseOK && uid) {
    set(ref(db, 'users/' + uid + '/done/' + it.id), { name: it.name, cat: it.cat, done: newDone, createdAt: it.createdAt, by: uid })
      .catch(e => console.error('Toggle sync failed:', e));
  }
}

function deleteItem(it) {
  const list = loadItems().filter(i => i.id !== it.id);
  saveItems(list);
  if (firebaseOK && uid) {
    remove(ref(db, 'users/' + uid + '/done/' + it.id))
      .catch(e => console.error('Delete sync failed:', e));
  }
}

// ── Event bindings (main panel) ──
qAdd.onclick = addItem;
qItems.onkeydown = e => { if (e.key === 'Enter') addItem(); };
qCat.onkeydown = e => { if (e.key === 'Enter') addItem(); };

el('btn-clear').onclick = () => {
  const done = loadItems().filter(i => i.done);
  if (!done.length) { toast('Nothing to clear'); return; }
  if (firebaseOK) {
    done.forEach(function(it) { try { remove(ref(db, 'users/' + uid + '/done/' + it.id)).catch(function(e){ console.error(e); }); } catch(e){} });
  }
  saveItems(loadItems().filter(i => !i.done));
  toast('Cleared ' + done.length);
};

qLinkBtn.onclick = () => {
  qLinkPanel.style.display = qLinkPanel.style.display === 'none' ? 'block' : 'none';
  updateHeader();
};

function updateHeader() {
  qUidDisplay.textContent = uid || '...';
  if (partnerUid) {
    qLinkedTo.textContent = 'Linked to: ' + partnerUid.slice(0, 12) + '...';
    qUnlink.style.display = '';
  } else {
    qLinkedTo.textContent = 'Not linked';
    qUnlink.style.display = 'none';
  }
}
// Copy UID
el('btn-copy-uid').onclick = () => {
  if (!uid) return;
  navigator.clipboard.writeText(uid).then(() => toast('UID copied'))
    .catch(() => toast('Tap and select to copy manually'));
};

qLinkAction.onclick = () => {
  var raw = (qLinkInput.value || '').trim();
  if (!raw) { toast('Enter email or UID'); return; }
  if (!firebaseOK) { toast('Cloud sync not available'); return; }

  function doLink(partnerId) {
    if (partnerId === uid) { toast('Cannot link to yourself'); return; }
    storePartner(partnerId);
    startListening();
    qLinkInput.value = '';
    toast('Linked!');
  }

  if (raw.indexOf('@') !== -1) {
    var sanitized = raw.replace(/\./g, ',');
    get(child(ref(db), 'users/emails/' + sanitized)).then(function(snap) {
      if (!snap.exists()) { toast('Email not found. Ask partner to log in first.'); return; }
      doLink(snap.val());
    }).catch(function(err) { toast('Lookup failed: ' + (err.message || '')); });
  } else {
    get(child(ref(db), 'users/' + raw + '/done')).then(function(snap) {
      if (!snap.exists()) { toast('No account found with that UID'); return; }
      doLink(raw);
    }).catch(function(err) { toast('Link failed: ' + (err.message || '')); });
  }
};

qUnlink.onclick = () => {
  storePartner('');
  startListening();
  toast('Unlinked');
};

qLogout.onclick = () => {
  storeUid('');
  storePartner('');
  signOut(auth).catch(() => {});
};

// ── Auth handlers ──
function showLogin() {
  qLoginPanel.classList.remove('hidden');
  qMainPanel.classList.add('hidden');
}
function showMain(user) {
  qLoginPanel.classList.add('hidden');
  qMainPanel.classList.remove('hidden');
  uid = user.uid;
  storeUid(uid);
  qUserDisp.textContent = '— ' + (user.email || uid.slice(0, 8));
  restorePartner();
  startListening();
  rebuild();
  updateHeader();
  // Store email UID mapping for partner lookup
  if (firebaseOK && user.email) {
    var es = user.email.replace(/\./g, ',');
    set(ref(db, 'users/emails/' + es), uid).catch(function(){});
  }
}

function authError(e) {
  const msg = (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password')
    ? 'Wrong email or password'
    : (e.code === 'auth/email-already-in-use')
    ? 'Email already registered. Sign in instead.'
    : (e.code === 'auth/weak-password')
    ? 'Password must be at least 6 characters'
    : e.message;
  qLoginErr.textContent = msg;
}

qBtnLogin.onclick = () => {
  const email = qLoginEmail.value.trim();
  const pass  = qLoginPass.value;
  if (!email || !pass) { qLoginErr.textContent = 'Enter email and password'; return; }
  qLoginErr.textContent = '';
  qBtnLogin.disabled = qBtnSignup.disabled = true;
  signInWithEmailAndPassword(auth, email, pass)
    .catch(e => { authError(e); qBtnLogin.disabled = qBtnSignup.disabled = false; });
};

qBtnSignup.onclick = () => {
  const email = qLoginEmail.value.trim();
  const pass  = qLoginPass.value;
  if (!email || !pass) { qLoginErr.textContent = 'Enter email and password'; return; }
  if (pass.length < 6) { qLoginErr.textContent = 'Password must be at least 6 characters'; return; }
  qLoginErr.textContent = '';
  qBtnLogin.disabled = qBtnSignup.disabled = true;
  createUserWithEmailAndPassword(auth, email, pass)
    .catch(e => { authError(e); qBtnLogin.disabled = qBtnSignup.disabled = false; });
};

// Allow Enter on password field
qLoginPass.onkeydown = e => { if (e.key === 'Enter') qBtnLogin.click(); };

// ── Boot ──
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

if (firebaseOK) {
  onAuthStateChanged(auth, user => {
    if (user) {
      showMain(user);
    } else {
      showLogin();
    }
  });
} else {
  // No Firebase: just show the app in offline mode
  showLogin();
  qLoginPanel.innerHTML = '<h1>Done</h1><div class="card">Cloud sync unavailable. Refresh to retry.</div>';
}

