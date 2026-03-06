(() => {
  console.log("%c 👋 Welcome Bot: Active ", "background: #4285f4; color: white; font-weight: bold; padding: 2px 5px;");

  const WELCOME_MESSAGE = "Welcome to the group chat 👋 this is an automated bot fyi";

  const sendMessage = (text) => {
    const textBox = document.querySelector('div[role="textbox"]');
    const sendButton = document.querySelector('div[aria-label="Send message"]');

    if (textBox && sendButton) {
      textBox.focus();
      document.execCommand('insertText', false, text);

      setTimeout(() => {
        sendButton.click();
      }, 100);
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
 
        if (node.nodeType === 1) {
          const text = node.innerText || "";
          
          const isJoinMessage = text.includes("joined") || text.includes("added to the space");
          
          if (isJoinMessage && !text.includes(WELCOME_MESSAGE)) {
            console.log("New member detected. Sending welcome...");
            sendMessage(WELCOME_MESSAGE);
          }
        }
      });
    }
  });

  const chatContainer = document.querySelector('div[role="main"]') || document.body;
  observer.observe(chatContainer, { childList: true, subtree: true });
})();
