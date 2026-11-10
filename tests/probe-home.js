() => ({
  href: location.href,
  launcher: !!document.getElementById('xr-launcher'),
  tweets: document.querySelectorAll('article[data-testid="tweet"]').length,
  profileLink: (document.querySelector('a[data-testid="AppTabBar_Profile_Link"]') || {}).href || null,
  scriptTags: document.querySelectorAll('script').length,
  title: document.title
})
