/* ── theme.js — tuixue.nl ── */
(function () {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const icon = btn.querySelector('i');

  function getStoredTheme() {
    const m = document.cookie.match(/(?:^|; )theme=(\w+)/);
    return m ? m[1] : null;
  }

  function getCurrentTheme() {
    return getStoredTheme() ||
      (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }

  function applyTheme(t, persist) {
    if (persist) {
      document.cookie = 'theme=' + t + ';path=/;max-age=' + (365 * 86400) + ';SameSite=Lax';
    }
    document.documentElement.style.colorScheme = t === 'dark' ? 'dark' : 'light';
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (icon) icon.className = 'fas fa-sun';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (icon) icon.className = 'fas fa-moon';
    }
    btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    btn.title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  applyTheme(getCurrentTheme(), false);

  btn.addEventListener('click', function () {
    applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark', true);
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
})();
