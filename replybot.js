(function() {
  const TARGET_DISPLAY_NAME = "John Doe"; // replace john doe with real name
  const RESPONSE_TEXT = "lol";
  const COOLDOWN_MS = 4000; 
  
  let lastResponseTime = 0;
  console.log(`%c Bot Active: Watching for ${TARGET_DISPLAY_NAME}`, "color: green; font-weight: bold;");

  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          // google chat marks the sender's name in a div with [data-name]
          const nameElement = node.querySelector('[data-name]');
          const senderName = nameElement ? nameElement.getAttribute('data-name') : null;

          if (senderName === TARGET_DISPLAY_NAME) {
            const now = Date.now();
            if (now - lastResponseTime > COOLDOWN_MS) {
              console.log(`Matched ${senderName}. Sending response...`);
              sendResponse();
              lastResponseTime = now;
            }
          }
        }
      }
    }
  });

  function sendResponse() {
    const inputBox = document.querySelector('div[role="textbox"][contenteditable="true"]');
    
    if (inputBox) {
      inputBox.focus();

      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, RESPONSE_TEXT);

      inputBox.dispatchEvent(new Event('input', { bubbles: true }));

      setTimeout(() => {
        const sendButton = document.querySelector('div[role="button"][aria-label="Send message"]') || 
                           document.querySelector('button[aria-label="Send message"]');
        
        if (sendButton) {
          sendButton.click();
        } else {

          const enter = new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
          });
          inputBox.dispatchEvent(enter);
        }
      }, 200); // tiny delay for reliability
    }
  }

  const chatContainer = document.querySelector('div[role="main"]') || document.body;
  observer.observe(chatContainer, { childList: true, subtree: true });

  // IMPORTANT To stop the bot, type 'stopBot()' in console
  window.stopBot = () => {
    observer.disconnect();
    console.log("Bot stopped.");
  };
})();
