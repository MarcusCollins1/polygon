import {
    addWordForToday,
    getWordsForToday,
    getPuzzleForToday,
    getPuzzleForDate,
    savePuzzleForToday,
    savePuzzleForDate
} from "./polygonFireBase.js";

function dateKeyUTC(date = new Date()) {
    return date.toISOString().slice(0, 10);
}
function hashStringToInt(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash;
}

async function loadValidWords() {
    const response = await fetch("English words.txt");
    const text = await response.text();
    const VALID_ENGLISH_WORDS = text.split("\n").map(w => w.trim().toLowerCase()).filter(w => w.length >= 4);
    return VALID_ENGLISH_WORDS;
}
function getPuzzle(validWords, date) {
    const candidates = validWords.filter(w => w.length >= 7 && new Set(w).size === 7);

    const seed = hashStringToInt(date);
    const index = seed % candidates.length;
    const answer = candidates[index];
    
    const center = answer[seed % answer.length].toUpperCase();
    const outer = [...new Set(answer)].filter(l => l.toUpperCase() !== center).map(l => l.toUpperCase());
    const words = validWords.filter(w => {
        const letters = new Set(w.toUpperCase());
        return w.length >= 4 && letters.has(center) && [...letters].every(l => outer.includes(l) || l === center);
    });
    return {center, outer, words, answer};
}

const today = dateKeyUTC();
let puzzle = await getPuzzleForDate(today);
if (puzzle) {
    console.log(`Loaded puzzle for ${today} from Firestore`);
} else {
    console.log(`No puzzle found for ${today}. Generating...`);
    const validWords = await loadValidWords();
    puzzle = getPuzzle(validWords, today);
    await savePuzzleForDate(today, puzzle);
    console.log(`Saved puzzle ${today} to Firestore`);
}

const isPhone = window.matchMedia("(max-width: 768px)").matches;

const board = document.getElementById("board");
const centerLetterBtn = document.getElementById("centerLetterBtn");
const centerLetter = document.getElementById("centerLetter");
const wordInput = document.getElementById("wordInput");
const backSpaceBtn = document.getElementById("backSpaceBtn");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const revealBtn = document.getElementById("revealBtn");
const shareBtn = document.getElementById("shareBtn");
const message = document.getElementById("message");
const foundWords = document.getElementById("foundWords");
const foundCount = document.getElementById("foundCount");
const scoreEl = document.getElementById("score");
const totalCount = document.getElementById("totalCount");
const totalScore = document.getElementById("totalScore");

let found = new Set();
let showingAnswers = false;

function normalize(word) {
    return word.trim().toLowerCase();
}

function buildBoard() {
    centerLetter.textContent = puzzle.center;
    const positions = ["p0", "p1", "p2", "p3", "p4", "p5"];

    puzzle.outer.forEach((letter, i) => {
        const tile = document.createElement("div");
        tile.className = `letter ${positions[i]}`;
        tile.innerHTML = `<span>${letter}</span>`;
        tile.addEventListener("click", () => {
            wordInput.value += letter.toLowerCase();
            if (!isPhone) {
                wordInput.focus();
            }
        });
        board.appendChild(tile);
    });

    centerLetterBtn.addEventListener("click", () => {
        wordInput.value += puzzle.center.toLowerCase();
        if (!isPhone) {
            wordInput.focus();
        }
    });

    totalCount.textContent = puzzle.words.length;
    totalScore.textContent = puzzle.words.reduce((total, word) => {
        return total + (word.length - 3);
    }, 0);
}

function updateStats() {
    foundCount.textContent = found.size;
    scoreEl.textContent = [...found].reduce((sum, w) => sum + scoreForWord(w), 0);
}

function scoreForWord(word) {
    return Math.max(1, word.length - 3);
}

function renderFoundWords() {
    foundWords.innerHTML = "";
    [...found].sort().forEach(word => {
        const pill = document.createElement("span");
        pill.className = "word";
        pill.textContent = word;
        foundWords.appendChild(pill);
    });
}

function setMessage(text, type = "") {
    message.textContent = text;
    message.className = `msg ${type}`;
}

function validLetters(word) {
    const allowed = new Set([puzzle.center, ...puzzle.outer].map(l => l.toLowerCase()));
    return [...word].every(ch => allowed.has(ch));
}

function containsCenter(word) {
    return word.includes(puzzle.center.toLowerCase());
}

function submitWord(word = null) {
    const userWord = word === null;
    if (userWord) {
        word = normalize(wordInput.value);
    }
    if (!word)  return;
    if (word.length < 4) {
        setMessage("Word must be at least 4 letters.", "bad");
        return;
    }
    if (!containsCenter(word)) {
        setMessage(`Word must include "${puzzle.center.toLowerCase()}".`, "bad");
        return;
    }
    if (!validLetters(word)) {
        setMessage("Use only the polygon letters.", "bad");
        return;
    }

    const answerSet = new Set(puzzle.words.map(normalize));
    if (!answerSet.has(word)) {
        setMessage("Not in the answer list for this puzzle.", "bad");
        return;
    }
    if (found.has(word)) {
        setMessage("Already found.", "bad");
        return;
    }

    found.add(word);
    renderFoundWords();
    updateStats();
    setMessage(`Nice! Added "${word}".`, "good");
    wordInput.value = "";
    if (!isPhone) {
        wordInput.focus();
    }
    if (userWord) {
        addWordForToday(word);
    }
}

function resetPuzzle() {
    found = new Set();
    showingAnswers = false;
    renderFoundWords();
    updateStats();
    setMessage("Puzzle reset.");
    wordInput.value = "";
}

function revealAnswers() {
    if (!showingAnswers) {
        if (prompt("Enter password to reaveal answers:") !== "polygon") {
            return;
        }
        found = new Set(puzzle.words.map(normalize));
        showingAnswers = true;
        renderFoundWords();
        updateStats();
        setMessage("All answers revealed.")
        revealBtn.textContent = "Hide Answers";
    } else {
        resetPuzzle();
        revealBtn.textContent = "Show Answers";
    }
}

function share() {
    const date = new Date();
    const maxScore = puzzle.words.reduce((sum, w) => sum + scoreForWord(w), 0);
    const string = `Polygon Puzzle - ${date.toDateString()}\nFound ${found.size}/${puzzle.words.length}\nScore: ${scoreEl.textContent}/${maxScore}\nhttps://marcuscollins1.github.io/polygon/`;
    navigator.clipboard.writeText(string).then(() => {
        setMessage("Results copied to clipboard!", "good");
    }).catch(() => {
        setMessage("Failed to copy results.", "bad");
    });
}

async function loadUserWords() {
    const words = await getWordsForToday();
    words.forEach((word) => {
        submitWord(word);
    });
}

function getFound() {
    return [...found];
}

function reloadAtNextMidnightUTC() {
    const now = new Date();

    // Next midnight UTC
    const nextMidnight = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
            0, 0, 0, 0
        )
    );

    const millisecondsUntilMidnight = nextMidnight.getTime() - now.getTime();
    console.log(`Next puzzle in ${Math.round(millisecondsUntilMidnight / 1000)} seconds`);
    setTimeout(() => {window.location.reload();}, millisecondsUntilMidnight);
}

backSpaceBtn.addEventListener("click", () => {
    wordInput.value = wordInput.value.slice(0, -1);
});
submitBtn.addEventListener("click", () => {
    submitWord();
});
resetBtn.addEventListener("click", () => {
    resetPuzzle();
    revealBtn.textContent = "Show Answers";
});
revealBtn.addEventListener("click", revealAnswers);
shareBtn.addEventListener("click", share)
wordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        submitWord();
    }
});

buildBoard();
renderFoundWords();
updateStats();
loadUserWords();

reloadAtNextMidnightUTC();

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState ==="visible") {
        const currentDate = dateKeyUTC();
        
        if (currentDate !== today) {
            window.location.reload();
        }
    }
});

window.loadUserWords = loadUserWords;
window.getFound = getFound;
