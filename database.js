// Supabase Configuration
const SUPABASE_URL = 'https://ylzxelchfnbalgmajjiw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsenhlbGNoZm5iYWxnbWFqaml3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NTI2ODIsImV4cCI6MjA4MjMyODY4Mn0.mNOT9VPHh5f9xSir8UbCU0Ao09pyv3J4Cwyuav5BJAs';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Database Functions
async function loadGames() {
    try {
        const { data, error } = await supabaseClient.from('games').select('*').order('created_at', { ascending: false });
        if (error) {
            if (error.message.includes('relation') && error.message.includes('does not exist')) {
                console.error("FEHLER: Die 'games' Tabelle existiert nicht in der Datenbank!");
                console.error("Bitte führe die SQL-Befehle aus database_setup.sql in deinem Supabase SQL Editor aus.");
                alert("Datenbankfehler: Die 'games' Tabelle fehlt. Bitte führe database_setup.sql aus.");
            }
            throw error;
        }
        const select = document.getElementById('game-select');
        if (!select) return;
        select.innerHTML = '<option value="">Neues Spiel erstellen...</option>';
        if (data) {
            data.forEach(game => {
                const option = document.createElement('option');
                option.value = game.id;
                option.textContent = game.title || `Spiel ${game.id}`;
                if (game.id === currentGameId) option.selected = true;
                select.appendChild(option);
            });
        }
    } catch (err) {
        console.error("Fehler beim Laden der Spiele:", err.message);
    }
}

async function loadGameData(gameId) {
    try {
        const { data, error } = await supabaseClient.from('games').select('*').eq('id', gameId).single();
        if (error) {
            if (error.message.includes('relation') && error.message.includes('does not exist')) {
                console.error("FEHLER: Die 'games' Tabelle existiert nicht in der Datenbank!");
                console.error("Bitte führe die SQL-Befehle aus database_setup.sql in deinem Supabase SQL Editor aus.");
                alert("Datenbankfehler: Die 'games' Tabelle fehlt. Bitte führe database_setup.sql aus.");
            }
            throw error;
        }
        if (data) {
            // Konvertiere JSONB zu Array falls nötig
            players[0].scores = Array.isArray(data.p1_scores) ? data.p1_scores : (data.p1_scores || [0, 0, 0, 0]);
            players[1].scores = Array.isArray(data.p2_scores) ? data.p2_scores : (data.p2_scores || [0, 0, 0, 0]);
            // Stelle sicher, dass Arrays die richtige Länge haben
            while (players[0].scores.length < 4) players[0].scores.push(0);
            while (players[1].scores.length < 4) players[1].scores.push(0);
            playerNames[0] = data.p1_name || "Spieler 1";
            playerNames[1] = data.p2_name || "Spieler 2";
            
            // Lade Sounds aus der Datenbank
            if (data.sound_win) soundFiles.win = data.sound_win;
            if (data.sound_promoted) soundFiles.promoted = data.sound_promoted;
            if (data.sound_comeback) soundFiles.comeback = data.sound_comeback;
            displaySounds();
            
            // Lade Comeback-Counts aus der Datenbank
            comebackCounts[0] = data.p1_comeback_count || 0;
            comebackCounts[1] = data.p2_comeback_count || 0;
            
            // Aktualisiere previousTotalScores beim Laden
            previousTotalScores[0] = getTotalScore(0);
            previousTotalScores[1] = getTotalScore(1);
            updateUI();
            updatePlayerNames();
            
            // Zeige Badges basierend auf geladenen Counts
            if (comebackCounts[0] > 0) {
                showComebackBadge(0);
            }
            if (comebackCounts[1] > 0) {
                showComebackBadge(1);
            }
        }
    } catch (err) {
        console.error("Datenbank-Fehler beim Laden:", err.message);
    }
}

async function createDefaultGame() {
    try {
        const { data, error } = await supabaseClient.from('games').insert({
            title: 'Mein Spiel',
            p1_name: 'Spieler 1',
            p2_name: 'Spieler 2',
            p1_scores: [0, 0, 0, 0],
            p2_scores: [0, 0, 0, 0],
            sound_win: null,
            sound_promoted: null,
            sound_comeback: null,
            p1_comeback_count: 0,
            p2_comeback_count: 0
        }).select().single();
        if (error) {
            if (error.message.includes('relation') && error.message.includes('does not exist')) {
                console.error("FEHLER: Die 'games' Tabelle existiert nicht in der Datenbank!");
                console.error("Bitte führe die SQL-Befehle aus database_setup.sql in deinem Supabase SQL Editor aus.");
                alert("Datenbankfehler: Die 'games' Tabelle fehlt. Bitte führe database_setup.sql aus.");
            }
            throw error;
        }
        currentGameId = data.id;
        await loadGames();
    } catch (err) {
        console.error("Fehler beim Erstellen des Standard-Spiels:", err.message);
    }
}

async function saveData() {
    if (!currentGameId) return;
    try {
        const { error } = await supabaseClient.from('games').update({ 
            p1_scores: players[0].scores,
            p2_scores: players[1].scores,
            p1_name: playerNames[0],
            p2_name: playerNames[1],
            sound_win: soundFiles.win || null,
            sound_promoted: soundFiles.promoted || null,
            sound_comeback: soundFiles.comeback || null,
            p1_comeback_count: comebackCounts[0],
            p2_comeback_count: comebackCounts[1]
        }).eq('id', currentGameId);
        if (error) throw error;
    } catch (err) {
        console.error("Datenbank-Fehler beim Speichern:", err.message);
    }
}

async function loadData() {
    if (!currentGameId) {
        // Lade das erste verfügbare Spiel oder erstelle ein neues
        const { data, error } = await supabaseClient.from('games').select('*').order('created_at', { ascending: false }).limit(1).single();
        if (data) {
            currentGameId = data.id;
            await loadGameData(data.id);
        } else {
            // Kein Spiel vorhanden, erstelle Standard-Spiel
            await createDefaultGame();
        }
    } else {
        await loadGameData(currentGameId);
    }
    await loadGames();
}

async function createNewGame() {
    const title = document.getElementById('new-game-title').value.trim();
    if (!title) {
        alert('Bitte gib einen Spieltitel ein!');
        return;
    }
    try {
        const { data, error } = await supabaseClient.from('games').insert({
            title: title,
            p1_name: 'Spieler 1',
            p2_name: 'Spieler 2',
            p1_scores: [0, 0, 0, 0],
            p2_scores: [0, 0, 0, 0],
            sound_win: null,
            sound_promoted: null,
            sound_comeback: null,
            p1_comeback_count: 0,
            p2_comeback_count: 0
        }).select().single();
        if (error) throw error;
        currentGameId = data.id;
        await loadGames();
        document.getElementById('game-select').value = currentGameId;
        document.getElementById('new-game-title').value = '';
        document.getElementById('new-game-title').style.display = 'none';
        document.getElementById('create-game-btn').style.display = 'none';
        await loadGameData(currentGameId);
    } catch (err) {
        console.error("Fehler beim Erstellen des Spiels:", err.message);
        alert('Fehler beim Erstellen des Spiels!');
    }
}

async function confirmReset() {
    if (!currentGameId) return;
    try {
        const { error } = await supabaseClient.from('games').update({
            p1_scores: [0, 0, 0, 0],
            p2_scores: [0, 0, 0, 0],
            p1_comeback_count: 0,
            p2_comeback_count: 0
        }).eq('id', currentGameId);
        if (error) throw error;
        players[0].scores = [0, 0, 0, 0];
        players[1].scores = [0, 0, 0, 0];
        previousTotalScores[0] = 0;
        previousTotalScores[1] = 0;
        comebackCounts[0] = 0;
        comebackCounts[1] = 0;
        // Entferne Comeback-Badges
        const p1Badge = document.querySelector('#p1-header .comeback-badge');
        const p2Badge = document.querySelector('#p2-header .comeback-badge');
        if (p1Badge) p1Badge.remove();
        if (p2Badge) p2Badge.remove();
        updateUI();
        document.getElementById('reset-confirmation').style.display = 'none';
    } catch (err) {
        console.error("Fehler beim Zurücksetzen:", err.message);
        alert('Fehler beim Zurücksetzen!');
    }
}

async function confirmDelete() {
    if (!currentGameId) return;
    try {
        const { error } = await supabaseClient.from('games').delete().eq('id', currentGameId);
        if (error) throw error;
        
        // Lösche Bestätigung ausblenden
        document.getElementById('delete-confirmation').style.display = 'none';
        
        // Setze currentGameId zurück
        currentGameId = null;
        
        // Lade Spiele neu und wähle das erste verfügbare oder erstelle ein neues
        await loadGames();
        const { data, error: loadError } = await supabaseClient.from('games').select('*').order('created_at', { ascending: false }).limit(1).single();
        
        if (data) {
            currentGameId = data.id;
            await loadGameData(data.id);
            document.getElementById('game-select').value = currentGameId;
        } else {
            // Kein Spiel vorhanden, erstelle Standard-Spiel
            await createDefaultGame();
        }
        
        // Aktualisiere UI
        updateUI();
    } catch (err) {
        console.error("Fehler beim Löschen:", err.message);
        alert('Fehler beim Löschen des Spiels!');
    }
}

// Setup real-time subscription
supabaseClient.channel('db-changes').on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'games' }, 
    payload => {
        if (payload.new.id === currentGameId) {
            players[0].scores = payload.new.p1_scores || [0, 0, 0, 0];
            players[1].scores = payload.new.p2_scores || [0, 0, 0, 0];
            playerNames[0] = payload.new.p1_name || "Spieler 1";
            playerNames[1] = payload.new.p2_name || "Spieler 2";
            
            // Lade Sounds aus der Datenbank
            if (payload.new.sound_win) soundFiles.win = payload.new.sound_win;
            if (payload.new.sound_promoted) soundFiles.promoted = payload.new.sound_promoted;
            if (payload.new.sound_comeback) soundFiles.comeback = payload.new.sound_comeback;
            displaySounds();
            
            // Lade Comeback-Counts aus der Datenbank
            comebackCounts[0] = payload.new.p1_comeback_count || 0;
            comebackCounts[1] = payload.new.p2_comeback_count || 0;
            
            previousTotalScores[0] = getTotalScore(0);
            previousTotalScores[1] = getTotalScore(1);
            updateUI();
            updatePlayerNames();
            
            // Aktualisiere Badges basierend auf geladenen Counts
            const p1Badge = document.querySelector('#p1-header .comeback-badge');
            const p2Badge = document.querySelector('#p2-header .comeback-badge');
            if (comebackCounts[0] > 0) {
                if (!p1Badge) {
                    showComebackBadge(0);
                } else {
                    p1Badge.querySelector('.comeback-count').textContent = comebackCounts[0];
                }
            } else if (p1Badge) {
                p1Badge.remove();
            }
            if (comebackCounts[1] > 0) {
                if (!p2Badge) {
                    showComebackBadge(1);
                } else {
                    p2Badge.querySelector('.comeback-count').textContent = comebackCounts[1];
                }
            } else if (p2Badge) {
                p2Badge.remove();
            }
        }
    }
).subscribe();

