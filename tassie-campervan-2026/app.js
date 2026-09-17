/* The trip page's behaviour, in one file: the countdown, the side menu and
   which section it opens on, the day tabs, the checklists, the budget, the
   ledger that syncs both between phones, and the offline app.

   It is a single IIFE of plain ES5-era JavaScript with no imports and no
   build step — the page has to run from a cache in a valley with no signal,
   so there is nothing here to resolve at load time.

   Two things bind it to the rest of the folder:

     - sw.js precaches ./app.js. A file missing from SHELL is a page that
       works until the signal does not.
     - Tailwind reads this file as well as index.html (see
       build/tailwind.config.js), because most of the classes below are
       applied from here and Tailwind only emits what it can see written
       out in full. Never assemble a class name from fragments. */

(function(){
  'use strict';
  var NS = 'tassie-camper-2026:';
  function get(k){ try { return localStorage.getItem(NS+k); } catch(e){ return null; } }
  function set(k,v){ try { localStorage.setItem(NS+k,v); } catch(e){} }
  function del(k){ try { localStorage.removeItem(NS+k); } catch(e){} }

  /* ── countdown ──────────────────────────────────────────────────
     The trip has two ends, and both matter. Counting only from the
     start and guessing at a length is how the header came to announce
     'trip done' on the Friday, with two days still to run. */
  var start = new Date('2026-09-12T09:00:00+10:00');
  var finish = new Date('2026-09-19T18:00:00+10:00');
  var now = new Date();
  var days = Math.ceil((start - now) / 86400000);
  var cd = document.getElementById('cd-num');
  var lbl = document.querySelector('#countdown div:last-child');
  if (now >= finish) { cd.textContent = '✓'; lbl.textContent = 'trip done'; }
  else if (now >= start) { cd.textContent = '🚐'; lbl.textContent = 'on the road'; }
  else if (days <= 1) { cd.textContent = '1'; }
  else { cd.textContent = days; }

  /* ── sections and the side menu ──────────────────────────────────
     One section is on screen at a time, and the menu is the only way
     between them, so everything the menu can reach carries .pane and a
     matching row. The star on a row is the section this phone opens
     on: it is kept locally, not synced, because the two of you will
     want different ones — whoever is driving lives in the day-by-day,
     whoever is packing lives in the checklists. */
  var menu    = document.getElementById('menu');
  var scrim   = document.getElementById('scrim');
  var menuBtn = document.getElementById('menu-btn');
  var rows    = Array.prototype.slice.call(document.querySelectorAll('.navrow'));
  var panes   = Array.prototype.slice.call(document.querySelectorAll('.pane'));
  var secName = {};
  rows.forEach(function(r){ secName[r.dataset.sec] = r.querySelector('.navitem').textContent.trim(); });

  function openMenu(on){
    menu.classList.toggle('open', on);
    scrim.classList.toggle('open', on);
    menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function showSection(id, scroll){
    if (!secName[id]) id = 'overview';
    panes.forEach(function(p){ p.classList.toggle('hidden', p.id !== id); });
    rows.forEach(function(r){
      var on = r.dataset.sec === id;
      r.classList.toggle('on', on);
      r.querySelector('.navitem').setAttribute('aria-current', on ? 'page' : 'false');
    });
    if (scroll !== false) window.scrollTo(0, 0);
  }
  function homeSection(){
    var h = get('home');
    return secName[h] ? h : 'overview';
  }
  function paintHome(){
    var h = homeSection();
    rows.forEach(function(r){
      var pin = r.querySelector('.pin'), on = r.dataset.sec === h;
      pin.classList.toggle('set', on);
      pin.textContent = on ? '\u2605' : '\u2606';
      pin.setAttribute('aria-pressed', on ? 'true' : 'false');
      pin.setAttribute('aria-label', (on ? 'Opens on ' : 'Open on ') + secName[r.dataset.sec]);
    });
    document.getElementById('home-name').textContent = secName[h];
  }

  rows.forEach(function(r){
    r.querySelector('.navitem').addEventListener('click', function(e){
      e.preventDefault();
      showSection(r.dataset.sec);
      openMenu(false);
    });
    r.querySelector('.pin').addEventListener('click', function(){
      // Starring the section that is already the default clears it.
      if (homeSection() === r.dataset.sec) del('home'); else set('home', r.dataset.sec);
      paintHome();
    });
  });
  menuBtn.addEventListener('click', function(){ openMenu(!menu.classList.contains('open')); });
  document.getElementById('menu-close').addEventListener('click', function(){ openMenu(false); });
  scrim.addEventListener('click', function(){ openMenu(false); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') openMenu(false); });

  /* A manifest shortcut or a bookmark names its section in the hash. The
     sync join link lives in the hash too and is not a section, so it
     falls through to whichever section this phone opens on.

     A section in the hash is spent as it is read: it opens that section
     once and is then wiped from the URL. Otherwise a fragment left in the
     address bar — this page's nav used to be plain anchor links, so any
     tab open from before carries one — outranks the starred section on
     every refresh, for as long as that tab lives. A hash that is not a
     section is left where it is for the sync module to read. */
  function takeHash(){
    var id = location.hash.replace(/^#/, '');
    if (!secName[id]) return null;
    if (window.history && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    return id;
  }
  showSection(takeHash() || homeSection(), false);
  paintHome();

  /* Tapping a shortcut while the app is already open changes the hash
     without reloading, so the section has to follow it. */
  window.addEventListener('hashchange', function(){
    var id = takeHash();
    if (id) showSection(id);
  });

  /* ── day tabs ── */
  var tabs = document.querySelectorAll('.daytab');
  var panels = document.querySelectorAll('.daypanel');
  function paint(){
    tabs.forEach(function(t){
      var on = t.classList.contains('on');
      t.className = 'daytab' + (on?' on':'') + ' shrink-0 px-4 py-2.5 rounded-2xl text-left border transition-all ' +
        (on ? 'bg-forest-900 text-white border-forest-900 shadow-soft' : 'bg-white text-slate-600 border-sand-200 hover:border-forest-700/40');
    });
  }
  function showDay(n){
    var t = document.querySelector('.daytab[data-day="' + n + '"]');
    if (!t) return;
    tabs.forEach(function(x){ x.classList.remove('on'); });
    t.classList.add('on');
    panels.forEach(function(p){ p.classList.toggle('hidden', p.dataset.day !== n); });
    paint();
  }
  tabs.forEach(function(t){
    t.addEventListener('click', function(){ showDay(t.dataset.day); });
  });
  paint();

  /* Days reference each other constantly — Thursday's summit is Wednesday's
     walk from higher up, Saturday's market is the one Day 1 warned you'd miss.
     Any link carrying data-goto switches to that day and scrolls to it. */
  document.querySelectorAll('[data-goto]').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      showSection('itinerary');
      showDay(a.dataset.goto);
    });
  });

  /* ── checklists ─────────────────────────────────────────────────
     Ticks and your own items both live in localStorage, so the lists
     are yours to edit and they work with no network at all. */
  function updateList(card){
    var boxes = card.querySelectorAll('.chk');
    var done = card.querySelectorAll('.chk:checked').length;
    var pct = boxes.length ? Math.round(done/boxes.length*100) : 0;
    var txt = card.querySelector('.progress-text');
    var bar = card.querySelector('.progress-bar');
    if (txt) txt.textContent = done + '/' + boxes.length;
    if (bar) { bar.style.width = pct + '%'; bar.classList.toggle('bg-forest-700', pct < 100); bar.classList.toggle('bg-ember-500', pct === 100); }
    var tally = card.querySelector('.custom-count');
    if (tally) {
      var mine = card.querySelectorAll('.custom-mount .chk').length;
      tally.textContent = mine ? (mine + (mine === 1 ? ' item you added' : ' items you added')) : '';
    }
  }

  function readItems(list){
    try { var v = JSON.parse(get('items:'+list) || '[]'); return Array.isArray(v) ? v : []; }
    catch(e){ return []; }
  }
  function writeItems(list, arr){ set('items:'+list, JSON.stringify(arr)); }

  function bindBox(card, box){
    if (get('chk:'+box.dataset.k) === '1') box.checked = true;
    box.addEventListener('change', function(){
      if (box.checked) set('chk:'+box.dataset.k,'1'); else del('chk:'+box.dataset.k);
      updateList(card);
      onTick(card.dataset.list, box);
    });
  }

  function customRow(card, list, item){
    var row = document.createElement('div');
    row.className = 'flex gap-3 items-start group';
    var label = document.createElement('label');
    label.className = 'flex gap-3 items-start cursor-pointer flex-1 min-w-0';
    var box = document.createElement('input');
    box.type = 'checkbox'; box.className = 'chk'; box.dataset.k = item.id; box.dataset.custom = '1';
    var span = document.createElement('span');
    span.className = 'chk-label text-sm';
    span.textContent = item.t;                       // textContent, never innerHTML
    label.appendChild(box); label.appendChild(span);
    var kill = document.createElement('button');
    kill.type = 'button';
    kill.className = 'shrink-0 text-slate-400 hover:text-red-600 text-base leading-none px-1.5 py-0.5';
    kill.textContent = '\u00d7';
    kill.title = 'Delete this item';
    kill.setAttribute('aria-label', 'Delete “' + item.t + '”');
    kill.addEventListener('click', function(){
      writeItems(list, readItems(list).filter(function(x){ return x.id !== item.id; }));
      del('chk:'+item.id);
      row.remove();
      updateList(card);
      onDelete(list, item.id);
    });
    row.appendChild(label); row.appendChild(kill);
    bindBox(card, box);
    return row;
  }

  function renderCustom(card){
    var list = card.dataset.list;
    var mount = card.querySelector('.custom-mount');
    if (!mount) return;
    mount.textContent = '';
    readItems(list).forEach(function(item){ mount.appendChild(customRow(card, list, item)); });
  }

  document.querySelectorAll('[data-list]').forEach(function(card){
    card.querySelectorAll('.chk').forEach(function(box){ bindBox(card, box); });
    renderCustom(card);
    updateList(card);

    var form = card.querySelector('.add-form');
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var input = form.querySelector('.add-input');
      var text = (input.value || '').trim();
      if (!text) return;
      var list = card.dataset.list;
      var item = { id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2,6), t: text };
      var arr = readItems(list); arr.push(item); writeItems(list, arr);
      onAdd(list, item);
      card.querySelector('.custom-mount').appendChild(customRow(card, list, item));
      input.value = '';
      updateList(card);
    });
  });

  function clearTicks(card){
    card.querySelectorAll('.chk').forEach(function(b){
      var was = b.checked;
      b.checked = false; del('chk:'+b.dataset.k);
      if (was) onTick(card.dataset.list, b);
    });
    updateList(card);
  }
  document.querySelectorAll('[data-reset]').forEach(function(btn){
    btn.addEventListener('click', function(){
      clearTicks(document.querySelector('[data-list="'+btn.dataset.reset+'"]'));
    });
  });
  document.getElementById('reset-checks').addEventListener('click', function(){
    if (!confirm('Clear every tick on this page? Items you added are kept.')) return;
    document.querySelectorAll('[data-list]').forEach(clearTicks);
  });

  /* ── sync between phones ────────────────────────────────────────
     Everything above keeps working as it is: ticks and your own items
     live on this phone. Connected to a trip, the page also sends that
     state to the API and takes back the merged result, so every phone
     holding the trip's token converges on the same lists. Each entry
     carries the time it last changed and the later change wins — the
     rule the server applies too. A tick is an entry; an untick or a
     deletion is a tombstone, so a later re-tick beats it.

     The trip is named after this page's folder, so a copy of this code
     in another itinerary talks to that itinerary's trip. */
  var TRIP = (function(){
    var seg = location.pathname.split('/').filter(Boolean).pop() || '';
    return /^[a-z0-9][a-z0-9-]{0,63}$/.test(seg) ? seg : 'tassie-campervan-2026';
  })();
  var API = '/api/v1';
  var cards = Array.prototype.slice.call(document.querySelectorAll('[data-list]'));
  var ledger = null;
  var token = get('sync:token') || '';
  var lastOk = parseInt(get('sync:last') || '0', 10) || 0;

  function readLedger(){ try { var v = JSON.parse(get('sync:ledger') || 'null'); return v && typeof v === 'object' ? v : null; } catch(e){ return null; } }
  function writeLedger(){ set('sync:ledger', JSON.stringify(ledger)); }

  // Does entry a beat entry b? Later stamp wins; on a tie a tombstone
  // wins; on a tie of both, the greater value. Same as the server.
  function wins(a, b){
    if (!b) return true;
    if (!a) return false;
    if (a.t !== b.t) return a.t > b.t;
    if (!!a.d !== !!b.d) return !!a.d;
    return JSON.stringify(a.v) > JSON.stringify(b.v);
  }
  function itemValue(list, key, fallbackText){
    var e = ledger[list] && ledger[list][key];
    return e && e.v && typeof e.v === 'object' ? e.v : { t: fallbackText || '', done:false, o: Date.now() };
  }
  // Every local change passes through here: stamp it, keep it, queue a sync.
  function record(list, key, entry){
    if (!ledger) return;
    (ledger[list] = ledger[list] || {})[key] = entry;
    writeLedger();
    queueSync();
  }
  function onTick(list, box){
    var now = Date.now(), k = box.dataset.k;
    if (box.dataset.custom) {
      var v = itemValue(list, k, box.nextSibling && box.nextSibling.textContent);
      record(list, k, { v:{ t:v.t, done:!!box.checked, o:v.o }, t:now });
    } else {
      record(list, k, box.checked ? { v:true, t:now } : { v:false, t:now, d:true });
    }
  }
  function onAdd(list, item){ record(list, item.id, { v:{ t:item.t, done:false, o:Date.now() }, t:Date.now() }); }
  function onDelete(list, key){ record(list, key, { v:itemValue(list, key), t:Date.now(), d:true }); }

  // First run: the ledger starts from what this phone already has.
  function bootLedger(){
    ledger = readLedger();
    if (ledger) return;
    ledger = {};
    var now = Date.now();
    cards.forEach(function(card){
      var list = card.dataset.list, m = ledger[list] = {};
      card.querySelectorAll('.chk').forEach(function(box){
        if (!box.dataset.custom && get('chk:'+box.dataset.k) === '1') m[box.dataset.k] = { v:true, t:now };
      });
      readItems(list).forEach(function(item, i){
        m[item.id] = { v:{ t:item.t, done: get('chk:'+item.id) === '1', o: now + i }, t:now };
      });
    });
    writeLedger();
  }

  // Take the server's view in, entry by entry, and repaint if anything won.
  function absorb(lists){
    var changed = false;
    Object.keys(lists || {}).forEach(function(list){
      var mine = ledger[list] = ledger[list] || {}, theirs = lists[list] || {};
      Object.keys(theirs).forEach(function(k){
        if (wins(theirs[k], mine[k])) { mine[k] = theirs[k]; changed = true; }
      });
    });
    if (changed) { writeLedger(); applyLedger(); }
  }
  function applyLedger(){
    cards.forEach(function(card){
      var list = card.dataset.list, m = ledger[list] || {};
      card.querySelectorAll('.chk').forEach(function(box){
        if (box.dataset.custom) return;
        var e = m[box.dataset.k], on = !!(e && !e.d && e.v === true);
        box.checked = on;
        if (on) set('chk:'+box.dataset.k, '1'); else del('chk:'+box.dataset.k);
      });
      var items = [];
      Object.keys(m).forEach(function(k){
        var e = m[k];
        if (e.d || !e.v || typeof e.v !== 'object') return;
        items.push({ id:k, t:String(e.v.t || ''), o:e.v.o || 0 });
        if (e.v.done) set('chk:'+k, '1'); else del('chk:'+k);
      });
      items.sort(function(a, b){ return a.o - b.o || (a.id < b.id ? -1 : 1); });
      writeItems(list, items.map(function(i){ return { id:i.id, t:i.t }; }));
      renderCustom(card);
      updateList(card);
    });
    if (typeof brender === 'function' && Object.keys(bmounts || {}).length) brender();
  }

  /* One request does the whole exchange: send everything this phone has,
     receive everything the trip has. Runs after each change (debounced),
     when the page opens or comes back to the front, when the connection
     returns, and every 45 s while the page is visible. */
  var inflight = false, again = false, timer = null;
  function queueSync(){ if (!token) return; clearTimeout(timer); timer = setTimeout(syncNow, 700); }
  function syncNow(){
    if (!token || !ledger) return;
    if (inflight) { again = true; return; }
    if (navigator.onLine === false) { paintSync('offline'); return; }
    inflight = true;
    paintSync('syncing');
    fetch(API + '/trips/' + TRIP, {
      method: 'PATCH', cache: 'no-store',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lists: ledger })
    }).then(function(res){
      if (res.status === 401) { paintSync('rejected'); return null; }
      if (res.status === 400) { return res.json().then(function(d){ paintSync('error', d.error); return null; }); }
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(function(data){
      if (!data) return;
      absorb(data.lists);
      lastOk = Date.now(); set('sync:last', String(lastOk));
      paintSync('ok');
    }).catch(function(){
      paintSync(navigator.onLine === false ? 'offline' : 'error');
    }).then(function(){
      inflight = false;
      if (again) { again = false; queueSync(); }
    });
  }

  /* ── the panel at the bottom ── */
  function el(id){ return document.getElementById(id); }
  var ui = { off: el('sync-off'), on: el('sync-on'), status: el('sync-status'), link: el('sync-link'), msg: el('sync-msg'), exists: el('sync-exists') };
  function joinLink(){ return location.origin + location.pathname + '#join=' + token; }
  function parseToken(s){
    s = (s || '').trim();
    var m = /join=([A-Za-z0-9_-]{43})/.exec(s);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{43}$/.test(s) ? s : '';
  }
  function paintSync(state, detail){
    if (!ui.on) return;
    var on = !!token;
    ui.on.classList.toggle('hidden', !on);
    ui.off.classList.toggle('hidden', on);
    if (!on) return;
    ui.link.value = joinLink();
    var cls = 'text-sm font-semibold ', txt;
    if (state === 'syncing')       { cls += 'text-slate-500';  txt = 'Syncing…'; }
    else if (state === 'ok')       { cls += 'text-forest-800'; txt = '✓ In sync · ' + new Date(lastOk).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }); }
    else if (state === 'offline')  { cls += 'text-amber-800';  txt = 'Offline — changes are kept here and sent when you’re back'; }
    else if (state === 'rejected') { cls += 'text-red-600';    txt = 'The server rejected this phone’s token — it may have been rotated. Disconnect, then open the new link.'; }
    else                           { cls += 'text-amber-800';  txt = detail ? 'The server said: ' + detail : 'Couldn’t reach the server — will try again'; }
    ui.status.className = cls;
    ui.status.textContent = txt;
  }
  function say(text, bad){
    ui.msg.className = 'text-[12px] mt-2 ' + (bad ? 'text-red-600' : 'text-slate-500');
    ui.msg.textContent = text;
  }
  function connect(t){
    token = t; set('sync:token', t);
    ui.msg.className = 'hidden';
    paintSync('syncing');
    syncNow();
  }
  // Rotate the trip's token with the admin key. done(err, token).
  function rotate(key, done){
    fetch(API + '/trips/' + TRIP + '/token', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key } })
      .then(function(res){
        if (res.status === 200) return res.json().then(function(d){ done(null, d.token); });
        if (res.status === 401) return done('That admin key was not accepted.');
        if (res.status === 404) return done('There is no trip on the server to rotate yet.');
        return res.json().then(function(d){ done(d.error || ('The server answered ' + res.status)); });
      }).catch(function(){ done('Couldn’t reach the server. Check the signal and try again.'); });
  }

  if (ui.on) {
    // A join link carries the token after '#', which never reaches the
    // server or its logs. Keep it, then take it out of the address bar.
    (function(){
      var t = parseToken(location.hash);
      if (t) { token = t; set('sync:token', t); history.replaceState(null, '', location.pathname + location.search); }
    })();

    el('sync-enable').addEventListener('click', function(){
      el('sync-create').classList.remove('hidden'); el('sync-join').classList.add('hidden'); el('sync-key').focus();
    });
    el('sync-join-toggle').addEventListener('click', function(){
      el('sync-join').classList.remove('hidden'); el('sync-create').classList.add('hidden'); el('sync-link-in').focus();
    });
    // Enable sync: create the trip with the admin key, typed once, never kept.
    el('sync-create').addEventListener('submit', function(e){
      e.preventDefault();
      var key = el('sync-key').value.trim();
      if (!key) return;
      say('Creating the trip…');
      ui.exists.classList.add('hidden');
      fetch(API + '/trips', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: TRIP, name: (document.title || TRIP).slice(0, 120) })
      }).then(function(res){
        if (res.status === 201) return res.json().then(function(d){ el('sync-key').value = ''; connect(d.token); });
        if (res.status === 409) { ui.msg.className = 'hidden'; ui.exists.classList.remove('hidden'); return; }
        if (res.status === 401) { say('That admin key was not accepted.', true); return; }
        return res.json().then(function(d){ say(d.error || ('The server answered ' + res.status), true); });
      }).catch(function(){ say('Couldn’t reach the server. Check the signal and try again.', true); });
    });
    el('sync-rotate-create').addEventListener('click', function(){
      var key = el('sync-key').value.trim();
      if (!key) { say('Paste the admin key first.', true); return; }
      rotate(key, function(err, t){
        if (err) { say(err, true); return; }
        el('sync-key').value = ''; ui.exists.classList.add('hidden'); connect(t);
      });
    });
    el('sync-join').addEventListener('submit', function(e){
      e.preventDefault();
      var t = parseToken(el('sync-link-in').value);
      if (!t) { say('That doesn’t look like a join link or a token.', true); return; }
      el('sync-link-in').value = '';
      connect(t);
    });

    // Connected: the join link, and the button that copies it.
    var copyBtn = el('sync-copy');
    function copied(){
      copyBtn.textContent = 'Copied ✓';
      setTimeout(function(){ copyBtn.textContent = 'Copy join link'; }, 1600);
    }
    copyBtn.addEventListener('click', function(){
      var link = joinLink();
      var fallback = function(){
        ui.link.focus(); ui.link.select();
        try { document.execCommand('copy'); copied(); } catch(e){ /* the text stays selected for a long-press */ }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(copied, fallback);
      else fallback();
    });
    if (navigator.share) {
      el('sync-share').classList.remove('hidden');
      el('sync-share').addEventListener('click', function(){
        navigator.share({ title: document.title, text: 'Join the trip checklists', url: joinLink() }).catch(function(){});
      });
    }
    el('sync-now').addEventListener('click', syncNow);
    el('sync-off-btn').addEventListener('click', function(){
      if (!confirm('Disconnect this phone from the trip? Your ticks stay on the phone; they just stop syncing.')) return;
      token = ''; del('sync:token');
      el('sync-rotate').classList.add('hidden');
      paintSync('off');
    });
    el('sync-rotate-toggle').addEventListener('click', function(){ el('sync-rotate').classList.toggle('hidden'); el('sync-key2').focus(); });
    el('sync-rotate').addEventListener('submit', function(e){
      e.preventDefault();
      var key = el('sync-key2').value.trim();
      if (!key) return;
      rotate(key, function(err, t){
        if (err) { ui.status.className = 'text-sm font-semibold text-red-600'; ui.status.textContent = err; return; }
        el('sync-key2').value = ''; el('sync-rotate').classList.add('hidden'); connect(t);
      });
    });

    bootLedger();
    paintSync(token ? 'syncing' : 'off');
    if (token) syncNow();
    window.addEventListener('online', syncNow);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) syncNow(); });
    setInterval(function(){ if (!document.hidden) syncNow(); }, 45000);
  }

  /* ── budget ─────────────────────────────────────────────────────
     Every row is data, not markup. The list below is only the seed: from
     the first run the rows live in the same ledger as the checklists, so
     a fuel stop entered at the pump turns up on the other phone. Each
     row carries what was planned and what was actually paid, because on
     the road the second is the number you want and the first is what you
     are judging it against.

     Keys match the ones the old fixed rows used, so a phone that has
     been editing figures all week keeps them. */
  var BUDGET = 'budget';
  var BSEED = [
    { k:"van", g:"fixed", p:747.25, t:"Campervan hire", n:"confirmed · $622.25 paid + $125 Hobart location fee at the counter. The $7,500 bond is separate and comes back" },
    { k:"pass", g:"fixed", p:50.7, t:"Freycinet One-Park pass", n:"buying 11 Sep · $50.70, twelve months, one park, up to two vehicles — covers Sunday evening, Monday and Tuesday. One 24-hr pass only works if both Freycinet walks fall inside a single window." },
    { k:"tasmanpass", g:"fixed", p:47.7, t:"Tasman NP pass, Friday", n:"buy on the day · 24-hour vehicle pass, $47.70 — the hire car needs its own. Zero if you skip the coastal stops and go straight to Port Arthur" },
    { k:"fuel", g:"fixed", p:190.0, t:"Diesel", n:"~670 km · 67–80 L at ~245–250 c/L · one fill, at Cambridge" },
    { k:"n1", g:"camp", p:35.0, t:"Night 1 · Tasman Holiday Parks", n:"paid · Booking #57776 · paid in full" },
    { k:"n2", g:"camp", p:60.0, t:"Night 2 · BIG4 Iluka, Coles Bay", n:"paid · Reservation 263967 · $120 for the two nights" },
    { k:"n3", g:"camp", p:60.0, t:"Night 3 · BIG4 Iluka again", n:"paid · Same reservation — the second half of the $120" },
    { k:"n4", g:"camp", p:49.0, t:"Night 4 · Triabunna", n:"on arrival · Ref BBA26090121260069 · payable at check-in" },
    { k:"groc", g:"food", p:170.0, t:"Groceries", n:"Big shop at Campbell Town Saturday, top-up at St Helens Sunday" },
    { k:"eat", g:"food", p:180.0, t:"Meals out & coffee", n:"Ross bakery, St Helens, Swansea, Salamanca" },
    { k:"mill", g:"food", p:30.0, t:"Callington Mill tour (optional)", n:"$15 each, hourly 10:00–15:00 Saturday" },
    { k:"taxi", g:"food", p:25.0, t:"Taxi to the depot", n:"Apollo runs no airport shuttle" },
    { k:"buf", g:"food", p:100.0, t:"Buffer", n:"Laundry, coin showers, odds and ends" },
    { k:"hotel", g:"hobart", p:415.2, t:"ibis Styles Hobart", n:"paid · Nights 5–7 · ref JQKZANYD3 · non-refundable, nothing left to pay" },
    { k:"car", g:"hobart", p:58.0, t:"Simba car hire, 2 days", n:"confirmed · $58 for the two days — less than the two taxis it saves you if you pick it up on Wednesday" },
    { k:"excess", g:"hobart", p:0.0, t:"Excess cover for the car", n:"covered · Your credit card carries the $6,380 excess — decline the upsell at the counter" },
    { k:"mona", g:"hobart", p:138.0, t:"Mona — entry and ferry", n:"Thu · 2 × $39 entry + 2 × $30 return ferry" },
    { k:"parthur", g:"hobart", p:110.0, t:"Port Arthur Historic Site", n:"Fri · 2 × $55 · includes the harbour cruise and a guide talk, valid two days" },
    { k:"carfuel", g:"hobart", p:45.0, t:"Petrol for the car", n:"~300 km in a small hybrid, handed back full" },
    { k:"transfers", g:"hobart", p:80.0, t:"Two taxis out to Cambridge", n:"Depot → hotel Wednesday, hotel → car Thursday. About $40 each for the pair of you" },
    { k:"parking", g:"hobart", p:60.0, t:"Parking", n:"Two nights at the hotel plus Saturday at Salamanca Square — ask the hotel rate at check-in" },
    { k:"hobfood", g:"hobart", p:320.0, t:"Eating in Hobart", n:"Three days of breakfasts, lunches and dinners for two, with no kitchen" }
  ];
  var BNUMCLS = 'w-full bg-sand-50 border border-sand-200 rounded-lg px-2 py-1.5 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-forest-700/30';
  var BTXTCLS = 'w-full bg-white border border-sand-200 rounded-lg px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-700/30';

  var bmounts = {};
  document.querySelectorAll('[data-brows]').forEach(function(m){ bmounts[m.dataset.brows] = m; });
  var bmoney = function(n){ return '$' + Math.round(n).toLocaleString('en-AU'); };
  function bnum(v){
    if (v === null || v === undefined || v === '') return null;
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  function bmk(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // The ledger is the truth; this is just a sorted view of it.
  function brows(){
    var m = (ledger && ledger[BUDGET]) || {}, out = [];
    Object.keys(m).forEach(function(k){
      var e = m[k];
      if (e.d || !e.v || typeof e.v !== 'object') return;
      out.push({ k:k, g:String(e.v.g || ''), t:String(e.v.t || ''), n:String(e.v.n || ''),
                 p:bnum(e.v.p) || 0, a:bnum(e.v.a), o:e.v.o || 0 });
    });
    out.sort(function(x, y){ return x.o - y.o || (x.k < y.k ? -1 : 1); });
    return out;
  }
  function bput(r){
    record(BUDGET, r.k, { v:{ g:r.g, t:r.t, n:r.n, p:r.p, a:r.a, o:r.o }, t:Date.now() });
  }
  function bdrop(k){
    var cur = (ledger[BUDGET] || {})[k];
    record(BUDGET, k, { v:(cur && cur.v) || {}, t:Date.now(), d:true });
  }

  /* First run on this phone: lay the seed down, keeping any figure already
     typed into the old per-row store so nobody loses a week of edits.

     The stamp is the whole game here. Every phone seeds every row, so a seed
     carrying today's clock would beat an edit another phone made yesterday —
     the second phone to join would quietly undo the first one's work. A
     default is not an edit, so it is stamped at the epoch and loses every
     merge it is ever in. A figure this phone actually typed is an edit and
     keeps a real stamp, and so does the reset button, which is a deliberate
     act and has to win. */
  function bseed(force){
    if (!ledger) return;
    if (ledger[BUDGET] && !force) return;
    var now = Date.now();
    BSEED.forEach(function(r, i){
      var kept = force ? null : bnum(get('bud:' + r.k));
      record(BUDGET, r.k, {
        v: { g:r.g, t:r.t, n:r.n, p:(kept === null ? r.p : kept), a:null, o:(i + 1) * 10 },
        t: (force || kept !== null) ? now : 1
      });
    });
  }

  function brow(r){
    var wrap = bmk('div', 'px-5 py-3');
    wrap.dataset.bk = r.k;

    var head = bmk('div', 'flex items-start gap-3');
    var txt = bmk('div', 'flex-1 min-w-0');
    txt.appendChild(bmk('div', 'text-sm font-medium', r.t));
    if (r.n) txt.appendChild(bmk('div', 'text-xs text-slate-500 mt-0.5', r.n));
    head.appendChild(txt);
    var pen = bmk('button', 'shrink-0 text-slate-300 hover:text-forest-800 px-1 leading-none', '\u270E');
    pen.type = 'button';
    pen.setAttribute('aria-label', 'Edit ' + r.t);
    head.appendChild(pen);
    wrap.appendChild(head);

    var nums = bmk('div', 'flex items-center gap-3 mt-2');
    function field(which, value, ph) {
      var lab = bmk('label', 'flex items-center gap-1.5 flex-1 min-w-0');
      lab.appendChild(bmk('span', 'text-[10px] uppercase tracking-wider text-slate-400 font-semibold', which === 'p' ? 'plan' : 'spent'));
      lab.appendChild(bmk('span', 'text-slate-400 text-sm', '$'));
      var i = bmk('input', BNUMCLS);
      i.type = 'number'; i.step = '0.01'; i.inputMode = 'decimal';
      i.value = value === null ? '' : String(value);
      i.placeholder = ph;
      i.dataset.bf = which;
      // A number field renders 50.70 as "50.7", which does not read as money.
      i.addEventListener('blur', function(){
        var n = bnum(i.value);
        if (n !== null && n % 1 !== 0) i.value = n.toFixed(2);
      });
      i.addEventListener('input', function(){
        var cur = r;
        cur[which] = which === 'p' ? (bnum(i.value) || 0) : bnum(i.value);
        bput(cur);
        brecalc();
      });
      lab.appendChild(i);
      return lab;
    }
    nums.appendChild(field('p', r.p, '0'));
    nums.appendChild(field('a', r.a, '\u2014'));
    wrap.appendChild(nums);

    // The text of a row changes rarely, so it hides behind the pencil.
    var form = bmk('form', 'hidden mt-2.5 space-y-2 rounded-xl bg-sand-50 border border-sand-200 p-3');
    var tIn = bmk('input', BTXTCLS); tIn.type = 'text'; tIn.value = r.t; tIn.maxLength = 80;
    tIn.placeholder = 'What it is'; tIn.setAttribute('aria-label', 'Name');
    var nIn = bmk('input', BTXTCLS); nIn.type = 'text'; nIn.value = r.n; nIn.maxLength = 160;
    nIn.placeholder = 'A note — where the figure came from'; nIn.setAttribute('aria-label', 'Note');
    form.appendChild(tIn); form.appendChild(nIn);
    var btns = bmk('div', 'flex gap-2');
    var save = bmk('button', 'text-xs font-semibold bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800', 'Save');
    save.type = 'submit';
    var kill = bmk('button', 'text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-2 rounded-lg ml-auto', 'Delete');
    kill.type = 'button';
    btns.appendChild(save); btns.appendChild(kill);
    form.appendChild(btns);
    wrap.appendChild(form);

    pen.addEventListener('click', function(){
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) tIn.focus();
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name = tIn.value.trim();
      if (!name) return;
      r.t = name; r.n = nIn.value.trim();
      bput(r);
      brender();
    });
    kill.addEventListener('click', function(){
      bdrop(r.k);
      brender();
    });
    return wrap;
  }

  /* Rebuilding throws away the field you were typing in, and sync can
     land at any moment, so put the caret back where it was. */
  function brender(){
    var act = document.activeElement, keep = null;
    if (act && act.dataset && act.dataset.bf) {
      var owner = act.closest('[data-bk]');
      if (owner) keep = { k:owner.dataset.bk, f:act.dataset.bf, s:act.selectionStart };
    }
    Object.keys(bmounts).forEach(function(g){ bmounts[g].textContent = ''; });
    brows().forEach(function(r){
      var mount = bmounts[r.g] || bmounts.food;
      if (mount) mount.appendChild(brow(r));
    });
    if (keep) {
      var back = document.querySelector('[data-bk="' + keep.k + '"] [data-bf="' + keep.f + '"]');
      if (back) { back.focus(); try { back.setSelectionRange(keep.s, keep.s); } catch (e) {} }
    }
    brecalc();
  }

  function brecalc(){
    var per = {}, planned = 0, spent = 0, now = 0, recorded = false;
    Object.keys(bmounts).forEach(function(g){ per[g] = 0; });
    brows().forEach(function(r){
      var eff = r.a === null ? r.p : r.a;
      planned += r.p;
      if (r.a !== null) { spent += r.a; recorded = true; }
      now += eff;
      if (per[r.g] === undefined) per[r.g] = 0;
      per[r.g] += eff;
    });
    Object.keys(per).forEach(function(g){
      var a = document.querySelector('[data-subtotal="' + g + '"]');
      var b = document.querySelector('[data-summary="' + g + '"]');
      if (a) a.textContent = bmoney(per[g]);
      if (b) b.textContent = bmoney(per[g]);
    });
    document.getElementById('grand-total').textContent = bmoney(now);
    document.getElementById('per-person').textContent = bmoney(now / 2) + ' per person';
    document.getElementById('per-day').textContent = bmoney(now / 8);
    document.getElementById('bud-planned').textContent = bmoney(planned);
    // Entering 0 for something that turned out free is a real answer, so
    // this asks whether a figure was recorded, not whether it was non-zero.
    document.getElementById('bud-spent').textContent = recorded ? bmoney(spent) : 'nothing yet';
    var vs = document.getElementById('bud-vs'), diff = Math.round(now - planned);
    vs.textContent = diff === 0 ? 'on the money' : (diff > 0 ? '+' + bmoney(diff) + ' over' : bmoney(-diff) + ' under');
    vs.className = diff > 0 ? 'font-semibold text-amber-300' : (diff < 0 ? 'font-semibold text-emerald-300' : 'font-semibold');
  }

  document.querySelectorAll('[data-badd]').forEach(function(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name = form.querySelector('input[type=text]').value.trim();
      if (!name) return;
      var amt = form.querySelector('input[type=number]');
      var last = brows().reduce(function(m, r){ return Math.max(m, r.o); }, 0);
      bput({ k:'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
             g:form.dataset.badd, t:name.slice(0, 80), n:'', p:bnum(amt.value) || 0, a:null, o:last + 10 });
      form.reset();
      brender();
    });
  });

  document.getElementById('reset-budget').addEventListener('click', function(){
    if (!window.confirm('Put the original figures back and clear everything spent against them? Rows you added are kept.')) return;
    bseed(true);
    brender();
  });

  bseed(false);
  brender();


  /* ── Friday on the peninsula ─────────────────────────────────────
     A day you assemble rather than follow. Every stop worth making is
     here whether or not it fits, because which ones to drop is the
     traveller's call and not the page's — the clock warns, it never
     filters.

     Distances come from a small graph of road legs rather than a time
     for every pair of places: the peninsula is one spine with spurs,
     and a table of thirty-by-thirty invented numbers would be fiction.
     The spine legs are the ones already measured on this page; the
     spurs are estimates, and the page says so.

     The map is drawn from published coordinates on an equirectangular
     projection — longitude scaled by cos(latitude), which at this size
     is true enough that what looks near is near. No tiles, so it works
     with no signal. */
  var PEN = 'pen:plan';
  var PEN_START = 8 * 60 + 30;
  var PEN_HOME = 18 * 60;
  var PEN_PLACES = [
    { id:"hotel", n:"ibis Styles, Macquarie St", s:"Hobart", lat:-42.8837, lng:147.3283, stay:0, tags:["start"], note:"Out through Sorell on the A3, then the A9 the whole way. Sealed, all of it." },
    { id:"sorell", n:"Sorell", s:"Sorell", lat:-42.783, lng:147.567, stay:15, tags:["food", "free"], note:"Last supermarket and the last certain fuel. The peninsula is thin on servos — fill here." },
    { id:"richmond", n:"Richmond", s:"Richmond", lat:-42.736, lng:147.438, stay:75, tags:["history", "cafe", "free", "photo-spot"], note:"Australia's oldest bridge still in use, and a gaol older than Port Arthur — the earlier system, not more of the same. Only worth it if you clear Port Arthur by 15:00; the village shuts early in low season. Richmond Bakery serves until 18:00, the latest anywhere on this route." },
    { id:"bluelagoon", n:"Blue Lagoon Oysters, Boomer Bay", s:"Blue Lagoon", lat:-42.855, lng:147.845, stay:25, tags:["food", "local-favourite", "quirky"], note:"A working farm gate, shucked to order. They sell the Angasi — the native Tasmanian oyster — and its season runs late May to late September, so today sits inside it with a fortnight to spare. Wed–Sun 10:00–16:00. Ring ahead for Angasi." },
    { id:"bangor", n:"Bangor Vineyard Shed, Dunalley", s:"Bangor", lat:-42.885, lng:147.805, stay:75, tags:["food", "cafe", "local-favourite"], note:"Oysters pulled from the bay in front of the building. Seven days 10:00–17:00, kitchen closes 16:00, shut only two days a year — the most weatherproof stop on the route. No booking needed at the bar." },
    { id:"dunalley", n:"Dunalley", s:"Dunalley", lat:-42.883, lng:147.8, stay:20, tags:["food", "free"], note:"The swing bridge over the Denison Canal. The bakery is known for its scallop pie, though reviews split hard on the coffee. The Fish Market opens at noon, so it is no use outbound." },
    { id:"pirateslookout", n:"Pirates Bay Lookout", s:"Pirates Bay", lat:-43.005, lng:147.928, stay:20, tags:["must-see", "lookout", "cafe", "free", "photo-spot"], note:"The orientation stop — the whole sweep of the bay, with Cape Hauy and Cape Pillar down the coast. Cubed Espresso is parked on it, a solar-powered 1957 caravan pouring beans roasted on the peninsula. Thursday to Monday from 09:00; sources differ on whether it shuts at 15:00 or 16:00." },
    { id:"tessellated", n:"Tessellated Pavement", s:"Pavement", lat:-43.0105, lng:147.933, stay:40, tags:["must-see", "short walk", "free", "tide-dependent", "photo-spot"], note:"Not a pavement and not man-made: siltstone fractured into a grid, then etched by salt into hollow pans and domed loaves. Wants LOW tide — the pans hold water and the whole grid reads; at high water you are looking at the sea. Check the tide tonight. East-facing, so it takes morning light. Slippery when wet." },
    { id:"dogline", n:"The Dog Line & Officers Quarters", s:"Dog Line", lat:-43.0225, lng:147.92, stay:25, tags:["history", "free", "short walk", "wet-weather-ok"], note:"Thirty metres of sand was all that held the peninsula, so they chained a line of dogs across it. The 1832 Officers Quarters behind is said to be the oldest timber military building in Australia — free museum, 09:00–17:00 — and it explains the semaphore relay that carried news of an escape to Hobart faster than a man could run." },
    { id:"dootown", n:"Doo Town", s:"Doo Town", lat:-43.045, lng:147.945, stay:10, tags:["quirky", "free", "photo-spot"], note:"Thirty-odd shacks, almost all punning on Doo. It started in 1935 when Eric Round nailed up Doo I, his neighbour answered with Doo Me, and a third followed with Doo Us. Gunadoo, Love Me Doo, Rum Doo, Xanadu — and one holdout called Medhust. It is on the way to the Blowhole." },
    { id:"blowhole", n:"The Blowhole & Doo-lishus", s:"Blowhole", lat:-43.034392, lng:147.947942, stay:30, tags:["food", "lookout", "free", "quirky"], note:"A collapsed sea tunnel, and the van in the car park half of Tasmania will tell you about — scallop pie, venison pie, berry ice cream. Carry cash. Two caveats today: the swell is running west-southwest and this coast faces east, so the blowhole may do nothing; and nobody could confirm the van has reopened for the season. 0437 469 412." },
    { id:"tasmanarch", n:"Tasman Arch & Devils Kitchen", s:"Tasman Arch", lat:-43.042071, lng:147.950548, stay:0, tags:["closed"], note:"CLOSED 15 April to 29 September for a rebuild, and the extension covers today. The clifftop track to Waterfall Bay is shut from this end too." },
    { id:"waterfallbay", n:"Waterfall Bay lookout", s:"Waterfall Bay", lat:-43.065, lng:147.96, stay:0, tags:["gravel"], note:"Seven kilometres of gravel to reach it, and the walk-in from Tasman Arch is closed today. Out of reach on both counts. What lies under it: Cathedral Cave, described as the largest sea cave system in Australia." },
    { id:"taranna", n:"Taranna & the Chocolate Foundry", s:"Taranna", lat:-43.057, lng:147.852, stay:25, tags:["food", "history", "quirky", "wet-weather-ok"], note:"Federation Chocolate has LEFT Taranna for Richmond, though half the official listings still send you here. What is at 3 South Street now is the Tasmanian Chocolate Foundry, 10:00–16:00 daily, with viewing windows onto the floor. Taranna was also the end of Australia's first railway — convicts pushed the carriages to Port Arthur, some in leg irons." },
    { id:"unzoo", n:"Tasmanian Devil Unzoo", s:"Unzoo", lat:-43.05, lng:147.9, stay:105, tags:["ticketed", "kid-friendly", "wet-weather-ok"], note:"No perimeter fence — the animals come and go. The only place on the route you will reliably see a devil. About $39 each. Reviewers split hard, and the one useful tip is to arrive after 14:00, when something happens every half hour and feeding is around 16:00." },
    { id:"koonya", n:"Koonya", s:"Koonya", lat:-43.07, lng:147.8, stay:10, tags:["history", "free"], note:"An 1841 probation station whose cell block and officers' quarters were restored in the eighties and stand in plain view from the road. It was called Cascades until 1887, when the name was changed deliberately to scrub off the convict stain." },
    { id:"premaydena", n:"Premaydena & Impression Bay", s:"Premaydena", lat:-43.03, lng:147.79, stay:20, tags:["history", "free", "tide-dependent", "lookout"], note:"An agricultural station with 445 convicts by 1851, and where the typhus ship Persian was towed in 1857 after Hobart refused her. At low tide the timbers of the original rail jetty show in the bay. Cresting Premaydena Hill on the way gives you Norfolk Bay, the Forestier Peninsula and, on a clear day, Maria Island." },
    { id:"coalmines", n:"Coal Mines Historic Site", s:"Coal Mines", lat:-42.988141, lng:147.714598, stay:90, tags:["history", "must-see", "short walk", "free", "local-favourite"], note:"Where Port Arthur sent the men it had given up on. Eighteen underground solitary cells, and mine shafts now readable as circular dips in the paddock. Free, unstaffed and usually empty, which after a morning in Port Arthur's crowds is the entire point. Sources disagree on the last few kilometres — two say sealed to the entrance, others report gravel. You will see the seal end if it does." },
    { id:"nubeena", n:"Nubeena", s:"Nubeena", lat:-43.1, lng:147.75, stay:15, tags:["food", "free"], note:"The peninsula's actual town — two IGAs, a chemist, fuel, toilets. The bakery shuts at 15:00, the earliest closer on the route." },
    { id:"whitebeach", n:"White Beach", s:"White Beach", lat:-43.11, lng:147.74, stay:15, tags:["beach", "free", "photo-spot"], note:"Two and a half kilometres of white sand on Wedge Bay, small waves, usually the warmest water on the peninsula. You can pull off the road straight onto it, so it costs two minutes." },
    { id:"roaringbeach", n:"Roaring Beach", s:"Roaring Beach", lat:-43.11, lng:147.71, stay:45, tags:["beach", "short walk", "photo-spot", "free"], note:"The opposite of the sheltered east coast — a wild south-west-facing surf beach, big dunes, 400 m from the car park. Rips are strong and swimming is not recommended; this is a beach to look at. The final approach surface could not be confirmed." },
    { id:"lavender", n:"Port Arthur Lavender", s:"Lavender", lat:-43.1191, lng:147.86, stay:50, tags:["cafe", "food", "free", "wet-weather-ok"], note:"Eighteen acres of lavender, rainforest and lakes on Long Bay, five minutes short of the Historic Site. April to November it opens 10:00–16:00 — the only place on the route publishing its low-season hours, which is why it is the safest lunch. Be realistic: lavender flowers December to February. Today it is a good café with a view of green rows." },
    { id:"portarthur", n:"Port Arthur Historic Site", s:"Port Arthur", lat:-43.14639, lng:147.85139, stay:240, tags:["must-see", "history", "ticketed", "long walk", "cafe", "wet-weather-ok"], note:"Thirty-odd buildings across forty hectares above the water. $55 each, valid two consecutive days, including the 20-minute harbour cruise, the audio guide and the free guide talks. Book online tonight — the cruise time is chosen at checkout now, not claimed at the desk. Four hours is fair; you could spend six. The Asylum Café is down on the grounds, 11:30–15:30, so lunch need not cost you the walk back up." },
    { id:"stewartsbay", n:"Stewarts Bay", s:"Stewarts Bay", lat:-43.14, lng:147.86, stay:30, tags:["beach", "short walk", "free"], note:"Sheltered and clear, with a coastal track linking it to the Historic Site — the place to decompress either side of Port Arthur without getting back in the car. Reviewers warn the track is overgrown in places and snakey, which matters in September." },
    { id:"safetycove", n:"Safety Cove Beach", s:"Safety Cove", lat:-43.175, lng:147.855, stay:30, tags:["beach", "photo-spot", "free"], note:"Four kilometres south of Port Arthur on the road you are already taking. White sand, usually calm, and the view is out to Tasman Island and the western side of Cape Pillar — the coastline the boat cruise sells you, from a beach, for nothing. The final spur's surface is unconfirmed." },
    { id:"remarkable", n:"Remarkable Cave & Maingon Blowhole", s:"Remarkable Cave", lat:-43.187245, lng:147.844382, stay:90, tags:["must-see", "short walk", "lookout", "free", "photo-spot"], note:"The stop that rescues the day, and sealed the entire way. A sea cave you look down into past 115 steps, and from the same car park a 3.4 km return walk to the Maingon Blowhole — easy, about an hour, and it hands you the Cape Raoul dolerite columns from a road your hire terms allow. Spring wildflowers start about now. Mt Brown continues from the same track if the legs want it." },
    { id:"palmers", n:"Palmers Lookout", s:"Palmers", lat:-43.16, lng:147.83, stay:30, tags:["lookout", "free"], note:"Repeatedly named as worth it, and nobody could establish whether you can drive to it or what the access road is made of. Out until someone local says otherwise — the Maingon Blowhole gives comparable views on a road we know is sealed." },
    { id:"capehauy", n:"Cape Hauy (Fortescue Bay)", s:"Cape Hauy", lat:-43.1307, lng:147.9703, stay:0, tags:["gravel"], note:"Twelve kilometres of gravel to the trailhead, confirmed by Parks and by AllTrails. The finest half-day walk in Tasmania, and the one thing here that matched Mount Amos. Worth a call to Simba: if the exclusion turns on gazetted roads rather than surface, this comes back." },
    { id:"caperaoul", n:"Cape Raoul", s:"Cape Raoul", lat:-43.195255, lng:147.777145, stay:0, tags:["gravel"], note:"Gravel on Stormlea Road — sources say the last kilometre, or the last nine. Either breaches the terms. The full walk runs about five hours anyway and would not fit beside Port Arthur." }
  ];
  var PEN_LEGS = [
    ["hotel","sorell",25],
    ["sorell","richmond",12],
    ["sorell","bluelagoon",18],
    ["bluelagoon","dunalley",7],
    ["dunalley","bangor",3],
    ["sorell","dunalley",22],
    ["dunalley","pirateslookout",25],
    ["pirateslookout","tessellated",4],
    ["tessellated","dogline",5],
    ["dogline","dootown",6],
    ["dootown","blowhole",4],
    ["blowhole","tasmanarch",4],
    ["tasmanarch","waterfallbay",12],
    ["dogline","taranna",14],
    ["taranna","unzoo",4],
    ["taranna","koonya",8],
    ["koonya","premaydena",8],
    ["premaydena","coalmines",15],
    ["premaydena","nubeena",10],
    ["nubeena","whitebeach",6],
    ["whitebeach","roaringbeach",8],
    ["taranna","lavender",8],
    ["lavender","portarthur",5],
    ["portarthur","stewartsbay",4],
    ["portarthur","safetycove",6],
    ["safetycove","remarkable",4],
    ["portarthur","palmers",12],
    ["nubeena","portarthur",14],
    ["blowhole","capehauy",25],
    ["remarkable","caperaoul",40],
    ["portarthur","hotel",78]
  ];

  var penById = {};
  PEN_PLACES.forEach(function(p){ penById[p.id] = p; });
  var penAdj = {};
  PEN_LEGS.forEach(function(l){
    (penAdj[l[0]] = penAdj[l[0]] || []).push([l[1], l[2]]);
    (penAdj[l[1]] = penAdj[l[1]] || []).push([l[0], l[2]]);
  });
  function penRuledOut(p){
    if (p.tags.indexOf('closed') >= 0) return 'closed today';
    if (p.tags.indexOf('gravel') >= 0) return 'gravel — your hire terms';
    return null;
  }

  /* Shortest driving time from one place to all the others. Dijkstra over
     thirty nodes costs nothing, and it beats inventing a number for two
     places no road directly joins. */
  function penTimes(from){
    var dist = {}, seen = {};
    PEN_PLACES.forEach(function(p){ dist[p.id] = Infinity; });
    dist[from] = 0;
    for (;;) {
      var best = null;
      Object.keys(dist).forEach(function(k){
        if (!seen[k] && dist[k] < Infinity && (best === null || dist[k] < dist[best])) best = k;
      });
      if (best === null) break;
      seen[best] = true;
      (penAdj[best] || []).forEach(function(e){
        if (dist[best] + e[1] < dist[e[0]]) dist[e[0]] = dist[best] + e[1];
      });
    }
    return dist;
  }

  function penPlan(){
    try {
      var v = JSON.parse(get(PEN) || 'null');
      if (Object.prototype.toString.call(v) === '[object Array]') {
        return v.filter(function(id){ return penById[id]; });
      }
    } catch (e) {}
    return [];
  }
  function penSave(list){ set(PEN, JSON.stringify(list)); penRender(); }
  function penAt(){ var l = penPlan(); return l.length ? l[l.length - 1] : 'hotel'; }
  function penClock(m){
    var h = Math.floor(m / 60) % 24, mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  // Where the day lands, including getting home from wherever it ends.
  function penFinish(){
    var list = penPlan(), at = 'hotel', t = PEN_START;
    list.forEach(function(id){
      t += penTimes(at)[id] + penById[id].stay;
      at = id;
    });
    return { end: t, home: t + penTimes(at)['hotel'], at: at };
  }

  var penFilter = null;
  var penTagList = ['must-see','lookout','short walk','history','beach','cafe','food',
                    'free','ticketed','photo-spot','local-favourite','quirky',
                    'tide-dependent','wet-weather-ok','kid-friendly'];

  /* Twenty-eight pins in a peninsula that is mostly one road means labels
     land on top of each other. Try above the pin, then below, then out to
     each side, and if every one of those is taken, leave the pin unlabelled
     rather than print mush — it is still tappable, and the list below names
     everything anyway. */
  var PEN_FS = 21;
  function penLabelSpot(text, cx, cy, r, W, H, taken){
    var w = text.length * PEN_FS * 0.55, h = PEN_FS;
    var tries = [
      { x:cx, y:cy - r - 9,      anchor:'middle', x0:cx - w / 2, y0:cy - r - 9 - h },
      { x:cx, y:cy + r + h + 3,  anchor:'middle', x0:cx - w / 2, y0:cy + r + 3 },
      { x:cx + r + 8, y:cy + 7,  anchor:'start',  x0:cx + r + 8, y0:cy + 7 - h },
      { x:cx - r - 8, y:cy + 7,  anchor:'end',    x0:cx - r - 8 - w, y0:cy + 7 - h }
    ];
    for (var i = 0; i < tries.length; i++) {
      var t = tries[i];
      if (t.x0 < 2 || t.x0 + w > W - 2 || t.y0 < 2 || t.y0 + h > H - 2) continue;
      var clash = false;
      for (var k = 0; k < taken.length; k++) {
        var o = taken[k];
        if (t.x0 < o.x0 + o.w && t.x0 + w > o.x0 && t.y0 < o.y0 + o.h && t.y0 + h > o.y0) { clash = true; break; }
      }
      if (!clash) { taken.push({ x0:t.x0, y0:t.y0, w:w, h:h }); return t; }
    }
    return null;
  }

  /* The day's stops are not evenly spread: two dozen sit on the peninsula
     and a handful trail back up the highway to Richmond. Fitting all of
     them squeezes the part you are actually driving into a corner, so the
     map opens on the peninsula and you pan or zoom out for the rest.
     Panning moves the viewBox rather than re-rendering, so labels grow as
     you zoom in instead of staying eight pixels tall. */
  var penView = null, penFull = null;
  var PEN_PENINSULA = -42.96;   // everything south of this is the day proper

  function penMap(){
    var wrap = document.getElementById('pen-map');
    if (!wrap) return;
    var shown = PEN_PLACES.filter(function(p){ return p.id !== 'hotel'; });
    var lats = shown.map(function(p){ return p.lat; });
    var lngs = shown.map(function(p){ return p.lng; });
    var north = Math.max.apply(null, lats), south = Math.min.apply(null, lats);
    var west = Math.min.apply(null, lngs), east = Math.max.apply(null, lngs);
    var k = Math.cos((north + south) / 2 * Math.PI / 180);
    var pad = 0.04;
    var W = 1000;
    var H = Math.round(W * ((north - south) + pad * 2) / (((east - west) + pad * 2) * k));
    function X(lng){ return ((lng - west + pad) * k) / (((east - west) + pad * 2) * k) * W; }
    function Y(lat){ return ((north - lat + pad) / ((north - south) + pad * 2)) * H; }

    if (!penView) {
      var core = shown.filter(function(q){ return q.lat <= PEN_PENINSULA; });
      if (core.length < 3) core = shown;
      var cx0 = Math.min.apply(null, core.map(function(q){ return X(q.lng); }));
      var cx1 = Math.max.apply(null, core.map(function(q){ return X(q.lng); }));
      var cy0 = Math.min.apply(null, core.map(function(q){ return Y(q.lat); }));
      var cy1 = Math.max.apply(null, core.map(function(q){ return Y(q.lat); }));
      var m = 150;   // room for a label that has to sit left of its pin
      penView = { x: cx0 - m, y: cy0 - m, w: (cx1 - cx0) + m * 2, h: (cy1 - cy0) + m * 2 };
    }
    penFull = { x: 0, y: 0, w: W, h: H };

    var here = penAt(), plan = penPlan(), out = [];
    out.push('<svg id="pen-svg" viewBox="' + penView.x.toFixed(1) + ' ' + penView.y.toFixed(1) + ' ' +
             penView.w.toFixed(1) + ' ' + penView.h.toFixed(1) + '" class="w-full block" ' +
             'style="background:#eef5f1;touch-action:none" role="img" ' +
             'aria-label="Map of the stops between Hobart and Port Arthur">');
    PEN_LEGS.forEach(function(l){
      var a = penById[l[0]], b = penById[l[1]];
      if (!a || !b || a.id === 'hotel' || b.id === 'hotel') return;
      out.push('<line x1="' + X(a.lng).toFixed(1) + '" y1="' + Y(a.lat).toFixed(1) +
               '" x2="' + X(b.lng).toFixed(1) + '" y2="' + Y(b.lat).toFixed(1) +
               '" stroke="#b9cfc4" stroke-width="3" stroke-linecap="round"/>');
    });
    /* Seed the collision set with the pins themselves, or labels land on
       top of circles that are not theirs. */
    var taken = shown.map(function(q){
      var qr = (q.id === here ? 15 : 11) + 3;
      return { x0: X(q.lng) - qr, y0: Y(q.lat) - qr, w: qr * 2, h: qr * 2 };
    });
    var order = shown.slice().sort(function(a, b){
      var rank = function(x){
        return (x.id === here ? 0 : 0) + (penRuledOut(x) ? 2 : 0) +
               (x.tags.indexOf('must-see') >= 0 ? -1 : 0);
      };
      return rank(a) - rank(b);
    });
    order.forEach(function(p){
      var ruled = penRuledOut(p), been = plan.indexOf(p.id) >= 0, isHere = p.id === here;
      var fill = ruled ? '#cbd5e1' : isHere ? '#b45309' : been ? '#94a3b8' : '#0f3d2e';
      var r = isHere ? 15 : 11;
      var cx = X(p.lng), cy = Y(p.lat);
      out.push('<g class="pen-pin" data-pin="' + p.id + '" style="cursor:pointer">');
      out.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (r + 10) + '" fill="transparent"/>');
      out.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r + '" fill="' + fill + '" stroke="#ffffff" stroke-width="3"/>');
      var spot = penLabelSpot(p.s, cx, cy, r, W, H, taken);
      if (spot) {
        out.push('<text x="' + spot.x.toFixed(1) + '" y="' + spot.y.toFixed(1) +
                 '" text-anchor="' + spot.anchor + '" font-size="' + PEN_FS + '" font-weight="600" fill="#0f3d2e"' +
                 ' stroke="#eef5f1" stroke-width="5" paint-order="stroke">' + p.s + '</text>');
      }
      out.push('</g>');
    });
    out.push('</svg>');
    wrap.innerHTML = out.join('');
    var svg = wrap.querySelector('svg');

    /* A tap on a pin picks it; a drag moves the map. Telling them apart is
       the whole trick — without the distance test every pan that starts on
       a pin adds a stop you did not choose. */
    var down = null, moved = false, pointers = {}, pinch = null;
    function apply(){
      svg.setAttribute('viewBox', penView.x.toFixed(1) + ' ' + penView.y.toFixed(1) + ' ' +
                                  penView.w.toFixed(1) + ' ' + penView.h.toFixed(1));
    }
    function zoom(factor, ox, oy){
      var nw = Math.min(penFull.w * 1.6, Math.max(penFull.w / 14, penView.w * factor));
      var scale = nw / penView.w;
      penView.x = ox - (ox - penView.x) * scale;
      penView.y = oy - (oy - penView.y) * scale;
      penView.w = nw;
      penView.h = penView.h * scale;
      apply();
    }
    function toUser(ev){
      var r = svg.getBoundingClientRect();
      return { x: penView.x + (ev.clientX - r.left) / r.width * penView.w,
               y: penView.y + (ev.clientY - r.top) / r.height * penView.h };
    }
    svg.addEventListener('pointerdown', function(ev){
      pointers[ev.pointerId] = ev;
      if (Object.keys(pointers).length === 2) {
        var ps = Object.keys(pointers).map(function(k){ return pointers[k]; });
        pinch = { d: Math.hypot(ps[0].clientX - ps[1].clientX, ps[0].clientY - ps[1].clientY) };
        return;
      }
      down = { x: ev.clientX, y: ev.clientY, vx: penView.x, vy: penView.y };
      moved = false;
      svg.setPointerCapture(ev.pointerId);
    });
    svg.addEventListener('pointermove', function(ev){
      if (pointers[ev.pointerId]) pointers[ev.pointerId] = ev;
      var ids = Object.keys(pointers);
      if (pinch && ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch.d > 0) {
          var mid = toUser({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
          zoom(pinch.d / d, mid.x, mid.y);
        }
        pinch.d = d;
        moved = true;
        return;
      }
      if (!down) return;
      var r = svg.getBoundingClientRect();
      var dx = (ev.clientX - down.x) / r.width * penView.w;
      var dy = (ev.clientY - down.y) / r.height * penView.h;
      if (Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 6) moved = true;
      penView.x = down.vx - dx;
      penView.y = down.vy - dy;
      apply();
    });
    function release(ev){
      delete pointers[ev.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      down = null;
    }
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('wheel', function(ev){
      ev.preventDefault();
      var u = toUser(ev);
      zoom(ev.deltaY > 0 ? 1.15 : 0.87, u.x, u.y);
    }, { passive: false });

    wrap.querySelectorAll('.pen-pin').forEach(function(g){
      g.addEventListener('click', function(){ if (!moved) penGo(g.dataset.pin); });
    });

    var bar = bmk('div', 'absolute top-2 right-2 flex gap-1');
    [['\u2212', function(){ zoom(1.4, penView.x + penView.w / 2, penView.y + penView.h / 2); }],
     ['+', function(){ zoom(0.7, penView.x + penView.w / 2, penView.y + penView.h / 2); }],
     ['all', function(){ penView = { x:0, y:0, w:penFull.w, h:penFull.h }; apply(); }]
    ].forEach(function(spec){
      var b = bmk('button', 'text-xs font-semibold bg-white/90 border border-sand-200 text-slate-700 rounded-lg px-2.5 py-1.5 shadow-soft', spec[0]);
      b.type = 'button';
      b.setAttribute('aria-label', spec[0] === '+' ? 'Zoom in' : spec[0] === 'all' ? 'Show everything' : 'Zoom out');
      b.addEventListener('click', spec[1]);
      bar.appendChild(b);
    });
    wrap.appendChild(bar);
  }

  function penGo(id){
    var p = penById[id];
    if (!p) return;
    var ruled = penRuledOut(p);
    if (ruled && !window.confirm(p.n + ' is ' + ruled + '. Add it anyway?')) return;
    var list = penPlan();
    list.push(id);
    penSave(list);
  }

  function penRender(){
    var list = penPlan(), here = penAt(), times = penTimes(here), fin = penFinish();

    document.getElementById('pen-here').textContent = penById[here].n;
    document.getElementById('pen-clock').textContent = penClock(fin.end);
    var homeEl = document.getElementById('pen-home');
    var over = fin.home > PEN_HOME;
    homeEl.textContent = penClock(fin.home) + (over ? ' · over' : '');
    homeEl.className = 'text-sm font-semibold ' + (over ? 'text-amber-700' : 'text-forest-800');

    var mount = document.getElementById('pen-plan');
    mount.textContent = '';
    if (!list.length) {
      mount.appendChild(bmk('p', 'px-4 py-3 text-sm text-slate-500', 'Nothing chosen yet. Leaving the hotel at 08:30.'));
    }
    var at = 'hotel', t = PEN_START;
    list.forEach(function(id, i){
      var drive = penTimes(at)[id], p = penById[id];
      t += drive;
      var row = bmk('div', 'px-4 py-3 flex items-start gap-3');
      var col = bmk('div', 'flex-1 min-w-0');
      col.appendChild(bmk('div', 'text-sm font-medium', penClock(t) + ' · ' + p.n));
      col.appendChild(bmk('div', 'text-xs text-slate-500 mt-0.5', drive + ' min drive, then ' + p.stay + ' min here'));
      row.appendChild(col);
      if (i === list.length - 1) {
        var undo = bmk('button', 'shrink-0 text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1', 'Undo');
        undo.type = 'button';
        undo.addEventListener('click', function(){ var l = penPlan(); l.pop(); penSave(l); });
        row.appendChild(undo);
      }
      t += p.stay;
      at = id;
      mount.appendChild(row);
    });

    var next = document.getElementById('pen-next');
    next.textContent = '';
    var cands = PEN_PLACES.filter(function(p){
      if (p.id === 'hotel' || p.id === here) return false;
      if (penFilter && p.tags.indexOf(penFilter) < 0) return false;
      return true;
    }).sort(function(a, b){ return (times[a.id] || 9999) - (times[b.id] || 9999); });
    document.getElementById('pen-count').textContent = cands.length + ' places';

    cands.forEach(function(p){
      var ruled = penRuledOut(p), been = list.indexOf(p.id) >= 0;
      var mins = times[p.id] === Infinity ? null : times[p.id];
      var row = bmk('div', 'px-4 py-3');
      var head = bmk('div', 'flex items-baseline gap-2');
      head.appendChild(bmk('div', 'text-sm font-medium flex-1 min-w-0', p.n));
      head.appendChild(bmk('div', 'text-xs font-semibold text-slate-500 shrink-0', mins === null ? '—' : mins + ' min'));
      row.appendChild(head);

      var chips = bmk('div', 'flex flex-wrap gap-1 mt-1.5');
      if (ruled) chips.appendChild(bmk('span', 'badge bg-red-100 text-red-800', ruled));
      if (been) chips.appendChild(bmk('span', 'badge bg-slate-100 text-slate-600', 'been'));
      p.tags.forEach(function(tag){
        if (tag === 'closed' || tag === 'gravel' || tag === 'start') return;
        var cls = tag === 'must-see' ? 'badge bg-forest-100 text-forest-800'
                : tag === 'tide-dependent' ? 'badge bg-amber-100 text-amber-800'
                : 'badge bg-sand-100 text-slate-600';
        chips.appendChild(bmk('span', cls, tag));
      });
      row.appendChild(chips);
      row.appendChild(bmk('p', 'text-[13px] text-slate-600 leading-relaxed mt-1.5', p.note));

      var go = bmk('button', 'mt-2 text-xs font-semibold bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800',
                   mins === null ? 'Go here' : 'Go here · arrive ' + penClock(fin.end + mins));
      go.type = 'button';
      go.addEventListener('click', function(){ penGo(p.id); });
      row.appendChild(go);
      next.appendChild(row);
    });

    penMap();
  }

  if (document.getElementById('pen-next')) {
    var penTagWrap = document.getElementById('pen-tags');
    penTagList.forEach(function(tag){
      var b = bmk('button', 'badge bg-white border border-sand-200 text-slate-600 hover:bg-sand-50', tag);
      b.type = 'button';
      b.addEventListener('click', function(){
        penFilter = (penFilter === tag) ? null : tag;
        penTagWrap.querySelectorAll('button').forEach(function(x){
          x.className = x.textContent === penFilter
            ? 'badge bg-forest-900 text-white border border-forest-900'
            : 'badge bg-white border border-sand-200 text-slate-600 hover:bg-sand-50';
        });
        penRender();
      });
      penTagWrap.appendChild(b);
    });
    document.getElementById('pen-reset').addEventListener('click', function(){ del(PEN); penRender(); });
    penRender();
  }

  /* ── keeping the ticks ──────────────────────────────────────────
     Safari clears script-writable storage for sites left unvisited for
     about a week, which spans the gap between packing and flying. Ask
     for persistent storage so the checklists survive it — browsers grant
     it silently to installed apps and refuse it silently otherwise, so
     say which way it went rather than leaving it to chance. */
  var storeNote = document.getElementById('store-note');
  function paintStore(granted){
    if (!storeNote) return;
    storeNote.classList.remove('hidden');
    if (granted === true) {
      storeNote.className = 'text-[12px] mt-2 text-forest-800';
      storeNote.textContent = '\u2713 Saved on this device and marked permanent \u2014 your ticks will still be here on the 12th.';
    } else if (granted === false) {
      storeNote.className = 'text-[12px] mt-2 text-amber-800';
      storeNote.textContent = '\u26a0 Saved on this device, but the browser won\u2019t mark it permanent. Install this page to your home screen \u2014 iOS clears storage for sites left unopened for about a week, and installing exempts it.';
    } else {
      storeNote.classList.add('hidden');
    }
  }
  function askPersist(){
    if (!navigator.storage || !navigator.storage.persist) { paintStore(null); return; }
    navigator.storage.persisted().then(function(already){
      if (already) { paintStore(true); return; }
      return navigator.storage.persist().then(paintStore);
    }).catch(function(){ paintStore(null); });
  }
  askPersist();

  /* ── offline app ────────────────────────────────────────────────
     Register the service worker, surface an install button when the
     browser offers one, and say so plainly when there's no signal. */
  var pill = document.getElementById('net-pill');
  function paintNet(){
    if (!pill) return;
    pill.classList.toggle('hidden', navigator.onLine !== false);
  }
  window.addEventListener('online', paintNet);
  window.addEventListener('offline', paintNet);
  paintNet();

  var installBtn = document.getElementById('install-btn');
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferred = e;
    if (installBtn) installBtn.classList.remove('hidden');
  });
  if (installBtn) {
    installBtn.addEventListener('click', function(){
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function(){ deferred = null; installBtn.classList.add('hidden'); });
    });
  }
  window.addEventListener('appinstalled', function(){
    deferred = null;
    if (installBtn) installBtn.classList.add('hidden');
    askPersist();               // installing is what flips the answer
  });

  /* Android and desktop Chrome fire beforeinstallprompt, so they get the
     Install button above. iOS has no equivalent API — the share sheet is the
     only way on — and until this hint the page said nothing about it, which
     is how you end up standing in a valley with a browser tab. */
  var iosHint = document.getElementById('ios-install');
  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (iosHint && isIOS && !installed && get('ios-hint') !== '1') {
    iosHint.classList.remove('hidden');
    document.getElementById('ios-install-x').addEventListener('click', function(){
      iosHint.classList.add('hidden');
      set('ios-hint', '1');
    });
  }

  function offerUpdate(worker){
    var bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'updatebar fixed left-1/2 -translate-x-1/2 z-50 text-sm font-semibold bg-forest-900 text-white px-4 py-2.5 rounded-2xl shadow-soft';
    bar.textContent = 'A newer plan is ready — tap to update';
    bar.addEventListener('click', function(){
      worker.postMessage('skip-waiting');
      bar.textContent = 'Updating…';
    });
    document.body.appendChild(bar);
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Captured before any worker can claim this page.
    var hadController = !!navigator.serviceWorker.controller;
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').then(function(reg){
        if (reg.waiting) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', function(){
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function(){
            // Only an update if a worker was already in charge.
            if (sw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(sw);
          });
        });
      }).catch(function(){ /* offline app is a bonus, never a blocker */ });

      /* The worker calls clients.claim(), so the first one to install takes
         control of this very page and fires controllerchange on a first
         visit too. Reloading then is pointless — the page came off the
         network a moment ago — and it costs a section named in the URL,
         which has already been read and cleared by the time the reload
         lands. Same test the update bar uses: only a worker replacing one
         already in charge is worth a reload. */
      var reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function(){
        if (reloading || !hadController) return;
        reloading = true;
        location.reload();
      });
    });
  }
})();
