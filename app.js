/**
 * LIQUID LEAGUE TRACKER PRO ENGINE
 * Enthält: State Management, Supabase Sync, Custom Audio Core und Puter.js KI Integration.
 */

// --- CONFIGURATIONS & API KEYS ---
const SUPABASE_URL = 'https://ylzxelchfnbalgmajjiw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsenhlbGNoZm5iYWxnbWFqaml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NTI2ODIsImV4cCI6MjA4MjMyODY4Mn0.mNOT9VPHh5f9xSir8UbCU0Ao09pyv3J4Cwyuav5BJAs';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const leagueConfig = [
    { name: "Bronze", class: "bronze", weight: 1 },
    { name: "Silber", class: "silver", weight: 3 },
    { name: "Gold", class: "gold", weight: 9 },
    { name: "Platin", class: "platinum", weight: 27 }
];

// --- APPLICATION STATE ---
let players = [
    { name: "Spieler 1", scores: [0, 0, 0, 0] },
    { name: "Spieler 2", scores: [0, 0, 0, 0] }
];
let currentGameId = null;
let isDarkMode = true;
let aiPersonality = 'professional'; // Options: 'professional' or 'trash'

let soundFiles = {
    win: null,
    promoted: null,
    comeback: null
};

let previousTotalScores = [0, 0];
let comebackCounts = [0, 0];
let currentTrackedDeficit = [0, 0]; // Verfolgt den maximalen Rückstand für Comeback-Logik

// --- DOM INITIALISIERUNG ---
window.addEventListener('DOMContentLoaded', async () => {
    initVoiceSelector();
    renderLeagueContainers();
    await loadInitialData();
    setupSupabaseRealtime();
    updateUI();
});

// Generiert die HTML Elemente für die Ligen-Anzeige
function renderLeagueContainers() {
    [0, 1].forEach(pIdx => {
        const container = document.getElementById(`p${pIdx + 1}-leagues`);
        container.innerHTML = '';
        leagueConfig.forEach((league, lIdx) => {
            // Wir überspringen Bronze in der Stack-Anzeige, da es als Hauptzähler fungiert
            if (lIdx === 0) return; 
            
            const item = document.createElement('div');
            item.className = `league-item ${league.class}`;
            item.id = `p${pIdx}-league-${lIdx}`;
            item.innerHTML = `
                <div class="league-left">
                    <div class="league-icon ${league.class}-glow"></div>
                    <span class="league-name">${league.name}</span>
                </div>
                <span class="league-count" id="p${pIdx}-league-val-${lIdx}">0</span>
            `;
            container.appendChild(item);
        });
    });
}

// --- SCORE ENGINE (LOGIK & PROMOTIONEN) ---
function modifyScore(playerIndex, change) {
    const otherIndex = playerIndex === 0 ? 1 : 0;
    
    // Speichere die gewichteten Scores VOR der Änderung
    previousTotalScores[0] = getTotalWeightedScore(0);
    previousTotalScores[1] = getTotalWeightedScore(1);

    if (change > 0) {
        // Punkt hinzufügen
        players[playerIndex].scores[0] += 1;
        checkPromotionLogic(playerIndex);
        
        // Comeback-Prüfung ausführen
        evaluateComebackTrigger(playerIndex, otherIndex);
        
        // Sound & KI Triggern
        playEventSound('point');
        triggerAICommentary(`Punkt für ${players[playerIndex].name}`);
    } else {
        // Punkt abziehen (Sicherheitsuntergrenze 0)
        if (players[playerIndex].scores[0] > 0) {
            players[playerIndex].scores[0] -= 1;
        } else {
            // Falls Bronze 0 ist, versuchen wir eine Liga tiefer zu gehen falls vorhanden
            for (let i = 1; i < 4; i++) {
                if (players[playerIndex].scores[i] > 0) {
                    players[playerIndex].scores[i] -= 1;
                    players[playerIndex].scores[i-1] = 2; // Setze vorherige Liga auf 2
                    break;
                }
            }
        }
    }

    // Aktualisiere maximalen Rückstand für spätere Comeback-Berechnungen
    updateDeficitTracking();
    
    updateUI();
    saveStateToCloud();
}

// Berechnet den gesamten gewichteten Punktestand eines Spielers
function getTotalWeightedScore(pIdx) {
    return players[pIdx].scores.reduce((total, val, lIdx) => total + (val * leagueConfig[lIdx].weight), 0);
}

// Überprüft kaskadierend alle Aufstiegsbedingungen (3 Siege zum Aufstieg)
function checkPromotionLogic(pIdx) {
    // 0: Bronze, 1: Silber, 2: Gold, 3: Platin
    for (let i = 0; i < 3; i++) {
        if (players[pIdx].scores[i] >= 3) {
            players[pIdx].scores[i + 1] += 1;
            
            // Regelkonformer Reset: Setze alle Ligen unterhalb der neuen Stufe für BEIDE Spieler zurück
            for (let p = 0; p < 2; p++) {
                for (let l = 0; l <= i; l++) {
                    players[p].scores[l] = 0;
                }
            }
            playEventSound('promoted');
            triggerAICommentary(`AUFSTIEG! ${players[pIdx].name} ist in die Liga ${leagueConfig[i+1].name} aufgestiegen!`);
        }
    }
}

// Mischt den maximalen Rückstand während des laufenden Spiels
function updateDeficitTracking() {
    const score0 = getTotalWeightedScore(0);
    const score1 = getTotalWeightedScore(1);
    
    const diff = score0 - score1;
    if (diff > 0) {
        if (diff > currentTrackedDeficit[1]) currentTrackedDeficit[1] = diff;
    } else if (diff < 0) {
        const absDiff = Math.abs(diff);
        if (absDiff > currentTrackedDeficit[0]) currentTrackedDeficit[0] = absDiff;
    }
}

// Prüft ob ein Comeback vorliegt (Mindestens 4 Punkte Rückstand aufgeholt zu einem Gleichstand)
function evaluateComebackTrigger(scorerIdx, loserIdx) {
    const scoreScorer = getTotalWeightedScore(scorerIdx);
    const scoreLoser = getTotalWeightedScore(loserIdx);
    
    // Comeback wird beim Erreichen des Gleichstands ausgelöst
    if (scoreScorer === scoreLoser && currentTrackedDeficit[scorerIdx] >= 4) {
        comebackCounts[scorerIdx] += 1;
        currentTrackedDeficit[scorerIdx] = 0; // Zurücksetzen nach Auslösung
        
        triggerVisualComebackEffect(scorerIdx);
        playEventSound('comeback');
        triggerAICommentary(`UNGLAUBLICH! ${players[scorerIdx].name} hat einen Rückstand von 4 oder mehr Punkten aufgeholt und den Ausgleich erzielt!`);
    }
}

function triggerVisualComebackEffect(pIdx) {
    const card = document.getElementById(`p${pIdx + 1}-card`);
    card.classList.add('comeback-active');
    setTimeout(() => {
        card.classList.remove('comeback-active');
    }, 10000); // 10 Sekunden feuriger Effekt
}

// --- UI SYNC ENGINE ---
function updateUI() {
    // Namen setzen
    document.getElementById('p1-name-display').textContent = players[0].name;
    document.getElementById('p2-name-display').textContent = players[1].name;
    
    // Haupt-Bronze Zähler setzen
    document.getElementById('p1-display').textContent = players[0].scores[0];
    document.getElementById('p2-display').textContent = players[1].scores[0];

    // Höhere Ligen-Werte updaten
    for (let p = 0; p < 2; p++) {
        for (let l = 1; l < 4; l++) {
            const valEl = document.getElementById(`p${p}-league-val-${l}`);
            if (valEl) valEl.textContent = players[p].scores[l];
            
            // Optisches Highlight setzen, wenn in dieser Liga Punkte existieren
            const itemEl = document.getElementById(`p${p}-league-${l}`);
            if (itemEl) {
                if (players[p].scores[l] > 0) itemEl.classList.add('active');
                else itemEl.classList.remove('active');
            }
        }
    }

    // Comeback Badges aktualisieren
    [0, 1].forEach(pIdx => {
        const badge = document.getElementById(`p${pIdx + 1}-comeback-badge`);
        const txt = document.getElementById(`p${pIdx + 1}-comeback-txt`);
        if (comebackCounts[pIdx] > 0) {
            badge.style.display = 'inline-flex';
            txt.textContent = comebackCounts[pIdx];
        } else {
            badge.style.display = 'none';
        }
    });

    // Differenzanzeige berechnen
    const t0 = getTotalWeightedScore(0);
    const t1 = getTotalWeightedScore(1);
    const diffElement1 = document.getElementById('p1-score-diff');
    const diffElement2 = document.getElementById('p2-score-diff');

    if (t0 === t1) {
        diffElement1.textContent = "="; diffElement1.removeAttribute('data-equal');
        diffElement2.textContent = "="; diffElement2.removeAttribute('data-equal');
    } else if (t0 > t1) {
        diffElement1.textContent = `+${t0 - t1}`; diffElement1.setAttribute('data-equal', 'false');
        diffElement2.textContent = `-${t0 - t1}`; diffElement2.removeAttribute('data-equal');
    } else {
        diffElement1.textContent = `-${t1 - t0}`; diffElement1.removeAttribute('data-equal');
        diffElement2.textContent = `+${t1 - t0}`; diffElement2.setAttribute('data-equal', 'false');
    }
}

// --- SUPABASE DATA MANAGEMENT & SYNC ---
async function loadInitialData() {
    try {
        const { data, error } = await supabaseClient.from('games').select('*').order('created_at', { ascending: false }).limit(1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const game = data[0];
            currentGameId = game.id;
            players[0].name = game.p1_name || "Spieler 1";
            players[1].name = game.p2_name || "Spieler 2";
            players[0].scores = Array.isArray(game.p1_scores) ? game.p1_scores : [0,0,0,0];
            players[1].scores = Array.isArray(game.p2_scores) ? game.p2_scores : [0,0,0,0];
            comebackCounts[0] = game.p1_comeback_count || 0;
            comebackCounts[1] = game.p2_comeback_count || 0;
            
            soundFiles.win = game.sound_win || null;
            soundFiles.promoted = game.sound_promoted || null;
            soundFiles.comeback = game.sound_comeback || null;

            document.getElementById('game-id-input').value = `Slot #${currentGameId}`;
        } else {
            // Erstelle ein leeres Initial-Match falls die Tabelle komplett leer ist
            const { data: newGame, error: createError } = await supabaseClient.from('games').insert([{
                title: "Liquid Match Session",
                p1_name: "Spieler 1", p2_name: "Spieler 2",
                p1_scores: [0,0,0,0], p2_scores: [0,0,0,0]
            }]).select();
            if (!createError && newGame) currentGameId = newGame[0].id;
        }
    } catch (e) {
        console.warn("Supabase Verbindung fehlgeschlagen. Starte im lokalen Offline-Modus.", e);
        loadLocalFallback();
    }
}

async function saveStateToCloud() {
    // Lokales Backup sichern
    localStorage.setItem('liquid_tt_state', JSON.stringify({ players, comebackCounts, soundFiles }));
    
    if (!currentGameId) return;
    try {
        await supabaseClient.from('games').update({
            p1_name: players[0].name,
            p2_name: players[1].name,
            p1_scores: players[0].scores,
            p2_scores: players[1].scores,
            p1_comeback_count: comebackCounts[0],
            p2_comeback_count: comebackCounts[1],
            sound_win: soundFiles.win,
            sound_promoted: soundFiles.promoted,
            sound_comeback: soundFiles.comeback
        }).eq('id', currentGameId);
    } catch (e) {
        console.error("Cloud-Sync fehlgeschlagen:", e);
    }
}

function loadLocalFallback() {
    const local = localStorage.getItem('liquid_tt_state');
    if (local) {
        const parsed = JSON.parse(local);
        players = parsed.players;
        comebackCounts = parsed.comebackCounts || [0,0];
        if (parsed.soundFiles) soundFiles = parsed.soundFiles;
    }
}

// Registriert Echtzeit-Listenener für Multi-Device-Support (Echtzeit Scoreboard)
function setupSupabaseRealtime() {
    if (!currentGameId) return;
    supabaseClient.channel('custom-filter-channel')
    .on('postgres_changes', { event: 'UPDATE', filter: `id=eq.${currentGameId}`, schema: 'public', table: 'games' }, payload => {
        const next = payload.new;
        players[0].name = next.p1_name;
        players[1].name = next.p2_name;
        players[0].scores = next.p1_scores;
        players[1].scores = next.p2_scores;
        comebackCounts[0] = next.p1_comeback_count;
        comebackCounts[1] = next.p2_comeback_count;
        updateUI();
    }).subscribe();
}

// --- CLIENT-SIDE PUTER.JS AI COMMENTATOR CORE ---
async function triggerAICommentary(eventDescription) {
    const orb = document.getElementById('ai-visual-orb');
    setOrbState('thinking');

    // Berechne Matchdaten für den KI Kontext
    const contextString = `
        Match-Status:
        - ${players[0].name}: Bronze=${players[0].scores[0]}, Silber=${players[0].scores[1]}, Gold=${players[0].scores[2]}, Platin=${players[0].scores[3]} (Gesamtgewicht: ${getTotalWeightedScore(0)})
        - ${players[1].name}: Bronze=${players[1].scores[0]}, Silber=${players[1].scores[1]}, Gold=${players[1].scores[2]}, Platin=${players[1].scores[3]} (Gesamtgewicht: ${getTotalWeightedScore(1)})
        Aktuelles Ereignis: ${eventDescription}
        Gewählter Kommentator-Stil: ${aiPersonality === 'trash' ? 'Gnadenloser, lustiger Trash-Talker der den Verlierer neckt' : 'Seriöser, epischer TV-Sportanalyst'}.
    `;

    try {
        // Direkte Nutzung der kostenlosen Puter AI Chat API v2 im Browser
        const response = await puter.ai.chat(
            `Du bist der offizielle Live-Kommentator für dieses Tischtennis-Match. Reagiere auf das aktuelle Ereignis mit maximal 1 bis 2 kurzen, prägnanten und packenden Sätzen auf Deutsch. Nutze den Stil: ${aiPersonality}.\nContext:\n${contextString}`
        );
        
        const textToSpeak = response.toString().trim();
        setOrbState('speaking');
        speakTextViaTTS(textToSpeak);
    } catch (error) {
        console.error("Puter AI Engine Error:", error);
        setOrbState('idle');
    }
}

function setOrbState(state) {
    const orb = document.getElementById('ai-visual-orb');
    orb.className = 'ai-orb'; // Reset
    if (state === 'thinking') orb.classList.add('status-thinking');
    else if (state === 'speaking') orb.classList.add('status-speaking');
    else orb.classList.add('status-idle');
}

// --- WEB SPEECH SYNTHESIS ENGINE (TEXT TO SPEECH) ---
let systemVoices = [];
function initVoiceSelector() {
    const select = document.getElementById('tts-voice-select');
    if (!select) return;
    
    function populate() {
        systemVoices = window.speechSynthesis.getVoices();
        select.innerHTML = '';
        systemVoices.forEach((voice, index) => {
            if (voice.lang.includes('de') || voice.lang.includes('en')) {
                const opt = document.createElement('option');
                opt.value = index;
                opt.textContent = `${voice.name} (${voice.lang})`;
                if (voice.lang.startsWith('de-')) opt.selected = true; // Bevorzuge Deutsch
                select.appendChild(opt);
            }
        });
    }
    populate();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = populate;
    }
}

function speakTextViaTTS(text) {
    if (!window.speechSynthesis) {
        setOrbState('idle');
        return;
    }
    window.speechSynthesis.cancel(); // Laufende Sprachausgaben abbrechen
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voiceIdx = document.getElementById('tts-voice-select').value;
    if (systemVoices[voiceIdx]) utterance.voice = systemVoices[voiceIdx];
    
    utterance.rate = parseFloat(document.getElementById('tts-rate').value) || 1.0;
    utterance.pitch = parseFloat(document.getElementById('tts-pitch').value) || 1.0;
    
    utterance.onend = () => setOrbState('idle');
    utterance.onerror = () => setOrbState('idle');
    
    window.speechSynthesis.speak(utterance);
}

// --- ADVANCED AUDIO CORE (BASE64 STORAGE) ---
function handleAudioUpload(inputElement, type) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64String = e.target.result;
        soundFiles[type] = base64String;
        saveStateToCloud();
        alert(`Sound für "${type}" erfolgreich hochgeladen und in Cloud gespeichert!`);
    };
    reader.readAsDataURL(file);
}

function playCustomSound(type) {
    if (soundFiles[type]) {
        const audio = new Audio(soundFiles[type]);
        audio.volume = 1.0;
        audio.play().catch(e => console.error("Audio Playback Error:", e));
    } else {
        alert("Für dieses Event wurde noch kein Custom Sound hochgeladen.");
    }
}

function playEventSound(eventType) {
    if (eventType === 'promoted' && soundFiles.promoted) playCustomSound('promoted');
    else if (eventType === 'comeback' && soundFiles.comeback) playCustomSound('comeback');
    else if (eventType === 'point' && soundFiles.win) playCustomSound('win');
}

// --- UTILITY INTERFACE INTERACTIONS ---
function renamePlayer(pIdx) {
    const newName = prompt(`Neuen Namen für Spieler ${pIdx + 1} eingeben:`, players[pIdx].name);
    if (newName && newName.trim() !== "") {
        players[pIdx].name = newName.trim();
        updateUI();
        saveStateToCloud();
    }
}

function togglePopup(id) {
    const el = document.getElementById(id);
    const isOpen = el.classList.contains('open');
    closeAllPopups();
    if (!isOpen) el.classList.add('open');
}

function closeAllPopups() {
    document.querySelectorAll('.popup-overlay').forEach(p => p.classList.remove('open'));
}

function setAIMode(mode) {
    aiPersonality = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    if (mode === 'professional') document.getElementById('mode-pro').classList.add('active');
    else document.getElementById('mode-trash').classList.add('active');
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) document.body.classList.remove('light-mode');
    else document.body.classList.add('light-mode');
}
