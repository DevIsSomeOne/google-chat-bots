(function () {
    // ═══════════════════════════════════════════════════════════════════════
    // CONFIG — edit here
    // ═══════════════════════════════════════════════════════════════════════
    // The only 3 people allowed to use !ragebait / !unragebait. Use the exact
    // display name as it appears in the chat.
    const RAGEBAIT_ADMINS = ["Name One", "Name Two", "Name Three"];
    // ═══════════════════════════════════════════════════════════════════════

    if (window._diceObserver) {
        window._diceObserver.disconnect();
        console.log("♻️ Stopped old observer.");
    }
    console.log("🎮 GChat Bot 35.1: Infinite Wordle words via API");

    let _botSending = false;
    let _hangmanStarting = false;
    let _triviaStarting = false;

    // ── Game States ─────────────────────────────────────────────────────────
    // ── Local dedup ───────────────────────────────────────────────────────────
    const _seenQuestions = new Set();

    let hangmanState = { active: false, word: "", guessed: [], lives: 6 };
    let triviaState = { active: false, question: "", answer: "", choices: [], correctLetter: "", askedBy: "", wrongGuesses: 0 };

    // ── Blackjack State ─────────────────────────────────────────────────────
    let blackjackState = {
        active: false,
        deck: [],
        playerHand: [],
        dealerHand: [],
        playerScore: 0,
        dealerScore: 0,
        startedBy: "",
        gameOver: false
    };

    // ── Wordle State ──────────────────────────────────────────────────────────
    let wordleState = {
        active: false,
        word: "",
        guesses: [],
        maxGuesses: 6,
        startedBy: ""
    };

    // ── Missing States & Stubs (Added for stability) ──────────────────────────
    let ticTacToeState = { active: false, board: [], currentPlayer: "", players: {} };
    let madLibsState = { active: false, needed: [], collected: [], startedBy: "" };
    let zorkState = { active: false, location: "entrance", inventory: [], flags: {} };
    let afkState = {};
    const _lastAfkNotice = {};
    const AFK_NOTICE_COOLDOWN_MS = 10000;

    // ── Ragebait State (config is at the very top of the file) ────────────
    // { "targetnamelowercase": { message: "...", setBy: "..." } }
    let ragebaitState = {};
    const _lastRagebaitFire = {};
    const RAGEBAIT_COOLDOWN_MS = 4000; // don't refire on the same target within this window

    // ── Mad Libs Engine ─────────────────────────────────────────────────────
    const MADLIBS_TEMPLATES = [
        {
            title: "The Great Adventure",
            blanks: ["adjective", "noun", "verb", "adverb", "place"],
            story: (w) => `Once upon a time, a ${w[0]} ${w[1]} decided to ${w[2]} ${w[3]} through the ${w[4]}. It was an experience nobody would forget.`
        },
        {
            title: "Space Exploration",
            blanks: ["name", "planet", "noun", "adjective", "verb"],
            story: (w) => `${w[0]} traveled all the way to ${w[1]} just to find a ${w[2]}. The locals thought it was ${w[3]}, but ${w[0]} just wanted to ${w[4]}.`
        },
        {
            title: "Cooking Class",
            blanks: ["food", "noun", "adjective", "verb", "container"],
            story: (w) => `To cook the perfect ${w[0]}, you first need a ${w[1]}. Make sure it stays ${w[2]}, then ${w[3]} it into a large ${w[4]}.`
        }
    ];

    const zorkData = { locations: { entrance: { desc: "You are at the entrance.", exits: {}, items: [] } }, items: {} };
    const startZork = (name) => sendMessage("🚧 Zork is currently under construction, " + cleanName(name) + ".");

    const startMadLibs = (rawName) => {
        if (isGameActive()) return;
        const name = cleanName(rawName);
        const template = MADLIBS_TEMPLATES[Math.floor(Math.random() * MADLIBS_TEMPLATES.length)];
        madLibsState = { active: true, needed: template.blanks, collected: [], startedBy: name, template: template };
        sendMessage(`📝 **Mad Libs: ${template.title}** started by ${name}!\nI need ${template.blanks.length} words.\n\nFirst, give me a: **${template.blanks[0]}**`);
    };

    const processMadLibsWord = (text, name) => {
        madLibsState.collected.push(text);
        if (madLibsState.collected.length < madLibsState.needed.length) {
            const nextBlank = madLibsState.needed[madLibsState.collected.length];
            sendMessage(`✅ Got it! Next, I need a: **${nextBlank}**`);
        } else {
            const finalStory = madLibsState.template.story(madLibsState.collected);
            sendMessage(`📖 **The Finished Story**\n\n${finalStory}\n\nType !madlibs to play again!`);
            madLibsState.active = false;
        }
    };

    // ── Wordle fallback list (used if API fails) ──────────────────────────────
    const WORDLE_FALLBACK = [
        "CRANE","SLATE","TRACE","STARE","RAISE","IRATE","SNARE","CRATE","LEARN","ALERT",
        "HEART","EARTH","REACT","LANCE","PLANE","PANEL","BRAND","BRAIN","TRAIN","TRIAL",
        "GRAIN","DRAIN","BRAWN","SPAWN","STAMP","SONIC","TONIC","SPINE","SPIRE","STONE",
        "SMOKE","SPOKE","SCORE","SCOPE","SLOPE","GLOBE","GLOVE","GRAVE","BRAVE","BRACE",
        "GRACE","PLACE","BLADE","FLARE","FLAME","FRAME","FRANK","CLAMP","SWIFT","SHIFT",
        "DRAFT","CRANK","CLASH","FLASH","GLASS","CROSS","FROTH","BROTH","BLOOD","FLOOD",
        "BLOOM","BROOM","TROUT","STOUT","SCOUT","SHOUT","DROVE","PROVE","STOVE","COVER",
        "HOVER","LOVER","TOKEN","TAKEN","FIXED","MIXED","CRAFT","EXTRA","LLAMA","DRAMA",
        "TALON","SALON","MELON","BATON","BARON","BACON","WAGON","MASON","BISON","LEMON",
        "WOMAN","HUMAN","TOXIN","RESIN","CABIN","METAL","PETAL","MEDAL","VITAL","FATAL",
        "NOVEL","TOWEL","VOWEL","REBEL","BAGEL","CAMEL","ANGEL","CORAL","MORAL","VIRAL",
        "FERAL","BREAD","TREAD","CREAM","DREAM","STEAM","SWEAR","SMEAR","SPEAR","CLEAR",
        "FREAK","CREAK","SNEAK","CHEAT","GREAT","TREAT","WHEAT","STEEL","WHEEL","THEFT",
        "SWEPT","CREPT","ADEPT","PERCH","MERGE","VERGE","SERVE","NERVE","CURVE","SURGE",
        "JUDGE","BUDGE","NUDGE","FUDGE","LODGE","DODGE","RIDGE","GUIDE","GLIDE","SLIDE",
        "SNORE","STORE","SHORE","SPORE","ADORE","CHORE","ABODE","ERODE","ELOPE","SCOPE",
        "SMOKE","EVOKE","CHOKE","FROZE","THOSE","PROSE","TROVE","GROVE","ABOVE","GLOVE"
    ];

    const getWordleEmoji = (guess, target) => {
        const result = ["⬛","⬛","⬛","⬛","⬛"];
        const targetArr = target.split('');
        const guessArr = guess.split('');
        const used = [false,false,false,false,false];

        // First pass: greens
        for (let i = 0; i < 5; i++) {
            if (guessArr[i] === targetArr[i]) {
                result[i] = "🟩";
                used[i] = true;
                guessArr[i] = null;
            }
        }
        // Second pass: yellows
        for (let i = 0; i < 5; i++) {
            if (!guessArr[i]) continue;
            for (let j = 0; j < 5; j++) {
                if (!used[j] && guessArr[i] === targetArr[j]) {
                    result[i] = "🟨";
                    used[j] = true;
                    break;
                }
            }
        }
        return result.join('');
    };

    // ── Blackjack Helpers ───────────────────────────────────────────────────
    const SUITS = ["♠️", "♥️", "♣️", "♦️"];
    const VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

    const createDeck = () => {
        const deck = [];
        for (const suit of SUITS) {
            for (const value of VALUES) {
                deck.push({ suit, value });
            }
        }
        return deck;
    };

    const shuffleDeck = (deck) => {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    };

    const calculateScore = (hand) => {
        let score = 0;
        let aces = 0;
        hand.forEach(card => {
            if (card.value === "A") aces++;
            else if (["J", "Q", "K"].includes(card.value)) score += 10;
            else score += parseInt(card.value);
        });
        for (let i = 0; i < aces; i++) {
            score += (score + 11 > 21) ? 1 : 11;
        }
        return score;
    };

    const formatHand = (hand, hideFirstCard = false) => {
        if (hideFirstCard) {
            return "❓ + " + hand.slice(1).map(c => c.value + c.suit).join(' ');
        }
        return hand.map(c => c.value + c.suit).join(' ');
    };

    // ── Game State Checker ──────────────────────────────────────────────────
    // When a game is active and a lot of people are in the chat, many of them
    // will inevitably fire commands that get rejected. Without a cooldown,
    // each rejection queues its own reply and the bot spends ages just
    // catching up on "game already in progress" spam. This throttles those
    // notices (the block itself is never skipped, only the extra chatter).
    let _lastBusyNotice = 0;
    const BUSY_NOTICE_COOLDOWN_MS = 4000;
    const notifyBusy = (msg) => {
        const now = Date.now();
        if (now - _lastBusyNotice < BUSY_NOTICE_COOLDOWN_MS) return;
        _lastBusyNotice = now;
        sendMessage(msg);
    };

    const isGameActive = () => {
        if (hangmanState.active || _hangmanStarting) {
            notifyBusy("🚫 Finish the current Hangman game first!\nWord: " + getDisplayWord() + " | ❤️ Lives: " + hangmanState.lives);
            return true;
        }
        if (triviaState.active || _triviaStarting) {
            notifyBusy("🚫 Finish the current Trivia question first!\n❓ " + triviaState.question + "\n" + triviaState.choices.join("\n") + "\nAnswer with !A !B !C or !D");
            return true;
        }
        if (wordleState.active || _wordleStarting) {
            const board = wordleState.guesses.map(g => getWordleEmoji(g, wordleState.word) + "  " + g).join("\n");
            notifyBusy("🟩 Wordle already in progress! (" + wordleState.guesses.length + "/" + wordleState.maxGuesses + " guesses)\n\n" + (board || "(no guesses yet)") + "\n\nGuess with !guess WORD");
            return true;
        }
        if (ticTacToeState.active) {
            notifyBusy("❌ Tic-Tac-Toe is in progress!\n" + formatTicTacToeBoard() + "\nIt's " + ticTacToeState.players[ticTacToeState.currentPlayer] + "'s turn (" + ticTacToeState.currentPlayer + "). Use !move [1-9].");
            return true;
        }
        if (madLibsState.active) {
            notifyBusy("📝 Mad Libs is in progress! Next word needed: " + madLibsState.needed[madLibsState.collected.length] + " (anyone can answer).");
            return true;
        }
        if (zorkState.active) {
            notifyBusy("🛡️ Zork is in progress! Type commands to play (e.g. 'look') or 'quit' to exit.");
            return true;
        }
        if (blackjackState.active) {
            notifyBusy("🃏 Blackjack already in progress!\nCurrent Hand: " + formatHand(blackjackState.playerHand) + " (Score: " + blackjackState.playerScore + ")\nType !hit or !stand");
            return true;
        }
        if (anagramState.active || _anagramStarting) {
            notifyBusy("🔤 Anagram already in progress! Unscramble: " + anagramState.shuffledWord);
            return true;
        }
        return false;
    };

    // ── Fetch infinite random 5-letter words from Datamuse API ─────────────
    const fetchWordleWord = async () => {
        const starters = ["st","cr","tr","br","gr","fl","sl","pr","sp","sh","ch","pl","cl","dr","fr","bl","sw","sn","sm","sc","sk","wh","th","gl","str","spr","shr","thr"];
        const starter = starters[Math.floor(Math.random() * starters.length)];
        const questions = "?".repeat(5 - starter.length);
        try {
            const res = await fetch("https://api.datamuse.com/words?sp=" + starter + questions + "&md=f&max=500");
            const data = await res.json();
            const valid = data.filter(w =>
                /^[a-z]{5}$/.test(w.word) &&
                w.tags && w.tags.some(t => t.startsWith("f:") && parseFloat(t.slice(2)) > 3.0)
            );
            if (valid.length > 0) {
                return valid[Math.floor(Math.random() * valid.length)].word.toUpperCase();
            }
        } catch (e) {
            console.warn("Datamuse wordle fetch failed:", e);
        }
        return WORDLE_FALLBACK[Math.floor(Math.random() * WORDLE_FALLBACK.length)];
    };

    let _wordleStarting = false;

    const startWordle = async (rawName) => {
        if (isGameActive()) return;
        _wordleStarting = true;
        const name = cleanName(rawName);
        sendMessage("⏳ Picking a random word...");
        const word = await fetchWordleWord();
        wordleState = { active: true, word, guesses: [], maxGuesses: 6, startedBy: name };
        setTimeout(() => {
            sendMessage(
                "🟩 Wordle started by " + name + "!\n\n" +
                "I'm thinking of a 5-letter word.\n" +
                "You have 6 guesses. After each guess:\n" +
                "🟩 = right letter, right spot\n" +
                "🟨 = right letter, wrong spot\n" +
                "⬛ = letter not in word\n\n" +
                "Guess with: !guess WORD  (e.g. !guess CRANE)"
            );
            _wordleStarting = false;
        }, 300);
    };

    const guessWordle = (guess, rawName) => {
        if (!wordleState.active) return;
        const name = cleanName(rawName);
        guess = guess.toUpperCase();
        if (guess.length !== 5 || !/^[A-Z]{5}$/.test(guess)) {
            sendMessage("⚠️ " + name + ": Your guess must be a single 5-letter word! Try: !guess CRANE");
            return;
        }
        if (wordleState.guesses.includes(guess)) {
            sendMessage("⚠️ " + name + ": You already guessed " + guess + "! Try a different word.");
            return;
        }

        wordleState.guesses.push(guess);
        const emoji = getWordleEmoji(guess, wordleState.word);
        const guessNum = wordleState.guesses.length;
        const board = wordleState.guesses.map(g =>
            getWordleEmoji(g, wordleState.word) + "  " + g
        ).join("\n");

        if (guess === wordleState.word) {
            wordleState.active = false;
            const scoreMsg = ["Genius! 🤯","Magnificent! 🌟","Impressive! 😎","Splendid! 👏","Great! 😊","Phew! 😅"][guessNum - 1] || "Nice!";
            sendMessage(
                "🎉 " + name + " got it in " + guessNum + "/6! " + scoreMsg + "\n\n" +
                board + "\n\nThe word was: " + wordleState.word + "\nType !wordle to play again!"
            );
            return;
        }

        if (guessNum >= wordleState.maxGuesses) {
            wordleState.active = false;
            sendMessage(
                "💀 Out of guesses! The word was: " + wordleState.word + "\n\n" +
                board + "\n\nType !wordle to play again!"
            );
            return;
        }

        const remaining = wordleState.maxGuesses - guessNum;
        sendMessage(
            name + "'s guess " + guessNum + "/6: " + guess + "\n" +
            emoji + "  " + guess + "\n\n" +
            board + "\n\n" +
            remaining + " guess" + (remaining === 1 ? "" : "es") + " left. !guess WORD"
        );
    };

    // ── Blackjack Game Logic ────────────────────────────────────────────────
    const startBlackjack = (rawName) => {
        if (isGameActive()) return;

        const name = cleanName(rawName);
        blackjackState.active = true;
        blackjackState.gameOver = false;
        blackjackState.startedBy = name;
        blackjackState.deck = createDeck();
        shuffleDeck(blackjackState.deck);

        blackjackState.playerHand = [blackjackState.deck.pop(), blackjackState.deck.pop()];
        blackjackState.dealerHand = [blackjackState.deck.pop(), blackjackState.deck.pop()];

        blackjackState.playerScore = calculateScore(blackjackState.playerHand);

        let message = "🃏 Blackjack started by " + name + "!\n\n" +
                      "Dealer's Hand: " + formatHand(blackjackState.dealerHand, true) + "\n" +
                      "Your Hand: " + formatHand(blackjackState.playerHand) + " (Score: " + blackjackState.playerScore + ")\n\n" +
                      "Type !hit or !stand";

        if (blackjackState.playerScore === 21) {
            blackjackState.gameOver = true;
            blackjackState.active = false;
            message = "🃏 Blackjack! You win, " + name + "! 🎉\n\n" +
                      "Dealer's Hand: " + formatHand(blackjackState.dealerHand) + " (Score: " + calculateScore(blackjackState.dealerHand) + ")\n" +
                      "Your Hand: " + formatHand(blackjackState.playerHand) + " (Score: 21)\n\n" +
                      "Type !blackjack to play again.";
        }

        sendMessage(message);
    };

    const blackjackHit = (rawName) => {
        if (!blackjackState.active || blackjackState.gameOver) return;
        const name = cleanName(rawName);

        blackjackState.playerHand.push(blackjackState.deck.pop());
        blackjackState.playerScore = calculateScore(blackjackState.playerHand);

        let message = "🃏 You hit!\n\n" +
                      "Dealer's Hand: " + formatHand(blackjackState.dealerHand, true) + "\n" +
                      "Your Hand: " + formatHand(blackjackState.playerHand) + " (Score: " + blackjackState.playerScore + ")\n\n";

        if (blackjackState.playerScore > 21) {
            blackjackState.gameOver = true;
            blackjackState.active = false;
            message += "💀 BUST! You lose. The dealer wins.\n\nType !blackjack to play again.";
        } else if (blackjackState.playerScore === 21) {
            message += "21! Standing automatically...";
            sendMessage(message);
            setTimeout(() => blackjackStand(rawName), 1000);
            return;
        } else {
            message += "Type !hit or !stand";
        }
        sendMessage(message);
    };

    const blackjackStand = (rawName) => {
        if (!blackjackState.active || blackjackState.gameOver) return;
        const name = cleanName(rawName);

        blackjackState.gameOver = true;
        blackjackState.active = false;

        blackjackState.dealerScore = calculateScore(blackjackState.dealerHand);
        while (blackjackState.dealerScore < 17) {
            blackjackState.dealerHand.push(blackjackState.deck.pop());
            blackjackState.dealerScore = calculateScore(blackjackState.dealerHand);
        }

        const resultMessage = blackjackState.dealerScore > 21 ? "🎉 Dealer busts! You win!" :
                              blackjackState.dealerScore > blackjackState.playerScore ? "💀 Dealer wins." :
                              blackjackState.playerScore > blackjackState.dealerScore ? "🎉 You win!" : "🤝 It's a push (tie)!";

        sendMessage(
            "🃏 You stand.\n\n" +
            "Dealer's Hand: " + formatHand(blackjackState.dealerHand) + " (Score: " + blackjackState.dealerScore + ")\n" +
            "Your Hand: " + formatHand(blackjackState.playerHand) + " (Score: " + blackjackState.playerScore + ")\n\n" +
            resultMessage + "\n\nType !blackjack to play again."
        );
    };

    const processZorkCommand = (text) => { if (!zorkState.active) return;
        const cmd = parseZorkCommand(text);
        let message = '';

        if (!cmd) return;

        if (cmd.verb === 'quit') {
            zorkState.active = false;
            message = "You have left the dungeon. Thanks for playing!\nType !zork to play again.";
            sendMessage("💬 " + message);
            return;
        }

        const currentLocation = zorkData.locations[zorkState.location];

        switch (cmd.verb) {
            case 'go':
                const direction = cmd.directObject;
                if (currentLocation.exits[direction]) {
                    const exit = currentLocation.exits[direction];
                    if (exit.locked && !zorkState.flags.door_unlocked) {
                        message = exit.locked_desc || "It's locked."; } else { zorkState.location = exit.to;
                        message = zorkData.locations[zorkState.location].desc;
                    }
                } else {
                    message = "You can't go that way.";
                }
                break;

            case 'look':
                const itemToLookAt = cmd.directObject;
                if (itemToLookAt) {
                    const isItemInRoom = currentLocation.items.includes(itemToLookAt); const isScenery = zorkData.items[itemToLookAt] && !zorkData.items[itemToLookAt].takeable;
                    if (isItemInRoom || isScenery) {
                        message = (itemToLookAt === 'door' && zorkState.flags.door_unlocked)
                            ? zorkData.items[itemToLookAt].desc_unlocked
                            : zorkData.items[itemToLookAt].desc;
                    } else {
                        message = "You don't see that here.";
                    }
                } else {
                    let roomDesc = currentLocation.desc; const itemsInRoom = currentLocation.items.map(key => zorkData.items[key].name);
                    if (itemsInRoom.length > 0) {
                        roomDesc += "\n\nYou see " + itemsInRoom.join(', ') + " here.";
                    }
                    message = roomDesc;
                }
                break;

            case 'take':
                const itemToTake = cmd.directObject;
                if (itemToTake && currentLocation.items.includes(itemToTake)) {
                    if (zorkData.items[itemToTake].takeable) {
                        zorkState.inventory.push(itemToTake); currentLocation.items = currentLocation.items.filter(i => i !== itemToTake);
                        message = "You take the " + itemToTake + ".";
                        if (itemToTake === 'gold') {
                            message += "\n\n🎉 CONGRATULATIONS! You found the treasure! YOU WIN! 🎉\n\nType !zork to play again.";
                            zorkState.active = false;
                        }
                    } else { message = "You can't take that."; }
                } else { message = "You don't see that here."; }
                break;

            case 'inventory':
                message = zorkState.inventory.length === 0
                    ? "You are not carrying anything."
                    : "You are carrying:\n" + zorkState.inventory.map(key => zorkData.items[key].name).join('\n');
                break;

            case 'unlock':
            case 'use':
                const itemToUse = cmd.directObject;
                const target = cmd.indirectObject || (cmd.verb === 'unlock' ? 'door' : null);
                if (itemToUse === 'key' && target === 'door' && zorkState.inventory.includes('key') && zorkState.location === 'entrance') {
                    zorkState.flags.door_unlocked = true; message = "You insert the rusty key into the lock. With a loud *CLICK*, the door unlocks!";
                } else if (!zorkState.inventory.includes(itemToUse)) {
                    message = "You don't have a " + itemToUse + ".";
                } else { message = "You can't use that like that."; }
                break;

            default:
                message = "I don't know how to '" + text + "'.";
                break;
        }
        sendMessage("💬 " + message);
    };


    const formatTicTacToeBoard = () => {
        const b = ticTacToeState.board;
        return "```\n" +
               ` ${b[0]} | ${b[1]} | ${b[2]} \n` +
               `---+---+---\n` +
               ` ${b[3]} | ${b[4]} | ${b[5]} \n` +
               `---+---+---\n` +
               ` ${b[6]} | ${b[7]} | ${b[8]} \n` +
               "```";
    };

    const checkTicTacToeWin = () => {
        const b = ticTacToeState.board;
        const lines = [ [0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6] ];
        for (const line of lines) {
            if (b[line[0]] !== ' ' && b[line[0]] === b[line[1]] && b[line[1]] === b[line[2]]) {
                return b[line[0]]; // Return winner ('X' or 'O')
            }
        }
        return b.includes(' ') ? null : 'Tie'; // Return null if ongoing, 'Tie' if draw
    };

    const startTicTacToe = (rawName, opponent) => {
        if (isGameActive()) return;
        const name = cleanName(rawName);
        ticTacToeState = {
            active: true, board: Array(9).fill(' '), currentPlayer: 'X',
            players: { X: name, O: 'Bot' }, gameOver: false, isBotGame: true
        };
        if (opponent) {
            ticTacToeState.players.O = cleanName(opponent);
            ticTacToeState.isBotGame = false;
        }
        sendMessage(`⚔️ Tic-Tac-Toe started by ${name}!\n${name} is X, ${ticTacToeState.players.O} is O.\n` +
                    formatTicTacToeBoard() + `\nIt's ${name}'s turn (X). Use !move [1-9] to play.`);
    };

    const ticTacToeMove = (move, rawName) => {
        if (!ticTacToeState.active) return;
        const name = cleanName(rawName);
        const playerSymbol = name === ticTacToeState.players.X ? 'X' : name === ticTacToeState.players.O ? 'O' : null;

        if (playerSymbol !== ticTacToeState.currentPlayer) {
            sendMessage(`⚠️ It's not your turn, ${name}!`); return;
        }

        const pos = parseInt(move) - 1;
        if (isNaN(pos) || pos < 0 || pos > 8 || ticTacToeState.board[pos] !== ' ') {
            sendMessage(`⚠️ Invalid move, ${name}. Pick an empty spot from 1 to 9.`); return;
        }

        ticTacToeState.board[pos] = playerSymbol;
        const winner = checkTicTacToeWin();

        if (winner) {
            ticTacToeState.active = false;
            const winMsg = winner === 'Tie' ? "🤝 It's a tie!" : `🎉 ${ticTacToeState.players[winner]} (${winner}) wins!`;
            sendMessage(`${winMsg}\n` + formatTicTacToeBoard() + "\nType !tictactoe to play again.");
        } else {
            ticTacToeState.currentPlayer = ticTacToeState.currentPlayer === 'X' ? 'O' : 'X';
            const nextPlayer = ticTacToeState.players[ticTacToeState.currentPlayer];
            sendMessage(`Move accepted.\n` + formatTicTacToeBoard() + `\nIt's ${nextPlayer}'s turn (${ticTacToeState.currentPlayer}).`);
            if (ticTacToeState.isBotGame && ticTacToeState.currentPlayer === 'O') {
                setTimeout(ticTacToeBotMove, 1000);
            }
        }
    };

    const ticTacToeBotMove = () => {
        if (!ticTacToeState.active) return;
        const board = ticTacToeState.board;
        let move = -1;

        //minimax algorthm

        const checkState = (b) => {
            const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
            for (let [x,y,z] of wins) {
                if (b[x] !== ' ' && b[x] === b[y] && b[y] === b[z]) return b[x];
            }
            return b.includes(' ') ? null : 'Tie';
        };

        const minimax = (b, depth, isMaximizing) => {
            const result = checkState(b);
            if (result === 'O') return 10 - depth;
            if (result === 'X') return depth - 10;
            if (result === 'Tie') return 0;

            if (isMaximizing) {
                let bestScore = -Infinity;
                for (let i = 0; i < 9; i++) {
                    if (b[i] === ' ') {
                        b[i] = 'O';
                        bestScore = Math.max(bestScore, minimax(b, depth + 1, false));
                        b[i] = ' ';
                    }
                }
                return bestScore;
            } else {
                let bestScore = Infinity;
                for (let i = 0; i < 9; i++) {
                    if (b[i] === ' ') {
                        b[i] = 'X';
                        bestScore = Math.min(bestScore, minimax(b, depth + 1, true));
                        b[i] = ' ';
                    }
                }
                return bestScore;
            }
        };

        // Optimization: First move center if available, else corner.
        // This keeps the bot instant on the first turn.
        if (board.filter(c => c === ' ').length >= 8) {
            move = board[4] === ' ' ? 4 : 0;
        } else if (Math.random() < 0.3) {
            // Nerf: 30% chance to make a random blunder so it's not unbeatable
            const emptyIndices = board.map((c, i) => c === ' ' ? i : null).filter(i => i !== null);
            move = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        } else {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === ' ') {
                    board[i] = 'O'; // Bot simulates its move
                    const score = minimax(board, 0, false);
                    board[i] = ' '; // Undo move (backtrack)
                    if (score > bestScore) {
                        bestScore = score;
                        move = i;
                    }
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────
        
        ticTacToeMove(String(move + 1), 'Bot');
    };


    const COMPLIMENTS = [
        "You have the energy of someone who refills the office coffee without being asked. Truly rare. ☕",
        "You're the human equivalent of finding a $20 bill in an old jacket. Always a pleasant surprise. 💸",
        "You make people feel smarter just by listening to them. That's a superpower. 🦸",
        "You're the type of person who actually reads the whole group chat. A legend. 📱",
        "Your laugh is so contagious it should come with a health warning. 😂",
        "You have the rare gift of making awkward silences feel cozy. 🛋️",
        "You're the kind of person who holds the elevator. The world needs more of you. 🛗",
        "You have the vibe of someone who always knows a great restaurant. Invaluable. 🍽️",
        "You're basically a human highlighter — you make everything around you brighter. ✨",
        "You're proof that good people still exist. And we are here for it. 🙌",
        "You have the energy of a perfectly ripe avocado. Rare. Cherished. Gone too soon. 🥑",
        "If kindness were a currency, you'd be absolutely loaded. 💰",
        "You're the person everyone secretly hopes shows up to the party. 🎉",
        "You give off the vibe of someone who tips well. And we respect that deeply. 🤌",
        "You're the friend people call first when something good happens. That means everything. 📞",
        "You have the confidence of someone who orders dessert without asking if anyone wants to split it. Iconic. 🍰",
        "You could make small talk with a brick wall and the brick wall would walk away smiling. 🧱😄",
        "You're the human equivalent of a noise-cancelling headphone. Calming, premium, and always there. 🎧",
        "You have the charisma of a golden retriever and the wisdom of a very old cat. Unbeatable combo. 🐕🐈",
        "You're the type of person who remembers birthdays without Facebook reminding you. An absolute hero. 🎂",
        "You radiate 'I have a really good playlist' energy. Never change. 🎵",
        "You're the kind of person who makes every group project less terrible. You deserve a medal. 🥇",
        "You have main character energy, but you're also super supportive of the side characters. Balance. 🎬",
        "You're the human equivalent of a perfectly timed meme. Relevant, funny, and always appreciated. 😂",
        "You glow different. That's not a metaphor. It's just true. 🌟",
        "You could narrate a nature documentary and make it a hundred times better. 🎙️🦁",
        "You're proof that 'being a good person' and 'being fun to be around' are not mutually exclusive. 🏆",
        "You have the energy of someone who actually finishes their to-do list. Aspirational. ✅",
        "You're like a library — full of interesting things, calming to be around, and fundamentally good for society. 📚",
        "The world is measurably better with you in it. That's just math. ➕🌍",
        "You have the kind of patience that makes hard days easier for everyone around you. 🌿",
        "You ask really good questions — the kind that make people think twice. 🤔",
        "You're remarkably good at making people feel heard. That's not common. 👂",
        "You bring the best snacks and somehow never take credit for it. 🍪",
        "You have impeccable timing with a joke. Never fails. 🎯",
        "You're the friend who actually shows up. Every single time. 🚗",
        "Your texts always make people smile, even the one-word replies. 💬",
        "You have a talent for making complicated things simple. 🧩",
        "You're incredibly easy to be around — zero effort required. 🌤️",
        "You notice the little things other people miss. That's a gift. 🔍",
        "You're the definition of reliable. People build plans around you for a reason. 🧱",
        "You give the best advice, and somehow it's never preachy. 🧠",
        "You have a way of making people feel like the main character. 🎬",
        "Your enthusiasm is genuinely contagious. 🎉",
        "You're the calm in most storms. People notice. 🌊",
        "You make everyone around you a little braver. 🦁",
        "You're effortlessly funny — the good kind, not the trying-too-hard kind. 😄",
        "You have great taste, and you're not even smug about it. 🎨",
        "You somehow remember everyone's order. Icon behavior. 🍔",
        "You're the type of person people trust with their secrets. That says a lot. 🤫",
        "You have a gift for turning bad days around with one sentence. ☀️",
        "You're incredibly generous with your time, and it doesn't go unnoticed. ⏳",
        "You make hard conversations feel a little less scary. 🗣️",
        "You're the kind of person who cheers loudest for other people's wins. 📣",
        "Your curiosity is honestly inspiring. You ask 'why' more than most adults do. 🔎",
        "You've got that rare talent of disagreeing with someone and still making them feel respected. 🤝",
        "You're consistently kind, even on days when it would be easier not to be. 🌼",
        "You have the best laugh in any room you walk into. 😂",
        "You make people feel instantly comfortable. That's a superpower. 🛋️",
        "You're weirdly good at picking the perfect gift. Every time. 🎁",
        "You have a gift for making people feel less alone. 🌙",
        "You're the friend who remembers the small details from months ago. 🧵",
        "You bring a genuinely good vibe wherever you go. 🌈",
        "You're brave in the quiet ways — the ones nobody claps for. 🕊️",
        "You have a great sense of when someone just needs to vent, not fix. 🎧",
        "You're the person who makes new people feel instantly welcome. 🚪",
        "Your work ethic quietly makes everyone around you better. 💪",
        "You have impeccable comedic timing. Truly underrated. ⏱️",
        "You're one of the few people who actually follows through. 📌",
        "You make ordinary hangouts feel like an event. 🎈",
        "You're incredibly self-aware, and that's rarer than people think. 🪞",
        "You have a knack for saying exactly what someone needs to hear. 💬",
        "You're low-key one of the most thoughtful people around. 🧠💛",
        "You handle stress with way more grace than you give yourself credit for. 🧘",
        "You're the person people quietly hope gets seated next to them. 🪑",
        "You give great hugs. Scientifically proven — probably. 🤗",
        "You have an underrated talent for making people feel important. ⭐",
        "You're consistently, quietly excellent at what you do. 🏅",
        "You make people want to be a slightly better version of themselves. 🌱",
        "You're proof that being genuinely good doesn't have to be loud. 🔔",
    ];

    const sendCompliment = (rawName) => {
        const name = cleanName(rawName);
        const compliment = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
        setTimeout(() => sendMessage("💌 " + name + ": " + compliment), 300);
    };

    // ── Roasts ───────────────────────────────────────────────────────────────
    const ROASTS = [
        "You have the confidence of someone who's never once read the terms and conditions. 📜",
        "You're the human equivalent of a buffering video. 🔄",
        "You have the energy of a phone at 1% brightness. 🔋",
        "You're proof that spellcheck can only do so much. 🔤",
        "You've got main character energy in a story nobody's reading. 📖",
        "You're the reason group projects have a 'did not contribute' section. 📋",
        "You have the aim of someone throwing trash at a can from two feet away. 🗑️",
        "You're like a Wi-Fi signal — great in theory, unreliable in practice. 📶",
        "You have the punctuality of a pizza that says '30 minutes or free' and takes an hour. 🍕",
        "You're the human version of a typo nobody caught before sending. ⌨️",
        "You've got the decision-making speed of someone picking a Netflix show for 45 minutes. 🍿",
        "You're basically a software update — nobody asked, and it's happening at the worst time. 💻",
        "You have the reliability of a phone charger that only works at one exact angle. 🔌",
        "You're the human equivalent of a 'reply all' email nobody needed. 📧",
        "You've got the balance of a Roomba that's found the stairs. 🤖",
        "You're like a parking ticket — unwanted, unnecessary, and always at the worst time. 🎫",
        "You have the memory of someone who walks into a room and forgets why. 🚪",
        "You're the human version of a CAPTCHA — everyone's patience runs out around you. 🧩",
        "You've got the grace of someone tripping on a flat surface. 🧍",
        "You're like a microwave that beeps three times but somehow the food's still cold. 🍽️",
        "You have the smoothness of gravel. 🪨",
        "You're the reason instructions now come with pictures. 🖼️",
        "You've got the timing of an alarm that goes off after you're already awake. ⏰",
        "You're basically a software bug — hard to explain, impossible to reproduce on command. 🐛",
        "You have the subtlety of a fire alarm during a nap. 🚨",
        "You're the human equivalent of autocorrect changing a perfectly fine word. 📱",
        "You've got the follow-through of a New Year's resolution by January 3rd. 🎆",
        "You're like a GPS that says 'recalculating' way too often. 🗺️",
        "You have the patience of someone waiting for a webpage to load on airport Wi-Fi. ✈️",
        "You're the human version of a plot hole — everyone notices, nobody wants to explain it. 🕳️",
        "You've got the coordination of a fan trying to catch confetti. 🎊",
        "You're like a group chat notification — loud, frequent, and mostly unnecessary. 🔔",
        "You have the consistency of gym motivation in February. 🏋️",
        "You're the reason 'reply' and 'reply all' are two different buttons. 📨",
        "You've got the accuracy of a weather app three weeks out. ☁️",
        "You're like a vending machine that takes your money and gives you nothing. 🥤",
        "You have the stealth of a shopping cart with one busted wheel. 🛒",
        "You're the human equivalent of a printer that jams right before the deadline. 🖨️",
        "You've got the volume control of someone whispering into a live mic. 🎤",
        "You're like a browser with 47 tabs open and no idea which one's playing music. 🌐",
        "You have the punctuality of a bus that's 'on its way' for twenty minutes straight. 🚌",
        "You're the reason spellcheck has trust issues. ✍️",
        "You've got the elegance of someone doing the 'after you, no after you' door dance alone. 🚪",
        "You're like a Bluetooth speaker that connects to the wrong device every time. 🔊",
        "You have the timing of a sneeze during a moment of silence. 🤧",
        "You're the human version of a plot twist nobody asked for. 🌀",
        "You've got the follow-up game of a text left on read for three days. 📵",
        "You're like a self-checkout machine — technically working, emotionally exhausting. 🛍️",
        "You have the reliability of a 'call you right back' that never comes. ☎️",
        "You're the reason autocomplete gave up trying to guess what you meant. 🔍",
        "You've got the poise of someone waving back at a person who wasn't waving at them. 👋",
        "You're like a loading bar stuck at 99%. 📊",
        "You have the subtlety of a car alarm at 3am. 🚗",
        "You're the human equivalent of a chair that's 'just for decoration.' 🪑",
        "You've got the aim of a paper airplane thrown indoors. ✈️",
        "You're like a streaming app that logs you out for 'security reasons' weekly. 🔐",
        "You have the punctuality of the last email in a thread that was already resolved. 📩",
        "You're the reason 'you're on mute' became a universal phrase. 🎙️",
        "You've got the confidence of someone singing karaoke to a song they don't know. 🎶",
        "You're like a treadmill in January — full of promise, mostly unused by March. 🏃",
        "You have the mystery of a 'no reply' address that somehow still expects a response. 📮",
        "You're the human version of a website that makes you accept cookies twice. 🍪",
        "You've got the drama of a phone battery that dies exactly at 20%. 🔋",
        "You're like a group project slideshow with one slide that's clearly a different font. 🎞️",
        "You have the accuracy of an ETA that assumes zero traffic, ever. 🚦",
        "You're the reason 'are you still watching?' pops up on the screen. 📺",
        "You've got the smoothness of a Zoom call with three seconds of lag. 🖥️",
        "You're like an umbrella that turns inside out the second it's actually useful. ☔",
        "You have the timing of a spoiler dropped one scene too early. 🎬",
        "You're the human equivalent of a 'this meeting could've been an email.' 📨",
        "You've got the reliability of a self-tying shoelace that's never actually tied. 👟",
        "You're like a search engine returning results for something you never typed. 🔎",
        "You have the punctuality of a delivery that says 'out for delivery' for two straight days. 📦",
        "You're the reason 'undo send' exists as a feature. ↩️",
        "You've got the composure of someone stepping on a Lego at 2am. 🧱",
        "You're like a phone update that changes everything and explains nothing. 📲",
        "You have the grace of a chair spinning one extra time after you tried to stop it. 🪑",
        "You're the human version of a 'terms may change without notice.' 📜",
        "You've got the consistency of a printer that only works when nobody's watching. 🖨️",
        "You have the subtlety of confetti cannons at a library. 🎉",
    ];

    const sendRoast = (rawName, args) => {
        const name = (args && args.length) ? cleanName(args.join(' ')) : cleanName(rawName);
        const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
        setTimeout(() => sendMessage("🔥 " + name + ": " + roast), 300);
    };

    // ── Callout ──────────────────────────────────────────────────────────────
    const sendCallout = (rawName, args) => {
        const name = (args && args.length) ? cleanName(args.join(' ')) : cleanName(rawName);
        setTimeout(() => sendMessage("🚨 " + name + " was in the files"), 300);
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
    const getDisplayWord = () => hangmanState.word.split('').map(l => hangmanState.guessed.includes(l) ? l : '_').join(' ');
    const getRemainingLetters = () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').filter(l => !hangmanState.guessed.includes(l)).join(' ');
    const decodeHTML = (str) => { const txt = document.createElement("textarea"); txt.innerHTML = str; return txt.value; };
    const cleanName = (n) => (n || "Player").replace(/\b(Message|User|Avatar of|Profile photo of)\b:?/gi,'').replace(/\b(AM|PM)\b/g,'').replace(/[0-9:]/g,'').trim() || "Player";
    const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);


    const TRIVIA_POOL = [
        // Geography
        {q:"What is the capital of Australia?",a:"Canberra",w:["Sydney","Melbourne","Brisbane"]},
        {q:"What is the capital of Canada?",a:"Ottawa",w:["Toronto","Vancouver","Montreal"]},
        {q:"What is the capital of Brazil?",a:"Brasilia",w:["Rio de Janeiro","São Paulo","Salvador"]},
        {q:"What is the capital of Japan?",a:"Tokyo",w:["Osaka","Kyoto","Hiroshima"]},
        {q:"What is the capital of South Africa?",a:"Pretoria",w:["Cape Town","Johannesburg","Durban"]},
        {q:"What is the largest country by area?",a:"Russia",w:["Canada","China","USA"]},
        {q:"What is the smallest country in the world?",a:"Vatican City",w:["Monaco","San Marino","Liechtenstein"]},
        {q:"What is the longest river in the world?",a:"Nile",w:["Amazon","Yangtze","Mississippi"]},
        {q:"What is the largest ocean?",a:"Pacific",w:["Atlantic","Indian","Arctic"]},
        {q:"How many continents are there?",a:"7",w:["5","6","8"]},
        {q:"What country has the most natural lakes?",a:"Canada",w:["Russia","USA","Finland"]},
        {q:"What is the tallest mountain in the world?",a:"Mount Everest",w:["K2","Kangchenjunga","Makalu"]},
        {q:"What is the largest desert in the world?",a:"Antarctica",w:["Sahara","Arabian","Gobi"]},
        {q:"Which country has the longest coastline?",a:"Canada",w:["Norway","Russia","Australia"]},
        {q:"What is the capital of Argentina?",a:"Buenos Aires",w:["Cordoba","Rosario","Mendoza"]},
        {q:"What is the capital of Egypt?",a:"Cairo",w:["Alexandria","Luxor","Giza"]},
        {q:"What is the capital of Germany?",a:"Berlin",w:["Munich","Hamburg","Frankfurt"]},
        {q:"What is the capital of India?",a:"New Delhi",w:["Mumbai","Kolkata","Bangalore"]},
        {q:"What is the capital of Mexico?",a:"Mexico City",w:["Guadalajara","Monterrey","Puebla"]},
        {q:"Which country is home to the Amazon Rainforest?",a:"Brazil",w:["Peru","Colombia","Venezuela"]},
        {q:"What is the capital of Spain?",a:"Madrid",w:["Barcelona","Seville","Valencia"]},
        {q:"What is the capital of Italy?",a:"Rome",w:["Milan","Naples","Turin"]},
        {q:"What river flows through Egypt?",a:"Nile",w:["Congo","Niger","Zambezi"]},
        {q:"What is the capital of China?",a:"Beijing",w:["Shanghai","Guangzhou","Shenzhen"]},
        {q:"What is the capital of Russia?",a:"Moscow",w:["Saint Petersburg","Novosibirsk","Yekaterinburg"]},
        // Science
        {q:"What is the chemical symbol for gold?",a:"Au",w:["Ag","Fe","Cu"]},
        {q:"What is the chemical symbol for water?",a:"H2O",w:["HO","H2O2","HO2"]},
        {q:"What planet is known as the Red Planet?",a:"Mars",w:["Venus","Jupiter","Saturn"]},
        {q:"How many bones are in the adult human body?",a:"206",w:["198","213","225"]},
        {q:"What gas do plants absorb from the air?",a:"Carbon dioxide",w:["Oxygen","Nitrogen","Hydrogen"]},
        {q:"What is the hardest natural substance on Earth?",a:"Diamond",w:["Quartz","Ruby","Titanium"]},
        {q:"What is the speed of light in km/s (approx)?",a:"300,000",w:["150,000","450,000","600,000"]},
        {q:"How many planets are in our solar system?",a:"8",w:["7","9","10"]},
        {q:"What is the powerhouse of the cell?",a:"Mitochondria",w:["Nucleus","Ribosome","Golgi body"]},
        {q:"What is the most abundant gas in Earth's atmosphere?",a:"Nitrogen",w:["Oxygen","Carbon dioxide","Argon"]},
        {q:"What is the atomic number of carbon?",a:"6",w:["8","12","14"]},
        {q:"What force keeps planets in orbit around the sun?",a:"Gravity",w:["Magnetism","Nuclear force","Friction"]},
        {q:"What is the closest star to Earth?",a:"The Sun",w:["Proxima Centauri","Sirius","Alpha Centauri"]},
        {q:"What organ pumps blood through the human body?",a:"Heart",w:["Liver","Lungs","Kidney"]},
        {q:"What is the chemical symbol for iron?",a:"Fe",w:["Ir","In","I"]},
        {q:"How many chromosomes do humans have?",a:"46",w:["23","44","48"]},
        {q:"What is the largest planet in our solar system?",a:"Jupiter",w:["Saturn","Neptune","Uranus"]},
        {q:"What is the smallest planet in our solar system?",a:"Mercury",w:["Mars","Venus","Pluto"]},
        {q:"What type of animal is a dolphin?",a:"Mammal",w:["Fish","Reptile","Amphibian"]},
        {q:"What is the chemical formula for table salt?",a:"NaCl",w:["KCl","CaCl2","MgCl2"]},
        {q:"What is the boiling point of water in Celsius?",a:"100",w:["90","110","120"]},
        {q:"What part of the plant conducts photosynthesis?",a:"Leaves",w:["Roots","Stem","Flowers"]},
        {q:"What is the most common blood type?",a:"O+",w:["A+","B+","AB+"]},
        {q:"How many chambers does the human heart have?",a:"4",w:["2","3","6"]},
        {q:"What is DNA short for?",a:"Deoxyribonucleic acid",w:["Diribonucleic acid","Deoxyribonitric acid","Dinucleic riboacid"]},
        // Math
        {q:"What is the square root of 144?",a:"12",w:["11","13","14"]},
        {q:"How many sides does a hexagon have?",a:"6",w:["5","7","8"]},
        {q:"What is 15% of 200?",a:"30",w:["25","35","40"]},
        {q:"What is the value of Pi to two decimal places?",a:"3.14",w:["3.12","3.16","3.18"]},
        {q:"What is 7 multiplied by 8?",a:"56",w:["54","58","48"]},
        {q:"What is the next prime number after 7?",a:"11",w:["9","10","13"]},
        {q:"What is 2 to the power of 10?",a:"1024",w:["512","2048","256"]},
        {q:"How many degrees are in a right angle?",a:"90",w:["45","180","360"]},
        {q:"What is the sum of angles in a triangle?",a:"180",w:["90","270","360"]},
        {q:"What is 12 squared?",a:"144",w:["124","164","112"]},
        {q:"What is the Roman numeral for 50?",a:"L",w:["V","X","C"]},
        {q:"What is 1000 divided by 8?",a:"125",w:["115","130","120"]},
        {q:"How many sides does an octagon have?",a:"8",w:["6","7","9"]},
        {q:"What is 25% of 80?",a:"20",w:["15","25","30"]},
        {q:"What is the Fibonacci sequence's 7th number (starting 1,1,2...)?",a:"13",w:["8","11","21"]},
        // History
        {q:"In what year did World War II end?",a:"1945",w:["1943","1944","1946"]},
        {q:"Who was the first President of the United States?",a:"George Washington",w:["John Adams","Thomas Jefferson","Benjamin Franklin"]},
        {q:"In what year did the Berlin Wall fall?",a:"1989",w:["1987","1991","1985"]},
        {q:"Who painted the Mona Lisa?",a:"Leonardo da Vinci",w:["Michelangelo","Raphael","Picasso"]},
        {q:"In what year did the Titanic sink?",a:"1912",w:["1910","1914","1916"]},
        {q:"Who was the first man to walk on the moon?",a:"Neil Armstrong",w:["Buzz Aldrin","Yuri Gagarin","John Glenn"]},
        {q:"In what year did World War I begin?",a:"1914",w:["1912","1916","1918"]},
        {q:"What ancient wonder was located in Alexandria?",a:"The Lighthouse",w:["The Colossus","The Hanging Gardens","The Statue of Zeus"]},
        {q:"Who wrote the Declaration of Independence?",a:"Thomas Jefferson",w:["George Washington","Benjamin Franklin","John Adams"]},
        {q:"What empire was ruled by Julius Caesar?",a:"Roman Empire",w:["Greek Empire","Ottoman Empire","Byzantine Empire"]},
        {q:"In what year did the French Revolution begin?",a:"1789",w:["1776","1804","1815"]},
        {q:"Who was the first female Prime Minister of the UK?",a:"Margaret Thatcher",w:["Theresa May","Angela Merkel","Indira Gandhi"]},
        {q:"What year did the Soviet Union collapse?",a:"1991",w:["1989","1993","1985"]},
        {q:"Which country was Nelson Mandela president of?",a:"South Africa",w:["Zimbabwe","Kenya","Nigeria"]},
        {q:"What ship famously sank on its maiden voyage?",a:"Titanic",w:["Lusitania","Bismarck","Edmund Fitzgerald"]},
        {q:"Who led the Cuban Revolution?",a:"Fidel Castro",w:["Che Guevara","Raul Castro","Batista"]},
        {q:"In what year did man first land on the moon?",a:"1969",w:["1967","1971","1965"]},
        {q:"What was the name of the first artificial satellite?",a:"Sputnik",w:["Explorer","Vanguard","Pioneer"]},
        // Pop Culture & Entertainment
        {q:"What movie features the character Jack Sparrow?",a:"Pirates of the Caribbean",w:["Treasure Island","The Mummy","Blackbeard"]},
        {q:"Who sang 'Thriller'?",a:"Michael Jackson",w:["Prince","Madonna","David Bowie"]},
        {q:"What show features Walter White?",a:"Breaking Bad",w:["Better Call Saul","Dexter","The Wire"]},
        {q:"What is the highest-grossing film of all time (not adjusted)?",a:"Avatar",w:["Avengers: Endgame","Titanic","Star Wars"]},
        {q:"Who created the Harry Potter series?",a:"J.K. Rowling",w:["J.R.R. Tolkien","C.S. Lewis","Roald Dahl"]},
        {q:"What band was Freddie Mercury the lead singer of?",a:"Queen",w:["Led Zeppelin","The Rolling Stones","David Bowie"]},
        {q:"What animated film features Simba?",a:"The Lion King",w:["Bambi","Jungle Book","Tarzan"]},
        {q:"Who plays Iron Man in the MCU?",a:"Robert Downey Jr.",w:["Chris Evans","Chris Hemsworth","Mark Ruffalo"]},
        {q:"What sport does LeBron James play?",a:"Basketball",w:["Football","Baseball","Soccer"]},
        {q:"What year was the first iPhone released?",a:"2007",w:["2005","2008","2010"]},
        {q:"What company makes the PlayStation?",a:"Sony",w:["Microsoft","Nintendo","Sega"]},
        {q:"What TV show is set in Westeros?",a:"Game of Thrones",w:["The Witcher","Lord of the Rings","Vikings"]},
        {q:"Who sang 'Rolling in the Deep'?",a:"Adele",w:["Beyoncé","Rihanna","Amy Winehouse"]},
        {q:"What video game franchise features Link and Zelda?",a:"The Legend of Zelda",w:["Final Fantasy","Dragon Quest","Dark Souls"]},
        {q:"What streaming service created Stranger Things?",a:"Netflix",w:["HBO","Disney+","Amazon Prime"]},
        {q:"Who is the author of 'The Lord of the Rings'?",a:"J.R.R. Tolkien",w:["C.S. Lewis","George R.R. Martin","Terry Pratchett"]},
        {q:"What is the name of Batman's butler?",a:"Alfred",w:["James","Arthur","Edwin"]},
        {q:"What movie is set on the planet Pandora?",a:"Avatar",w:["Interstellar","Guardians of the Galaxy","The Martian"]},
        {q:"Who voiced Woody in Toy Story?",a:"Tom Hanks",w:["Tim Allen","Billy Crystal","Robin Williams"]},
        {q:"What is the name of the fictional kingdom in Frozen?",a:"Arendelle",w:["Narnia","Agrabah","Corona"]},
        // Sports
        {q:"How many players are on a soccer team?",a:"11",w:["9","10","12"]},
        {q:"How many rings are on the Olympic flag?",a:"5",w:["4","6","7"]},
        {q:"What country invented basketball?",a:"USA",w:["Canada","UK","France"]},
        {q:"How long is a marathon in km (approx)?",a:"42.2",w:["36.5","39.4","45.0"]},
        {q:"What sport is played at Wimbledon?",a:"Tennis",w:["Cricket","Polo","Croquet"]},
        {q:"How many players are on a basketball team on court?",a:"5",w:["4","6","7"]},
        {q:"What country has won the most FIFA World Cups?",a:"Brazil",w:["Germany","Italy","Argentina"]},
        {q:"In what sport would you perform a slam dunk?",a:"Basketball",w:["Volleyball","Tennis","Handball"]},
        {q:"How many holes are on a standard golf course?",a:"18",w:["9","12","24"]},
        {q:"What is the national sport of Japan?",a:"Sumo",w:["Judo","Karate","Kendo"]},
        {q:"What sport uses a puck?",a:"Ice Hockey",w:["Lacrosse","Field Hockey","Polo"]},
        {q:"In what sport can you score a hat-trick?",a:"Soccer",w:["Basketball","Tennis","Baseball"]},
        {q:"How many points is a touchdown worth in American football?",a:"6",w:["3","7","8"]},
        {q:"What is the diameter of a basketball hoop in inches?",a:"18",w:["15","21","24"]},
        {q:"What country hosted the 2016 Summer Olympics?",a:"Brazil",w:["China","UK","Japan"]},
        // Food & Drink
        {q:"What is the main ingredient in guacamole?",a:"Avocado",w:["Tomato","Lime","Onion"]},
        {q:"What country does sushi originate from?",a:"Japan",w:["China","Korea","Vietnam"]},
        {q:"What is the most consumed beverage in the world after water?",a:"Tea",w:["Coffee","Beer","Cola"]},
        {q:"What nut is used to make marzipan?",a:"Almonds",w:["Hazelnuts","Cashews","Pistachios"]},
        {q:"What fruit is used to make wine?",a:"Grapes",w:["Apples","Plums","Cherries"]},
        {q:"What is the main ingredient in hummus?",a:"Chickpeas",w:["Lentils","Black beans","Soybeans"]},
        {q:"What country is famous for inventing pizza?",a:"Italy",w:["Greece","France","Spain"]},
        {q:"What is the spiciest pepper in the world?",a:"Carolina Reaper",w:["Ghost Pepper","Habanero","Scotch Bonnet"]},
        {q:"What is the primary ingredient in bread?",a:"Flour",w:["Sugar","Salt","Yeast"]},
        {q:"What is the most expensive spice by weight?",a:"Saffron",w:["Vanilla","Cardamom","Truffle"]},
        {q:"What bean is used to make tofu?",a:"Soybean",w:["Chickpea","Lentil","Kidney bean"]},
        {q:"Which country produces the most coffee?",a:"Brazil",w:["Colombia","Ethiopia","Vietnam"]},
        // Language & Literature
        {q:"Who wrote 'Romeo and Juliet'?",a:"Shakespeare",w:["Dickens","Austen","Tolkien"]},
        {q:"How many letters are in the English alphabet?",a:"26",w:["24","25","27"]},
        {q:"Who wrote '1984'?",a:"George Orwell",w:["Aldous Huxley","Ray Bradbury","H.G. Wells"]},
        {q:"What language is spoken in Brazil?",a:"Portuguese",w:["Spanish","French","English"]},
        {q:"Who wrote 'Pride and Prejudice'?",a:"Jane Austen",w:["Charlotte Bronte","Emily Bronte","George Eliot"]},
        {q:"What is the most spoken language in the world?",a:"Mandarin Chinese",w:["English","Spanish","Hindi"]},
        {q:"Who wrote 'The Great Gatsby'?",a:"F. Scott Fitzgerald",w:["Ernest Hemingway","John Steinbeck","William Faulkner"]},
        {q:"In what language was the original Bible written (New Testament)?",a:"Greek",w:["Latin","Hebrew","Aramaic"]},
        {q:"Who wrote 'Moby Dick'?",a:"Herman Melville",w:["Mark Twain","Nathaniel Hawthorne","Edgar Allan Poe"]},
        {q:"What is the longest word in the English language (commonly cited)?",a:"Pneumonoultramicroscopicsilicovolcanoconiosis",w:["Antidisestablishmentarianism","Floccinaucinihilipilification","Supercalifragilisticexpialidocious"]},
        {q:"Who wrote 'To Kill a Mockingbird'?",a:"Harper Lee",w:["Toni Morrison","John Steinbeck","Truman Capote"]},
        {q:"What is a word that reads the same forwards and backwards called?",a:"Palindrome",w:["Anagram","Acronym","Oxymoron"]},
        // Technology
        {q:"What does 'HTTP' stand for?",a:"HyperText Transfer Protocol",w:["High Traffic Transfer Protocol","HyperText Transport Protocol","Hosted Text Transfer Protocol"]},
        {q:"Who co-founded Apple with Steve Jobs?",a:"Steve Wozniak",w:["Bill Gates","Paul Allen","Michael Dell"]},
        {q:"What does 'CPU' stand for?",a:"Central Processing Unit",w:["Computer Processing Unit","Core Program Unit","Central Program Unit"]},
        {q:"What company created Android?",a:"Google",w:["Apple","Samsung","Microsoft"]},
        {q:"What year was the World Wide Web invented?",a:"1989",w:["1983","1991","1995"]},
        {q:"What does 'RAM' stand for?",a:"Random Access Memory",w:["Read Access Memory","Rapid Access Memory","Random Array Memory"]},
        {q:"Who founded Microsoft?",a:"Bill Gates",w:["Steve Jobs","Elon Musk","Jeff Bezos"]},
        {q:"What programming language was the first high-level language?",a:"FORTRAN",w:["COBOL","BASIC","Pascal"]},
        {q:"What does 'URL' stand for?",a:"Uniform Resource Locator",w:["Universal Resource Link","Unified Resource Locator","Unique Reference Location"]},
        {q:"What social media platform uses a bird as its original logo?",a:"Twitter",w:["Facebook","Instagram","Snapchat"]},
        {q:"How many bits are in a byte?",a:"8",w:["4","16","32"]},
        {q:"What company makes the iPhone?",a:"Apple",w:["Samsung","Google","Microsoft"]},
        // Animals
        {q:"What is the fastest land animal?",a:"Cheetah",w:["Lion","Pronghorn","Springbok"]},
        {q:"What is the largest land animal?",a:"African Elephant",w:["Hippopotamus","White Rhino","Giraffe"]},
        {q:"What is the only mammal capable of true flight?",a:"Bat",w:["Flying squirrel","Sugar glider","Colugo"]},
        {q:"What is a group of lions called?",a:"Pride",w:["Pack","Herd","Flock"]},
        {q:"What is the largest species of shark?",a:"Whale shark",w:["Great white shark","Basking shark","Hammerhead shark"]},
        {q:"How many legs does a spider have?",a:"8",w:["6","10","12"]},
        {q:"What animal has the longest lifespan?",a:"Greenland Shark",w:["Galapagos Tortoise","Bowhead Whale","Ocean Quahog"]},
        {q:"What is the largest bird in the world?",a:"Ostrich",w:["Emu","Cassowary","Albatross"]},
        {q:"What do you call a baby kangaroo?",a:"Joey",w:["Cub","Pup","Kit"]},
        {q:"What is the only venomous mammal native to North America?",a:"Short-tailed shrew",w:["Platypus","Slow loris","Duck-billed platypus"]},
        {q:"What animal is known for having the best memory?",a:"Elephant",w:["Dolphin","Chimpanzee","Crow"]},
        {q:"How many hearts does an octopus have?",a:"3",w:["1","2","4"]},
        {q:"What is the collective noun for a group of crows?",a:"Murder",w:["Flock","Colony","Parliament"]},
        {q:"What is the largest type of penguin?",a:"Emperor Penguin",w:["King Penguin","Chinstrap Penguin","Gentoo Penguin"]},
        {q:"What is a group of wolves called?",a:"Pack",w:["Pride","Herd","Colony"]},
        // Miscellaneous
        {q:"How many colors are in a rainbow?",a:"7",w:["5","6","8"]},
        {q:"What is the currency of the United Kingdom?",a:"Pound Sterling",w:["Euro","Dollar", "Franc"]},
        {q:"What is the currency of Japan?",a:"Yen",w:["Won","Yuan","Ringgit"]},
        {q:"What is the tallest building in the world?",a:"Burj Khalifa",w:["Shanghai Tower","One World Trade Center","Taipei 101"]},
        {q:"What is the most common element in the universe?",a:"Hydrogen",w:["Helium","Oxygen","Carbon"]},
        {q:"How many days are in a leap year?",a:"366",w:["364","365","367"]},
        {q:"What is the symbol for the euro?",a:"€",w:["£","$","¥"]},
        {q:"What is the largest organ in the human body?",a:"Skin",w:["Liver","Intestine","Lung"]},
        {q:"What is the phobia of spiders called?",a:"Arachnophobia",w:["Agoraphobia","Claustrophobia","Entomophobia"]},
        {q:"How many minutes are in a day?",a:"1440",w:["1200","1320","1560"]},
        {q:"What is the name of the tallest waterfall in the world?",a:"Angel Falls",w:["Victoria Falls","Niagara Falls","Iguazu Falls"]},
        {q:"What is the most widely practiced religion in the world?",a:"Christianity",w:["Islam","Hinduism","Buddhism"]},
        {q:"What is the national animal of Australia?",a:"Red Kangaroo",w:["Koala","Wombat","Emu"]},
        {q:"What instrument does a luthier make?",a:"Stringed instruments",w:["Wind instruments","Drums","Keyboards"]},
        {q:"What is the name of the longest bone in the human body?",a:"Femur",w:["Tibia","Humerus","Fibula"]},
        {q:"What does NASA stand for?",a:"National Aeronautics and Space Administration",w:["National Aerospace and Science Agency","North American Space Association","National Aviation and Space Authority"]},
        {q:"How many strings does a standard guitar have?",a:"6",w:["4","5","7"]},
        {q:"What gemstone is associated with a 60th anniversary?",a:"Diamond",w:["Ruby","Emerald","Sapphire"]},
        {q:"What is the fear of heights called?",a:"Acrophobia",w:["Agoraphobia","Vertigo","Claustrophobia"]},
        {q:"What is the chemical symbol for silver?",a:"Ag",w:["Si","Sl","Sv"]},
        {q:"How many keys does a standard piano have?",a:"88",w:["72","84","96"]},
        {q:"What is the largest internal organ in the human body?",a:"Liver",w:["Kidney","Stomach","Spleen"]},
        // Geography (new)
        {q:"What is the capital of South Korea?",a:"Seoul",w:["Busan","Incheon","Daegu"]},
        {q:"What is the longest mountain range in the world?",a:"Andes",w:["Rockies","Himalayas","Alps"]},
        {q:"What is the smallest continent by land area?",a:"Australia",w:["Europe","Antarctica","South America"]},
        {q:"What is the capital of Turkey?",a:"Ankara",w:["Istanbul","Izmir","Bursa"]},
        {q:"Which African country was formerly known as Abyssinia?",a:"Ethiopia",w:["Sudan","Kenya","Somalia"]},
        {q:"What is the capital of Norway?",a:"Oslo",w:["Bergen","Stockholm","Helsinki"]},
        {q:"Which sea is the saltiest body of water in the world?",a:"Dead Sea",w:["Red Sea","Caspian Sea","Black Sea"]},
        {q:"What is the capital of Portugal?",a:"Lisbon",w:["Porto","Madrid","Barcelona"]},
        {q:"What is the largest island in the world?",a:"Greenland",w:["Madagascar","Borneo","New Guinea"]},
        {q:"What is the capital of Thailand?",a:"Bangkok",w:["Phuket","Chiang Mai","Hanoi"]},
        // Science (new)
        {q:"What is the study of earthquakes called?",a:"Seismology",w:["Geology","Meteorology","Volcanology"]},
        {q:"What is the chemical symbol for potassium?",a:"K",w:["P","Po","Pt"]},
        {q:"What is the second largest planet in the solar system?",a:"Saturn",w:["Jupiter","Uranus","Neptune"]},
        {q:"What is the largest muscle in the human body?",a:"Gluteus maximus",w:["Quadriceps","Latissimus dorsi","Trapezius"]},
        {q:"What blood cells fight infection?",a:"White blood cells",w:["Red blood cells","Platelets","Plasma cells"]},
        {q:"What is the term for water turning directly into vapor?",a:"Sublimation",w:["Evaporation","Condensation","Deposition"]},
        {q:"What is the unit of electrical resistance called?",a:"Ohm",w:["Volt","Watt","Ampere"]},
        {q:"What is the chemical symbol for sodium?",a:"Na",w:["So","Sd","S"]},
        {q:"What galaxy do we live in?",a:"Milky Way",w:["Andromeda","Triangulum","Whirlpool"]},
        {q:"What is the freezing point of water in Fahrenheit?",a:"32",w:["0","30","40"]},
        // Math (new)
        {q:"What is 9 factorial divided by 8 factorial?",a:"9",w:["8","72","1"]},
        {q:"What is a triangle with all sides equal called?",a:"Equilateral",w:["Isosceles","Scalene","Right"]},
        {q:"What is the perimeter formula for a square with side s?",a:"4s",w:["s squared","2s","s divided by 4"]},
        {q:"What is 3 to the power of 4?",a:"81",w:["64","27","243"]},
        {q:"What is a right angle in radians?",a:"Pi/2",w:["Pi","2 Pi","Pi/4"]},
        // History (new)
        {q:"Who was the longest-reigning British monarch?",a:"Queen Elizabeth II",w:["Queen Victoria","King George III","King Henry VIII"]},
        {q:"What year did the Wright brothers achieve powered flight?",a:"1903",w:["1899","1907","1911"]},
        {q:"Who was the first emperor of Rome?",a:"Augustus",w:["Julius Caesar","Nero","Constantine"]},
        {q:"What conflict was fought between the North and South United States?",a:"The Civil War",w:["The Revolutionary War","World War I","The War of 1812"]},
        {q:"In what year did India gain independence?",a:"1947",w:["1945","1950","1930"]},
        // Sports
        {q:"How many players are on a standard soccer team on the field?",a:"11",w:["9","10","12"]},
        {q:"In which sport would you perform a slam dunk?",a:"Basketball",w:["Volleyball","Tennis","Baseball"]},
        {q:"How many rings are on the Olympic flag?",a:"5",w:["4","6","7"]},
        {q:"What sport is nicknamed 'the sweet science'?",a:"Boxing",w:["Fencing","Wrestling","Judo"]},
        {q:"How many players are on a standard basketball team on the court?",a:"5",w:["6","7","4"]},
        // Food & Drink (new)
        {q:"What country is famous for popularizing the croissant?",a:"France",w:["Austria","Belgium","Italy"]},
        {q:"What is the primary grain used to make sake?",a:"Rice",w:["Barley","Wheat","Corn"]},
        {q:"What is the main ingredient in traditional Greek tzatziki?",a:"Yogurt",w:["Sour cream","Cream cheese","Milk"]},
        {q:"What type of pastry is used to make baklava?",a:"Phyllo dough",w:["Puff pastry","Shortcrust","Choux pastry"]},
        {q:"What is the world's best-selling fruit?",a:"Banana",w:["Apple","Grape","Orange"]},
        // Language & Literature (new)
        {q:"Who wrote 'War and Peace'?",a:"Leo Tolstoy",w:["Fyodor Dostoevsky","Anton Chekhov","Ivan Turgenev"]},
        {q:"What is the study of word origins called?",a:"Etymology",w:["Linguistics","Semantics","Phonetics"]},
        {q:"Who wrote the 'Harry Potter' series?",a:"J.K. Rowling",w:["C.S. Lewis","J.R.R. Tolkien","Roald Dahl"]},
        {q:"In what language was 'Don Quixote' originally written?",a:"Spanish",w:["Italian","Portuguese","French"]},
        {q:"Who wrote 'The Odyssey'?",a:"Homer",w:["Virgil","Sophocles","Aristotle"]},
        // Technology (new)
        {q:"What does 'GPS' stand for?",a:"Global Positioning System",w:["General Positioning System","Global Placement Sensor","Geo Positioning Service"]},
        {q:"Who is considered the father of the World Wide Web?",a:"Tim Berners-Lee",w:["Vint Cerf","Steve Jobs","Bill Gates"]},
        {q:"What does 'AI' stand for?",a:"Artificial Intelligence",w:["Automated Interface","Applied Informatics","Advanced Integration"]},
        {q:"What company developed the PlayStation?",a:"Sony",w:["Microsoft","Nintendo","Sega"]},
        {q:"What does 'USB' stand for?",a:"Universal Serial Bus",w:["Universal System Bus","United Serial Board","Unified Storage Bus"]}
    ];

    // ── Trivia picker with dedup ──────────────────────────────────────────────
    const fetchTriviaQuestion = () => {
        const unseen = TRIVIA_POOL.filter(q => !_seenQuestions.has(q.q));
        if (unseen.length === 0) {
            _seenQuestions.clear();
            console.log("🔄 All trivia questions seen — resetting pool!");
            return pickRandom(TRIVIA_POOL);
        }
        return pickRandom(unseen);
    };

    const pickRandom = (pool) => {
        const item = pool[Math.floor(Math.random() * pool.length)];
        _seenQuestions.add(item.q);
        return { question: item.q, correct: item.a, wrong: item.w };
    };

    // ── Hangman word fetch ────────────────────────────────────────────────────
    const fetchRandomWord = async () => {
        const allStarters = ["br","cl","dr","fl","fr","gl","gr","pl","pr","sl","sm","sn","sp","st","sw","tr","wh","ch","sh","th","cr","sk","sc","a","e","i","o","un","in","ex","en","out","over","up"];
        const starter = allStarters[Math.floor(Math.random() * allStarters.length)];
        try {
            const res = await fetch("https://api.datamuse.com/words?sp=" + starter + "*&md=f&max=500");
            const data = await res.json();
            const valid = data.filter(w =>
                /^[a-zA-Z]{4,10}$/.test(w.word) &&
                w.tags && w.tags.some(t => t.startsWith("f:") && parseFloat(t.slice(2)) > 1.5)
            );
            if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)].word.toUpperCase();
        } catch (e) { console.warn("Datamuse failed:", e); }

        const fallback = [
            "PLANET","BRIDGE","JUNGLE","PIRATE","CANDLE","FROZEN","MARBLE","COBALT","WANDER","FELINE",
            "DONKEY","GOBLIN","ZIPPER","CASTLE","TANGLE","ROCKET","RIDDLE","BASKET","SILVER","MIRROR",
            "BOTTLE","CACTUS","DRAGON","FEATHER","HAMMER","ISLAND","JIGSAW","KERNEL","MAGNET","NOODLE",
            "OYSTER","PEPPER","QUARTZ","RIBBON","SOCKET","TIMBER","VELVET","WALRUS","ZENITH","ALPINE"
        ];
        return fallback[Math.floor(Math.random() * fallback.length)];
    };

    // ── Trivia game logic ─────────────────────────────────────────────────────
    const startTrivia = async (rawName) => {
        if (isGameActive()) return;
        _triviaStarting = true;
        const name = cleanName(rawName);

        const { question, correct, wrong } = fetchTriviaQuestion();
        const allAnswers = shuffle([correct, ...wrong]);
        const letters = ["A","B","C","D"];
        const choices = allAnswers.map((ans, i) => letters[i] + ") " + ans);
        const correctLetter = letters[allAnswers.indexOf(correct)];

        triviaState = { active: true, question, answer: correct, choices, correctLetter, askedBy: name, wrongGuesses: 0 };

        setTimeout(() => {
            sendMessage("🧠 Trivia time! (started by " + name + ")\n❓ " + question + "\n\n" + choices.join("\n") + "\n\nAnswer with !A  !B  !C  or  !D");
            _triviaStarting = false;
        }, 400);
    };

    const answerTrivia = (cmd, rawName) => {
        if (!triviaState.active) return;
        const name = cleanName(rawName);
        const letter = cmd[1].toUpperCase();
        if (letter === triviaState.correctLetter) {
            triviaState.active = false;
            sendMessage("🎉 Correct, " + name + "! The answer was: " + triviaState.answer + " ✅\nType !trivia for another question!");
        } else {
            triviaState.wrongGuesses++;
            const chosenAnswer = triviaState.choices.find(c => c.startsWith(letter + ")")) || "option " + letter;
            const guessesLeft = 3 - triviaState.wrongGuesses;
            if (triviaState.wrongGuesses >= 3) {
                triviaState.active = false;
                sendMessage("❌ " + name + " got it wrong! The answer was: " + triviaState.answer + ".\nNo guesses left! Type !trivia to restart.");
            } else {
                sendMessage("❌ " + name + " guessed " + chosenAnswer + " — wrong! (" + guessesLeft + " guess" + (guessesLeft === 1 ? "" : "es") + " left)\n❓ " + triviaState.question + "\n" + triviaState.choices.join("\n") + "\nAnswer with !A  !B  !C  !D");
            }
        }
    };


    const WMO_CODES = {
        0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Foggy",48:"Icy fog",
        51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",
        71:"Light snow",73:"Snow",75:"Heavy snow",77:"Snow grains",80:"Light showers",81:"Showers",
        82:"Heavy showers",85:"Snow showers",86:"Heavy snow showers",95:"Thunderstorm",
        96:"Thunderstorm w/ hail",99:"Thunderstorm w/ heavy hail",
    };
    const WEATHER_EMOJI = {
        0:"☀️", 1:"️", 2:"⛅", 3:"☁️", 45:"🌫️", 48:"🌫️", 51:"🌦️", 53:"🌦️", 55:"🌧️",
        0:"☀️", 1:"🌤️", 2:"⛅", 3:"☁️", 45:"🌫️", 48:"🌫️", 51:"🌦️", 53:"🌦️", 55:"🌧️",
        61:"🌧️", 63:"🌧️", 65:"🌧️", 71:"🌨️", 73:"❄️", 75:"❄️", 77:"🌨️", 80:"🌦️", 81:"🌧️",
        82:"⛈️", 85:"🌨️", 86:"❄️", 95:"⛈️", 96:"⛈️", 99:"⛈️",
    };

    const fetchWeather = async (city, rawName) => {
        const name = cleanName(rawName);
        _botSending = true;
        try {
            const geoRes = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&count=1&language=en&format=json");
            const geoData = await geoRes.json();
            if (!geoData.results || geoData.results.length === 0) {
                _botSending = false;
                sendMessage("🌍 " + name + ": Couldn't find \"" + city + "\". Try just the city name (e.g. !weather Denver), or add a state/country if it's a common name (e.g. !weather Springfield, Illinois).");
                return;
            }
            const { latitude, longitude, name: cityName, country, admin1 } = geoData.results[0];
            // Show exactly which place was matched, since common city names (Springfield,
            // Paris, etc.) can resolve to somewhere the person didn't mean.
            const locationLabel = [cityName, admin1, country].filter(Boolean).join(", ");

            const weatherRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
                `&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto&temperature_unit=celsius`
            );
            const weatherData = await weatherRes.json();
            const daily = weatherData.daily;

            if (!daily || !daily.time || daily.time.length < 7) {
                 _botSending = false;
                 sendMessage("🌦️ " + name + ": Could not retrieve weekly forecast data for " + locationLabel + ".");
                 return;
            }

            let forecastMessage = `🌦️ 7-Day Forecast for ${locationLabel}\n(requested by ${name} — !weather ${city})\n\n`;

            for (let i = 0; i < 7; i++) {
                const date = new Date(daily.time[i] + 'T00:00:00Z'); // Use Z for UTC
                const day = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
                const code = daily.weathercode[i];
                const maxC = Math.round(daily.temperature_2m_max[i]);
                const minC = Math.round(daily.temperature_2m_min[i]);
                const maxF = Math.round(maxC * 9/5 + 32);
                const minF = Math.round(minC * 9/5 + 32);

                forecastMessage += `${day}, ${dateStr}: ${WEATHER_EMOJI[code] || '🌡️'} ${WMO_CODES[code] || 'N/A'}\n` +
                                   `  └ High: ${maxC}°C / ${maxF}°F | Low: ${minC}°C / ${minF}°F\n`;
            }

            forecastMessage += "\nWrong place? Add a state or country, e.g. !weather " + cityName + ", [state/country]";

            _botSending = false;
            sendMessage(forecastMessage);

        } catch (e) {
            _botSending = false;
            console.error("Weekly forecast fetch error:", e);
            sendMessage("⚠️ " + name + ": Failed to fetch weekly forecast for \"" + city + "\".");
        }
    };


    const anagramState = {
        active: false,
        word: "",
        shuffledWord: "",
        startedBy: ""
    };
    let _anagramStarting = false;

    const shuffleWord = (word) => {
        const arr = word.split('');
        let n = arr.length;

        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        return arr.join('');
    };

    const startAnagram = async (rawName) => {
        if (isGameActive()) return;
        _anagramStarting = true;

        const name = cleanName(rawName);
        const word = await fetchRandomWord();
        const shuffledWord = shuffleWord(word);

        anagramState.active = true;
        anagramState.word = word;
        anagramState.shuffledWord = shuffledWord;
        anagramState.startedBy = name;
        _anagramStarting = false;

        sendMessage(
            "🔤 Anagram started by " + name + "!\n\n" +
            "Unscramble this word: " + shuffledWord + "\n" +
            "Type !anagram WORD to guess."
        );
    };

    const guessAnagram = (guess, rawName) => {
        if (!anagramState.active) return;

        const name = cleanName(rawName);

        if (guess.toUpperCase() === anagramState.word) {
            anagramState.active = false;
            sendMessage(
                "🎉 " + name + " guessed it! The word was " + anagramState.word + "!\n" +
                "Type !anagram to play again."
            );
        } else {
            sendMessage(
                "❌ " + name + " guessed wrong! Try again.\n" +
                "Unscramble this word: " + anagramState.shuffledWord
            );
        }
    };
    const fetchWiki = async (query, rawName) => {
        const name = cleanName(rawName);
        if (!query) { sendMessage("Usage: !wiki [search term]"); return; }
        
        try {
            const res = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(query));
            if (res.status === 404) { sendMessage("🤷 " + name + ": No Wikipedia page found for \"" + query + "\"."); return; }
            const data = await res.json();
            
            if (data.type === 'disambiguation') { sendMessage("⚠️ " + name + ": \"" + query + "\" is too vague. Please be more specific."); return; }
            
            const summary = data.extract;
            const url = data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : "";
            sendMessage("📚 **" + data.title + "**\n" + summary + "\n🔗 " + url);
        } catch (e) {
            console.error(e);
            sendMessage("❌ " + name + ": Error connecting to Wikipedia.");
        }
    };

    const pingServer = async (url, rawName) => {
        const name = cleanName(rawName);
        let target = url;
        if (!target.startsWith('http')) target = 'https://' + target;
        const start = Date.now();
        try { await fetch(target, { mode: 'no-cors', cache: 'no-cache' }); sendMessage("🏓 " + name + ": Pong! " + target + " is reachable (" + (Date.now() - start) + "ms)."); }
        catch (e) { sendMessage("⚠️ " + name + ": Could not reach " + target + "."); }
    };

    // ── Outgoing message queue ──────────────────────────────────────────────
    // In a busy group chat, many people can trigger sendMessage() at nearly
    // the same moment. Since there's only one compose box, firing execCommand
    // from multiple overlapping calls corrupts the text (or drops replies),
    // which is what makes the bot look "frozen". Queuing guarantees every
    // reply is sent, in order, one at a time.
    const _outgoingQueue = [];
    let _sendingNow = false;

    // Texts the bot has sent but hasn't yet seen echoed back by the
    // MutationObserver. Used to stop the bot from reacting to its own
    // messages (e.g. an "!afk" notice that itself contains the AFK user's
    // name, which would otherwise re-trigger the mention check forever).
    const _botSentTexts = new Set();

    const sendMessage = (text) => {
        _outgoingQueue.push(text);
        _pumpOutgoingQueue();
    };

    const _pumpOutgoingQueue = () => {
        if (_sendingNow || _outgoingQueue.length === 0) return;
        const text = _outgoingQueue.shift();
        _botSentTexts.add(text);
        const editor = document.querySelector('div[contenteditable="true"]');
        if (!editor) {
            // No editor available right now (tab backgrounded, DOM not ready, etc).
            // Don't drop the message — retry shortly instead of freezing the queue.
            _outgoingQueue.unshift(text);
            setTimeout(_pumpOutgoingQueue, 500);
            return;
        }
        _sendingNow = true;
        _botSending = true;
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
        setTimeout(() => {
            editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter' }));
            setTimeout(() => {
                _sendingNow = false;
                _botSending = false;
                _pumpOutgoingQueue();
            }, 1200);
        }, 100);
    };

    const startHangman = async (rawName) => {
        if (isGameActive()) return;
        _hangmanStarting = true;
        const name = cleanName(rawName);
        sendMessage("⏳ Fetching a random word...");
        const word = await fetchRandomWord();
        hangmanState = { active: true, word, guessed: [], lives: 6 };
        setTimeout(() => {
            sendMessage("🕹️ Hangman started by " + name + "!\n```\n" + getArt() + "\n```\nWord: " + getDisplayWord() + " (" + word.length + " letters)\n❤️ Lives: 6 | Letters left: " + getRemainingLetters() + "\nGuess with !a  !b  !c ...");
            _hangmanStarting = false;
        }, 1400);
    };

    const guessLetter = (cmd, rawName) => {
        if (!hangmanState.active) return;
        const name = cleanName(rawName);
        const letter = cmd[1].toUpperCase();
        if (hangmanState.guessed.includes(letter)) {
            sendMessage("⚠️ " + name + ": \"" + letter + "\" already guessed!\nWord: " + getDisplayWord() + " | ❤️ " + hangmanState.lives);
            return;
        }
        hangmanState.guessed.push(letter);
        if (hangmanState.word.includes(letter)) {
            const won = !getDisplayWord().includes('_');
            if (won) { hangmanState.active = false; sendMessage("🎉 " + name + " solved it! The word was " + hangmanState.word + ". YOU WIN! 🎊\nType !hangman to play again."); return; }
            sendMessage("✅ " + name + " found \"" + letter + "\"!\n```\n" + getArt() + "\n```\nWord: " + getDisplayWord() + "\n❤️ Lives: " + hangmanState.lives + " | Letters left: " + getRemainingLetters());
        } else {
            hangmanState.lives--;
            if (hangmanState.lives <= 0) { hangmanState.active = false; sendMessage("💀 GAME OVER, " + name + "! The word was " + hangmanState.word + ".\n```\n" + getArt() + "\n```\nType !hangman to try again."); return; }
            sendMessage("❌ " + name + ": no \"" + letter + "\"!\n```\n" + getArt() + "\n```\nWord: " + getDisplayWord() + "\n❤️ Lives: " + hangmanState.lives + " | Letters left: " + getRemainingLetters());
        }
    };

    const processedNodes = new WeakSet();

    const tryHandleNode = (node) => {
        if (node.nodeType !== 1) return;
        if (processedNodes.has(node)) return;
        processedNodes.add(node);
        if (_botSending || _hangmanStarting || _triviaStarting) return;
 

        const text = (node.innerText || node.textContent || '').trim();

        // The bot's own messages get picked up by the observer just like any
        // other message. If we don't recognize and skip them here, an "is
        // away" notice (which contains the AFK user's name) re-triggers the
        // mention check below and the bot spams itself forever.
        if (_botSentTexts.has(text)) {
            _botSentTexts.delete(text);
            return;
        }

        let rawName = "Player";
        let el_for_name = node; for (let i = 0; i < 12 && el_for_name; i++) { const nameEl = el_for_name.querySelector && el_for_name.querySelector('[data-name], [data-hovercard-id], [aria-label*="sent by"]'); if (nameEl) { rawName = nameEl.getAttribute('data-name') || nameEl.getAttribute('aria-label') || nameEl.innerText; break; } el_for_name = el_for_name.parentElement; }
        const name = cleanName(rawName);

        // ── AFK Logic ────────────────────────────────────────────────────────
        // 1. If the speaker was AFK, they are now back
        if (afkState[name]) {
            delete afkState[name];
            sendMessage("👋 Welcome back, " + name + "!");
        }
        // 2. Check if an AFK user is mentioned in this message (word-boundary
        // match so a name that happens to be a substring of another word
        // doesn't false-positive), throttled per user so a flurry of
        // messages mentioning the same AFK person doesn't spam the chat.
        if (!text.startsWith('!afk')) {
            const afkUser = Object.keys(afkState).find(u => {
                const escaped = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = new RegExp("(^|\\s|@)" + escaped + "(\\s|$|[.,!?])", "i");
                return re.test(text);
            });
            if (afkUser) {
                const now = Date.now();
                if (now - (_lastAfkNotice[afkUser] || 0) > AFK_NOTICE_COOLDOWN_MS) {
                    _lastAfkNotice[afkUser] = now;
                    sendMessage("💤 " + afkUser + " is away: " + afkState[afkUser]);
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────

        // ── Ragebait Auto-Reply ─────────────────────────────────────────────
        // If this speaker is currently a ragebait target, fire the stored
        // reply. Skipped for !ragebait/!unragebait themselves so setting it
        // up doesn't immediately trigger on the admin's own message.
        if (!/^!(un)?ragebait\b/i.test(text)) {
            const rbTarget = ragebaitState[name.toLowerCase()];
            if (rbTarget) {
                const now = Date.now();
                const key = name.toLowerCase();
                if (now - (_lastRagebaitFire[key] || 0) > RAGEBAIT_COOLDOWN_MS) {
                    _lastRagebaitFire[key] = now;
                    sendMessage(rbTarget.message);
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────

        if (madLibsState.active && !text.startsWith('!')) { processMadLibsWord(text, name); return; }

        if (!text || text.length > 300) return;

        if (zorkState.active) {
            // If a Zork game is active, all non-! commands go to its engine
            if (!text.startsWith('!')) processZorkCommand(text);
            return;
        }
 
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const commandLine = lines.find(l => l.startsWith('!'));
 
        if (!commandLine) return;
 
        let el = node;
        for (let i = 0; i < 12; i++) {
            if (!el) break;
            const nameEl = el.querySelector && el.querySelector('[data-name], [data-hovercard-id], [aria-label*="sent by"]');
            if (nameEl) {
                rawName = nameEl.getAttribute('data-name') || nameEl.getAttribute('aria-label') || nameEl.innerText;
                break;
            }
            el = el.parentElement;
        }
 
        const parts = commandLine.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        const query = parts.slice(1).join(' ');
 
        if (cmd === '!weather') {
            if (!query) { sendMessage("Usage: !weather [city]\nExamples: !weather Denver  |  !weather Springfield, Illinois"); return; }
            fetchWeather(query, rawName);
            return;
        }
        if (cmd === '!guess') {
            if (!query) { sendMessage("Usage: !guess {5-letter-word}"); return; }
            guessWordle(query, rawName);
            return;
        }
 
        if (cmd === '!rps') {
            const move = args[0] ? args[0].toLowerCase() : '';
            if (!['rock', 'paper', 'scissors'].includes(move)) { sendMessage("Usage: !rps [rock|paper|scissors]"); return; }
            const botMove = ['rock', 'paper', 'scissors'][Math.floor(Math.random()*3)];
            let result = "It's a tie!";
            if ( (move === 'rock' && botMove === 'scissors') || (move === 'paper' && botMove === 'rock') || (move === 'scissors' && botMove === 'paper') ) { result = "You win!"; }
            else if (move !== botMove) { result = "I win!"; }
            sendMessage(`Rock, Paper, Scissors!\nYou chose ${move}. I chose ${botMove}.\n${result}`);
        }
        else if (cmd === '!ship') {
            if (args.length < 2) { sendMessage("Usage: !ship [name1] [name2]"); return; }
            const name1 = cleanName(args[0]);
  const name2 = cleanName(args[1]);
            const shipName = name1.slice(0, Math.ceil(name1.length / 2)) + name2.slice(Math.floor(name2.length / 2));

  const getSoundScore = (str1, str2) => {
   const vowels = "aeiou";
   let score = 0;
   for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
    if (vowels.includes(str1[i].toLowerCase()) && vowels.includes(str2[i].toLowerCase())) {
     score += 2; 
    } else if (str1[i].toLowerCase() === str2[i].toLowerCase()) {
     score += 1; 
    }
   }
   return score;
  };

  const maxLen = Math.max(name1.length, name2.length);
  const soundScore = getSoundScore(name1, name2);

  let seed = 0;
  for (let i = 0; i < name1.length; i++) seed += name1.charCodeAt(i);
  for (let i = 0; i < name2.length; i++) seed += name2.charCodeAt(i);


  const rand = () => { 
   seed |= 0;
   seed = seed + 0x6D2B79F5 | 0;
   let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
   t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
   return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  let percentage = Math.floor(rand() * 40) + 20;

  percentage += Math.floor((soundScore / maxLen) * 40); 

  percentage = Math.min(percentage, 100);

            const score = percentage;

            sendMessage(`❤️ Shipping ${name1} and ${name2}...\nNew name: *${shipName}*\nCompatibility: ${score}%`);
        }
        else if (cmd === '!tictactoe') { startTicTacToe(rawName, args[0]); }
        else if (ticTacToeState.active && cmd === '!move') { ticTacToeMove(args[0], rawName); }
        else if (cmd === '!madlibs') { startMadLibs(rawName); }
        else if (cmd === '!trivia') { startTrivia(rawName); }
        else if (triviaState.active && /^![abcd]$/i.test(cmd)) { answerTrivia(cmd, rawName); }
        else if (cmd === '!hangman') { startHangman(rawName); }
        else if (hangmanState.active && /^![a-z]$/i.test(cmd)) { guessLetter(cmd, rawName); }
        else if (cmd === '!blackjack' || cmd === '!21') { startBlackjack(rawName); }
        else if (blackjackState.active && cmd === '!hit') { blackjackHit(rawName); }
        else if (blackjackState.active && cmd === '!stand') { blackjackStand(rawName); }
        else if (cmd === '!wordle') { startWordle(rawName); } 
        else if (wordleState.active && cmd === '!guess') { guessWordle(query, rawName); }
        else if (cmd === '!zork') { startZork(rawName); }
        else if (cmd === '!compliment') { sendCompliment(rawName); }
        else if (cmd === '!roast') { sendRoast(rawName, args); }
        else if (cmd === '!callout') { sendCallout(rawName, args); }
        else if (cmd === '!dice') { const r = Math.floor(Math.random()*6)+1; setTimeout(() => sendMessage("🎲 " + cleanName(rawName) + " rolled a " + r + "! " + ["⚀","⚁","⚂","⚃","⚄","⚅"][r-1]), 300); }
        else if (cmd === '!kissmyhug') { setTimeout(() => sendMessage("Sending a big hug and a kiss to " + cleanName(rawName) + "! 💋🤗😘"), 300); }
        else if (cmd === '!anagram') { startAnagram(rawName); }
        else if (anagramState.active && cmd === '!anagram') { guessAnagram(query, rawName); }
        else if (cmd === '!wiki') { fetchWiki(query, rawName); }
        else if (cmd === '!ping') { pingServer(query || 'google.com', rawName); }
        else if (cmd === '!afk') {
            const reason = args.join(' ') || "Away";
            afkState[cleanName(rawName)] = reason;
            sendMessage("💤 " + cleanName(rawName) + " is now AFK: " + reason);
        }
        else if (cmd === '!ragebait') {
            const setterName = cleanName(rawName);
            const isAdmin = RAGEBAIT_ADMINS.some(a => a.toLowerCase() === setterName.toLowerCase());
            if (!isAdmin) { sendMessage("🚫 " + setterName + " isn't authorized to use !ragebait."); return; }
            if (args.length < 2) { sendMessage("Usage: !ragebait [name] [message to auto-reply with every time they talk]"); return; }
            const targetDisplay = cleanName(args[0]);
            const message = args.slice(1).join(' ');
            ragebaitState[targetDisplay.toLowerCase()] = { message, setBy: setterName };
            sendMessage("🎯 Ragebait armed on " + targetDisplay + " by " + setterName + ".");
        }
        else if (cmd === '!unragebait') {
            const setterName = cleanName(rawName);
            const isAdmin = RAGEBAIT_ADMINS.some(a => a.toLowerCase() === setterName.toLowerCase());
            if (!isAdmin) { sendMessage("🚫 " + setterName + " isn't authorized to use !unragebait."); return; }
            if (!args[0]) { sendMessage("Usage: !unragebait [name]"); return; }
            const targetDisplay = cleanName(args[0]);
            if (ragebaitState[targetDisplay.toLowerCase()]) {
                delete ragebaitState[targetDisplay.toLowerCase()];
                sendMessage("✅ Ragebait cleared for " + targetDisplay + ".");
            } else {
                sendMessage("No active ragebait on " + targetDisplay + ".");
            }
        }
    };

    // Busy group chats can fire dozens of DOM mutations per second (new
    // messages, read receipts, typing indicators, reactions). Handling each
    // mutation synchronously and immediately used to make the tab jank/stall
    // when a lot of people were active at once. Instead, batch mutations and
    // process them once per animation frame.
    let _pendingMutations = [];
    let _mutationFrameQueued = false;

    const _flushPendingMutations = () => {
        if (_botSending) {
            // Bot's own message is still being sent — try again next frame
            // instead of dropping the batch (keep mutations queued).
            requestAnimationFrame(_flushPendingMutations);
            return;
        }
        _mutationFrameQueued = false;
        const mutations = _pendingMutations;
        _pendingMutations = [];
        for (const mutation of mutations)
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                const isMessage = node.matches && (node.matches('[role="listitem"]') || node.querySelector('[data-name]'));
                if (isMessage) {
                    tryHandleNode(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('[role="listitem"]').forEach(tryHandleNode);
                }
            }
    };

    window._diceObserver = new MutationObserver((mutations) => {
        _pendingMutations.push(...mutations);
        if (!_mutationFrameQueued) {
            _mutationFrameQueued = true;
            requestAnimationFrame(_flushPendingMutations);
        }
    });

    window._diceObserver.observe(document.body, { childList: true, subtree: true });
    console.log("✅ Bot 35.1 ready — Infinite Wordle words via Datamuse API!");

    // ── Periodic "Reloading..." heartbeat message ───────────────────────────
    if (window._reloadingInterval) clearInterval(window._reloadingInterval);
    window._reloadingInterval = setInterval(() => {
        sendMessage("Reloading...");
    }, 1000000);

    setTimeout(() => {
        sendMessage(
            "🤖 GChat Bot 35.1 is now online! Coded by Thomas. Here's what I can do:\n\n" +
            "🃏 !blackjack or !21 — Play a game of Blackjack\n     └ !hit or !stand when it's your turn\n" +
            "⚔️ !tictactoe [@player] — Play Tic-Tac-Toe vs Bot or a friend.\n     └ !move [1-9] to play.\n" +
            "📝 !madlibs — Play a game of Mad Libs.\n" +
            "🔤 !anagram — Unscramble a word.\n" +
            "🧠 !trivia — Start a trivia question (" + TRIVIA_POOL.length + " questions, no repeats!)\n" +
            "🕹️ !hangman — Start a game of Hangman\n" +
            "🟩 !wordle — Guess a 5-letter word in 6 tries\n     └ !guess WORD to make a guess (e.g. !guess CRANE)\n" +
            "🎲 !dice — Roll a six-sided die\n" +
            "📚 !wiki [term] — Fetch a Wikipedia summary\n" +
            "💤 !afk [reason] — Set yourself as away. I'll auto-reply if you're tagged.\n" +
            "🌤️ !weather [city] — Get the 7-day forecast\n     └ Just the city name works, e.g. !weather Denver\n     └ Add a state/country if it's ambiguous, e.g. !weather Springfield, Illinois\n" +
            "❤️ !ship [name1] [name2] — Check name compatibility.\n" +
            "🗿 !rps [rock|paper|scissors] — Play Rock, Paper, Scissors.\n" +
            "💌 !compliment — Receive a compliment\n" +
            "🔥 !roast [name] — Get roasted (leave blank to roast yourself)\n" +
            "🚨 !callout [name] — Expose someone (leave blank to expose yourself)\n" +
            "💋 !kissmyhug — Spread some love\n" +
            "🎯 !ragebait [name] [msg] — (admins only) auto-replies to [name] with [msg] every time they send a message\n     └ !unragebait [name] to turn it off\n\n" +
            "Only one game can run at a time. Have fun! 🎉"
        );
    }, 1500);
})();
