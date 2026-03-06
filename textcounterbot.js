(function () {
  'use strict';

  const old = document.getElementById('__msg_counter_ui__');
  if (old) old.remove();

  const ui = document.createElement('div');
  ui.id = '__msg_counter_ui__';
  Object.assign(ui.style, {
    position: 'fixed', bottom: '80px', right: '20px', zIndex: '99999',
    background: '#1a73e8', color: '#fff',
    fontFamily: "'Google Sans', Roboto, sans-serif",
    padding: '12px 18px', borderRadius: '20px',
    boxShadow: '0 4px 14px rgba(0,0,0,.4)',
    cursor: 'pointer', userSelect: 'none',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '3px',
    minWidth: '170px', textAlign: 'center',
  });

  const labelTop = document.createElement('div');
  labelTop.textContent = '💬 Message Counter';
  labelTop.style.cssText = 'font-size:11px;opacity:.8';

  const labelCount = document.createElement('div');
  labelCount.textContent = '—';
  labelCount.style.cssText = 'font-size:22px;font-weight:700';

  const labelSub = document.createElement('div');
  labelSub.textContent = 'Initialising…';
  labelSub.style.cssText = 'font-size:10px;opacity:.75';

  ui.append(labelTop, labelCount, labelSub);
  document.body.appendChild(ui);

  function setUI(count, sub, color) {
    labelCount.textContent = count;
    labelSub.textContent   = sub;
    ui.style.background    = color || '#1a73e8';
  }

  function findMessageScrollContainer() {

    const msgSelectors = [
      '[data-message-id]',
      '[data-local-id]',
      '[jsmodel*="VPILAb"]',
      'c-wiz [role="listitem"]',
    ];

    let msgNode = null;
    for (const sel of msgSelectors) {
      msgNode = document.querySelector(sel);
      if (msgNode) {
        console.log('[MsgCounter] Found message node via:', sel, msgNode);
        break;
      }
    }

    if (!msgNode) {
      console.warn('[MsgCounter] No message node found yet — are you inside a DM?');
      return null;
    }

    let el = msgNode.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      const isScrollable = (oy === 'auto' || oy === 'scroll' || oy === 'overlay');
      const hasRoom = el.scrollHeight > el.clientHeight + 50;

      if (isScrollable && hasRoom) {
        console.log('[MsgCounter] ✅ Message scroll container found:', el.tagName, el.className.slice(0, 80));
        console.log('[MsgCounter]    scrollHeight:', el.scrollHeight, '| clientHeight:', el.clientHeight);
        return el;
      }
      el = el.parentElement;
    }

    console.warn('[MsgCounter] Could not walk up to a scrollable ancestor');
    return null;
  }

  function countDOM() {
    const selectors = [
      '[data-message-id]',
      '[data-local-id]',
      '[jsmodel*="VPILAb"]',
      '[jsmodel*="message"]',
    ];
    let best = 0;
    for (const sel of selectors) {
      try {
        const n = document.querySelectorAll(sel).length;
        if (n > best) best = n;
      } catch(e) {}
    }
    return best;
  }

  function waitForGrowth(baseline, timeoutMs) {
    return new Promise(resolve => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (countDOM() > baseline) { clearInterval(iv); resolve(true); }
        else if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(false); }
      }, 200);
    });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function loadAllMessages() {
    setUI('…', 'Locating message panel…', '#f29900');
    await sleep(800);

    let container = findMessageScrollContainer();

    if (!container) {
      setUI('ERR', 'Open a DM first, then click', '#d93025');
      return;
    }

    let totalLoaded = countDOM();
    let noGrowthRounds = 0;
    console.log('[MsgCounter] Starting scroll. Initial count:', totalLoaded);

    while (true) {
      container.scrollTop = 0;
      setUI(totalLoaded, `Loading… ${totalLoaded} so far`, '#f29900');

      const grew = await waitForGrowth(totalLoaded, 3500);
      const newCount = countDOM();

      console.log(`[MsgCounter] scroll → count: ${newCount} (grew: ${grew})`);

      if (!grew) {
        noGrowthRounds++;
        console.log(`[MsgCounter] No growth ${noGrowthRounds}/3`);
        if (noGrowthRounds >= 3) {
          console.log('[MsgCounter] Reached top!');
          break;
        }
        container.scrollTop = 200;
        await sleep(400);
        container.scrollTop = 0;
        await sleep(1200);
      } else {
        noGrowthRounds = 0;
        const fresh = findMessageScrollContainer();
        if (fresh) container = fresh;
      }

      totalLoaded = newCount;
    }

    const final = countDOM();
    setUI(`${final.toLocaleString()}`, '✓ Done — click to recount', '#188038');
    console.log(`%c[MsgCounter] FINAL: ${final} messages`, 'color:#188038;font-weight:bold;font-size:16px');
  }

  let running = false;
  new MutationObserver(() => {
    if (!running) labelCount.textContent = countDOM().toLocaleString();
  }).observe(document.body, { childList: true, subtree: true });

  ui.addEventListener('click', () => { if (!running) { running = true; loadAllMessages().then(() => running = false); } });

  running = true;
  loadAllMessages().then(() => { running = false; });

})();
