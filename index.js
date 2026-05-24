// Firebase Compat SDK — loaded via script tags, no ES modules
const CFG = {
  apiKey: "AIzaSyC2fezwrXSOeDCytG84RES-dJ04teLvmuo",
  authDomain: "ainvested-703ec.firebaseapp.com",
  projectId: "ainvested-703ec",
  databaseURL: "https://ainvested-703ec-default-rtdb.asia-southeast1.firebasedatabase.app",
  appId: "1:453797298902:web:a54e8f9da3bf2b9daaff77"
};

var app, auth, db;
var firebaseOK = false;
try {
  app = firebase.initializeApp(CFG);
  auth = firebase.auth();
  db  = firebase.database();
  firebaseOK = true;
} catch (e) {
  firebaseOK = false;
  console.warn('Firebase init failed', e);
}

// DOM refs
function el(s) { return document.getElementById(s); }
function toast(m) { var t = el('toast'); t.textContent = m; t.classList.add('show'); setTimeout(function(){ t.classList.remove('show'); }, 2200); }

var qLoginEmail = el('login-email'), qLoginPass = el('login-password'), qLoginErr = el('login-error');
var qBtnLogin = el('btn-login'), qBtnSignup = el('btn-signup');
var qLoginPanel = el('login-panel');
var qMainPanel = el('main-panel'), qUserDisp = el('user-email-display');
var qItems = el('new-item'), qAdd = el('btn-add');
var qList  = el('list-card'),  qTotal = el('total-items'), qDone = el('done-items');
var qCatChips = el('cat-chips');
var qLinkPanel = el('link-panel'), qLinkInput = el('link-input'), qLinkAction = el('btn-link-action');
var qLinkedTo = el('linked-to'), qUidDisplay = el('uid-display'), qUnlink = el('btn-unlink');
var qLogout  = el('btn-logout'),  qLinkBtn = el('btn-link');

// State
var uid = '', partnerUid = '', itemsKey = 'done_items', listeners = [], selectedCat = 'Misc';

function storeUid(u) { uid = u; try { localStorage.setItem('done_uid', u); } catch(e){} }
function storePartner(u) {
  partnerUid = (u || '');
  try { localStorage.setItem('done_partner', partnerUid); } catch(e){}
  if (firebaseOK && uid) {
    var pr = db.ref('users/' + uid + '/partner');
    if (partnerUid) {
      pr.set(partnerUid).catch(function(){});
    } else {
      pr.remove().catch(function(){});
    }
  }
}
function restorePartner(cb) {
  partnerUid = localStorage.getItem('done_partner') || '';
  if (partnerUid) { if (cb) cb(); return; }
  if (firebaseOK && uid) {
    db.ref('users/' + uid + '/partner').once('value').then(function(snap) {
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

// Data helpers
function loadItems() { try { return JSON.parse(localStorage.getItem(itemsKey) || '[]'); } catch(e) { return []; } }
function saveItems(arr) { try { localStorage.setItem(itemsKey, JSON.stringify(arr)); } catch(e){} rebuild(); }

function startListening() {
  listeners.forEach(function(l) { try { l.dbRef.off('value', l.fn); } catch(e){} });
  listeners = [];
  if (!firebaseOK || !uid) return;
  listenTo(uid);
  if (partnerUid && partnerUid !== uid) listenTo(partnerUid);
}

function listenTo(u) {
  if (!u) return;
  var r = db.ref('users/' + u + '/done');
  var fn = function(snap) {
    var val = snap.val() || {};
    var incoming = Object.keys(val).map(function(id) {
      var v = val[id];
      return { id: id, name: v.name || '', cat: v.cat || 'Misc', done: !!v.done, createdAt: v.createdAt || 0, by: u };
    });
    var local = loadItems().filter(function(i) { return i.by !== u; });
    saveItems(local.concat(incoming));
  };
  r.on('value', fn);
  listeners.push({ dbRef: r, fn: fn });
}

// Rebuild UI
function rebuild() {
  var all = loadItems();
  var map = {};
  all.forEach(function(i) { map[i.by + '::' + i.id] = i; });
  var uniq = Object.values(map);

  renderCatChips(uniq);
  renderList(uniq);
  qTotal.textContent = uniq.length;
  qDone.textContent = uniq.filter(function(i){ return i.done; }).length;
}

function renderCatChips(items) {
  var seen = {};
  var cats = [];
  seen['Misc'] = true; cats.push('Misc');
  var sorted = items.slice().sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });
  sorted.forEach(function(i) {
    var c = i.cat || 'Misc';
    if (!seen[c]) { seen[c] = true; cats.push(c); }
  });
  var shown = cats.slice(0, 7);

  qCatChips.innerHTML = '';
  shown.forEach(function(c) {
    var b = document.createElement('button');
    b.className = 'chip' + (selectedCat === c ? ' active' : '');
    b.textContent = c;
    b.onclick = function() { selectedCat = c; renderCatChips(items); hideNewCat(); };
    qCatChips.appendChild(b);
  });

  var plus = document.createElement('button');
  plus.className = 'chip';
  plus.style.cssText = 'background:transparent;border-style:dashed';
  plus.textContent = '+ New';
  plus.onclick = function() {
    var row = el('new-cat-row');
    var inp = el('new-cat-input');
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

  var groups = {};
  items.forEach(function(it) {
    var cat = it.cat || 'Misc';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(it);
  });

  var sortedCats = Object.keys(groups).sort(function(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); });
  var miscIdx = sortedCats.indexOf('Misc');
  if (miscIdx > -1) { sortedCats.splice(miscIdx, 1); sortedCats.push('Misc'); }

  sortedCats.forEach(function(cat) {
    var hdr = document.createElement('div');
    hdr.className = 'section-hdr';
    hdr.textContent = cat + ' (' + groups[cat].length + ')';
    qList.appendChild(hdr);

    groups[cat].sort(function(a,b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    groups[cat].forEach(function(it) {
      var isMine = !it.by || it.by === uid;
      var row = document.createElement('div');
      row.className = 'row ' + (isMine ? 'mine' : 'partner');
      var circ = document.createElement('div'); circ.className = 'check' + (it.done ? ' on' : ''); circ.innerHTML = '&#10003;';
      circ.onclick = function() { toggleItem(it); };
      var name = document.createElement('div'); name.className = 'name' + (it.done ? ' done' : ''); name.textContent = it.name;
      var del = document.createElement('button'); del.className = 'btn btn-danger'; del.style.cssText = 'padding:4px 8px;border-radius:8px;font-size:12px;flex-shrink:0'; del.textContent = 'Del';
      del.onclick = function(e) { e.stopPropagation(); deleteItem(it); };
      row.appendChild(circ); row.appendChild(name); row.appendChild(del);
      qList.appendChild(row);
    });
  });
}

// Item actions
function hideNewCat() { el('new-cat-row').style.display = 'none'; el('new-cat-input').value = ''; }

function setNewCategory() {
  var v = el('new-cat-input').value.trim();
  if (v) { selectedCat = v; }
  hideNewCat();
  rebuild();
}

function addItem() {
  var name = qItems.value.trim(); if (!name) { toast('Enter item name'); return; }
  var cat = selectedCat;
  var ts = Date.now();

  var r = firebaseOK ? db.ref('users/' + uid + '/done').push() : null;
  var id = r ? r.key : ('_' + ts + Math.random().toString(36).slice(2, 6));
  var item = { id: id, name: name, cat: cat, done: false, createdAt: ts, by: uid };

  var list = loadItems();
  list.push(item);
  saveItems(list);

  if (r) {
    r.set({ name: name, cat: cat, done: false, createdAt: ts, by: uid }).catch(function(e){ console.error('Push failed:', e); });
  }
  toast('Added');
  qItems.value = ''; qItems.focus();
}

function toggleItem(it) {
  var newDone = !it.done;
  var list = loadItems().map(function(i) { return i.id === it.id ? Object.assign({}, i, {done: newDone}) : i; });
  saveItems(list);
  if (firebaseOK && uid) {
    var targetUid = it.by || uid;
    db.ref('users/' + targetUid + '/done/' + it.id).set({ name: it.name, cat: it.cat, done: newDone, createdAt: it.createdAt, by: targetUid })
      .catch(function(e){ console.error('Toggle sync failed:', e); });
  }
}

function deleteItem(it) {
  var list = loadItems().filter(function(i) { return i.id !== it.id; });
  saveItems(list);
  if (firebaseOK && uid) {
    var targetUid = it.by || uid;
    db.ref('users/' + targetUid + '/done/' + it.id).remove()
      .catch(function(e){ console.error('Delete sync failed:', e); });
  }
}

// Event bindings (main panel)
qAdd.onclick = addItem;
qItems.onkeydown = function(e) { if (e.key === 'Enter') addItem(); };

el('btn-new-cat').onclick = setNewCategory;
el('new-cat-input').onkeydown = function(e) { if (e.key === 'Enter') setNewCategory(); };

el('btn-clear').onclick = function() {
  var done = loadItems().filter(function(i) { return i.done; });
  if (!done.length) { toast('Nothing to clear'); return; }
  if (firebaseOK) {
    done.forEach(function(it) { try { db.ref('users/' + (it.by || uid) + '/done/' + it.id).remove().catch(function(e){ console.error(e); }); } catch(e){} });
  }
  saveItems(loadItems().filter(function(i) { return !i.done; }));
  toast('Cleared ' + done.length);
};

qLinkBtn.onclick = function() {
  qLinkPanel.style.display = qLinkPanel.style.display === 'none' ? 'block' : 'none';
  updateHeader();
};

function updateHeader() {
  qUidDisplay.textContent = uid || '...';
  if (partnerUid) {
    qLinkedTo.textContent = 'Linked to: ' + partnerUid.slice(0, 12) + '...';
    qUnlink.style.display = '';
    qLinkBtn.textContent = '\uD83D\uDC65';
    qLinkBtn.title = 'Linked \u2014 click to manage';
  } else {
    qLinkedTo.textContent = 'Not linked';
    qUnlink.style.display = 'none';
    qLinkBtn.textContent = '\u2699';
    qLinkBtn.title = 'Link Partner';
  }
}

el('btn-copy-uid').onclick = function() {
  if (!uid) return;
  navigator.clipboard.writeText(uid).then(function(){ toast('UID copied'); }).catch(function(){ toast('Tap and select to copy manually'); });
};

qLinkAction.onclick = function() {
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
    db.ref('users/emails/' + sanitized).once('value').then(function(snap) {
      if (!snap.exists()) { toast('Email not found. Ask partner to log in first.'); return; }
      doLink(snap.val());
    }).catch(function(err) { toast('Lookup failed: ' + (err.message || '')); });
  } else {
    db.ref('users/' + raw + '/done').once('value').then(function(snap) {
      if (!snap.exists()) { toast('No account found with that UID'); return; }
      doLink(raw);
    }).catch(function(err) { toast('Link failed: ' + (err.message || '')); });
  }
};

qUnlink.onclick = function() {
  storePartner('');
  startListening();
  toast('Unlinked');
};

qLogout.onclick = function() {
  storeUid('');
  auth.signOut().catch(function(){});
};

// Auth handlers
function showLogin() {
  qLoginPanel.classList.remove('hidden');
  qMainPanel.classList.add('hidden');
}
function showMain(user) {
  qLoginPanel.classList.add('hidden');
  qMainPanel.classList.remove('hidden');
  uid = user.uid;
  storeUid(uid);
  qUserDisp.textContent = '\u2014 ' + (user.email || uid.slice(0, 8));
  restorePartner(function() {
    startListening();
    rebuild();
    updateHeader();
  });
  if (firebaseOK && user.email) {
    var es = user.email.replace(/\./g, ',');
    db.ref('users/emails/' + es).set(uid).catch(function(){});
  }
}

function authError(e) {
  var msg = (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password')
    ? 'Wrong email or password'
    : (e.code === 'auth/email-already-in-use')
    ? 'Email already registered. Sign in instead.'
    : (e.code === 'auth/weak-password')
    ? 'Password must be at least 6 characters'
    : e.message;
  qLoginErr.textContent = msg;
}

qBtnLogin.onclick = function() {
  var email = qLoginEmail.value.trim();
  var pass  = qLoginPass.value;
  if (!email || !pass) { qLoginErr.textContent = 'Enter email and password'; return; }
  qLoginErr.textContent = '';
  qBtnLogin.disabled = qBtnSignup.disabled = true;
  auth.signInWithEmailAndPassword(email, pass)
    .catch(function(e) { authError(e); qBtnLogin.disabled = qBtnSignup.disabled = false; });
};

qBtnSignup.onclick = function() {
  var email = qLoginEmail.value.trim();
  var pass  = qLoginPass.value;
  if (!email || !pass) { qLoginErr.textContent = 'Enter email and password'; return; }
  if (pass.length < 6) { qLoginErr.textContent = 'Password must be at least 6 characters'; return; }
  qLoginErr.textContent = '';
  qBtnLogin.disabled = qBtnSignup.disabled = true;
  auth.createUserWithEmailAndPassword(email, pass)
    .catch(function(e) { authError(e); qBtnLogin.disabled = qBtnSignup.disabled = false; });
};

qLoginPass.onkeydown = function(e) { if (e.key === 'Enter') qBtnLogin.click(); };

// Boot
function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

var statusEl = el('module-status');
if (statusEl) { statusEl.textContent = 'Module loaded'; statusEl.style.color = 'var(--accent)'; }

if (firebaseOK) {
  auth.onAuthStateChanged(function(user) {
    if (statusEl) { statusEl.textContent = user ? 'Signed in' : 'Ready \u2014 sign in'; }
    if (user) {
      showMain(user);
    } else {
      showLogin();
    }
  });
} else {
  qLoginPanel.innerHTML = '<h1>Done</h1><div class="card">Cloud sync unavailable. Refresh to retry.</div>';
}
