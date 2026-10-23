/* Useful Data Resources - search, filters, and rendering.
   Data comes from data/resources.js (window.UDR), written by export_site.py. */
(function () {
  // Paste the Google Form's share link here once it exists.
  const SUGGEST_URL = '';

  const D = window.UDR;
  if (!D) {
    document.getElementById('stamp').textContent = 'Could not load the list.';
    return;
  }
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const archive = (url) => 'https://web.archive.org/web/2/' + url;
  const sortKey = (s) => s.toLowerCase().replace(/^the\s+/, '');

  const STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
    IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
    NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
    NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
    RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
    VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  };
  // Local sources that belong to a state's list
  const LOCAL_STATE = { NYC: 'NY', DC: 'DC' };
  const stateOf = (r) => {
    if (r.geography !== 'US state' && r.geography !== 'US local') return '';
    if (STATES[r.place]) return r.place;
    return LOCAL_STATE[r.place] || '';
  };

  const ACCESS_CLASS = {
    'Open download': 'open', 'Free registration': 'reg', 'Application or restricted': 'restricted', 'Mixed': 'mixed',
  };
  const LEVEL_SHORT = { 'General (not education-specific)': 'General' };

  const rows = D.resources.filter((r) => r.status !== 'Broken').map((r) => ({
    ...r,
    state: stateOf(r),
    hay: [r.name, r.description, r.topics.join(' '), r.place, STATES[stateOf(r)] || '', r.level, r.kind].join(' ').toLowerCase(),
  }));
  rows.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));

  // Filters: key in the URL, label, and how to read a row's value(s)
  const FILTERS = [
    { key: 'level', label: 'Level', get: (r) => [r.level], order: ['K-12', 'Postsecondary', 'Early childhood', 'Multiple levels', 'General (not education-specific)'] },
    { key: 'geo', label: 'Geography', get: (r) => [r.geography], order: ['US national', 'US state', 'US local', 'International', 'Global/mixed'] },
    { key: 'state', label: 'State', get: (r) => (r.state ? [r.state] : []), name: (v) => STATES[v] || v },
    { key: 'topic', label: 'Topic', get: (r) => r.topics },
    { key: 'access', label: 'Access', get: (r) => [r.access], order: ['Open download', 'Free registration', 'Mixed', 'Application or restricted', 'Not yet checked'] },
    { key: 'kind', label: 'Kind', get: (r) => [r.kind], order: ['Dataset', 'Data portal', 'Data tool or dashboard', 'Repository', 'List of sources'] },
  ];

  const state = { q: '' };
  FILTERS.forEach((f) => { state[f.key] = ''; });

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    state.q = p.get('q') || '';
    FILTERS.forEach((f) => { state[f.key] = p.get(f.key) || ''; });
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    FILTERS.forEach((f) => { if (state[f.key]) p.set(f.key, state[f.key]); });
    const h = p.toString();
    history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }

  // Rough stemming so "salary" finds "salaries" and "teachers" finds "teacher"
  const stem = (w) => (w.length > 4 ? w.replace(/(ies|es|s|y)$/, '') : w);
  let stemsFor = null, stems = [];
  function queryStems() {
    if (stemsFor !== state.q) { stemsFor = state.q; stems = state.q.toLowerCase().split(/\s+/).filter(Boolean).map(stem); }
    return stems;
  }

  function matches(r, skip) {
    if (state.q && !queryStems().every((w) => r.hay.includes(w))) return false;
    return FILTERS.every((f) => f.key === skip || !state[f.key] || f.get(r).includes(state[f.key]));
  }

  // Build the selects once; counts refresh on every change
  const selects = {};
  FILTERS.forEach((f) => {
    const values = new Set();
    rows.forEach((r) => f.get(r).forEach((v) => values.add(v)));
    let list = [...values];
    if (f.order) list = f.order.filter((v) => values.has(v)).concat(list.filter((v) => !f.order.includes(v)));
    else list.sort((a, b) => (f.name ? f.name(a) : a).localeCompare(f.name ? f.name(b) : b));
    f.values = list;
    const label = document.createElement('label');
    label.innerHTML = `<span>${esc(f.label)}</span>`;
    const sel = document.createElement('select');
    sel.addEventListener('change', () => { state[f.key] = sel.value; update(); });
    label.appendChild(sel);
    $('filters').appendChild(label);
    selects[f.key] = sel;
  });

  function refreshSelects() {
    FILTERS.forEach((f) => {
      const sel = selects[f.key];
      const pool = rows.filter((r) => matches(r, f.key));
      const counts = {};
      pool.forEach((r) => f.get(r).forEach((v) => { counts[v] = (counts[v] || 0) + 1; }));
      const opts = [`<option value="">All</option>`].concat(f.values.map((v) => {
        const n = counts[v] || 0;
        const name = f.name ? f.name(v) : v;
        return `<option value="${esc(v)}"${n ? '' : ' disabled'}>${esc(name)} (${n})</option>`;
      }));
      sel.innerHTML = opts.join('');
      sel.value = state[f.key];
      sel.classList.toggle('on', !!state[f.key]);
    });
  }

  function metaHTML(r, withTopics) {
    const place = r.state ? STATES[r.state] || r.place : r.place;
    const geo = place && r.place !== 'All states' ? place : r.place === 'All states' ? 'All states' : r.geography;
    const items = [
      `<li class="access ${ACCESS_CLASS[r.access] || 'mixed'}">${esc(r.access)}</li>`,
      `<li>${esc(LEVEL_SHORT[r.level] || r.level)}</li>`,
      `<li>${esc(geo)}</li>`,
      r.unit && r.unit !== 'Varies' && r.unit !== 'Other' ? `<li>${esc(r.unit)}-level</li>` : '',
      `<li>${esc(r.kind)}</li>`,
    ];
    if (withTopics) {
      r.topics.filter((t) => t !== 'general').forEach((t) => {
        items.push(`<li style="background:none;padding:0"><button type="button" class="topic" data-topic="${esc(t)}">${esc(t)}</button></li>`);
      });
      if (r.link) items.push(`<li class="arch"><a href="${esc(archive(r.link))}" rel="noopener" title="Internet Archive's most recent copy">archived</a></li>`);
    }
    return `<ul class="meta">${items.join('')}</ul>`;
  }

  function renderResults() {
    const hits = rows.filter((r) => matches(r));
    $('results').innerHTML = hits.map((r) => `
      <li class="result">
        <h3>${r.link ? `<a href="${esc(r.link)}" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}${r.start ? '<span class="badge-start">Start here</span>' : ''}</h3>
        <p class="desc clamp">${esc(r.description)}</p>
        ${metaHTML(r, true)}
      </li>`).join('');
    $('results').querySelectorAll('.desc').forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'linkish more'; b.textContent = 'Show more'; b.hidden = true;
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') !== 'true';
        p.classList.toggle('clamp', !open);
        b.textContent = open ? 'Show less' : 'Show more';
        b.setAttribute('aria-expanded', String(open));
      });
      p.after(b);
    });
    if (lastW) fitClamps();
    const active = state.q || FILTERS.some((f) => state[f.key]);
    $('count').textContent = active ? `${hits.length} of ${rows.length} sources` : `${rows.length} sources`;
    $('clear').hidden = !active;
    $('empty').hidden = hits.length > 0;
  }

  // "Show more" only where a description is actually cut off at the current width
  function fitClamps() {
    $('results').querySelectorAll('.desc').forEach((p) => {
      const b = p.nextElementSibling;
      if (b.getAttribute('aria-expanded') === 'true') return;
      p.classList.add('clamp');
      b.hidden = p.scrollHeight - p.clientHeight < 4;
    });
  }
  // Re-measure whenever the list's width changes (window resize, fonts, first layout)
  let lastW = 0;
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w && w !== lastW) { lastW = w; fitClamps(); }
  }).observe($('results'));

  function renderStates() {
    const counts = {};
    rows.forEach((r) => { if (r.state) counts[r.state] = (counts[r.state] || 0) + 1; });
    $('state-grid').innerHTML = Object.keys(STATES).sort().map((c) => {
      const n = counts[c] || 0;
      return `<button type="button" data-state="${c}" class="${n ? '' : 'none'}" aria-pressed="${state.state === c}" title="${esc(STATES[c])}"${n ? '' : ' aria-disabled="true"'}>
        <span class="code">${c}</span><span class="n">${n || '–'}</span></button>`;
    }).join('');
    const multi = rows.filter((r) => r.place === 'All states' || r.place === 'All counties').length;
    const covered = Object.keys(counts).length;
    $('state-note').textContent = `${covered} of the 50 states and DC have at least one state-specific source. Another ${multi} sources have data for every state; filter Geography to "US state" to see them.`;
  }

  function update() {
    writeHash();
    refreshSelects();
    renderResults();
    $('state-grid').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.state === state.state)));
  }

  // Start here
  $('start-grid').innerHTML = rows.filter((r) => r.start).map((r) => `
    <article class="start-card">
      <h3><a href="${esc(r.link)}" rel="noopener">${esc(r.name)}</a></h3>
      <p>${esc(r.description)}</p>
      ${metaHTML(r, false)}
    </article>`).join('');

  // Learning resources, grouped by type
  const groups = {};
  D.learning.filter((r) => r.status !== 'Broken').forEach((r) => { (groups[r.type] = groups[r.type] || []).push(r); });
  const TYPE_HEADINGS = {
    'Textbook': 'Textbooks', 'Course materials': 'Course materials', 'Coding guide': 'Coding guides',
    'R package': 'R packages', 'Writing guide': 'Research and writing guides', 'Podcast': 'Podcasts',
    'Tool': 'Tools', 'List of resources': 'Other lists',
  };
  $('learning-list').innerHTML = Object.keys(TYPE_HEADINGS).filter((t) => groups[t]).map((t) => `
    <div><h3>${esc(TYPE_HEADINGS[t])}</h3><ul>
      ${groups[t].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name))).map((r) => `
        <li><a href="${esc(r.link)}" rel="noopener">${esc(r.name)}</a><span>${esc(r.description)}</span></li>`).join('')}
    </ul></div>`).join('');

  // Events
  let t;
  $('q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); update(); }, 120); });
  $('clear').addEventListener('click', () => {
    state.q = ''; $('q').value = '';
    FILTERS.forEach((f) => { state[f.key] = ''; });
    update();
  });
  $('results').addEventListener('click', (e) => {
    const b = e.target.closest('button.topic');
    if (!b) return;
    state.topic = b.dataset.topic;
    update();
    $('browse').scrollIntoView();
  });
  $('state-grid').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-state]');
    if (!b || b.classList.contains('none')) return;
    state.state = state.state === b.dataset.state ? '' : b.dataset.state;
    state.geo = '';
    update();
    if (state.state) $('browse').scrollIntoView();
  });
  window.addEventListener('hashchange', () => {
    const p = new URLSearchParams(location.hash.slice(1));
    if (![...p.keys()].some((k) => k === 'q' || FILTERS.some((f) => f.key === k))) return; // a section link
    readHash(); $('q').value = state.q; update();
  });

  // Suggestion form
  if (SUGGEST_URL) $('suggest-link').href = SUGGEST_URL;
  else $('suggest').innerHTML = '<strong>Suggest a source.</strong> A suggestion form is coming soon.';

  const fmt = new Date(D.checked + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  $('stamp').textContent = `${rows.length} data sources and ${D.learning.length} learning resources · Links last checked ${fmt}`;

  // Section links (#browse etc.) shouldn't be read as filters
  if (/[=]/.test(location.hash)) readHash();
  $('q').value = state.q;
  renderStates();
  update();
})();
