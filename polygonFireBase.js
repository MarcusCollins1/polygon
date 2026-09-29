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
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";

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

async function getScoreFromDay(user, dayStr) {
    const days = await getUserDays(user);
    const day = days.find((entry) => entry.id === dayStr);
    const words = day?.words || [];
    return scoreFromWords(words);
}

async function getAllTimeScore(user) {
    const days = await getUserDays(user);
    return days.reduce((total, day) => total + scoreFromWords(day.words || []), 0);
}

async function getAverageScore(user) {
    const days = await getUserDays(user);

    if (days.length === 0) return 0;

    const total = days.reduce((sum, day) => {
        return sum + scoreFromWords(day.words || []);
    }, 0);

    return total / days.length;
}

async function getBestScore(user) {
    const days = await getUserDays(user);

    if (days.length === 0) return 0;

    let best = 0;

    for (const day of days) {
        best = Math.max(best, scoreFromWords(day.words || []));
    }

    return best;
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
const closeAccountBtn = document.getElementById("closeAccountBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const closeLeaderboardBtn = document.getElementById("closeLeaderboardBtn");
const leaderboardTabs = document.querySelectorAll(".leaderboard-tab");

let currentUser = JSON.parse(localStorage.getItem("polygonCurrentUser") || "null");
let usersWithScores = [];
let currentLeaderboardView = "today";

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

function openAccountBox() {
    if (!currentUser) return;

    if (currentUsernameAccount) {
        currentUsernameAccount.textContent = currentUser.username;
    }

    if (currentPasswordAccount) {
        currentPasswordAccount.textContent = "********";
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

async function loadLeaderboard(view = currentLeaderboardView) {
    const querySnapshot = await getDocs(collection(db, "polygon-users"));
    const dayStr = getDayStr();

    const userPromises = querySnapshot.docs.map(async (docSnap) => {
        const userData = docSnap.data();

        const [today, allTime, average, best] = await Promise.all([
            getScoreFromDay(userData, dayStr),
            getAllTimeScore(userData),
            getAverageScore(userData),
            getBestScore(userData)
        ]);

        return {
            id: docSnap.id,
            ...userData,
            today,
            allTime,
            average,
            best
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
        if (view === "allTime") return b.allTime - a.allTime;
        if (view === "average") return b.average - a.average;
        if (view === "best") return b.best - a.best;

        return 0;
    });

    leaderboardBoxLeaderboard.innerHTML = sorted.map((user, index) => {
        let value = 0;

        if (view === "today") value = user.today;
        if (view === "allTime") value = user.allTime;
        if (view === "average") value = user.average.toFixed(2);
        if (view === "best") value = user.best;

        const isCurrentUser = 
            currentUser && 
            (user.username === currentUser.username ||
             user.id === currentUser.username)

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
    await loadLeaderboard(currentLeaderboardView);

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
    btn.addEventListener("click", () => {
        currentLeaderboardView = btn.dataset.view || "today";

        renderLeaderboard(currentLeaderboardView);
        setActiveTab(currentLeaderboardView);
    });
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