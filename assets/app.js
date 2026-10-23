/* Useful Data Resources - search, filters, and rendering.
   Data comes from data/resources.js (window.UDR), written by export_site.py. */
(function () {
  // The "Suggest a Data Source" Google Form. The short link is for the About section; the full
  // address takes pre-filled answers. If you rebuild the form, update the entry IDs too (they're in
  // the page source of the live form, or via ⋮ → Get pre-filled link in the form editor).
  const SUGGEST_URL = 'https://forms.gle/hpsQShDawoB16JiR9';
  const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSf0XzVElF1vTukrjKzbSEpx1E0lT1jXhDpMHKlcCQ-tut7NYQ/viewform';
  const ENTRY = { action: 'entry.1025311559', name: 'entry.296759305', link: 'entry.2006265283' };
  const reportURL = (r) => FORM_URL + '?' + new URLSearchParams({
    usp: 'pp_url',
    [ENTRY.action]: 'Report a broken or outdated link',
    [ENTRY.name]: r.name,
    [ENTRY.link]: r.link,
  });

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
  const UNIT_NAMES = { 'Individual': 'Individual (student, teacher, household)', 'Varies': 'Varies by dataset' };

  const rows = D.resources.filter((r) => r.status !== 'Broken').map((r) => {
    const levels = r.levels || [r.level];
    const units = r.units || (r.unit ? [r.unit] : []); // a source can report at several units
    return {
      ...r,
      levels,
      units,
      state: stateOf(r),
      hay: [r.name, r.summary || '', r.description, r.topics.join(' '), r.place, STATES[stateOf(r)] || '', levels.join(' '), units.join(' '), r.kind].join(' ').toLowerCase(),
    };
  });
  rows.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));

  // Filters: key in the URL, label, and how to read a row's value(s). A source that covers
  // several levels lists each one, so it shows up under every level it covers.
  // Sources added in the last four months (the workbook's Added column) get a "New" badge
  const NEW_DAYS = 120;
  const isNew = (r) => !!r.added && (Date.now() - new Date(r.added + 'T12:00:00')) / 864e5 <= NEW_DAYS;

  const FILTERS = [
    { key: 'level', label: 'Level', get: (r) => r.levels, order: ['K-12', 'Postsecondary', 'Early childhood', 'General (not education-specific)'] },
    { key: 'unit', label: 'Unit of analysis', get: (r) => r.units, name: (v) => UNIT_NAMES[v] || v,
      hint: 'What each record describes: individual people, schools, districts, colleges, places, etc. Many sources report at several.',
      order: ['Individual', 'School', 'District', 'Institution', 'Program', 'County or local', 'State', 'Country', 'Varies', 'Other'] },
    { key: 'geo', label: 'Geography', more: true, get: (r) => [r.geography], order: ['US national', 'US state', 'US local', 'International', 'Global/mixed'] },
    // Every state is offered, even with no state-specific sources, so national ones can be shown
    { key: 'state', label: 'State', get: (r) => (r.state ? [r.state] : []), name: (v) => STATES[v] || v, all: Object.keys(STATES) },
    { key: 'topic', label: 'Topic', get: (r) => r.topics },
    { key: 'access', label: 'Access', get: (r) => [r.access], order: ['Open download', 'Free registration', 'Mixed', 'Application or restricted', 'Not yet checked'] },
    { key: 'kind', label: 'Kind', more: true, get: (r) => [r.kind], order: ['Dataset', 'Data portal', 'Data tool or dashboard', 'Repository', 'List of sources'] },
    { key: 'added', label: 'Added', more: true, get: (r) => (isNew(r) ? ['recent'] : []), name: () => 'In the last 4 months' },
  ];

  const state = { q: '' };
  FILTERS.forEach((f) => { state[f.key] = ''; });

  // Filters live in the query string (?state=IL&q=finance) and the section in the fragment
  // (#browse), so section links never drop the filters and the address always reproduces the view.
  function readURL() {
    let p = new URLSearchParams(location.search);
    // Older shared links put filters in the fragment (#state=IL); read and convert those
    if (location.hash.includes('=')) p = new URLSearchParams(location.hash.slice(1));
    state.q = p.get('q') || '';
    FILTERS.forEach((f) => { state[f.key] = p.get(f.key) || ''; });
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    FILTERS.forEach((f) => { if (state[f.key]) p.set(f.key, state[f.key]); });
    const qs = p.toString();
    const hash = location.hash.includes('=') ? '#browse' : location.hash;
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + hash);
  }

  // Search: rough stemming ("salary" finds "salaries") plus groups of words that mean the
  // same thing here, so a search doesn't depend on knowing each publisher's vocabulary.
  const stem = (w) => (w.length > 4 ? w.replace(/(ies|es|s|y)$/, '') : w);
  const SYNONYMS = [
    ['teacher', 'educator', 'certificated', 'certified', 'staff', 'personnel', 'instructional', 'licensure', 'licensed'],
    ['salary', 'pay', 'compensation', 'wage', 'benefits'],
    ['discipline', 'suspension', 'expulsion', 'truancy', 'truant'],
    ['finance', 'spending', 'expenditure', 'revenue', 'funding', 'budget', 'fiscal'],
    ['achievement', 'assessment', 'test', 'test score', 'proficiency', 'report card'],
    ['college', 'postsecondary', 'university', 'universities', 'higher education'],
    ['graduation', 'completion', 'degree'],
    ['vacancy', 'vacancies', 'shortage', 'turnover', 'attrition', 'pipeline', 'supply and demand'],
    ['demographic', 'race', 'ethnicity', 'gender'],
    ['enrollment', 'enrolment', 'enrolled'],
    ['early childhood', 'preschool', 'pre-k', 'prekindergarten', 'kindergarten', 'child care', 'childcare'],
    ['special education', 'disability', 'disabilities', 'sped', 'osep'],
    ['charter', 'school choice', 'magnet', 'private school', 'voucher'],
    ['crime', 'police', 'law enforcement', 'justice'],
    ['election', 'voting', 'vote', 'political', 'legislator'],
    ['income', 'poverty', 'wealth', 'earnings'],
    ['wage', 'earnings', 'labor market', 'employment', 'workforce'],
    // Acronyms
    ['ccd', 'common core of data'],
    ['crdc', 'civil rights data collection'],
    ['ipeds', 'integrated postsecondary'],
    ['acs', 'american community survey'],
    ['seda', 'stanford education data archive', 'educational opportunity'],
    ['ecls', 'early childhood longitudinal'],
    ['nhes', 'household education survey'],
    ['pisa', 'international student assessment'],
    ['yrbs', 'yrbss', 'youth risk behavior'],
    ['met', 'measures of effective teaching'],
    ['fred', 'federal reserve economic'],
    ['lemas', 'law enforcement management'],
    ['nces', 'national center for education statistics'],
  ];
  // Synonyms that only match as whole words: "staff" stands in for "teacher", but "staffing"
  // (as in a police agency's staffing) shouldn't
  const WHOLE_WORD = new Set(['staff']);
  const SYN_INDEX = {};
  SYNONYMS.forEach((g) => g.forEach((t) => { (SYN_INDEX[stem(t)] = SYN_INDEX[stem(t)] || []).push(g); }));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Each query word becomes a test: the word itself as typed (substring, so partial words
  // work), or any of its synonyms (whole words when short, so "acs" doesn't match "access")
  function wordTest(w) {
    const s = stem(w);
    const alts = new Set();
    (SYN_INDEX[s] || []).forEach((g) => g.forEach((t) => alts.add(stem(t))));
    alts.delete(s);
    const exact = (a) => a.length <= 4 || WHOLE_WORD.has(a);
    const res = [...alts].map((a) => (exact(a) ? new RegExp('\\b' + reEsc(a) + '\\b') : null));
    const longs = [...alts].filter((a) => !exact(a));
    return (hay) => hay.includes(s) || longs.some((a) => hay.includes(a)) || res.some((re) => re && re.test(hay));
  }
  let testsFor = null, tests = [];
  function queryTests() {
    if (testsFor !== state.q) { testsFor = state.q; tests = state.q.toLowerCase().split(/\s+/).filter(Boolean).map(wordTest); }
    return tests;
  }

  function matches(r, ...skip) {
    if (state.q && !queryTests().every((test) => test(r.hay))) return false;
    return FILTERS.every((f) => skip.includes(f.key) || !state[f.key] || f.get(r).includes(state[f.key]));
  }

  // National sources that report by state: those reporting schools, districts, colleges,
  // counties, or states, plus the Start here sources (e.g., ACS and IPUMS microdata carry state
  // identifiers). This doesn't establish that a source covers every state, so the page says so,
  // and sources known to cover only some places ("Some states" in the workbook) are left out.
  const BY_STATE_UNITS = ['School', 'District', 'Institution', 'County or local', 'State'];
  const reportsByState = (r) => (r.geography === 'US national' || r.place === 'All states' || r.place === 'All counties')
    && !/^some/i.test(r.place) && (r.units.some((u) => BY_STATE_UNITS.includes(u)) || r.start);
  // With a state chosen, the national sources shown under its own (other filters still apply)
  const nationalFor = (...skip) => (state.state
    ? rows.filter((r) => reportsByState(r) && matches(r, 'state', 'geo', ...skip)) : []);

  // Build the selects once; counts refresh on every change. Less-used filters sit behind a
  // "More filters" button, which opens by itself when one of them is in use.
  const selects = {};
  const moreBox = document.createElement('div');
  moreBox.className = 'controls more-filters';
  moreBox.id = 'more-filters';
  moreBox.hidden = true;
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'linkish more-toggle';
  moreBtn.setAttribute('aria-controls', 'more-filters');
  moreBtn.addEventListener('click', () => { moreBox.hidden = !moreBox.hidden; refreshMore(); });
  function refreshMore() {
    const n = FILTERS.filter((f) => f.more && state[f.key]).length;
    if (n) moreBox.hidden = false;
    moreBtn.setAttribute('aria-expanded', String(!moreBox.hidden));
    moreBtn.textContent = (moreBox.hidden ? 'More filters' : 'Fewer filters') + (n ? ` (${n} on)` : '');
  }
  FILTERS.forEach((f) => {
    const values = new Set(f.all || []);
    rows.forEach((r) => f.get(r).forEach((v) => values.add(v)));
    let list = [...values];
    if (f.order) list = f.order.filter((v) => values.has(v)).concat(list.filter((v) => !f.order.includes(v)));
    else list.sort((a, b) => (f.name ? f.name(a) : a).localeCompare(f.name ? f.name(b) : b));
    f.values = list;
    const label = document.createElement('label');
    label.innerHTML = `<span>${esc(f.label)}</span>`;
    if (f.hint) label.title = f.hint;
    const sel = document.createElement('select');
    sel.addEventListener('change', () => { state[f.key] = sel.value; update(); });
    label.appendChild(sel);
    (f.more ? moreBox : $('filters')).appendChild(label);
    selects[f.key] = sel;
  });
  $('filters').appendChild(moreBtn);
  $('filters').after(moreBox);

  function refreshSelects() {
    FILTERS.forEach((f) => {
      const sel = selects[f.key];
      // Count what would be on screen: the matching sources plus, with a state chosen, the
      // national sources listed under them (except for the State menu itself)
      const pool = new Set(rows.filter((r) => matches(r, f.key)));
      if (f.key !== 'state' && f.key !== 'geo') nationalFor(f.key).forEach((r) => pool.add(r));
      const counts = {};
      pool.forEach((r) => f.get(r).forEach((v) => { counts[v] = (counts[v] || 0) + 1; }));
      const opts = [`<option value="">All</option>`].concat(f.values.map((v) => {
        const n = counts[v] || 0;
        const name = f.name ? f.name(v) : v;
        return `<option value="${esc(v)}"${n || f.all ? '' : ' disabled'}>${esc(name)} (${n})</option>`;
      }));
      sel.innerHTML = opts.join('');
      sel.value = state[f.key];
      sel.classList.toggle('on', !!state[f.key]);
    });
  }

  // "School-level", or "School, district, state level" for several
  function unitLabel(units) {
    const u = units.filter((x) => x !== 'Varies' && x !== 'Other');
    if (!u.length) return '';
    if (u.length === 1) return `${u[0]}-level`;
    return u.map((x, i) => (i ? x.toLowerCase() : x)).join(', ') + ' level';
  }

  function metaHTML(r, withTopics) {
    const place = r.state ? STATES[r.state] || r.place : r.place;
    const geo = place && r.place !== 'All states' ? place : r.place === 'All states' ? 'All states' : r.geography;
    const items = [
      `<li class="access ${ACCESS_CLASS[r.access] || 'mixed'}">${esc(r.access)}</li>`,
      `<li>${esc(r.levels.map((l) => LEVEL_SHORT[l] || l).join(', '))}</li>`,
      `<li>${esc(geo)}</li>`,
      unitLabel(r.units) ? `<li>${esc(unitLabel(r.units))}</li>` : '',
      `<li>${esc(r.kind)}</li>`,
    ];
    if (withTopics) {
      r.topics.filter((t) => t !== 'general').forEach((t) => {
        items.push(`<li style="background:none;padding:0"><button type="button" class="topic" data-topic="${esc(t)}">${esc(t)}</button></li>`);
      });
      if (r.link) items.push(`<li class="arch"><a href="${esc(archive(r.link))}" rel="noopener" title="Internet Archive's most recent copy">archived</a> · <a href="${esc(reportURL(r))}" rel="noopener" target="_blank" title="Opens a short form with this source filled in">report a problem</a></li>`);
    }
    return `<ul class="meta">${items.join('')}</ul>`;
  }

  const cardHTML = (r) => `
      <li class="result">
        <h3>${r.link ? `<a href="${esc(r.link)}" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}${r.start ? '<span class="badge-start">Start here</span>' : ''}${isNew(r) ? `<span class="badge-start badge-new" title="Added ${esc(r.added)}">New</span>` : ''}</h3>
        <p class="desc clamp">${esc(r.summary || r.description)}</p>
        ${r.summary && r.description ? `<details class="pub"><summary>Publisher's description</summary><p>${esc(r.description)}</p></details>` : ''}
        ${metaHTML(r, true)}
      </li>`;

  function renderResults() {
    const hits = rows.filter((r) => matches(r));
    $('results').innerHTML = hits.map(cardHTML).join('');

    // With a state chosen, follow its own sources with national ones that include it.
    // Other filters (search, level, topic...) still apply.
    const st = state.state;
    const isGeneral = (r) => r.levels.every((l) => l.startsWith('General'));
    const national = nationalFor().sort((a, b) => isGeneral(a) - isGeneral(b)); // education sources first
    $('national').hidden = !national.length;
    $('national-results').innerHTML = national.map(cardHTML).join('');
    if (national.length) {
      const name = STATES[st] || st;
      $('national-h').textContent = 'National sources that report by state';
      $('national-lede').textContent = (hits.length ? '' : `No ${name}-specific sources are listed yet. `)
        + `These national sources report on schools, districts, colleges, counties, or states, so many will include ${name}. `
        + 'Coverage varies, so check each source\'s documentation.';
    }

    document.querySelectorAll('.results .desc').forEach((p) => {
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
    const stName = STATES[st] || st;
    $('count').textContent = st && !hits.length && national.length
      ? `No ${stName}-specific sources · ${national.length} national sources that report by state`
      : (active ? `${hits.length} of ${rows.length} sources` : `${rows.length} sources`)
        + (national.length ? `, plus ${national.length} national sources that report by state` : '');
    $('clear').hidden = !active;
    $('empty').hidden = hits.length > 0 || national.length > 0;
  }

  // "Show more" only where a description is actually cut off at the current width
  function fitClamps() {
    document.querySelectorAll('.results .desc').forEach((p) => {
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
      const label = n ? `${STATES[c]}: ${n} state-specific source${n > 1 ? 's' : ''}` : `${STATES[c]}: national sources only`;
      return `<button type="button" data-state="${c}" class="${n ? '' : 'none'}" aria-pressed="${state.state === c}" title="${esc(label)}">
        <span class="code">${c}</span><span class="n">${n || '–'}</span></button>`;
    }).join('');
    const covered = Object.keys(counts).length;
    const national = rows.filter(reportsByState).length;
    $('state-note').textContent = `${covered} of the 50 states and DC have at least one state-specific source. Choosing any state also lists ${national} national sources that report by state; coverage varies by source.`;
  }

  function update() {
    writeURL();
    refreshSelects();
    refreshMore();
    renderResults();
    $('state-grid').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.state === state.state)));
  }

  // Start here: grouped by research purpose, in the start_here tab's order. Each card says what the
  // source is good for and what a row is; how to get started is one click away.
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  const startCard = (s) => {
    const r = byName[s.name];
    if (!r) return '';
    const fact = (label, text) => (text ? `<div><dt>${label}</dt><dd>${esc(text)}</dd></div>` : '');
    return `
    <article class="start-card">
      <h3><a href="${esc(r.link)}" rel="noopener">${esc(r.name)}</a></h3>
      <p>${esc(s.useful || r.summary || r.description)}</p>
      <dl class="facts">${fact('Each row is', s.row)}${fact('Years', s.years)}</dl>
      ${s.getting_started || s.structure || s.docs ? `<details class="how">
        <summary>Getting started</summary>
        <dl class="facts">${fact('How', s.getting_started)}${fact('Structure', s.structure)}</dl>
        ${s.docs ? `<p class="docs"><a href="${esc(s.docs)}" rel="noopener">Documentation</a></p>` : ''}
      </details>` : ''}
      ${metaHTML(r, false)}
    </article>`;
  };
  const S = D.start_here || [];
  if (S.length) {
    const groups = [];
    S.forEach((s) => { let g = groups.find((x) => x.name === s.group); if (!g) groups.push(g = { name: s.group, items: [] }); g.items.push(s); });
    $('start-grid').classList.remove('start-grid');
    $('start-grid').innerHTML = groups.map((g) => `
      <h3 class="sub-h start-group">${esc(g.name)}</h3>
      <div class="start-grid">${g.items.map(startCard).join('')}</div>`).join('');
  } else {
    $('start-grid').innerHTML = rows.filter((r) => r.start).map((r) => `
    <article class="start-card">
      <h3><a href="${esc(r.link)}" rel="noopener">${esc(r.name)}</a></h3>
      <p>${esc(r.summary || r.description)}</p>
      ${metaHTML(r, false)}
    </article>`).join('');
  }

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
  // How many sources a search matches by itself, ignoring the filters (for counting searches)
  const searchHits = () => rows.filter((r) => queryTests().every((test) => test(r.hay))).length;
  const recordSearch = () => { if (window.countSearch && state.q) window.countSearch(state.q, searchHits()); };
  $('q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); update(); recordSearch(); }, 120); });
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
    if (!b) return;
    state.state = state.state === b.dataset.state ? '' : b.dataset.state;
    state.geo = '';
    update();
    if (state.state) $('browse').scrollIntoView();
  });
  // An older #state=IL-style link followed while the page is already open
  window.addEventListener('hashchange', () => {
    if (!location.hash.includes('=')) return; // an ordinary section link
    readURL(); $('q').value = state.q; update();
  });

  // Header search, so returning visitors can search without scrolling past Start here
  $('q-top').placeholder = `Search ${rows.length} sources`;
  $('quick').addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = $('q-top').value.trim();
    $('q').value = state.q;
    update();
    recordSearch();
    $('q-top').blur();
    $('browse').scrollIntoView();
  });

  // Suggestion form
  if (SUGGEST_URL) $('suggest-link').href = SUGGEST_URL;
  else $('suggest').innerHTML = '<strong>Suggest a source.</strong> A suggestion form is coming soon.';

  // The list date is when the site was last exported from the workbook; links are rechecked
  // monthly by a GitHub Action, which doesn't change the site, so no check date is shown.
  const fmt = new Date((D.updated || D.checked) + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const recent = rows.filter(isNew).length;
  $('stamp').innerHTML = `${rows.length} data sources and ${D.learning.length} learning resources · List updated ${esc(fmt)} · Links checked monthly`
    + (recent ? ` · <a href="?added=recent#browse">${recent} added recently</a>` : '');

  readURL();
  $('q').value = state.q;
  renderStates();
  update();
})();
