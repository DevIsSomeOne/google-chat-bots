(function () {
    if (window._diceObserver) {
        window._diceObserver.disconnect();
        console.log("♻️ Stopped old observer.");
    }
    console.log("🎮 GChat Bot 27.0: Fix letter-spam loop");

    let _botSending = false;
    let _hangmanStarting = false;

    let hangmanState = {
        active: false,
        word: "",
        guessed: [],
        lives: 6,
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

    const fetchRandomWord = async () => {
        try {
            const res = await fetch("https://random-word-api.herokuapp.com/word?number=1&swear=0");
            const data = await res.json();
            const word = data[0];
            if (/^[a-zA-Z]{4,12}$/.test(word)) return word.toUpperCase();
        } catch (e) { console.warn("Word API failed, using fallback.", e); }

        const fallback = [
            "PLANET","BRIDGE","JUNGLE","PIRATE","CANDLE","FROZEN","MARBLE","COBALT",
            "WANDER","FELINE","DONKEY","GOBLIN","ZIPPER","CASTLE","TANGLE","ROCKET",
            "RIDDLE","BASKET","SILVER","MIRROR","BOTTLE","CACTUS","DRAGON","FEATHER",
            "HAMMER","ISLAND","JIGSAW","KERNEL","MAGNET","NOODLE","OYSTER","PEPPER",
            "QUARTZ","RIBBON","SOCKET","TIMBER","VELVET","WALRUS","ZENITH","ALPINE",
            "BANTER","CINDER","DOLLOP","EMPIRE","FAUCET","GRAVEL","HERMIT","INDIGO",
            "KETTLE","LANTERN","MUFFIN","NAPKIN","PEBBLE","RADISH","SADDLE","TUNDRA",
            "VORTEX","WOMBAT","ANCHOR","CREVICE","ECLIPSE","FROLIC","GALLOP","HARVEST",
            "JASMINE","KETCHUP","LOBSTER","MUSTARD","NARWHAL","ORCHID","PENGUIN","RASCAL",
            "SERPENT","TSUNAMI","UNICORN","VAMPIRE","WEASEL","DAGGER","EMERALD","FALCON",
            "HORIZON","IMPULSE","KINGDOM","MONARCH","PHANTOM","QUANTUM","LABYRINTH"
        ];
        return fallback[Math.floor(Math.random() * fallback.length)];
    };

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
            setTimeout(() => { _botSending = false; }, 1200);
        }, 100);
    };

    const startHangman = async (rawName) => {
        if (_hangmanStarting) return;
        _hangmanStarting = true;
        const name = cleanName(rawName);
        sendMessage("⏳ Fetching a random word...");
        const word = await fetchRandomWord();
        hangmanState.word    = word;
        hangmanState.guessed = [];
        hangmanState.lives   = 6;
        hangmanState.active  = true;
        setTimeout(() => {
            sendMessage(`🕹️ Hangman started by ${name}!\n\`\`\`\n${getArt()}\n\`\`\`\nWord: ${getDisplayWord()} (${word.length} letters)\n❤️ Lives: ${hangmanState.lives} | Letters left: ${getRemainingLetters()}\nGuess with !a  !b  !c ...`);
            _hangmanStarting = false;
        }, 1400);
    };

    const guessLetter = (cmd, rawName) => {
        // ── HARD GUARD: if game not active, do nothing ──────────────────────
        if (!hangmanState.active) return;

        const name = cleanName(rawName);
        const letter = cmd[1].toUpperCase();

        if (hangmanState.guessed.includes(letter)) {
            sendMessage(`⚠️ ${name}: "${letter}" already guessed!\nWord: ${getDisplayWord()} | ❤️ ${hangmanState.lives}`);
            return;
        }

        hangmanState.guessed.push(letter);

        if (hangmanState.word.includes(letter)) {
            // Check win BEFORE sending — set active=false immediately so no
            // further guesses can sneak through while the message is sending
            const won = !getDisplayWord().includes('_');
            if (won) {
                hangmanState.active = false; // ← stop game RIGHT NOW
                sendMessage(`🎉 ${name} solved it! The word was ${hangmanState.word}. YOU WIN! 🎊\nType !hangman to play again.`);
                return;
            }
            sendMessage(`✅ ${name} found "${letter}"!\n\`\`\`\n${getArt()}\n\`\`\`\nWord: ${getDisplayWord()}\n❤️ Lives: ${hangmanState.lives} | Letters left: ${getRemainingLetters()}`);
        } else {
            hangmanState.lives--;
            if (hangmanState.lives <= 0) {
                hangmanState.active = false; // ← stop game RIGHT NOW
                sendMessage(`💀 GAME OVER, ${name}! The word was ${hangmanState.word}.\n\`\`\`\n${getArt()}\n\`\`\`\nType !hangman to try again.`);
                return;
            }
            sendMessage(`❌ ${name}: no "${letter}"!\n\`\`\`\n${getArt()}\n\`\`\`\nWord: ${getDisplayWord()}\n❤️ Lives: ${hangmanState.lives} | Letters left: ${getRemainingLetters()}`);
        }
    };

    // ── Observer ──────────────────────────────────────────────────────────────
    const processedNodes = new WeakSet();

    const tryHandleNode = (node) => {
        if (node.nodeType !== 1) return;

        // Mark as processed IMMEDIATELY — before any async/guard checks.
        // This prevents the same node being handled twice if _botSending
        // was true on first pass and false on a re-scan.
        if (processedNodes.has(node)) return;
        processedNodes.add(node);

        // Now apply guards (node is already marked so it won't re-enter)
        if (_botSending || _hangmanStarting) return;

        const text = (node.innerText || node.textContent || '').trim();
        if (!text || text.length > 300) return;

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const cmd = lines.find(l => /^![a-zA-Z]+$/.test(l));
        if (!cmd) return;

        console.log(`📨 Command: "${cmd}"`);

        // Find sender name
        let rawName = "Player";
        let el = node;
        for (let i = 0; i < 12; i++) {
            if (!el) break;
            const nameEl = el.querySelector && el.querySelector('[data-name], [data-hovercard-id], [aria-label*="sent by"]');
            if (nameEl) { rawName = nameEl.getAttribute('data-name') || nameEl.getAttribute('aria-label') || nameEl.innerText; break; }
            el = el.parentElement;
        }

        const cmdL = cmd.toLowerCase();

        if (cmdL === '!hangman') {
            startHangman(rawName);
        } else if (hangmanState.active && /^![a-zA-Z]$/.test(cmd)) {
            guessLetter(cmd, rawName);
        } else if (cmdL === '!dice') {
            const res = Math.floor(Math.random() * 6) + 1;
            setTimeout(() => sendMessage(`🎲 ${cleanName(rawName)} rolled a ${res}! ${["⚀","⚁","⚂","⚃","⚄","⚅"][res-1]}`), 300);
        } else if (cmdL === '!kissmyhug') {
            setTimeout(() => sendMessage(`Sending a big hug and a kiss to ${cleanName(rawName)}! 💋🤗😘`), 300);
        }
    };

    window._diceObserver = new MutationObserver((mutations) => {
        if (_botSending) return;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                tryHandleNode(node);
                if (node.querySelectorAll) node.querySelectorAll('*').forEach(tryHandleNode);
            }
        }
    });

    window._diceObserver.observe(document.body, { childList: true, subtree: true });
    console.log("✅ Bot 27.0 ready — !hangman  !{letter}  !dice  !kissmyhug");
})();
