import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDoc,
    setDoc,
    getDocs,
    deleteDoc,
    doc,
    addDoc,
    serverTimestamp,
    arrayUnion,
    updateDoc,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";
import { ACHIEVEMENTS } from "./achievements.js";

const firebaseConfig = {
    apiKey: "AIzaSyA_CXSZVz6meJgcJyktktWNmPtLmeFNXn0",
    authDomain: "marcus-collins-github-website.firebaseapp.com",
    projectId: "marcus-collins-github-website",
    storageBucket: "marcus-collins-github-website.firebasestorage.app",
    messagingSenderId: "328004594228",
    appId: "1:328004594228:web:47074e07c446a328bbf861",
    measurementId: "G-6M9HBX4E3Z"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

async function addDocument(collectionName, fields) {
    await addDoc(collection(db, collectionName), {
        ...fields,
        createdAt: serverTimestamp()
    });
}

function getDayStr(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function getYesterdayStr() {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate()-1);
    return getDayStr(yesterday);
}

function scoreFromWords(words = []) {
    let score = 0;

    for (const word of words) {
        score += Math.max(0, word.length - 3);
    }

    return score;
}

async function getUserDays(user) {
    const username = user?.username || user?.id;
    if (!username) return [];

    const daysRef = collection(db, "polygon-users", username, "days");
    const snapshot = await getDocs(daysRef);

    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
    }));
}

function calculateUserScores(days, todayStr, specificDayStr) {
    const scores = days.map(day => ({
        date: day.id,
        score: scoreFromWords(day.words || [])
    }));

    const today = scores.find(day => day.date === todayStr)?.score || 0;
    const specificDay = scores.find(day => day.date === specificDayStr)?.score || 0;
    const allTime = scores.reduce(
        (total, day) => total + day.score,
        0
    );
    const average = scores.length > 0 ? allTime / scores.length : 0;
    const best = scores.length > 0 ? Math.max(...scores.map(day => day.score)) : 0;

    return {
        today,
        specificDay,
        allTime,
        average,
        best
    };
}

// ---------- login / signup UI ----------
const loginButton = document.getElementById("login-button");
const authOverlay = document.getElementById("authOverlay");
const accountOverlay = document.getElementById("accountOverlay");
const leaderboardOverlay = document.getElementById("leaderboardOverlay");
const leaderboardBoxLeaderboard = document.getElementById("leaderboardBoxLeaderboard");
const closeAuthBtn = document.getElementById("closeAuthBtn");
const signupBtn = document.getElementById("signupBtn");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const userBar = document.getElementById("userBar");
const currentUsernameAuth = document.getElementById("currentUsernameAuth");
const currentUsernameAccount = document.getElementById("currentUsernameAccount");
const currentPasswordAccount = document.getElementById("currentPasswordAccount");
const showHideCurrentPasswordAccountButton = document.getElementById("showHideCurrentPasswordAccountButton");
const showHideCurrentPasswordAccountButtonImage = document.getElementById("showHideCurrentPasswordAccountButtonImage");
const currentStreak = document.getElementById("currentStreak");
const longestStreak = document.getElementById("longestStreak");
const closeAccountBtn = document.getElementById("closeAccountBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const closeLeaderboardBtn = document.getElementById("closeLeaderboardBtn");
const leaderboardTabs = document.querySelectorAll(".leaderboard-tab");
const leaderboardDatePicker = document.getElementById("leaderboardDatePicker");
const leaderboardDate = document.getElementById("leaderboardDate");
const messagesBtn = document.getElementById("messagesBtn");
const messagesOverlay = document.getElementById("messagesOverlay");
const messagesList = document.getElementById("messagesList");
const closeMessagesBtn = document.getElementById("closeMessagesBtn");
const unreadMessageCount = document.getElementById("unreadMessageCount");
const messageOverlay = document.getElementById("messageOverlay");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const markMessageReadBtn = document.getElementById("markMessageReadBtn");
const closeMessageBtn = document.getElementById("closeMessageBtn");
const achievementsBtn = document.getElementById("achievementsBtn");
const achievementsOverlay = document.getElementById("achievementsOverlay");
const achievementCount = document.getElementById("achievementCount");
const achievementsList = document.getElementById("achievementsList");
const closeAchievementsBtn = document.getElementById("closeAchievementsBtn");

let currentUser = JSON.parse(localStorage.getItem("polygonCurrentUser") || "null");
let usersWithScores = [];
let currentLeaderboardView = "today";
let selectedLeaderboardDate = getDayStr();
let currentMessage = null;
let streakUpdatedToday = false;

function showLoggedInUser(username) {
    if (currentUsernameAuth) currentUsernameAuth.textContent = username;
    if (userBar) userBar.classList.remove("hidden");
    if (loginButton) loginButton.textContent = "Account";
}

function clearLoggedInUser() {
    currentUser = null;
    localStorage.removeItem("polygonCurrentUser");

    if (userBar) userBar.classList.add("hidden");
    if (loginButton) loginButton.textContent = "Login / Sign up";
}

if (currentUser?.username) {
    showLoggedInUser(currentUser.username);
    checkUnreadMessages();
}

function openAuthBox() {
    if (authMsg) authMsg.textContent = "";
    if (authUsername) authUsername.value = "";
    if (authPassword) authPassword.value = "";

    if (authOverlay) authOverlay.classList.remove("hidden");
}

function closeAuthBox() {
    if (authOverlay) authOverlay.classList.add("hidden");
    if (authMsg) authMsg.textContent = "";
    if (authUsername) authUsername.value = "";
    if (authPassword) authPassword.value = "";
}

async function openAccountBox() {
    if (!currentUser) return;

    if (currentUsernameAccount) {
        currentUsernameAccount.textContent = currentUser.username;
    }

    if (currentPasswordAccount) {
        currentPasswordAccount.textContent = "********";
    }

    const userRef = doc(db, "polygon-users", currentUser.username);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const data = userSnap.data();
        currentStreak.textContent = data.currentStreak ?? 0;
        longestStreak.textContent = data.longestStreak ?? 0;
    }

    if (accountOverlay) {
        accountOverlay.classList.remove("hidden");
    }
}

function closeAccountBox() {
    if (accountOverlay) {
        accountOverlay.classList.add("hidden");
    }

    if (currentUsernameAccount) {
        currentUsernameAccount.textContent = "";
    }

    if (currentPasswordAccount) {
        currentPasswordAccount.textContent = "";
    }
}

async function deleteAccount() {
    if (!currentUser?.username) return;

    const confirmed = confirm("Are you sure you want to delete your account?");

    if (!confirmed) return;

    await deleteDoc(doc(db, "polygon-users", currentUser.username));

    clearLoggedInUser();
    closeAccountBox();
}

async function loadLeaderboard(view = currentLeaderboardView, dayStr = selectedLeaderboardDate) {
    const querySnapshot = await getDocs(collection(db, "polygon-users"));
    const todayStr = getDayStr();

    const userPromises = querySnapshot.docs.map(async (docSnap) => {
        const userData = {
            id: docSnap.id,
            ...docSnap.data()
        };

        const days = await getUserDays(userData);

        const scores = calculateUserScores(days, todayStr, dayStr);

        return {
            ...userData,
            ...scores
        };
    });

    usersWithScores = await Promise.all(userPromises);

    currentLeaderboardView = view;

    renderLeaderboard(view);
    setActiveTab(view);
}

function renderLeaderboard(view) {
    if (!leaderboardBoxLeaderboard) return;

    const sorted = [...usersWithScores].sort((a, b) => {
        if (view === "today") return b.today - a.today;
        if (view === "specificDay") return b.specificDay- a.specificDay;
        if (view === "allTime") return b.allTime - a.allTime;
        if (view === "average") return b.average - a.average;
        if (view === "best") return b.best - a.best;

        return 0;
    });

    leaderboardBoxLeaderboard.innerHTML = sorted.map((user, index) => {
        let value = 0;

        if (view === "today") value = user.today;
        if (view === "specificDay") value = user.specificDay;
        if (view === "allTime") value = user.allTime;
        if (view === "average") value = user.average.toFixed(2);
        if (view === "best") value = user.best;

        const isCurrentUser = 
            currentUser && 
            (user.username === currentUser.username ||
             user.id === currentUser.username)

        // Skip if not current user and score is 0
        if (!isCurrentUser && value === 0) {
            return "";
        }

        return `
            <div class="leaderboard-row ${isCurrentUser ? "current-user-row" : ""}">
                <span>#${index + 1} ${user.name || user.username || user.id}</span>
                <span>${value}</span>
            </div>
        `;
    }).join("");
}

function setActiveTab(view) {
    leaderboardTabs.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.view === view);
    });
}

async function openLeaderboardBox() {
    const today = getDayStr();

    leaderboardDate.max = today;

    if (!leaderboardDate.value) {
        leaderboardDate.value = today;
    }

    await loadLeaderboard(currentLeaderboardView, selectedLeaderboardDate);

    if (leaderboardOverlay) {
        leaderboardOverlay.classList.remove("hidden");
    }
}

function closeLeaderboardBox() {
    if (leaderboardOverlay) {
        leaderboardOverlay.classList.add("hidden");
    }
}

if (loginButton) {
    loginButton.addEventListener("click", () => {
        if (!currentUser) {
            openAuthBox();
        } else {
            openAccountBox();
        }
    });
}

if (closeAuthBtn) {
    closeAuthBtn.addEventListener("click", closeAuthBox);
}

if (closeAccountBtn) {
    closeAccountBtn.addEventListener("click", closeAccountBox);
}

if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", deleteAccount);
}

if (leaderboardBtn) {
    leaderboardBtn.addEventListener("click", openLeaderboardBox);
}

if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener("click", closeLeaderboardBox);
}

if (showHideCurrentPasswordAccountButton) {
    showHideCurrentPasswordAccountButton.addEventListener("click", () => {
        if (
            !currentPasswordAccount ||
            !showHideCurrentPasswordAccountButtonImage ||
            !currentUser
        ) {
            return;
        }

        if (currentPasswordAccount.textContent === "********") {
            currentPasswordAccount.textContent = currentUser.password;
            showHideCurrentPasswordAccountButtonImage.src = "closed-eye-icon.png";
        } else {
            currentPasswordAccount.textContent = "********";
            showHideCurrentPasswordAccountButtonImage.src = "eye-icon.png";
        }
    });
}

leaderboardTabs.forEach((btn) => {
    btn.addEventListener("click", async () => {
        currentLeaderboardView = btn.dataset.view || "today";

        if (currentLeaderboardView === "specificDay") {
            leaderboardDatePicker.classList.remove("hidden");
            leaderboardDate.value = selectedLeaderboardDate;
            await loadLeaderboard("specificDay", selectedLeaderboardDate);
        } else {
            leaderboardDatePicker.classList.add("hidden");
            await loadLeaderboard(currentLeaderboardView);
        }
    });
});

leaderboardDate.addEventListener("change", async () => {
    if (!leaderboardDate.value) {
        return;
    }
    selectedLeaderboardDate = leaderboardDate.value;

    await loadLeaderboard("specificDay", selectedLeaderboardDate);
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        clearLoggedInUser();
    });
}

async function signup() {
    const username = authUsername.value.trim();
    const password = authPassword.value;

    if (!username || !password) {
        authMsg.textContent = "Enter a username and password.";
        return;
    }

    const userRef = doc(db, "polygon-users", username);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        authMsg.textContent = "That username already exists.";
        return;
    }

    await setDoc(userRef, {
        username,
        password,
        currentStreak: 0,
        longestStreak: 0,
        lastPlayedDate: null,
        createdAt: serverTimestamp()
    });

    currentUser = { username, password };

    localStorage.setItem(
        "polygonCurrentUser",
        JSON.stringify(currentUser)
    );

    showLoggedInUser(username);

    closeAuthBox();

    window.getFound?.().forEach((word) => {
        addWordForToday(word);
    });
}

async function login() {
    const username = authUsername.value.trim();
    const password = authPassword.value;

    if (!username || !password) {
        authMsg.textContent = "Enter a username and password.";
        return;
    }

    const userRef = doc(db, "polygon-users", username);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        authMsg.textContent = "User not found.";
        return;
    }

    const data = userSnap.data();

    if (data.password !== password) {
        authMsg.textContent = "Incorrect password.";
        return;
    }

    currentUser = { username, password };

    localStorage.setItem(
        "polygonCurrentUser",
        JSON.stringify(currentUser)
    );

    showLoggedInUser(username);

    closeAuthBox();

    window.loadUserWords?.();

    await checkUnreadMessages();
}

if (signupBtn) {
    signupBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await signup();
    });
}

if (loginSubmitBtn) {
    loginSubmitBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await login();
    });
}

async function getUserMessages() {
    if (!currentUser?.username) {
        return [];
    }

    const messagesQuery = query(
        collection(db, "polygon-messages"),
        where("username", "==", currentUser.username)
    );

    const snapshot= await getDocs(messagesQuery);
    
    const messages = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
    }));

    // Newest first
    messages.sort((a, b) => {
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

    return messages;
}

async function markMessageAsRead(messageId) {
    const messageRef = doc(db, "polygon-messages", messageId);
    await updateDoc(messageRef, {
        read: true,
        readAt: serverTimestamp()
    });
}

async function loadMessages() {
    const messages = await getUserMessages();

    messagesList.innerHTML = "";

    const unreadCount = messages.filter(message => !message.read).length;

    if (unreadCount > 0) {
        unreadMessageCount.textContent = `${unreadCount} unread`;
    } else {
        unreadMessageCount.textContent = "";
    }

    if (messages.length === 0) {
        messagesList.innerHTML = `
            <p>You have no messages.</p>
        `;
        return;
    }

    for (const message of messages) {
        const messageElement = createMessageElement(message);
        messagesList.appendChild(messageElement);
    }
}

function createMessageElement(message) {
    const item = document.createElement("div");
    item.className = `message-item ${message.read ? "read" : "unread"}`;

    const header = document.createElement("div")
    header.className = "message-item-header";

    // Title
    const title = document.createElement("span");
    title.textContent = message.title || "Message";

    // Date
    const date = document.createElement("span");
    date.className = "message-item-date";
    if (message.createdAt?.toDate) {
        date.textContent = message.createdAt.toDate().toLocaleDateString();
    }

    // Message body
    const body = document.createElement("div");
    body.className = "message-item-body";
    body.textContent = message.message || "";

    // Read status
    const status = document.createElement("div");
    status.className = "message-status";
    status.textContent = message.read ? "Read" : "Unread";

    header.appendChild(title);
    header.appendChild(date);

    body.appendChild(status);

    item.appendChild(header);
    item.appendChild(body);

    // Click message

    item.addEventListener("click", async () => {

        item.classList.toggle("open");

        // Don't do anything if already read
        if (message.read) {
            return;
        }

        await markMessageAsRead(message.id);

        message.read = true;

        // Update UI
        item.classList.remove("unread");
        item.classList.add("read");

        status.textContent = "Read";

        await updateUnreadMessageCount();

    });

    return item;
}

async function updateUnreadMessageCount() {
    const messages = await getUserMessages();

    const unreadCount = messages.filter(message => !message.read).length;

    if (unreadCount > 0) {
        unreadMessageCount.textContent = `${unreadCount} unread`;
    } else {
        unreadMessageCount.textContent = "";
    }
}

async function openMessages() {
    await loadMessages();

    messagesOverlay.classList.remove("hidden");
}

function closeMessages() {
    messagesOverlay.classList.add("hidden");
}

async function checkUnreadMessages() {
    const messages = await getUserMessages();

    const unreadMessages = messages.filter(message => !message.read);
    if (unreadMessages.length === 0) {
        return;
    }
    // Show oldest unread message first
    unreadMessages.reverse();
    showMessage(unreadMessages[0]);
}

function showMessage(message) {
    currentMessage = message;
    messageTitle.textContent = message.title || "Message";
    messageBody.textContent = message.message || "";
    messageOverlay.classList.remove("hidden");
}

if (messagesBtn) {
    messagesBtn.addEventListener("click", openMessages);
}
if (closeMessagesBtn) {
    closeMessagesBtn.addEventListener("click", closeMessages);
}

if (markMessageReadBtn) {
    markMessageReadBtn.addEventListener("click", async () => {
        if (!currentMessage) {
            return;
        }

        await markMessageAsRead(currentMessage.id);
        messageOverlay.classList.add("hidden");
        currentMessage = null;
        // See if another unread message exists
        await checkUnreadMessages();
    });
}

if (closeMessageBtn) {
    closeMessageBtn.addEventListener("click", () => {
        messageOverlay.classList.add("hidden");
        currentMessage = null;
    });
}

async function getUserAchievements() {
    if (!currentUser) return [];

    const achievementsRef = collection(db, "polygon-users", currentUser.username, "achievements");
    const snapshot = await getDocs(achievementsRef);

    return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
    }));
}

async function loadAchievements() {
    const unlockedAchievements = await getUserAchievements();

    const unlockedMap = new Map(
        unlockedAchievements.map(achievement => [
            achievement.id,
            achievement
        ])
    );

    achievementsList.innerHTML = "";

    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
        const unlocked = unlockedMap.get(id);

        const element = document.createElement("div");

        element.className = `achievement ${unlocked ? "unlocked" : "locked"}`;

        let unlockedDate = "";

        if (unlocked?.unlockedAt?.toDate) {
            unlockedDate = unlocked?.unlockedAt?.toDate().toLocaleDateString();
        }

        element.innerHTML = `
            <div class="achievement-icon">
                ${unlocked ? achievement.icon : "🔒"}
            </div>

            <div class="achievement-info">
                <div class="achievement-name">
                    ${achievement.name}
                </div>

                <div class="achievement-description">
                    ${achievement.description}
                </div>

                ${
                    unlockedDate
                        ? `<div class="achievement-date">
                               Unlocked ${unlockedDate}
                           </div>`
                        : ""
                }
            </div>

            ${
                unlocked
                    ? `<div class="achievement-check">✓</div>`
                    : ""
            }
        `;

        achievementsList.appendChild(element);
    }

    achievementCount.textContent = `${unlockedAchievements.length} / ${Object.keys(ACHIEVEMENTS).length}`;
}

if (achievementsBtn) {
    achievementsBtn.addEventListener("click", async () => {
        await loadAchievements();
        achievementsOverlay.classList.remove("hidden");
    });
}

if (closeAchievementsBtn) {
    closeAchievementsBtn.addEventListener("click", () => {
        achievementsOverlay.classList.add("hidden");
    });
}

async function updateStreakIfNeeded() {
    if (!currentUser.username) return;

    if (streakUpdatedToday) return;

    const today = getDayStr();
    const yesterday = getYesterdayStr();

    const userRef = doc(db, "polygon-users", currentUser.username);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const data = userSnap.data();

    if (data.lastPlayedDate === today) {
        streakUpdatedToday = true;
        return;
    }

    const oldCurrentStreak = data.currentStreak ?? 0;
    const oldLongestStreak = data.longestStreak ?? 0;

    let newCurrentStreak;

    if (data.lastPlayedDate === yesterday) {
        newCurrentStreak = oldCurrentStreak + 1;
    } else {
        newCurrentStreak = 1;
    }

    const newLongestStreak = Math.max(
        oldLongestStreak,
        newCurrentStreak
    );

    await updateDoc(userRef, {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastPlayedDate: today
    });

    streakUpdatedToday = true;
}

export async function addWordForToday(word) {
    if (!currentUser) return;

    const today = getDayStr();

    const dayRef = doc(
        db,
        "polygon-users",
        currentUser.username,
        "days",
        today
    );

    await setDoc(dayRef, {
        updatedAt: serverTimestamp()
    }, { merge: true });

    await updateDoc(dayRef, {
        words: arrayUnion(word)
    });

    await updateStreakIfNeeded();

    await checkAchievements();
}

export async function getWordsForToday() {
    if (!currentUser) return [];

    const today = getDayStr();

    const dayRef = doc(
        db,
        "polygon-users",
        currentUser.username,
        "days",
        today
    );

    const snap = await getDoc(dayRef);

    if (!snap.exists()) return [];

    const data = snap.data();

    return data.words || [];
}

export async function getPuzzleForDate(date) {
    const puzzleRef = doc(db, "polygon-answers", date);
    const snapshot = await getDoc(puzzleRef);

    if (!snapshot.exists()) {
        return null;
    }

    return snapshot.data();
}

export async function savePuzzleForDate(date, puzzle) {
    const puzzleRef = doc(db, "polygon-answers", date);
    await setDoc(puzzleRef, {
        ...puzzle,
        createdAt: serverTimestamp()
    });
}

export async function getPuzzleForToday() {
    const today = getDayStr();
    return getPuzzleForDate(today);
}

export async function savePuzzleForToday(puzzle) {
    const today = getDayStr();
    await savePuzzleForDate(today, puzzle);
}

async function unlockAchievement(achievementId) {
    if (!currentUser) return;

    const achievementRef = doc(db, "polygon-users", currentUser.username, "achievements", achievementId);

    await setDoc(achievementRef, {unlockedAt: serverTimestamp()}, {merge: true});
}

async function checkAchievements() {
    if (!currentUser) return;
    const achievementsRef = collection(db, "polygon-users", currentUser.username, "achievements");
    const achievementsDocs = await getDocs(achievementsRef);
    const unlocked = new Set(achievementsDocs.docs.map(doc => doc.id));

    const userRef = doc(db, "polygon-users", currentUser.username);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data();
    const days = await getUserDays(currentUser);
    // FIRST_WORD
    if (!unlocked.has("FIRST_WORD")) {
        const hasFoundAWord = days.some(day => (day.words || []).length > 0);
        if (hasFoundAWord) {
            await unlockAchievement("FIRST_WORD");
        }
    }
    // STREAK_7
    if (!unlocked.has("STREAK_7") && (userData.longestStreak ?? 0) >= 7) {
        await unlockAchievement("STREAK_7");
    }
    // STREAK_30
    if (!unlocked.has("STREAK_30") && (userData.longestStreak ?? 0) >= 30) {
        await unlockAchievement("STREAK_30");
    }
    // PERFECT_PUZZLE
    if (!unlocked.has("PERFECT_PUZZLE")) {
        for (const day of days) {
            const puzzle = await getPuzzleForDate(day.id);

            if (!puzzle) continue;

            const foundWords = day.words || [];

            if (puzzle.words?.length > 0 && foundWords.length >= puzzle.words.length) {
                await unlockAchievement("PERFECT_PUZZLE");
                break;
            }
        }
    }
    // WORDS_1000
    if (!unlocked.has("WORDS_1000")) {
        const numWords = days.reduce((total, day) => {return total + (day.words?.length || 0);}, 0);
        if (numWords >= 1000) {
            await unlockAchievement("WORDS_1000");
        }
    }
}