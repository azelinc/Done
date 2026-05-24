     1|     1|import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
     2|     2|import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
     3|     3|import { getDatabase, ref, push, set, onValue, update, remove, child, get, off } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";
     4|     4|
     5|     5|const CFG = {
     6|     6|  apiKey: "AIzaSy...vmuo",
     7|     7|  authDomain: "ainvested-703ec.firebaseapp.com",
     8|     8|  projectId: "ainvested-703ec",
     9|     9|  databaseURL: "https://ainvested-703ec-default-rtdb.asia-southeast1.firebasedatabase.app",
    10|    10|  appId: "1:453797298902:web:a54e8f9da3bf2b9daaff77"
    11|    11|};
    12|    12|
    13|    13|let app, auth, db;
    14|    14|let firebaseOK = false;
    15|    15|try {
    16|    16|  app = initializeApp(CFG);
    17|    17|  auth = getAuth(app);
    18|    18|  db  = getDatabase(app);
    19|    19|  firebaseOK = true;
    20|    20|} catch (e) {
    21|    21|  firebaseOK = false;
    22|    22|  console.warn('Firebase init failed', e);
    23|    23|}
    24|    24|
    25|    25|// ── DOM refs ──
    26|    26|function el(s) { return document.getElementById(s); }
    27|    27|function toast(m) { const t = el('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
    28|    28|
    29|    29|// login panel
    30|    30|const qLoginEmail = el('login-email'), qLoginPass = el('login-password'), qLoginErr = el('login-error');
    31|    31|const qBtnLogin = el('btn-login'), qBtnSignup = el('btn-signup');
    32|    32|const qLoginPanel = el('login-panel');
    33|    33|// main panel
    34|    34|const qMainPanel = el('main-panel'), qUserDisp = el('user-email-display');
    35|    35|const qItems = el('new-item'), qCat = el('new-cat'), qAdd = el('btn-add');
    36|    36|const qList  = el('list-card'),  qTotal = el('total-items'), qDone = el('done-items');
    37|    37|const qChips = el('chip-group');
    38|    38|const qLinkPanel = el('link-panel'), qLinkInput = el('link-input'), qLinkAction = el('btn-link-action');
    39|    39|const qLinkedTo = el('linked-to'), qUidDisplay = el('uid-display'), qUnlink = el('btn-unlink');
    40|    40|const qLogout  = el('btn-logout'),  qLinkBtn = el('btn-link');
    41|    41|
    42|    42|// ── State ──
    43|    43|let uid = '', partnerUid = '', itemsKey = 'done_items', listeners = [], activeCat = 'All';
    44|    44|
    45|    45|function storeUid(u) { uid = u; try { localStorage.setItem('done_uid', u); } catch(e){} }
    46|    46|function storePartner(u) { partnerUid = (u || ''); try { localStorage.setItem('done_partner', partnerUid); } catch(e){} }
    47|    47|function restorePartner() { partnerUid = localStorage.getItem('done_partner') || ''; return partnerUid; }
    48|    48|
    49|    49|restorePartner();
    50|    50|
    51|    51|// ── Data helpers ──
    52|    52|function loadItems() { try { return JSON.parse(localStorage.getItem(itemsKey) || '[]'); } catch(e) { return []; } }
    53|    53|function saveItems(arr) { try { localStorage.setItem(itemsKey, JSON.stringify(arr)); } catch(e){} rebuild(); }
    54|    54|
    55|    55|function pathFor(u) { return ref(db, `users/${u}/done`); }
    56|    56|
    57|    57|function startListening() {
    58|    58|  listeners.forEach(({ dbRef, fn }) => { try { off(dbRef, 'value', fn); } catch(e){} });
    59|    59|  listeners = [];
    60|    60|  if (!firebaseOK || !uid) return;
    61|    61|  listenTo(uid);
    62|    62|  if (partnerUid && partnerUid !== uid) listenTo(partnerUid);
    63|    63|}
    64|    64|
    65|    65|function listenTo(u) {
    66|    66|  if (!u) return;
    67|    67|  const r = pathFor(u);
    68|    68|  const fn = (snap) => {
    69|    69|    const val = snap.val() || {};
    70|    70|    const incoming = Object.entries(val).map(([id, v]) => ({
    71|    71|      id, name: v.name || '', cat: v.cat || 'Misc', done: !!v.done,
    72|    72|      createdAt: v.createdAt || 0, by: u
    73|    73|    }));
    74|    74|    const local = loadItems().filter(i => i.by !== u);
    75|    75|    saveItems([...local, ...incoming]);
    76|    76|  };
    77|    77|  onValue(r, fn);
    78|    78|  listeners.push({ dbRef: r, fn });
    79|    79|}
    80|    80|
    81|    81|// ── Rebuild UI ──
    82|    82|function rebuild() {
    83|    83|  const all = loadItems();
    84|    84|  const map = new Map();
    85|    85|  all.forEach(i => { map.set(i.by + '::' + i.id, i); });
    86|    86|  const uniq = Array.from(map.values());
    87|    87|
    88|    88|  const cats = new Set(uniq.map(i => i.cat));
    89|    89|  cats.add('All');
    90|    90|  renderChips(Array.from(cats));
    91|    91|
    92|    92|  const filtered = activeCat === 'All' ? uniq : uniq.filter(i => i.cat === activeCat);
    93|    93|  filtered.sort((a, b) => {
    94|    94|    if (a.done !== b.done) return a.done ? 1 : -1;
    95|    95|    return (b.createdAt || 0) - (a.createdAt || 0);
    96|    96|  });
    97|    97|  renderList(filtered);
    98|    98|  qTotal.textContent = uniq.length;
    99|    99|  qDone.textContent = uniq.filter(i => i.done).length;
   100|   100|}
   101|   101|
   102|   102|function renderChips(cats) {
   103|   103|  qChips.innerHTML = '';
   104|   104|  cats.forEach(c => {
   105|   105|    const b = document.createElement('button');
   106|   106|    b.className = 'chip' + (activeCat === c ? ' active' : '');
   107|   107|    const count = c === 'All' ? loadItems().length : loadItems().filter(i => i.cat === c).length;
   108|   108|    b.innerHTML = esc(c) + '<span class="chip-badge">' + count + '</span>';
   109|   109|    b.onclick = () => { activeCat = c; rebuild(); };
   110|   110|    qChips.appendChild(b);
   111|   111|  });
   112|   112|}
   113|   113|
   114|   114|function renderList(items) {
   115|   115|  if (!items.length) {
   116|   116|    qList.innerHTML = '<div style="text-align:center;color:var(--muted);padding:18px 0">No items yet.<br>Add something above.</div>';
   117|   117|    return;
   118|   118|  }
   119|   119|  qList.innerHTML = '';
   120|   120|  items.forEach(it => {
   121|   121|    const row = document.createElement('div'); row.className = 'row';
   122|   122|    const circ = document.createElement('div'); circ.className = 'check' + (it.done ? ' on' : ''); circ.innerHTML = '&#10003;';
   123|   123|    circ.onclick = () => toggleItem(it);
   124|   124|    const name = document.createElement('div'); name.className = 'name' + (it.done ? ' done' : ''); name.textContent = it.name;
   125|   125|    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = (it.by && it.by !== uid) ? 'partner' : 'mine';
   126|   126|    const cat = document.createElement('span'); cat.className = 'tag'; cat.textContent = it.cat || 'Misc';
   127|   127|    const del = document.createElement('button'); del.className = 'btn btn-danger'; del.style.cssText = 'padding:4px 8px;border-radius:8px;font-size:12px'; del.textContent = 'Del';
   128|   128|    del.onclick = () => deleteItem(it);
   129|   129|    const act = document.createElement('div'); act.style.cssText = 'display:flex;gap:6px;align-items:center';
   130|   130|    act.appendChild(meta); act.appendChild(cat); act.appendChild(del);
   131|   131|    row.appendChild(circ); row.appendChild(name); row.appendChild(act);
   132|   132|    qList.appendChild(row);
   133|   133|  });
   134|   134|}
   135|   135|
   136|   136|// ── Item actions ──
   137|   137|function addItem() {
   138|   138|  const name = qItems.value.trim(); if (!name) { toast('Enter item name'); return; }
   139|   139|  const cat = (qCat.value.trim() || 'Misc');
   140|   140|  const item = { id: '_' + Date.now() + Math.random().toString(36).slice(2, 6), name, cat, done: false, createdAt: Date.now(), by: uid };
   141|   141|  const list = loadItems();
   142|   142|  list.push(item);
   143|   143|  saveItems(list);   // also calls rebuild()
   144|   144|  if (firebaseOK && uid) {
   145|   145|    const r = push(pathFor(uid));
   146|   146|    update(r, { name, cat, done: false, createdAt: Date.now(), by: uid });
   147|   147|  }
   148|   148|  toast('Added');
   149|   149|  qItems.value = ''; qCat.value = ''; qItems.focus();
   150|   150|}
   151|   151|
   152|   152|function toggleItem(it) {
   153|   153|  if (firebaseOK && it.by === uid) {
   154|   154|    update(ref(db, `dones/${it.by}/${it.id}`), { done: !it.done });
   155|   155|  }
   156|   156|  const list = loadItems().map(i => i.id === it.id ? { ...i, done: !i.done } : i);
   157|   157|  saveItems(list);
   158|   158|}
   159|   159|
   160|   160|function deleteItem(it) {
   161|   161|  if (firebaseOK && it.by === uid) {
   162|   162|    remove(ref(db, `users/${it.by}/done/${it.id}`));
   163|   163|  }
   164|   164|  const list = loadItems().filter(i => i.id !== it.id);
   165|   165|  saveItems(list);
   166|   166|}
   167|   167|
   168|   168|// ── Event bindings (main panel) ──
   169|   169|qAdd.onclick = addItem;
   170|   170|qItems.onkeydown = e => { if (e.key === 'Enter') addItem(); };
   171|   171|qCat.onkeydown = e => { if (e.key === 'Enter') addItem(); };
   172|   172|
   173|   173|el('btn-clear').onclick = () => {
   174|   174|  const done = loadItems().filter(i => i.done);
   175|   175|  if (!done.length) { toast('Nothing to clear'); return; }
   176|   176|  if (firebaseOK) {
   177|   177|    done.forEach(it => { try { remove(ref(db, `users/${uid}/done/${it.id}`)).catch(e => console.error(e)); } catch(e){} });
   178|   178|  }
   179|   179|  saveItems(loadItems().filter(i => !i.done));
   180|   180|  toast('Cleared ' + done.length);
   181|   181|};
   182|   182|
   183|   183|qLinkBtn.onclick = () => {
   184|   184|  qLinkPanel.style.display = qLinkPanel.style.display === 'none' ? 'block' : 'none';
   185|   185|  updateHeader();
   186|   186|};
   187|   187|
   188|   188|function updateHeader() {
   189|   189|  qUidDisplay.textContent = uid ? uid.slice(0, 8) + '...' : '...';
   190|   190|  if (partnerUid) {
   191|   191|    qLinkedTo.textContent = 'Linked to: ' + partnerUid.slice(0, 8) + '...';
   192|   192|    qUnlink.style.display = '';
   193|   193|  } else {
   194|   194|    qLinkedTo.textContent = 'Not linked';
   195|   195|    qUnlink.style.display = 'none';
   196|   196|  }
   197|   197|}
   198|   198|
   199|   199|qLinkAction.onclick = () => {
   200|   200|  const p = (qLinkInput.value || '').trim();
   201|   201|  if (!p) { toast('Paste a UID'); return; }
   202|   202|  if (!firebaseOK) { toast('Cloud sync not available'); return; }
   203|   203|  if (p === uid) { toast('Cannot link to yourself'); return; }
   204|   204|  get(child(ref(db), `users/${p}/done`)).then(snap => {
   205|   205|    if (!snap.exists()) { toast('No account found'); return; }
   206|   206|    storePartner(p);
   207|   207|    startListening();
   208|   208|    toast('Linked!');
   209|   209|  }).catch(err => toast('Link failed: ' + (err.message || '')));
   210|   210|};
   211|   211|
   212|   212|qUnlink.onclick = () => {
   213|   213|  storePartner('');
   214|   214|  startListening();
   215|   215|  toast('Unlinked');
   216|   216|};
   217|   217|
   218|   218|qLogout.onclick = () => {
   219|   219|  storeUid('');
   220|   220|  storePartner('');
   221|   221|  signOut(auth).catch(() => {});
   222|   222|};
   223|   223|
   224|   224|// ── Auth handlers ──
   225|   225|function showLogin() {
   226|   226|  qLoginPanel.classList.remove('hidden');
   227|   227|  qMainPanel.classList.add('hidden');
   228|   228|}
   229|   229|function showMain(user) {
   230|   230|  qLoginPanel.classList.add('hidden');
   231|   231|  qMainPanel.classList.remove('hidden');
   232|   232|  uid = user.uid;
   233|   233|  storeUid(uid);
   234|   234|  qUserDisp.textContent = '— ' + (user.email || uid.slice(0, 8));
   235|   235|  restorePartner();
   236|   236|  startListening();
   237|   237|  rebuild();
   238|   238|  updateHeader();
   239|   239|}
   240|   240|
   241|   241|function authError(e) {
   242|   242|  const msg = (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password')
   243|   243|    ? 'Wrong email or password'
   244|   244|    : (e.code === 'auth/email-already-in-use')
   245|   245|    ? 'Email already registered. Sign in instead.'
   246|   246|    : (e.code === 'auth/weak-password')
   247|   247|    ? 'Password must be at least 6 characters'
   248|   248|    : e.message;
   249|   249|  qLoginErr.textContent = msg;
   250|   250|}
   251|   251|
   252|   252|qBtnLogin.onclick = () => {
   253|   253|  const email = qLoginEmail.value.trim();
   254|   254|  const pass  = qLoginPass.value;
   255|   255|  if (!email || !pass) { qLoginErr.textContent = 'Enter email and password'; return; }
   256|   256|  qLoginErr.textContent = '';
   257|   257|  qBtnLogin.disabled = qBtnSignup.disabled = true;
   258|   258|  signInWithEmailAndPassword(auth, email, pass)
   259|   259|    .catch(e => { authError(e); qBtnLogin.disabled = qBtnSignup.disabled = false; });
   260|   260|};
   261|   261|
   262|   262|qBtnSignup.onclick = () => {
   263|   263|  const email = qLoginEmail.value.trim();
   264|   264|  const pass  = qLoginPass.value;
   265|   265|  if (!email || !pass) { qLoginErr.textContent = 'Enter email and password'; return; }
   266|   266|  if (pass.length < 6) { qLoginErr.textContent = 'Password must be at least 6 characters'; return; }
   267|   267|  qLoginErr.textContent = '';
   268|   268|  qBtnLogin.disabled = qBtnSignup.disabled = true;
   269|   269|  createUserWithEmailAndPassword(auth, email, pass)
   270|   270|    .catch(e => { authError(e); qBtnLogin.disabled = qBtnSignup.disabled = false; });
   271|   271|};
   272|   272|
   273|   273|// Allow Enter on password field
   274|   274|qLoginPass.onkeydown = e => { if (e.key === 'Enter') qBtnLogin.click(); };
   275|   275|
   276|   276|// ── Boot ──
   277|   277|function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
   278|   278|
   279|   279|if (firebaseOK) {
   280|   280|  onAuthStateChanged(auth, user => {
   281|   281|    if (user) {
   282|   282|      showMain(user);
   283|   283|    } else {
   284|   284|      showLogin();
   285|   285|    }
   286|   286|  });
   287|   287|} else {
   288|   288|  // No Firebase: just show the app in offline mode
   289|   289|  showLogin();
   290|   290|  qLoginPanel.innerHTML = '<h1>Done</h1><div class="card">Cloud sync unavailable. Refresh to retry.</div>';
   291|   291|}
   292|   292|