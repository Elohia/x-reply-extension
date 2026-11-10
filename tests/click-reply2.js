() => {
  const arts = [...document.querySelectorAll('article[data-testid="tweet"]')];
  if (!arts.length) return { ok: false, href: location.href };
  const b = arts[0].querySelector('[data-testid="reply"]');
  if (b) b.click();
  return { ok: true };
}