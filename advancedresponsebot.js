(function () {
    if (window._diceObserver) {
        window._diceObserver.disconnect();
        console.log("♻️ Stopped old observer.");
    }
    console.log("🎮 GChat Bot 24.0: Hangman Fixed");

    let _botSending = false;

    let hangmanState = {
        active: false,
        word: "",
        guessed: [],
        lives: 6,
        wordList: [
            "JAVASCRIPT", "GOOGLE", "BROWSER", "ELEMENT", "CONSOLE",
            "DOMINO", "NETWORK", "CHROME", "VIRTUAL", "KEYBOARD",
            "FUNCTION", "VARIABLE", "PROMISE", "MUTATION", "OBSERVER"
        ]
    };

    const HANGMAN_ART = [
        ["  +---+  ","  |   |  ","      |  ","      |  ","      |  ","      |  ","========="],
        ["  +---+  ","  |   |  ","  O   |  ","      |  ","      |  ","      |  ","========="],
        ["  +---+  ","  |   |  ","  O   |  ","  |   |  ","      |  ","      |  ","========="],
        ["  +---+  ","  |   |  ","  O   |  "," /|   |  ","      |  ","      |  ","========="],
        ["  +---+  ","  |   |  ","  O   |  "," /|\\  |  ","      |  ","      |  ","========="],
        ["  +---+  ","  |   |  ","  O   |  "," /|\\  |  "," /    |  ","      |  ","========="],
        ["  +---+  ","  |   |  ","  O   |  "," /|\\  |  "," / \\  |  ","      |  ","========="],
    ];

    const getArt = () => HANGMAN_ART[6 - hangmanState.lives].join("\n");
    const cleanName = (n) => (n || "Player").replace(/\b(Message|User|Avatar of|Profile photo of)\b:?/gi,'').replace(/\b(AM|PM)\b/g,'').replace(/[0-9:]/g,'').trim() || "Player";
    const getDisplayWord = () => hangmanState.word.split('').map(l => hangmanState.guessed.includes(l) ? l : '_').join(' ');
    const getRemainingLetters = () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').filter(l => !hangmanState.guessed.includes(l)).join(' ');

    const sendMessage = (text) => {
        const editor = document.querySelector('div[contenteditable="true"]');
        if (!editor) { console.warn("⚠️ No editor found!"); return; }
        _botSending = true;
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
        setTimeout(() => {
            editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter' }));
            setTimeout(() => { _botSending = false; }, 800);
        }, 100);
    };

    const handleHangman = (cmd, rawName) => {
        const name = cleanName(rawName);
        const cmdL = cmd.toLowerCase().trim();

        if (cmdL === "!hangman") {
            hangmanState.word    = hangmanState.wordList[Math.floor(Math.random() * hangmanState.wordList.length)];
            hangmanState.guessed = [];
            hangmanState.lives   = 6;
            hangmanState.active  = true;
            return `🕹️ Hangman started by ${name}!\n\`\`\`\n${getArt()}\n\`\`\`\nWord: ${getDisplayWord()}\n❤️ Lives: ${hangmanState.lives} | Letters left: ${getRemainingLetters()}\nGuess with !a !b !c ...`;
        }

        if (hangmanState.active && /^![a-zA-Z]$/.test(cmd.trim())) {
            const letter = cmd.trim()[1].toUpperCase();
            if (hangmanState.guessed.includes(letter)) return `⚠️ ${name}: "${letter}" already guessed!\nWord: ${getDisplayWord()} | ❤️ ${hangmanState.lives}`;
            hangmanState.guessed.push(letter);
            if (hangmanState.word.includes(letter)) {
                if (!getDisplayWord().includes('_')) {
                    hangmanState.active = false;
                    return `🎉 ${name} solved it! The word was ${hangmanState.word}. YOU WIN!\nType !hangman to play again.`;
                }
                return `✅ ${name} found "${letter}"!\n\`\`\`\n${getArt()}\n\`\`\`\nWord: ${getDisplayWord()}\n❤️ Lives: ${hangmanState.lives} | Letters left: ${getRemainingLetters()}`;
            } else {
                hangmanState.lives--;
                if (hangmanState.lives <= 0) {
                    hangmanState.active = false;
                    return `💀 GAME OVER, ${name}! The word was ${hangmanState.word}.\n\`\`\`\n${getArt()}\n\`\`\`\nType !hangman to try again.`;
                }
                return `❌ ${name}: no "${letter}"!\n\`\`\`\n${getArt()}\n\`\`\`\nWord: ${getDisplayWord()}\n❤️ Lives: ${hangmanState.lives} | Letters left: ${getRemainingLetters()}`;
            }
        }
        return null;
    };

    // ── THE KEY FIX: observe at document level, scan ALL nodes aggressively ──
    // GChat renders messages into deeply nested shadow-like structures.
    // Instead of hoping the right node surfaces, we scan every added node
    // AND every text node inside it.

    const processedIds = new WeakSet();

    const tryHandleNode = (node) => {
        if (node.nodeType !== 1) return;
        if (processedIds.has(node)) return;

        const raw = node.innerText || node.textContent || '';
        const text = raw.trim();
        if (!text) return;

        // Only process nodes whose text IS a command (short, starts with !)
        // This avoids matching bot replies or large blocks of text
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const cmd = lines.find(l => /^![a-zA-Z]+$/.test(l));
        if (!cmd) return;

        // Also skip if the node is too tall (i.e. it's a container with many messages)
        // We want leaf-level message nodes
        if (text.length > 300) return;

        processedIds.add(node);
        console.log(`📨 Command detected: "${cmd}" in`, node);

        // Sender name — walk up the tree looking for name elements
        let rawName = "Player";
        let el = node;
        for (let i = 0; i < 12; i++) {
            if (!el) break;
            const nameEl = el.querySelector && el.querySelector('[data-name], [data-hovercard-id], [aria-label*="sent by"]');
            if (nameEl) { rawName = nameEl.getAttribute('data-name') || nameEl.getAttribute('aria-label') || nameEl.innerText; break; }
            el = el.parentElement;
        }

        const cmdL = cmd.toLowerCase();
        let response = null;

        if (cmdL === '!hangman') {
            response = handleHangman(cmd, rawName);
        } else if (hangmanState.active && /^![a-zA-Z]$/.test(cmd)) {
            response = handleHangman(cmd, rawName);
        } else if (cmdL === '!dice') {
            const res = Math.floor(Math.random() * 6) + 1;
            response = `🎲 ${cleanName(rawName)} rolled a ${res}! ${["⚀","⚁","⚂","⚃","⚄","⚅"][res-1]}`;
        } else if (cmdL === '!kissmyhug') {
            response = `Sending a big hug and a kiss to ${cleanName(rawName)}! 💋🤗😘`;
        }

        if (response) {
            console.log(`🤖 Replying: "${response.substring(0,60)}"`);
            setTimeout(() => sendMessage(response), 500);
        }
    };

    window._diceObserver = new MutationObserver((mutations) => {
        if (_botSending) return;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                tryHandleNode(node);
                // Also check children — GChat often nests the actual text node
                if (node.querySelectorAll) {
                    node.querySelectorAll('*').forEach(tryHandleNode);
                }
            }
        }
    });

    window._diceObserver.observe(document.body, { childList: true, subtree: true });
    console.log("✅ Bot 24.0 ready. Commands: !hangman  !{letter}  !dice  !kissmyhug");
})();
