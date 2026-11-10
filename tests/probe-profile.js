({
  href: location.href,
  launcher: !!document.getElementById('xr-launcher'),
  tweets: document.querySelectorAll('article[data-testid="tweet"]').length,
  title: document.title,
  hasProfileLink: !!document.querySelector('a[data-testid="AppTabBar_Profile_Link"]'),
  profileHref: (document.querySelector('a[data-testid="AppTabBar_Profile_Link"]') || {}).getAttribute ? document.querySelector('a[data-testid="AppTabBar_Profile_Link"]').getAttribute('href') : null
})