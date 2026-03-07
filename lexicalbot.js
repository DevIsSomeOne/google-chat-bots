(function () {
  'use strict';
  const MAX_MESSAGES = 1000;
  const old = document.getElementById('__vocab_ui__');
  if (old) old.remove();

  const ui = document.createElement('div');
  ui.id = '__vocab_ui__';
  Object.assign(ui.style, {
    position: 'fixed', bottom: '80px', right: '20px', zIndex: '99999',
    background: '#121212', color: '#00e676', fontFamily: "system-ui, sans-serif",
    padding: '20px', borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '280px', border: '1px solid #333', textAlign: 'center'
  });

  const header = document.createElement('div');
  header.textContent = '🧠 LEXICAL MASTER';
  header.style.cssText = 'font-weight:bold; font-size:12px; letter-spacing:1px; color:#fff;';

  const vVal = document.createElement('div');
  vVal.textContent = '0%';
  vVal.style.cssText = 'font-size:32px; font-weight:900; margin: 10px 0;';
  
  const vSub = document.createElement('div');
  vSub.textContent = '0 unique / 0 total';
  vSub.style.cssText = 'font-size:10px; color:#aaa; margin-bottom: 10px;';

  const inp = document.createElement('input');
  inp.placeholder = 'Target Name...';
  Object.assign(inp.style, { background: '#252525', border: 'none', color: '#fff', padding: '10px', borderRadius: '8px', outline: 'none', marginBottom: '10px' });

  const btn = document.createElement('button');
  btn.textContent = 'ANALYZE VOCAB';
  Object.assign(btn.style, { padding: '10px', borderRadius: '10px', background: '#00e676', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' });

  ui.append(header, vVal, vSub, inp, btn);
  document.body.appendChild(ui);

  function countDOM() {
    return document.querySelectorAll('[data-message-id], [data-local-id], [jsmodel*="VPILAb"]').length;
  }

  function waitForGrowth(baseline) {
    return new Promise(resolve => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (countDOM() > baseline) { clearInterval(iv); resolve(true); }
        else if (Date.now() - start > 3500) { clearInterval(iv); resolve(false); }
      }, 250);
    });
  }

  async function run() {
    const target = inp.value.toLowerCase().trim();
    if (!target) return;
    
    btn.disabled = true;
    let messageMap = new Set();
    let uniqueWords = new Set();
    let totalWords = 0;

    let container = (function() {
      const msg = document.querySelector('[data-message-id], [jsmodel*="VPILAb"]');
      let el = msg?.parentElement;
      while (el && el !== document.body) {
        const s = window.getComputedStyle(el);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 20) return el;
        el = el.parentElement;
      }
      return null;
    })();

    if (!container) { btn.disabled = false; return; }

    let totalLoaded = countDOM();
    let noGrowthRounds = 0;

    while (totalLoaded < MAX_MESSAGES) {
      container.scrollTop = 0;
      const grew = await waitForGrowth(totalLoaded);
      
      document.querySelectorAll('[data-message-id], [data-local-id], [jsmodel*="VPILAb"]').forEach(node => {
        const id = node.getAttribute('data-message-id') || node.innerText.substring(0, 30);
        if (!messageMap.has(id)) {
          messageMap.add(id);
          const sender = (node.getAttribute('aria-label') || "").toLowerCase();
          if (sender.includes(target) || node.innerText.toLowerCase().includes(target)) {
            const words = node.innerText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 1);
            words.forEach(w => { totalWords++; uniqueWords.add(w); });
          }
        }
      });

      const score = totalWords > 0 ? ((uniqueWords.size / totalWords) * 100).toFixed(1) : 0;
      vVal.textContent = score + "%";
      vSub.textContent = `${uniqueWords.size} unique / ${totalWords} total`;

      if (!grew) {
        noGrowthRounds++;
        if (noGrowthRounds >= 2) break;
        container.scrollTop = 100;
        await new Promise(r => setTimeout(r, 400));
        container.scrollTop = 0;
      } else { noGrowthRounds = 0; }
      totalLoaded = countDOM();
    }
    btn.disabled = false;
  }
  btn.onclick = run;
})();
