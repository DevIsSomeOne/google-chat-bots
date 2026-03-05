(() => {
  // --- CONFIGURATION ---
  const MY_NAME = "YOUR_DISPLAY_NAME"; // <-- CHANGE THIS to your name
  const AFK_MESSAGE = "I'm currently AFK. I'll get back to you as soon as I'm back!";
  const TIME_TARGETS = ["12:00 AM", "2:00 AM", "3:00 AM", "1:30 PM", "10:06 PM"];
  
  let lastTimeSent = "";
  let lastAfkSent = 0;
  const AFK_COOLDOWN = 0000; // reply cooldown set to 0 on default

  console.clear();
  console.log(`%c 🚀 Master Bot Active | Tracking: ${MY_NAME} `, "background: #1a73e8; color: white; font-weight: bold; padding: 5px; border-radius: 3px;");

  const sendToChat = (text) => {
    const textBox = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (textBox) {
      textBox.focus();
      document.execCommand('insertText', false, text);
      const ke = new KeyboardEvent('keydown', { bubbles: true, keyCode: 13, key: 'Enter', code: 'Enter' });
      textBox.dispatchEvent(ke);
      return true;
    }
    return false;
  };

  setInterval(() => {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (TIME_TARGETS.includes(currentTime) && lastTimeSent !== currentTime) {
      if (sendToChat(`It's ${currentTime}`)) {
        lastTimeSent = currentTime;
        console.log(`%c [TIME] Posted: ${currentTime} `, "color: #1a73e8; font-weight: bold;");
      }
    }
  }, 1000);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.innerText) {
          const text = node.innerText;
          const now = Date.now();

          if (text.includes("@" + MY_NAME) && !text.includes(AFK_MESSAGE)) {
            if (now - lastAfkSent > AFK_COOLDOWN) {
              sendToChat(AFK_MESSAGE);
              lastAfkSent = now;
              console.log(`%c [AFK] Responded to @mention `, "color: #ea4335; font-weight: bold;");
            }
          }
        }
      });
    });
  });

  const chatContainer = document.querySelector('div[role="main"]') || document.body;
  observer.observe(chatContainer, { childList: true, subtree: true });

})();
