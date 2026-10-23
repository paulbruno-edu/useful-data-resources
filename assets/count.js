/* Visit and search counting with GoatCounter (no cookies, no personal data).
   Set GOATCOUNTER_CODE to the account's code to turn counting on; leave it empty to turn it off.
   Stats: https://<code>.goatcounter.com */
(function () {
  const GOATCOUNTER_CODE = 'paulbrunodata';
  if (!GOATCOUNTER_CODE) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  document.head.appendChild(s);
})();

// Records a search once the visitor stops typing. Searches with no results are recorded
// separately, since those show what the list is missing. Does nothing if counting is off.
window.countSearch = (function () {
  let timer, last = '';
  return function (query, hits) {
    clearTimeout(timer);
    const q = query.trim().toLowerCase();
    if (q.length < 3) return;
    timer = setTimeout(() => {
      if (q === last || !window.goatcounter || !window.goatcounter.count) return;
      last = q;
      window.goatcounter.count({ path: (hits ? 'search/' : 'search-no-results/') + q, title: q, event: true });
    }, 2000);
  };
})();
