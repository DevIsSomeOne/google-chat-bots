(function () {
    if (window._diceObserver) {
        window._diceObserver.disconnect();
        console.log("♻️ Stopped old observer.");
    }
    console.log("🎮 GChat Bot 28.0: Added !weather");

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

    // ── Weather ───────────────────────────────────────────────────────────────
    const WMO_CODES = {
        0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
        45:"Foggy",48:"Icy fog",
        51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
        61:"Light rain",63:"Rain",65:"Heavy rain",
        71:"Light snow",73:"Snow",75:"Heavy snow",77:"Snow grains",
        80:"Light showers",81:"Showers",82:"Heavy showers",
        85:"Snow showers",86:"Heavy snow showers",
        95:"Thunderstorm",96:"Thunderstorm w/ hail",99:"Thunderstorm w/ heavy hail",
    };

    const WEATHER_EMOJI = {
        0:"☀️",1:"🌤️",2:"⛅",3:"☁️",
        45:"🌫️",48:"🌫️",
        51:"🌦️",53:"🌦️",55:"🌧️",
        61:"🌧️",63:"🌧️",65:"🌧️",
        71:"🌨️",73:"❄️",75:"❄️",77:"🌨️",
        80:"🌦️",81:"🌧️",82:"⛈️",
        85:"🌨️",86:"❄️",
        95:"⛈️",96:"⛈️",99:"⛈️",
    };

    const fetchWeather = async (city, rawName) => {
        const name = cleanName(rawName);
        _botSending = true;

        try {
            // Step 1: Geocode city name → lat/lon
            const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
            );
            const geoData = await geoRes.json();

            if (!geoData.results || geoData.results.length === 0) {
                _botSending = false;
                sendMessage(`🌍 ${name}: Couldn't find a place called "${city}". Try a different city name!`);
                return;
            }

            const { latitude, longitude, name: cityName, country } = geoData.results[0];

            // Step 2: Fetch weather from Open-Meteo (no API key needed!)
            const weatherRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
                `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weathercode` +
                `&temperature_unit=celsius&wind_speed_unit=kmh&forecast_days=1`
            );
            const weatherData = await weatherRes.json();
            const c = weatherData.current;

            const code = c.weathercode;
            const condition = WMO_CODES[code] || "Unknown";
            const emoji = WEATHER_EMOJI[code] || "🌡️";
            const tempC = Math.round(c.temperature_2m);
            const feelsC = Math.round(c.apparent_temperature);
            const tempF = Math.round(tempC * 9/5 + 32);
            const feelsF = Math.round(feelsC * 9/5 + 32);
            const humidity = c.relative_humidity_2m;
            const wind = Math.round(c.wind_speed_10m);

            _botSending = false;
            sendMessage(
                `${emoji} Weather in ${cityName}, ${country}\n` +
                `Condition: ${condition}\n` +
                `🌡️ Temp: ${tempC}°C / ${tempF}°F (feels like ${feelsC}°C / ${feelsF}°F)\n` +
                `💧 Humidity: ${humidity}%\n` +
                `💨 Wind: ${wind} km/h\n` +
                `(requested by ${name})`
            );

        } catch (e) {
            console.warn("Weather fetch failed:", e);
            _botSending = false;
            sendMessage(`⚠️ ${name}: Failed to fetch weather for "${city}". Try again!`);
        }
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
        if (!hangmanState.active) return;
        const name = cleanName(rawName);
        const letter = cmd[1].toUpperCase();

        if (hangmanState.guessed.includes(letter)) {
            sendMessage(`⚠️ ${name}: "${letter}" already guessed!\nWord: ${getDisplayWord()} | ❤️ ${hangmanState.lives}`);
            return;
        }

        hangmanState.guessed.push(letter);

        if (hangmanState.word.includes(letter)) {
            const won = !getDisplayWord().includes('_');
            if (won) {
                hangmanState.active = false;
                sendMessage(`🎉 ${name} solved it! The word was ${hangmanState.word}. YOU WIN! 🎊\nType !hangman to play again.`);
                return;
            }
            sendMessage(`✅ ${name} found "${letter}"!\n\`\`\`\n${getArt()}\n\`\`\`\nWord: ${getDisplayWord()}\n❤️ Lives: ${hangmanState.lives} | Letters left: ${getRemainingLetters()}`);
        } else {
            hangmanState.lives--;
            if (hangmanState.lives <= 0) {
                hangmanState.active = false;
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
        if (processedNodes.has(node)) return;
        processedNodes.add(node);

        if (_botSending || _hangmanStarting) return;

        const text = (node.innerText || node.textContent || '').trim();
        if (!text || text.length > 300) return;

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        // Match "!weather <city>" — city can be multiple words
        const weatherLine = lines.find(l => /^!weather\s+.+/i.test(l));
        const cmd = lines.find(l => /^![a-zA-Z]+$/.test(l));

        if (!weatherLine && !cmd) return;

        // Find sender name
        let rawName = "Player";
        let el = node;
        for (let i = 0; i < 12; i++) {
            if (!el) break;
            const nameEl = el.querySelector && el.querySelector('[data-name], [data-hovercard-id], [aria-label*="sent by"]');
            if (nameEl) { rawName = nameEl.getAttribute('data-name') || nameEl.getAttribute('aria-label') || nameEl.innerText; break; }
            el = el.parentElement;
        }

        if (weatherLine) {
            const city = weatherLine.replace(/^!weather\s+/i, '').trim();
            console.log(`🌤️ Weather request for: "${city}"`);
            fetchWeather(city, rawName);
            return;
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
    console.log("✅ Bot 28.0 ready — !hangman  !{letter}  !dice  !kissmyhug  !weather {city}");
})();
