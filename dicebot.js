(function() {
    console.log("🎲 Dice Roller 2.0: Watching for !dice...");

    const rollDice = () => {
        const result = Math.floor(Math.random() * 6) + 1;
        const diceEmoji = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][result - 1];
        const message = `🎲 I rolled a ${result}! ${diceEmoji}`;

        const editor = document.querySelector('div[contenteditable="true"]');
        
        if (editor) {
            editor.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            
            document.execCommand('insertText', false, message);
            
            const enterEvent = new KeyboardEvent('keydown', {
                bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
            });
            editor.dispatchEvent(enterEvent);
        }
    };

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.innerText && node.innerText.includes('!dice')) {
                        setTimeout(rollDice, 100);
                    }
                }
            });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
