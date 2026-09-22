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
  var NS = 'india-nov-2026:';
  function get(k){ try { return localStorage.getItem(NS+k); } catch(e){ return null; } }
  function set(k,v){ try { localStorage.setItem(NS+k,v); } catch(e){} }
  function del(k){ try { localStorage.removeItem(NS+k); } catch(e){} }

  /* ── countdown ──────────────────────────────────────────────────
     The trip has two ends, and both matter. Counting only from the
     start and guessing at a length is how the header came to announce
     'trip done' on the Friday, with two days still to run. */
  var start = new Date('2026-11-02T09:00:00+05:30');
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
    return /^[a-z0-9][a-z0-9-]{0,63}$/.test(seg) ? seg : 'india-nov-2026';
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
    { k:"f1", g:"flights", p:25238, t:"Delhi \u2192 Bangalore \u00b7 6E 873", n:"booked \u00b7 2 seats \u00b7 \u20b912,619 each. No confirmation email reached this inbox \u2014 add the PNR here when you have it" },
    { k:"f2", g:"flights", p:21797, t:"Chandigarh \u2192 Bangalore \u00b7 6E 6634", n:"booked \u00b7 2 seats for your parents \u00b7 \u20b910,898 each" },
    { k:"f3", g:"flights", p:39770, t:"Bangalore \u2192 Mumbai \u00b7 6E 5351", n:"booked \u00b7 4 seats \u00b7 \u20b99,942 each" },
    { k:"f4", g:"flights", p:65849, t:"Mumbai \u2192 Chandigarh \u00b7 AI 2659", n:"booked \u00b7 4 seats \u00b7 \u20b916,462 each \u2014 the dearest leg by a distance" },
    { k:"s1", g:"stays", p:5579, t:"Delhi \u00b7 The Elevate, Aerocity", n:"to book \u00b7 1 night, 1 room \u00b7 Booking.com, 22 Sep. Free airport pickup" },
    { k:"s2", g:"stays", p:14106, t:"Bangalore \u00b7 Olive Zip Indiranagar", n:"to book \u00b7 2 nights, 2 rooms \u00b7 Booking.com, 22 Sep \u00b7 9.0 from 439 reviews" },
    { k:"s3", g:"stays", p:39528, t:"Mumbai \u00b7 Residency Hotel Fort", n:"to book \u00b7 2 nights, 2 rooms \u00b7 Booking.com, 22 Sep \u00b7 8.7 from 2,451 reviews" },
    { k:"g1", g:"sights", p:700, t:"CSMVS museum, Mumbai", n:"Thu afternoon \u00b7 the indoor hour between lunch and the sunset walk" },
    { k:"g2", g:"sights", p:1000, t:"Bangalore Palace entry", n:"Tue \u00b7 4 tickets plus the separate camera fee" },
    { k:"g3", g:"sights", p:200, t:"Lalbagh entry", n:"Tue \u00b7 nominal per head" },
    { k:"m1", g:"food", p:9000, t:"Bangalore \u00b7 eating", n:"Two evenings and a full day. Taaza Thindi and CTR are about \u20b980\u2013150 a head" },
    { k:"m2", g:"food", p:20000, t:"Mumbai \u00b7 eating", n:"The point of the trip. Britannia ~\u20b9500\u2013800 a head, Muhammad Ali Road and Chowpatty \u20b9100\u2013200, Bademiya ~\u20b9200" },
    { k:"m3", g:"food", p:1500, t:"Delhi \u00b7 one dinner", n:"Arriving 20:15 \u2014 hotel or Worldmark Aerocity" },
    { k:"t1", g:"food", p:6000, t:"Airport transfers", n:"Four airport runs across the week, four people with luggage" },
    { k:"t2", g:"food", p:5000, t:"Getting about", n:"Autos and cabs inside Bangalore and Mumbai" },
    { k:"buf", g:"food", p:8000, t:"Buffer", n:"Tips, water, the thing nobody planned for" }
  ];
  var BNUMCLS = 'w-full bg-sand-50 border border-sand-200 rounded-lg px-2 py-1.5 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-forest-700/30';
  var BTXTCLS = 'w-full bg-white border border-sand-200 rounded-lg px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-forest-700/30';

  var bmounts = {};
  document.querySelectorAll('[data-brows]').forEach(function(m){ bmounts[m.dataset.brows] = m; });
  var bmoney = function(n){ return '\u20b9' + Math.round(n).toLocaleString('en-IN'); };
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
      lab.appendChild(bmk('span', 'text-slate-400 text-sm', '\u20b9'));
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
    document.getElementById('per-person').textContent = bmoney(now / 4) + ' per person';
    document.getElementById('per-day').textContent = bmoney(now / 5);
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
