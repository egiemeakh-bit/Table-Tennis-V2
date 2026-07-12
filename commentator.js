/**
 * Table Tennis Game Commentator (Browser Edition mit Puter.js)
 */
class TableTennisCommentator {
    constructor() {
        this.muted = false;
        this.mode = 'professional'; // 'professional' oder 'trash'
        this.isProcessing = false;
    }

    setMode(mode) {
        this.mode = mode;
        // UI Update
        document.getElementById('mode-pro').classList.toggle('active', mode === 'professional');
        document.getElementById('mode-trash').classList.toggle('active', mode === 'trash');
    }

    toggleMute() {
        this.muted = !this.muted;
        const orb = document.getElementById('ai-orb');
        if (orb) {
            if (this.muted) orb.classList.add('muted');
            else orb.classList.remove('muted');
        }
        return this.muted;
    }

    async onScoreChange(p1Scores, p2Scores, p1Name, p2Name, eventType) {
        if (this.muted || this.isProcessing) return;

        // Gesamtpunkte berechnen (vereinfachte Logik für den Prompt)
        const p1Total = p1Scores.reduce((a, b) => a + b, 0);
        const p2Total = p2Scores.reduce((a, b) => a + b, 0);

        // Orb visuell auf "denkend" setzen
        const orb = document.getElementById('ai-orb');
        if (orb) orb.classList.add('thinking');

        const prompt = `Du bist ein Tischtennis-Kommentator. 
        Persönlichkeit: ${this.mode === 'trash' ? 'sarkastisch, witzig, frech (Trash Talk)' : 'professionell, sportlich, enthusiastisch'}.
        Ereignis: Es gab gerade einen ${eventType}.
        Spielstand: ${p1Name} hat ${p1Total} Punkte. ${p2Name} hat ${p2Total} Punkte.
        Aufgabe: Generiere genau EINEN kurzen, prägnanten Satz (max. 15 Wörter) als Kommentar auf Deutsch.`;

        try {
            this.isProcessing = true;
            // Nutzt die kostenlose Puter.js API aus der index.html
            const response = await puter.ai.chat(prompt);
            const commentary = response.message.text.trim();
            this.speak(commentary);
        } catch (error) {
            console.error('[Commentator] Fehler bei der KI-Generierung:', error);
        } finally {
            this.isProcessing = false;
            if (orb) orb.classList.remove('thinking');
        }
    }

    speak(text) {
        if (this.muted) return;

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Stimmen laden und nach afrikanischen Lokalisierungen filtern
        const voices = window.speechSynthesis.getVoices();
        
        // Versuch 1: Spezifische afrikanische Länderkürzel (z.B. ZA=Südafrika, NG=Nigeria)
        // Versuch 2: Standard Deutsch, damit die Aussprache des deutschen Textes nicht komplett kaputt klingt
        const selectedVoice = voices.find(v => v.lang.includes('ZA') || v.lang.includes('NG') || v.lang.includes('KE')) 
                           || voices.find(v => v.lang.includes('de-DE'))
                           || voices[0];

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        // Sprach-Parameter anpassen für eine tiefere, voluminösere Stimme
        utterance.pitch = 0.8;
        utterance.rate = 1.0;

        const orb = document.getElementById('ai-orb');
        
        utterance.onstart = () => {
            if (orb) orb.classList.add('speaking');
        };
        
        utterance.onend = () => {
            if (orb) orb.classList.remove('speaking');
        };

        window.speechSynthesis.speak(utterance);
    }
}

// Initiiere den Kommentator global, damit app.js darauf zugreifen kann
const commentator = new TableTennisCommentator();

// Workaround: Browser laden Stimmen oft asynchron. Dies stößt das Laden an.
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
