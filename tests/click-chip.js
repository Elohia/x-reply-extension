() => {
  const bar = document.querySelector('.xr-bar');
  const chips = bar ? [...bar.querySelectorAll('.xr-chip')] : [];
  if (!chips.length) return { ok: false, bar: !!bar, chips: 0, launcher: !!document.getElementById('xr-launcher') };
  chips[0].click();
  return { ok: true, chip: chips[0].textContent };
}