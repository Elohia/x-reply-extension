() => new Promise((resolve) => {
  const before = document.documentElement.dataset.xrLearn || null;
  document.dispatchEvent(new CustomEvent('xr:learn'));
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    const now = document.documentElement.dataset.xrLearn || null;
    if (now && now !== before) { clearInterval(t); resolve({ fired: true, result: now }); }
    if (tries > 40) { clearInterval(t); resolve({ fired: false, launcher: !!document.getElementById('xr-launcher'), href: location.href }); }
  }, 500);
})
