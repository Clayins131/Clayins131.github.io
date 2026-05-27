(function () {
  var match = document.cookie.match(/(?:^|; )theme=(dark|light)/);
  var theme = match ? match[1] : null;

  if (!theme && window.matchMedia) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
})();
