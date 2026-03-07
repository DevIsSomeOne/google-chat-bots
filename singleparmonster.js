(function () {
  'use strict';
  const MAX_MESSAGES = 1000;
  const old = document.getElementById('__monster_ui__');
  if (old) old.remove();

  const ui = document.createElement('div');
  ui.id = '__monster_ui__';
  Object.assign(ui.style, {
    position: 'fixed', bottom: '80px', right: '20px', zIndex: '99999',
    background: '#1a1a1a', color: '#ff8a65', fontFamily: "system-ui, sans-serif",
    padding: '20px', borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '280px', border: '1px solid #333', textAlign: 'center'
  });

  const header = document.createElement('div');
  header.textContent = '👹 PARAGRAPH MONSTER';
  header.style.cssText = 'font-weight:bold; font-size:12px; letter-spacing:1px;';

  const mVal = document.createElement('div');
  mVal.textContent = '0';
  mVal.style.cssText = 'font-size:32px; font-weight:900; margin: 10px 0;';

  const mSub = document.createElement('div');
  mSub.textContent = 'Waiting for scan...';
  mSub.style.cssText = 'font-size:10px; font-style:italic; color:#aaa; margin-bottom: 10px;';

  const inp = document.createElement('input');
  inp.placeholder = 'Target Name...';
  Object.assign(inp.style, { background: '#333', border: 'none', color: '#fff', padding: '10px', borderRadius: '8px', outline: 'none', marginBottom: '10px' });

  const btn = document.createElement('button');
  btn.textContent = 'START 1000 MSG SCAN';
  Object.assign(btn.style, { padding: '10px', borderRadius: '10px', background: '#ff8a65', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' });

  ui.append(header, mVal, mSub, inp, btn);
  document.body.appendChild(ui);

  function countDOM() {
    return document.querySelectorAll('[data-message-id], [data-local-id], [jsmodel*="VPILAb"]').length;
  }

  function waitForGrowth(baseline) {
    return new Promise(resolve => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (countDOM() > baseline) { clearInterval(iv); resolve(true); }
        else if (Date.now() - start > 3000) { clearInterval(iv); resolve(false); }
      }, 200);
    });
  }

  async function run() {
    const target = inp.value.toLowerCase().trim();
    if (!target) { mSub.textContent = "Enter a name first!"; return; }
    
    btn.disabled = true;
    btn.style.opacity = '0.5';
    let messageMap = new Set();
    let longest = 0;
    let totalScanned = 0;

    const container = (function() {
      const msg = document.querySelector('[data-message-id], [jsmodel*="VPILAb"]');
      let el = msg?.parentElement;
      while (el && el !== document.body) {
        const s = window.getComputedStyle(el);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement;
      }
      return null;
    })();

    if (!container) { 
        mSub.textContent = "Error: Scroll area not found";
        btn.disabled = false; 
        btn.style.opacity = '1';
        return; 
    }

    while (totalScanned < MAX_MESSAGES) {
      const baseline = countDOM();
      container.scrollTop = 0;
      
      mSub.textContent = `Scanned ${totalScanned} / ${MAX_MESSAGES}...`;

      const grew = await waitForGrowth(baseline);

      const messages = document.querySelectorAll('[data-message-id], [data-local-id], [jsmodel*="VPILAb"]');
      messages.forEach(node => {
        const id = node.getAttribute('data-message-id') || node.innerText.substring(0, 50);
        if (!messageMap.has(id)) {
          messageMap.add(id);
          totalScanned++;
          
          const sender = (node.getAttribute('aria-label') || "").toLowerCase();
          if (sender.includes(target)) {
            const text = node.innerText.trim();
            if (text.length > longest) {
              longest = text.length;
              mVal.textContent = longest;
            }
          }
        }
      });

      if (totalScanned >= MAX_MESSAGES) break;

      if (!grew) {

        container.scrollTop = 100;
        await new Promise(r => setTimeout(r, 300));
        container.scrollTop = 0;
        const secondTry = await waitForGrowth(baseline);
        if (!secondTry) break; 
      }
    }

    mSub.textContent = `Finished. Scanned ${totalScanned} messages.`;
    btn.disabled = false;
    btn.style.opacity = '1';
  }

  btn.onclick = run;
})();
