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
    padding: '20px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '300px', border: '1px solid #444', textAlign: 'center'
  });

  const header = document.createElement('div');
  header.textContent = '👹 GLOBAL PARAGRAPH MONSTER';
  header.style.cssText = 'font-weight:bold; font-size:11px; letter-spacing:1px; opacity: 0.7;';

  const mVal = document.createElement('div');
  mVal.textContent = '0';
  mVal.style.cssText = 'font-size:48px; font-weight:900; margin: 5px 0; line-height: 1; color: #fff;';

  const mUser = document.createElement('div');
  mUser.textContent = 'Waiting to start...';
  mUser.style.cssText = 'font-size:16px; font-weight:bold; color:#ff8a65; margin-bottom: 2px;';

  const mSub = document.createElement('div');
  mSub.textContent = 'Scanning every user...';
  mSub.style.cssText = 'font-size:10px; font-style:italic; color:#888; margin-bottom: 12px;';

  const btn = document.createElement('button');
  btn.textContent = '🚀 START GLOBAL SCAN';
  Object.assign(btn.style, { 
    padding: '12px', borderRadius: '12px', background: '#ff8a65', color: '#000', 
    fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px' 
  });

  ui.append(header, mVal, mUser, mSub, btn);
  document.body.appendChild(ui);

  function findSenderName(messageNode) {
    const block = messageNode.closest('[role="listitem"], [data-message-id]')?.parentElement;
    if (block) {
      const nameEl = block.querySelector('[data-name], [data-hovercard-id], span[dir="auto"]');
      if (nameEl && nameEl.textContent.trim().length > 1) {
          return nameEl.textContent.trim();
      }
    }

    let current = messageNode;
    while (current && current !== document.body) {
      const aria = current.getAttribute('aria-label');
      if (aria && aria.includes('Message from ')) {
        const parts = aria.split('Message from ');
        return parts[1].split(',')[0].trim();
      }
      current = current.parentElement;
    }

    let walker = messageNode.previousElementSibling;
    while (walker) {
      const nameInHeader = walker.querySelector('span[dir="auto"]');
      if (nameInHeader && nameInHeader.textContent.trim().length > 1) {
        return nameInHeader.textContent.trim();
      }
      walker = walker.previousElementSibling;
    }

    return "Unknown User";
  }

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
    btn.disabled = true;
    btn.style.opacity = '0.5';
    let messageMap = new Set();
    let globalLongest = 0;
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
        btn.disabled = false; btn.style.opacity = '1';
        return; 
    }

    while (totalScanned < MAX_MESSAGES) {
      const baseline = countDOM();
      container.scrollTop = 0; 
      
      mSub.textContent = `Analyzing: ${totalScanned} / ${MAX_MESSAGES}`;
      
      const grew = await waitForGrowth(baseline);
      
      const messages = document.querySelectorAll('[data-message-id], [data-local-id], [jsmodel*="VPILAb"]');
      messages.forEach(node => {
        const id = node.getAttribute('data-message-id') || node.getAttribute('data-local-id') || node.innerText.substring(0, 50);
        
        if (!messageMap.has(id)) {
          messageMap.add(id);
          totalScanned++;
          
          const text = node.innerText.trim();
          if (text.length > globalLongest) {
            const name = findSenderName(node);

            if (name !== "Unknown User" && isNaN(name.charAt(0))) {
                globalLongest = text.length;
                mVal.textContent = globalLongest;
                mUser.textContent = name;
            }
          }
        }
      });

      if (totalScanned >= MAX_MESSAGES) break;

      if (!grew) {
        container.scrollTop = 150;
        await new Promise(r => setTimeout(r, 400));
        container.scrollTop = 0;
        const retry = await waitForGrowth(baseline);
        if (!retry) break; 
      }
    }

    mSub.textContent = `✅ Scan finished!`;
    btn.disabled = false;
    btn.style.opacity = '1';
  }

  btn.onclick = run;
})();
