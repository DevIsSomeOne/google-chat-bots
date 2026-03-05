var chatBotInterval = setInterval(function() {
  var inputBox = document.querySelector('div[role="textbox"][contenteditable="true"]');
  
  if (inputBox) {
    inputBox.focus();
    inputBox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, "lol");

    inputBox.dispatchEvent(new Event('input', { bubbles: true }));

    var sendButton = document.querySelector('div[role="button"][aria-label="Send message"]') || 
                     document.querySelector('button[aria-label="Send message"]');
    
    if (sendButton) {
      sendButton.click();
      console.log("Success: Sent 'lol'"); // remove this if it spams the console
    } else {
      var enter = new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
      });
      inputBox.dispatchEvent(enter);
      console.log("Button not found, tried 'Enter' key instead.");
    }
  } else {
    console.error("Still can't find the box. Are you sure the chat window is open?");
  }
}, 2000);

// To stop: clearInterval(chatBotInterval);

// Have fun!
