import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, authStateReady } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
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
const qItems = el('new-item'), qAdd = el('btn-add');
const qList  = el('list-card'),  qTotal = el('total-items'), qDone = el('done-items');
const qCatChips = el('cat-chips');
const qLinkPanel = el('link-panel'), qLinkInput = el('link-input'), qLinkAction = el('btn-link-action');
const qLinkedTo = el('linked-to'), qUidDisplay = el('uid-display'), qUnlink = el('btn-unlink');
const qLogout  = el('btn-logout'),  qLinkBtn = el('btn-link');

// ── State ──
let uid = '', partnerUid = '', itemsKey = 'done_items', listeners = [], selectedCat = 'Misc';

function storeUid(u) { uid = u; try { localStorage.setItem('done_uid', u); } catch(e){} }
function storePartner(u) {
  partnerUid = (u || '');
  try { localStorage.setItem('done_partner', partnerUid); } catch(e){}
  // Persist to RTDB so link survives across devices
  if (firebaseOK && uid) {
    if (partnerUid) {
      set(ref(db, 'users/' + uid + '/partner'), partnerUid).catch(function(){});
    } else {
      remove(ref(db, 'users/' + uid + '/partner')).catch(function(){});
    }
  }
}
function restorePartner(cb) {
  // Try localStorage first for instant load
  partnerUid = localStorage.getItem('done_partner') || '';
  if (partnerUid) { if (cb) cb(); return; }
  // Then check RTDB for cross-device persistence
  if (firebaseOK && uid) {
    get(child(ref(db), 'users/' + uid + '/partner')).then(function(snap) {
      if (snap.exists()) {
        partnerUid = snap.val();
        try { localStorage.setItem('done_partner', partnerUid); } catch(e){}
        if (cb) cb();
        updateHeader();
      }
    }).catch(function(){});
  }
}

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

  renderCatChips(uniq);
  renderList(uniq);
  qTotal.textContent = uniq.length;
  qDone.textContent = uniq.filter(i => i.done).length;
}

function renderCatChips(items) {
  // Collect unique categories, sorted by recency (most recent item first)
  const seen = new Set();
  const cats = [];
  // Always offer Misc
  seen.add('Misc'); cats.push('Misc');
  // Then recently used categories (most recent first)
  const sorted = [...items].sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  sorted.forEach(i => {
    const c = i.cat || 'Misc';
    if (!seen.has(c)) { seen.add(c); cats.push(c); }
  });
  // Limit to ~7 chips + New button
  const shown = cats.slice(0, 7);

  qCatChips.innerHTML = '';
  shown.forEach(c => {
    const b = document.createElement('button');
    b.className = 'chip' + (selectedCat === c ? ' active' : '');
    b.textContent = c;
    b.onclick = () => { selectedCat = c; renderCatChips(items); hideNewCat(); };
    qCatChips.appendChild(b);
  });

  // + New chip
  const plus = document.createElement('button');
  plus.className = 'chip';
  plus.style.cssText = 'background:transparent;border-style:dashed';
  plus.textContent = '+ New';
  plus.onclick = () => {
    const row = el('new-cat-row');
    const inp = el('new-cat-input');
    row.style.display = 'block';
    inp.value = '';
    inp.focus();
  };
  qCatChips.appendChild(plus);
}

function renderList(items) {
  if (!items.length) {
    qList.innerHTML = '<div style="text-align:center;color:var(--muted);padding:18px 0">No items yet.<br>Add something above.</div>';
    return;
  }
  qList.innerHTML = '';

  // Group by category
  const groups = {};
  items.forEach(it => {
    const cat = it.cat || 'Misc';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(it);
  });

  // Sort categories alphabetically, Misc last
  const sortedCats = Object.keys(groups).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const miscIdx = sortedCats.indexOf('Misc');
  if (miscIdx > -1) { sortedCats.splice(miscIdx, 1); sortedCats.push('Misc'); }

  sortedCats.forEach(cat => {
    // Section header
    const hdr = document.createElement('div');
    hdr.className = 'section-hdr';
    hdr.textContent = cat + ' (' + groups[cat].length + ')';
    qList.appendChild(hdr);

    // Sort within category: undone first, then newest first
    groups[cat].sort((a,b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    groups[cat].forEach(it => {
      const isMine = !it.by || it.by === uid;
      const row = document.createElement('div');
      row.className = 'row ' + (isMine ? 'mine' : 'partner');
      const circ = document.createElement('div'); circ.className = 'check' + (it.done ? ' on' : ''); circ.innerHTML = '&#10003;';
      circ.onclick = () => toggleItem(it);
      const name = document.createElement('div'); name.className = 'name' + (it.done ? ' done' : ''); name.textContent = it.name;
      const del = document.createElement('button'); del.className = 'btn btn-danger'; del.style.cssText = 'padding:4px 8px;border-radius:8px;font-size:12px;flex-shrink:0'; del.textContent = 'Del';
      del.onclick = (e) => { e.stopPropagation(); deleteItem(it); };
      row.appendChild(circ); row.appendChild(name); row.appendChild(del);
      qList.appendChild(row);
    });
  });
}

// ── Item actions ──
function hideNewCat() { el('new-cat-row').style.display = 'none'; el('new-cat-input').value = ''; }

function setNewCategory() {
  const v = el('new-cat-input').value.trim();
  if (v) { selectedCat = v; }
  hideNewCat();
  rebuild();
}

function addItem() {
  const name = qItems.value.trim(); if (!name) { toast('Enter item name'); return; }
  const cat = selectedCat;
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
  qItems.value = ''; qItems.focus();
}

function toggleItem(it) {
  const newDone = !it.done;
  const list = loadItems().map(i => i.id === it.id ? { ...i, done: newDone } : i);
  saveItems(list);
  if (firebaseOK && uid) {
    const targetUid = it.by || uid;
    set(ref(db, 'users/' + targetUid + '/done/' + it.id), { name: it.name, cat: it.cat, done: newDone, createdAt: it.createdAt, by: targetUid })
      .catch(e => console.error('Toggle sync failed:', e));
  }
}

function deleteItem(it) {
  const list = loadItems().filter(i => i.id !== it.id);
  saveItems(list);
  if (firebaseOK && uid) {
    const targetUid = it.by || uid;
    remove(ref(db, 'users/' + targetUid + '/done/' + it.id))
      .catch(e => console.error('Delete sync failed:', e));
  }
}

// ── Event bindings (main panel) ──
qAdd.onclick = addItem;
qItems.onkeydown = e => { if (e.key === 'Enter') addItem(); };

el('btn-new-cat').onclick = setNewCategory;
el('new-cat-input').onkeydown = e => { if (e.key === 'Enter') setNewCategory(); };

el('btn-clear').onclick = () => {
  const done = loadItems().filter(i => i.done);
  if (!done.length) { toast('Nothing to clear'); return; }
  if (firebaseOK) {
    done.forEach(function(it) { try { remove(ref(db, 'users/' + (it.by || uid) + '/done/' + it.id)).catch(function(e){ console.error(e); }); } catch(e){} });
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
    qLinkBtn.textContent = '👥';
    qLinkBtn.title = 'Linked — click to manage';
  } else {
    qLinkedTo.textContent = 'Not linked';
    qUnlink.style.display = 'none';
    qLinkBtn.textContent = '⚙';
    qLinkBtn.title = 'Link Partner';
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
  restorePartner(function() {
    startListening();
    rebuild();
    updateHeader();
  });
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

// Signal that the JS module loaded
var statusEl = el('module-status');
if (statusEl) { statusEl.textContent = 'Module loaded'; statusEl.style.color = 'var(--accent)'; }

if (firebaseOK) {
  onAuthStateChanged(auth, user => {
    if (statusEl) { statusEl.textContent = user ? 'Signed in' : 'Ready — sign in'; }
    if (user) {
      showMain(user);
    } else {
      showLogin();
    }
  });
} else {
  qLoginPanel.innerHTML = '<h1>Done</h1><div class="card">Cloud sync unavailable. Refresh to retry.</div>';
}
