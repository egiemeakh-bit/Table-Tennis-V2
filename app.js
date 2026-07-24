// --- SUPABASE KONFIGURATION ---
// Ersetze diese beiden Werte mit deinen eigenen Supabase Credentials aus deinem Supabase-Dashboard:
const SUPABASE_URL = "https://DEIN-PROJEKT.supabase.co";
const SUPABASE_ANON_KEY = "DEIN-SUPABASE-ANON-KEY";

// Supabase Client initialisieren
let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== "https://DEIN-PROJEKT.supabase.co") {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- MATCH STATE ---
let state = {
    p1Score: 0,
    p2Score: 0,
    p1Sets: 0,
    p2Sets: 0,
    server: 1, // 1 oder 2
    history: []
};

// DOM Elemente
const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');
const setsP1El = document.getElementById('sets-p1');
const setsP2El = document.getElementById('sets-p2');
const serviceP1El = document.getElementById('service-p1');
const serviceP2El = document.getElementById('service-p2');
const serverIndicatorEl = document.getElementById('server-indicator');
const commentaryTextEl = document.getElementById('commentary-text');
const dbStatusEl = document.getElementById('db-status');

// Initialisierung bei Seitenaufruf
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    checkSupabaseStatus();
});

/**
 * Überprüft die Supabase-Verbindung
 */
function checkSupabaseStatus() {
    if (supabaseClient) {
        dbStatusEl.innerHTML = `<span class="dot"></span> Supabase verbunden`;
    } else {
        dbStatusEl.innerHTML = `<span class="dot" style="background-color: #ff9500; box-shadow: 0 0 8px #ff9500;"></span> Supabase Offline (Demo)`;
    }
}

/**
 * Punktzahl anpassen (+1 / -1)
 */
async function modifyScore(playerIndex, change) {
    // Zustand im Verlauf sichern
    state.history.push(JSON.parse(JSON.stringify(state)));

    const p1Name = document.getElementById('player1-name').value || "Spieler 1";
    const p2Name = document.getElementById('player2-name').value || "Spieler 2";

    if (playerIndex === 0) {
        state.p1Score = Math.max(0, state.p1Score + change);
    } else {
        state.p2Score = Math.max(0, state.p2Score + change);
    }

    // Satzgewinn-Prüfung (Tischtennis: 11 Punkte, 2 Punkte Abstand)
    checkSetWin(p1Name, p2Name);

    // Aufschlagwechsel-Prüfung (alle 2 Punkte, ab 10:10 jeden Punkt)
    updateServerInfo();

    // UI aktualisieren
    updateUI();

    // KI Kommentator Trigger (nur bei Punktgewinn)
    if (change > 0) {
        const scorerName = playerIndex === 0 ? p1Name : p2Name;
        commentaryTextEl.innerText = "KI denkt nach...";
        
        const text = await commentator.generateCommentary(
            p1Name, 
            p2Name, 
            state.p1Score, 
            state.p2Score, 
            state.p1Sets, 
            state.p2Sets, 
            scorerName
        );
        commentaryTextEl.innerText = text;
    }
}

/**
 * Prüft ob ein Satz gewonnen wurde
 */
function checkSetWin(p1Name, p2Name) {
    const s1 = state.p1Score;
    const s2 = state.p2Score;

    if (s1 >= 11 && s1 - s2 >= 2) {
        state.p1Sets++;
        state.p1Score = 0;
        state.p2Score = 0;
        alert(`Satz für ${p1Name}!`);
    } else if (s2 >= 11 && s2 - s1 >= 2) {
        state.p2Sets++;
        state.p1Score = 0;
        state.p2Score = 0;
        alert(`Satz für ${p2Name}!`);
    }
}

/**
 * Berechnet den aktuellen Aufschläger
 */
function updateServerInfo() {
    const totalPoints = state.p1Score + state.p2Score;
    
    // Deuce (Verlängerung ab 10:10) -> Aufschlag wechselt jeden Punkt
    if (state.p1Score >= 10 && state.p2Score >= 10) {
        state.server = (totalPoints % 2 === 0) ? 1 : 2;
    } else {
        // Normaler Satz -> Aufschlag wechselt alle 2 Punkte
        state.server = (Math.floor(totalPoints / 2) % 2 === 0) ? 1 : 2;
    }
}

/**
 * UI-Elemente mit dem State synchronisieren
 */
function updateUI() {
    scoreP1El.innerText = state.p1Score;
    scoreP2El.innerText = state.p2Score;
    setsP1El.innerText = state.p1Sets;
    setsP2El.innerText = state.p2Sets;

    const p1Name = document.getElementById('player1-name').value || "Spieler 1";
    const p2Name = document.getElementById('player2-name').value || "Spieler 2";

    if (state.server === 1) {
        serviceP1El.style.opacity = "1";
        serviceP2El.style.opacity = "0";
        serverIndicatorEl.innerText = `Aufschlag: ${p1Name}`;
    } else {
        serviceP1El.style.opacity = "0";
        serviceP2El.style.opacity = "1";
        serverIndicatorEl.innerText = `Aufschlag: ${p2Name}`;
    }
}

/**
 * Letzten Spielzug rückgängig machen
 */
function undoScore() {
    if (state.history.length > 0) {
        const previousState = state.history.pop();
        state.p1Score = previousState.p1Score;
        state.p2Score = previousState.p2Score;
        state.p1Sets = previousState.p1Sets;
        state.p2Sets = previousState.p2Sets;
        state.server = previousState.server;
        updateUI();
        commentaryTextEl.innerText = "Letzter Punkt wurde rückgängig gemacht.";
    }
}

/**
 * Match komplett zurücksetzen
 */
function resetMatch() {
    if (confirm("Möchtest du das aktuelle Match wirklich zurücksetzen?")) {
        state = {
            p1Score: 0,
            p2Score: 0,
            p1Sets: 0,
            p2Sets: 0,
            server: 1,
            history: []
        };
        updateUI();
        commentaryTextEl.innerText = "Match zurückgesetzt. Bereit für ein neues Spiel!";
    }
}

/**
 * Ton an- / ausschalten
 */
function toggleAudio() {
    const isEnabled = commentator.toggleAudio();
    const btn = document.getElementById('tts-toggle-btn');
    btn.innerText = isEnabled ? "🔊 Ton an" : "🔇 Ton aus";
}

/**
 * Test-Funktion für den Siri-Orb
 */
function testCommentator() {
    commentator.speak("iOS 27 Kommentator ist aktiv und betriebsbereit.");
}

/**
 * Speichert den Matchstand in deiner Supabase Datenbank
 */
async function saveMatchToSupabase() {
    if (!supabaseClient) {
        alert("Bitte trage deine SUPABASE_URL und den SUPABASE_ANON_KEY oben in der app.js ein!");
        return;
    }

    const p1Name = document.getElementById('player1-name').value || "Spieler 1";
    const p2Name = document.getElementById('player2-name').value || "Spieler 2";

    try {
        const { data, error } = await supabaseClient
            .from('matches')
            .insert([
                {
                    player1_name: p1Name,
                    player2_name: p2Name,
                    player1_score: state.p1Score,
                    player2_score: state.p2Score,
                    player1_sets: state.p1Sets,
                    player2_sets: state.p2Sets,
                    created_at: new Date()
                }
            ]);

        if (error) throw error;

        alert("Match erfolgreich in Supabase gespeichert!");
    } catch (err) {
        console.error("Fehler beim Speichern in Supabase:", err);
        alert("Fehler beim Speichern: " + err.message);
    }
}
