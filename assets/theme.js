/* ── theme.js — tuixue.nl ── */
(function () {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const icon = btn.querySelector('i');

  function getTheme() {
    const m = document.cookie.match(/(?:^|; )theme=(\w+)/);
    return m ? m[1] : null;
  }

  function setTheme(t) {
    document.cookie = 'theme=' + t + ';path=/;max-age=' + (365 * 86400) + ';SameSite=Lax';
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (icon) icon.className = 'fas fa-sun';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (icon) icon.className = 'fas fa-moon';
    }
  }

  // Apply saved preference on load
  if (getTheme() === 'dark') setTheme('dark');

  btn.addEventListener('click', function () {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
})();
