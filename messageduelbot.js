(function () {
  'use strict';

  const MAX_MESSAGES = 1000; 
  const old = document.getElementById('__msg_counter_ui__');
  if (old) old.remove();

  const ui = document.createElement('div');
  ui.id = '__msg_counter_ui__';
  Object.assign(ui.style, {
    position: 'fixed', bottom: '80px', right: '20px', zIndex: '99999',
    background: '#0f0f1a', color: '#fff', fontFamily: "system-ui, sans-serif",
    padding: '14px 18px', borderRadius: '18px', boxShadow: '0 6px 28px rgba(0,0,0,.6)',
    display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px',
    border: '1px solid rgba(255,255,255,.08)', textAlign: 'center'
  });

  const header = document.createElement('div');
  header.textContent = '💬 MESSAGE DUEL';
  header.style.fontSize = '11px'; header.style.opacity = '.6';

  const statusLine = document.createElement('div');
  statusLine.textContent = 'Click Start to Duel...';
  statusLine.style.fontSize = '10px'; statusLine.style.color = '#aaa';

  const duelRow = document.createElement('div');
  duelRow.style.display = 'flex'; duelRow.style.gap = '8px';

  function makeUserCard(label, color) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      flex: '1', background: color + '15', borderRadius: '12px', padding: '8px',
      border: `1px solid ${color}33`, display: 'flex', flexDirection: 'column'
    });
    const nameEl = document.createElement('div');
    nameEl.textContent = label; nameEl.style.fontSize = '9px';
    const countEl = document.createElement('div');
    countEl.textContent = '0'; countEl.style.fontSize = '24px'; countEl.style.color = color;
    card.append(nameEl, countEl);
    return { card, nameEl, countEl };
  }

  const u1 = makeUserCard('User 1', '#4fc3f7');
  const u2 = makeUserCard('User 2', '#f06292');
  duelRow.append(u1.card, u2.card);

  const inp1 = document.createElement('input');
  inp1.placeholder = 'User 1 name...';
  const inp2 = document.createElement('input');
  inp2.placeholder = 'User 2 name...';
  [inp1, inp2].forEach(i => Object.assign(i.style, {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    color: '#fff', padding: '6px', borderRadius: '8px', fontSize: '11px'
  }));

  const startBtn = document.createElement('button');
  startBtn.textContent = '⚡ START DUEL';
  Object.assign(startBtn.style, {
    padding: '8px', borderRadius: '10px', background: 'linear-gradient(135deg,#4fc3f7,#f06292)',
    border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer'
  });

  ui.append(header, statusLine, duelRow, inp1, inp2, startBtn);
  document.body.appendChild(ui);

  function countDOM() {
    const selectors = ['[data-message-id]', '[data-local-id]', '[jsmodel*="VPILAb"]', '[role="listitem"]'];
    let best = 0;
    selectors.forEach(sel => {
      const n = document.querySelectorAll(sel).length;
      if (n > best) best = n;
    });
    return best;
  }

  function findMessageScrollContainer() {
    const msgNode = document.querySelector('[data-message-id], [data-local-id], [jsmodel*="VPILAb"]');
    if (!msgNode) return null;
    let el = msgNode.parentElement;
    while (el && el !== document.body) {
      const s = window.getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 20) return el;
      el = el.parentElement;
    }
    return null;
  }

  function waitForGrowth(baseline, timeoutMs) {
    return new Promise(resolve => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (countDOM() > baseline) { clearInterval(iv); resolve(true); }
        else if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(false); }
      }, 250);
    });
  }

  async function runDuel() {
    const name1 = inp1.value.toLowerCase();
    const name2 = inp2.value.toLowerCase();
    if (!name1 || !name2) { statusLine.textContent = "Enter both names!"; return; }

    let container = findMessageScrollContainer();
    if (!container) { statusLine.textContent = "Error: Scroll area not found"; return; }

    let totalLoaded = countDOM();
    let noGrowthRounds = 0;
    let messageMap = new Map();

    while (totalLoaded < MAX_MESSAGES) {
      container.scrollTop = 0;
      statusLine.textContent = `Scrolling... (${totalLoaded} msgs found)`;
      
      const grew = await waitForGrowth(totalLoaded, 3500);
      const newCount = countDOM();

      const messages = document.querySelectorAll('[data-message-id], [data-local-id], [jsmodel*="VPILAb"]');
      messages.forEach(msg => {
        const id = msg.getAttribute('data-message-id') || msg.innerText.substring(0, 30);
        const senderText = (msg.innerText + " " + (msg.getAttribute('aria-label') || "")).toLowerCase();
        
        if (!messageMap.has(id)) {
          if (senderText.includes(name1)) messageMap.set(id, 1);
          else if (senderText.includes(name2)) messageMap.set(id, 2);
          else messageMap.set(id, 0);
        }
      });

      const results = Array.from(messageMap.values());
      u1.countEl.textContent = results.filter(v => v === 1).length;
      u2.countEl.textContent = results.filter(v => v === 2).length;

      if (!grew) {
        noGrowthRounds++;
        if (noGrowthRounds >= 2) break; 
        container.scrollTop = 100; 
        await new Promise(r => setTimeout(r, 400));
        container.scrollTop = 0;
      } else {
        noGrowthRounds = 0;
      }
      totalLoaded = newCount;
    }

    statusLine.textContent = `Finished! Scanned ${totalLoaded} messages.`;
  }

  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    runDuel().finally(() => {
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
    });
  });
})();
