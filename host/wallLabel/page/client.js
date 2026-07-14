(function () {
  const statusEl = document.getElementById('status');
  const titleEl = document.getElementById('title');
  const rationaleEl = document.getElementById('rationale');
  const metaEl = document.getElementById('meta');

  let ws = null;

  function render(piece) {
    document.body.classList.toggle('waiting', !piece);
    if (!piece) {
      titleEl.textContent = '—';
      rationaleEl.textContent = '';
      metaEl.textContent = '';
      return;
    }
    titleEl.textContent = piece.title;
    rationaleEl.textContent = piece.rationale;
    metaEl.textContent = [piece.artist, piece.created].filter(Boolean).join(' — ');
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);

    ws.onopen = () => {
      statusEl.textContent = 'connected';
    };
    ws.onclose = () => {
      statusEl.textContent = 'disconnected — retrying…';
      setTimeout(connect, 1000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'hello' || msg.type === 'piece') render(msg.piece);
    };
  }

  connect();
})();
