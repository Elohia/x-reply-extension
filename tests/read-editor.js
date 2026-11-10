() => {
  const eds = [...document.querySelectorAll('[data-testid="tweetTextarea_0"]')].filter(e => e.offsetParent !== null);
  const e = eds[eds.length - 1];
  return eds.map(x => ({ aria: x.getAttribute('aria-label') || '', len: (x.textContent || '').length, txt: (x.textContent || '').slice(0, 30) }));
}