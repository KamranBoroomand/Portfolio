(function () {
  const pathNode = document.querySelector('[data-path-value]');
  const redirectNode = document.querySelector('[data-redirect-note]');
  const requestedPath = window.location.pathname + window.location.search + window.location.hash;
  let secondsLeft = 12;

  if (pathNode) {
    pathNode.textContent = requestedPath || '/';
  }

  if (!redirectNode) {
    return;
  }

  const timer = window.setInterval(() => {
    secondsLeft -= 1;

    if (secondsLeft <= 0) {
      window.clearInterval(timer);
      window.location.replace('/');
      return;
    }

    redirectNode.textContent = `Auto redirect to home in ${secondsLeft}s.`;
  }, 1000);
})();
