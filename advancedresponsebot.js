(function() {
    if (window._diceObserver) { window._diceObserver.disconnect(); console.log("Stopped old observer."); }
    console.log("🎲 Dice Roller 20.0: Love & Luck Edition");

    // Generic function to send messages to the GChat editor
    const sendMessage = (text) => {
        const editor = document.querySelector('div[contenteditable="true"]');
        if (!editor) return;
        
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
        
        editor.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
        }));
    };

    const cleanName = (userName) => {
        let name = userName || "Player";
        return name
            .replace(/\b(Message|User|Avatar of|Profile photo of)\b:?/gi, '')
            .replace(/\b(AM|PM)\b/g, '')
            .replace(/[0-9:]/g, '')
            .trim() || "Player";
    };

    const rollDice = (userName) => {
        const name = cleanName(userName);
        const result = Math.floor(Math.random() * 6) + 1;
        const diceEmoji = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][result - 1];
        sendMessage(`User ${name} requested dice: 🎲 I rolled a ${result}! ${diceEmoji}`);
    };

    const sendKiss = (userName) => {
        const name = cleanName(userName);
        sendMessage(`${name} 💋😘`);
    };

    const extractName = (node) => {
        let el = node;
        for (let i = 0; i < 12; i++) {
            if (!el) break;
            const nameSelectors = ['[data-name]', '[data-member-id]', '[aria-label*="Sender"]', 'span[dir="auto"]'];
            for (const sel of nameSelectors) {
                const found = el.querySelector ? el.querySelector(sel) : null;
                if (found) {
                    const candidate = found.getAttribute('data-name') || found.getAttribute('aria-label') || found.innerText.split('\n')[0];
                    if (candidate && candidate.trim().length > 1) return candidate.trim();
                }
            }
            el = el.parentElement;
        }
        return null;
    };

    window._diceObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                const messageText = node.innerText || "";
                
                // Skip if this is the bot's own message
                if (node.hasAttribute('data-bot-processed') || messageText.includes('requested dice:') || messageText.includes('hug and a kiss')) continue;

                const foundName = extractName(node);

                // Check for !dice
                if (messageText.includes('!dice')) {
                    node.setAttribute('data-bot-processed', 'true');
                    setTimeout(() => rollDice(foundName), 200);
                    return;
                }

                // Check for !kissmyhug
                if (messageText.includes('!kissmyhug')) {
                    node.setAttribute('data-bot-processed', 'true');
                    setTimeout(() => sendKiss(foundName), 200);
                    return;
                }
            }
        }
    });

    window._diceObserver.observe(document.body, { childList: true, subtree: true });
})();
