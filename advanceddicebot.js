(function() {
    if (window._diceObserver) { window._diceObserver.disconnect(); console.log("Stopped old observer."); }
    console.log("🎲 Dice Roller 19.0: Clean Name Mode");

    const rollDice = (userName) => {
        let cleanName = userName || "Player";
        
        // 1. Remove "Message", "Message:", "User", and common UI prefix noise
        // 2. Remove timestamps (AM/PM, digits, colons)
        cleanName = cleanName
            .replace(/\b(Message|User|Avatar of|Profile photo of)\b:?/gi, '')
            .replace(/\b(AM|PM)\b/g, '')
            .replace(/[0-9:]/g, '')
            .trim();
            
        // Final fallback if name is somehow empty after cleaning
        if (!cleanName || cleanName.toLowerCase() === 'message') cleanName = "Player";

        const result = Math.floor(Math.random() * 6) + 1;
        const diceEmoji = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][result - 1];
        
        // Output format: User thomas requested dice: 🎲 I rolled a 3! ⚂
        const finalMessage = `User ${cleanName} requested dice: 🎲 I rolled a ${result}! ${diceEmoji}`;

        const editor = document.querySelector('div[contenteditable="true"]');
        if (!editor) return;
        
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, finalMessage);
        
        editor.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
        }));
    };

    const extractName = (node) => {
        let el = node;
        for (let i = 0; i < 12; i++) {
            if (!el) break;
            
            // Look for the name in GChat attributes
            const nameSelectors = [
                '[data-name]',
                '[data-member-id]',
                '[aria-label*="Sender"]',
                'span[dir="auto"]'
            ];

            for (const sel of nameSelectors) {
                const found = el.querySelector ? el.querySelector(sel) : null;
                if (found) {
                    const candidate = 
                        found.getAttribute('data-name') || 
                        found.getAttribute('aria-label') || 
                        found.innerText.split('\n')[0];
                    
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
                
                if (messageText.includes('!dice') && 
                    !messageText.includes('requested dice:') && 
                    !node.hasAttribute('data-dice-processed')) {

                    node.setAttribute('data-dice-processed', 'true');
                    const foundName = extractName(node);
                    
                    setTimeout(() => rollDice(foundName), 200);
                    return;
                }
            }
        }
    });

    window._diceObserver.observe(document.body, { childList: true, subtree: true });
})();
