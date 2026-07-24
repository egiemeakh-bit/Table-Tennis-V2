/**
 * Tischtennis KI-Kommentator mit Puter.ai & Web Speech API TTS
 */
class TableTennisCommentator {
    constructor() {
        this.audioEnabled = true;
        this.synth = window.speechSynthesis || null;
        this.lastCommentary = "";
    }

    /**
     * Schaltet Audio an/aus
     */
    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        if (!this.audioEnabled && this.synth) {
            this.synth.cancel();
        }
        return this.audioEnabled;
    }

    /**
     * Generiert einen Live-Kommentar basierend auf dem aktuellen Match-Stand
     */
    async generateCommentary(p1Name, p2Name, score1, score2, sets1, sets2, lastScorer) {
        const prompt = `Du bist ein begeisterter, professioneller Tischtennis-Live-Kommentator.
Match-Status:
- ${p1Name}: ${score1} Punkte (Sätze: ${sets1})
- ${p2Name}: ${score2} Punkte (Sätze: ${sets2})
- Letzter Punkt gemacht von: ${lastScorer}

Erstelle einen extrem kurzen, knackigen, mitreißenden Satz (maximal 15 Wörter) auf Deutsch, der diesen Punkt kommentiert.`;

        try {
            let resultText = "";

            // Verwendung von Puter AI falls verfügbar
            if (typeof puter !== 'undefined' && puter.ai) {
                const response = await puter.ai.chat(prompt, { model: 'gpt-4o-mini' });
                resultText = typeof response === 'string' ? response : response?.message?.content || response.toString();
            } else {
                // Fallback, falls Puter nicht erreichbar ist
                resultText = `Starker Punkt von ${lastScorer}! Der Spielstand steht nun ${score1} zu ${score2}.`;
            }

            this.lastCommentary = resultText.trim();
            
            // Text vorlesen, falls Audio aktiviert ist
            if (this.audioEnabled) {
                this.speak(this.lastCommentary);
            }

            return this.lastCommentary;
        } catch (error) {
            console.warn("KI Generierung fehlgeschlagen, benutze Standard-Kommentar:", error);
            const fallback = `Punkt für ${lastScorer}! Spielstand: ${score1} zu ${score2}.`;
            if (this.audioEnabled) this.speak(fallback);
            return fallback;
        }
    }

    /**
     * Text-to-Speech (Sprachausgabe)
     */
    speak(text) {
        if (!this.synth) {
            console.warn("Web Speech API wird von diesem Browser nicht unterstützt.");
            return;
        }

        // Laufende Sprachausgaben abbrechen für geringe Latenz
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        utterance.rate = 1.15; // Dynamisches Tempo für Sportkommentar
        utterance.pitch = 1.0;

        const orb = document.getElementById('ai-orb');

        utterance.onstart = () => {
            if (orb) {
                orb.style.animationDuration = '1.2s, 2s'; // Schnelleres Pulsieren beim Sprechen
                orb.style.transform = 'scale(1.15)';
            }
        };

        utterance.onend = () => {
            if (orb) {
                orb.style.animationDuration = '4s, 6s'; // Normale Animation nach dem Sprechen
                orb.style.transform = 'scale(1)';
            }
        };

        utterance.onerror = () => {
            if (orb) {
                orb.style.animationDuration = '4s, 6s';
                orb.style.transform = 'scale(1)';
            }
        };

        this.synth.speak(utterance);
    }
}

// Instanziierung
const commentator = new TableTennisCommentator();
