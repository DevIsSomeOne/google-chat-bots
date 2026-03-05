(() => {
  const TARGETS = ["12:00 AM", "2:00 AM", "3:00 AM", "1:30 PM", "10:06 PM"]; //change these if you want to change time
  let lastSent = "";

  console.clear();
  console.log("%c 🚀 Time Bot: ONLINE ", "background: #1a73e8; color: white; font-weight: bold; padding: 5px; border-radius: 3px;");
  console.log("%c Keep this tab visible or in a separate window to prevent Chrome from 'sleeping' the script.", "color: #e67e22; font-style: italic;");

  const attemptSend = (text) => {

    const textBox = document.querySelector('div[role="textbox"][contenteditable="true"]');
    
    if (textBox) {
      textBox.focus();

      document.execCommand('insertText', false, text);
      
      const ke = new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter'
      });
      textBox.dispatchEvent(ke);
      
      console.log(`%c [SENT] ${text} at ${new Date().toLocaleTimeString()} `, "background: #34A853; color: white; padding: 2px;");
      return true;
    }
    return false;
  };


  setInterval(() => {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });

    if (TARGETS.includes(currentTime) && lastSent !== currentTime) {
      const success = attemptSend(`It's ${currentTime}`);
      if (success) {
        lastSent = currentTime;
      } else {
        console.error("Failed to find Chat Input. Is the chat window open?");
      }
    }
    
    if (now.getSeconds() === 0 || now.getSeconds() === 30) {
      console.debug(`Bot Heartbeat: ${currentTime} - Waiting for next target...`);
    }

  }, 1000);
})();
