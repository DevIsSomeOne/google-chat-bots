(function () {
    if (window._diceObserver) {
        window._diceObserver.disconnect();
        console.log("♻️ Stopped old observer.");
    }
    console.log("🎮 GChat Bot 35.1: Infinite Wordle words via API");

    let _botSending = false;
    let _hangmanStarting = false;
    let _triviaStarting = false;

    // ── Local dedup ───────────────────────────────────────────────────────────
    const _seenQuestions = new Set();

    let hangmanState = { active: false, word: "", guessed: [], lives: 6 };
    let triviaState = { active: false, question: "", answer: "", choices: [], correctLetter: "", askedBy: "", wrongGuesses: 0 };

    // ── Wordle State ──────────────────────────────────────────────────────────
    let wordleState = {
        active: false,
        word: "",
        guesses: [],
        maxGuesses: 6,
        startedBy: ""
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

    // ── Fetch infinite random 5-letter words from Datamuse API ─────────────
    const fetchWordleWord = async () => {
        const starters = ["st","cr","tr","br","gr","fl","sl","pr","sp","sh","ch","pl","cl","dr","fr","bl","sw","sn","sm","sc","sk","wh","th","gl","str","spr","shr","thr"];
        const starter = starters[Math.floor(Math.random() * starters.length)];
        try {
            const res = await fetch("https://api.datamuse.com/words?sp=" + starter + "???&md=f&max=500");
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
        if (hangmanState.active || _hangmanStarting) {
            sendMessage("🚫 Finish the current Hangman game first!\nWord: " + getDisplayWord() + " | ❤️ Lives: " + hangmanState.lives);
            return;
        }
        if (triviaState.active || _triviaStarting) {
            sendMessage("🚫 Finish the current Trivia question first!\n❓ " + triviaState.question + "\n" + triviaState.choices.join("\n") + "\nAnswer with !A !B !C or !D");
            return;
        }
        if (wordleState.active) {
            const board = wordleState.guesses.map(g =>
                getWordleEmoji(g, wordleState.word) + "  " + g
            ).join("\n");
            sendMessage("🟩 Wordle already in progress! (" + wordleState.guesses.length + "/" + wordleState.maxGuesses + " guesses)\n\n" + (board || "(no guesses yet)") + "\n\nGuess with !guess WORD");
            return;
        }
        if (_wordleStarting) return;
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

    const guessWordle = (text, rawName) => {
        if (!wordleState.active) return;
        const name = cleanName(rawName);
        const parts = text.trim().split(/\s+/);
        if (parts.length < 2) {
            sendMessage("⚠️ " + name + ": Use !guess WORD (e.g. !guess CRANE)");
            return;
        }
        const guess = parts[1].toUpperCase();
        if (guess.length !== 5 || !/^[A-Z]{5}$/.test(guess)) {
            sendMessage("⚠️ " + name + ": Your guess must be exactly 5 letters! Try: !guess CRANE");
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

    // ── Compliments ───────────────────────────────────────────────────────────
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
    ];

    const sendCompliment = (rawName) => {
        const name = cleanName(rawName);
        const compliment = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
        setTimeout(() => sendMessage("💌 " + name + ": " + compliment), 300);
    };

    // ── Hangman stuff (unchanged) ─────────────────────────────────────────────
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
    const decodeHTML = (str) => { const txt = document.createElement("textarea"); txt.innerHTML = str; return txt.value; };
    const shuffle = (arr) => arr.slice().sort(() => Math.random() - 0.5);

    // ── MASSIVE trivia pool ───────────────────────────────────────────────────
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
        {q:"What is the currency of the United Kingdom?",a:"Pound Sterling",w:["Euro","Dollar","Franc"]},
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
        if (hangmanState.active || _hangmanStarting) {
            sendMessage("🚫 Finish the current Hangman game first!\nWord: " + getDisplayWord() + " | ❤️ Lives: " + hangmanState.lives);
            return;
        }
        if (triviaState.active) {
            sendMessage("❓ Trivia already active!\n" + triviaState.question + "\n" + triviaState.choices.join("\n") + "\nAnswer with !A  !B  !C  or  !D");
            return;
        }
        if (_triviaStarting) return;
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

    // ── Weather ───────────────────────────────────────────────────────────────
    const WMO_CODES = {
        0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Foggy",48:"Icy fog",
        51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",
        71:"Light snow",73:"Snow",75:"Heavy snow",77:"Snow grains",80:"Light showers",81:"Showers",
        82:"Heavy showers",85:"Snow showers",86:"Heavy snow showers",95:"Thunderstorm",
        96:"Thunderstorm w/ hail",99:"Thunderstorm w/ heavy hail",
    };
    const WEATHER_EMOJI = {
        0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",
        61:"🌧️",63:"🌧️",65:"🌧️",71:"🌨️",73:"❄️",75:"❄️",77:"🌨️",80:"🌦️",81:"🌧️",
        82:"⛈️",85:"🌨️",86:"❄️",95:"⛈️",96:"⛈️",99:"⛈️",
    };

    const fetchWeather = async (city, rawName) => {
        const name = cleanName(rawName);
        _botSending = true;
        try {
            const geoRes = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&count=1&language=en&format=json");
            const geoData = await geoRes.json();
            if (!geoData.results || geoData.results.length === 0) {
                _botSending = false;
                sendMessage("🌍 " + name + ": Couldn't find \"" + city + "\". Try a different city name!");
                return;
            }
            const { latitude, longitude, name: cityName, country } = geoData.results[0];
            const weatherRes = await fetch(
                "https://api.open-meteo.com/v1/forecast?latitude=" + latitude + "&longitude=" + longitude +
                "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weathercode" +
                "&temperature_unit=celsius&wind_speed_unit=kmh&forecast_days=1"
            );
            const weatherData = await weatherRes.json();
            const c = weatherData.current;
            const code = c.weathercode;
            const tempC = Math.round(c.temperature_2m), feelsC = Math.round(c.apparent_temperature);
            const tempF = Math.round(tempC * 9/5 + 32), feelsF = Math.round(feelsC * 9/5 + 32);
            _botSending = false;
            sendMessage(
                (WEATHER_EMOJI[code] || "🌡️") + " Weather in " + cityName + ", " + country + "\n" +
                "Condition: " + (WMO_CODES[code] || "Unknown") + "\n" +
                "🌡️ Temp: " + tempC + "°C / " + tempF + "°F (feels like " + feelsC + "°C / " + feelsF + "°F)\n" +
                "💧 Humidity: " + c.relative_humidity_2m + "%\n" +
                "💨 Wind: " + Math.round(c.wind_speed_10m) + " km/h\n(requested by " + name + ")"
            );
        } catch (e) {
            _botSending = false;
            sendMessage("⚠️ " + name + ": Failed to fetch weather for \"" + city + "\". Try again!");
        }
    };

    // ── Core send ─────────────────────────────────────────────────────────────
    const sendMessage = (text) => {
        const editor = document.querySelector('div[contenteditable="true"]');
        if (!editor) return;
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

    // ── Hangman ───────────────────────────────────────────────────────────────
    const startHangman = async (rawName) => {
        if (triviaState.active || _triviaStarting) {
            sendMessage("🚫 Finish the current Trivia question first!\n❓ " + triviaState.question + "\n" + triviaState.choices.join("\n") + "\nAnswer with !A  !B  !C  or  !D");
            return;
        }
        if (hangmanState.active) {
            sendMessage("🕹️ Hangman already in progress!\nWord: " + getDisplayWord() + " | ❤️ Lives: " + hangmanState.lives + "\nGuess with !a  !b  !c ...");
            return;
        }
        if (_hangmanStarting) return;
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

    // ── Observer ──────────────────────────────────────────────────────────────
    const processedNodes = new WeakSet();

    const tryHandleNode = (node) => {
        if (node.nodeType !== 1) return;
        if (processedNodes.has(node)) return;
        processedNodes.add(node);
        if (_botSending || _hangmanStarting || _triviaStarting) return;

        const text = (node.innerText || node.textContent || '').trim();
        if (!text || text.length > 300) return;

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const weatherLine = lines.find(l => /^!weather\s+.+/i.test(l));
        const guessLine = lines.find(l => /^!guess\s+[a-zA-Z]{5}$/i.test(l));
        const cmd = lines.find(l => /^![a-zA-Z]+$/.test(l));

        if (!weatherLine && !guessLine && !cmd) return;

        let rawName = "Player";
        let el = node;
        for (let i = 0; i < 12; i++) {
            if (!el) break;
            const nameEl = el.querySelector && el.querySelector('[data-name], [data-hovercard-id], [aria-label*="sent by"]');
            if (nameEl) { rawName = nameEl.getAttribute('data-name') || nameEl.getAttribute('aria-label') || nameEl.innerText; break; }
            el = el.parentElement;
        }

        if (weatherLine) { fetchWeather(weatherLine.replace(/^!weather\s+/i, '').trim(), rawName); return; }
        if (guessLine) { guessWordle(guessLine, rawName); return; }

        const cmdL = cmd.toLowerCase();
        if (cmdL === '!trivia') { startTrivia(rawName); }
        else if (triviaState.active && /^![abcd]$/i.test(cmd)) { answerTrivia(cmd, rawName); }
        else if (cmdL === '!hangman') { startHangman(rawName); }
        else if (hangmanState.active && /^![a-zA-Z]$/.test(cmd)) { guessLetter(cmd, rawName); }
        else if (cmdL === '!wordle') { startWordle(rawName); }
        else if (cmdL === '!compliment') { sendCompliment(rawName); }
        else if (cmdL === '!dice') { const r = Math.floor(Math.random()*6)+1; setTimeout(() => sendMessage("🎲 " + cleanName(rawName) + " rolled a " + r + "! " + ["⚀","⚁","⚂","⚃","⚄","⚅"][r-1]), 300); }
        else if (cmdL === '!kissmyhug') { setTimeout(() => sendMessage("Sending a big hug and a kiss to " + cleanName(rawName) + "! 💋🤗😘"), 300); }
    };

    window._diceObserver = new MutationObserver((mutations) => {
        if (_botSending) return;
        for (const mutation of mutations)
            for (const node of mutation.addedNodes) {
                tryHandleNode(node);
                if (node.querySelectorAll) node.querySelectorAll('*').forEach(tryHandleNode);
            }
    });

    window._diceObserver.observe(document.body, { childList: true, subtree: true });
    console.log("✅ Bot 35.1 ready — Infinite Wordle words via Datamuse API!");

    // ── Startup message ───────────────────────────────────────────────────────
    setTimeout(() => {
        sendMessage(
            "🤖 GChat Bot 35.1 is now online! Here's what I can do:\n\n" +
            "🧠 !trivia — Start a trivia question (" + TRIVIA_POOL.length + " questions, no repeats!)\n" +
            "🕹️ !hangman — Start a game of Hangman\n" +
            "🟩 !wordle — Guess a 5-letter word in 6 tries\n     └ !guess WORD to make a guess (e.g. !guess CRANE)\n" +
            "🎲 !dice — Roll a dice\n" +
            "🌤️ !weather {city} — Get current weather\n" +
            "💌 !compliment — Receive a compliment\n" +
            "💋 !kissmyhug — Spread some love\n\n" +
            "Only one game can run at a time. Have fun! 🎉"
        );
    }, 1500);
})();
