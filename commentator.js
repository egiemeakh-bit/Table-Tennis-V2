/**
 * Table Tennis Game Commentator
 * AI-powered commentary system for real-time game analysis
 * Enhanced with improved score state understanding and error handling
 */

const PuterAI = require('puter-ai');

class TableTennisCommentator {
  constructor(options = {}) {
    // Initialize with fastest puter.ai model configuration
    this.aiModel = options.aiModel || 'gpt-4-turbo-preview';
    this.maxTokens = options.maxTokens || 150;
    this.temperature = options.temperature || 0.7;
    this.responseTimeout = options.responseTimeout || 5000; // 5 second timeout
    
    // Game state tracking
    this.gameState = {
      player1Score: 0,
      player2Score: 0,
      sets: [0, 0],
      currentSet: 1,
      isGameActive: false,
      lastPlay: null,
      momentum: { player1: 0, player2: 0 }
    };
    
    // Error tracking and recovery
    this.errorLog = [];
    this.maxErrors = 5;
    this.isHealthy = true;
    
    // Initialize AI client with error handling
    this.initializeAI();
  }

  /**
   * Initialize AI client with retry logic
   */
  initializeAI() {
    try {
      this.puterAI = new PuterAI({
        model: this.aiModel,
        apiKey: process.env.PUTER_AI_KEY,
        timeout: this.responseTimeout
      });
    } catch (error) {
      console.error('[Commentator] Failed to initialize AI client:', error.message);
      this.logError('AI_INIT_FAILED', error);
      this.isHealthy = false;
    }
  }

  /**
   * Update game score with validation and state tracking
   * @param {number} player - Player number (1 or 2)
   * @param {number} points - Points scored
   */
  updateScore(player, points) {
    try {
      if (!this.validateScoreInput(player, points)) {
        throw new Error(`Invalid score input: player=${player}, points=${points}`);
      }

      const previousScore = this.getGameState();
      
      if (player === 1) {
        this.gameState.player1Score += points;
      } else if (player === 2) {
        this.gameState.player2Score += points;
      }

      // Check for set win
      this.checkSetCompletion();
      
      // Update momentum
      this.updateMomentum(player);
      
      // Log the change
      this.lastStateChange = {
        timestamp: Date.now(),
        previousState: previousScore,
        newState: this.getGameState(),
        action: 'score_update'
      };

      return true;
    } catch (error) {
      console.error('[Commentator] Error updating score:', error.message);
      this.logError('SCORE_UPDATE_ERROR', error);
      return false;
    }
  }

  /**
   * Validate score input parameters
   * @param {number} player - Player number
   * @param {number} points - Points to add
   */
  validateScoreInput(player, points) {
    if (![1, 2].includes(player)) {
      return false;
    }
    if (!Number.isInteger(points) || points < 0 || points > 5) {
      return false;
    }
    return true;
  }

  /**
   * Check if a set is complete and update accordingly
   */
  checkSetCompletion() {
    const { player1Score, player2Score } = this.gameState;
    const minPoints = 11;
    const leadRequired = 2;

    if (player1Score >= minPoints && player1Score - player2Score >= leadRequired) {
      this.completeSet(1);
    } else if (player2Score >= minPoints && player2Score - player1Score >= leadRequired) {
      this.completeSet(2);
    }
  }

  /**
   * Complete a set and update game state
   * @param {number} winner - Player number who won the set
   */
  completeSet(winner) {
    this.gameState.sets[winner - 1]++;
    this.gameState.player1Score = 0;
    this.gameState.player2Score = 0;
    this.gameState.currentSet++;
    
    // Check if match is complete (best of 3)
    if (this.gameState.sets[0] === 2 || this.gameState.sets[1] === 2) {
      this.gameState.isGameActive = false;
    }
  }

  /**
   * Update player momentum based on recent plays
   * @param {number} player - Player number who scored
   */
  updateMomentum(player) {
    const momentumGain = 1.5;
    const momentumDecay = 0.9;

    if (player === 1) {
      this.gameState.momentum.player1 = (this.gameState.momentum.player1 * momentumDecay) + momentumGain;
      this.gameState.momentum.player2 = this.gameState.momentum.player2 * momentumDecay;
    } else {
      this.gameState.momentum.player2 = (this.gameState.momentum.player2 * momentumDecay) + momentumGain;
      this.gameState.momentum.player1 = this.gameState.momentum.player1 * momentumDecay;
    }
  }

  /**
   * Generate AI commentary for current game state
   * @returns {Promise<string>} AI-generated commentary
   */
  async generateCommentary() {
    if (!this.isHealthy) {
      console.warn('[Commentator] AI system is unhealthy, using fallback commentary');
      return this.getFallbackCommentary();
    }

    try {
      const gameContext = this.buildGameContext();
      const prompt = this.constructPrompt(gameContext);

      const response = await Promise.race([
        this.puterAI.generate(prompt, {
          maxTokens: this.maxTokens,
          temperature: this.temperature
        }),
        this.createTimeout(this.responseTimeout)
      ]);

      if (!response || !response.text) {
        throw new Error('Invalid AI response format');
      }

      return response.text.trim();
    } catch (error) {
      console.error('[Commentator] Error generating commentary:', error.message);
      this.logError('COMMENTARY_GENERATION_ERROR', error);
      return this.getFallbackCommentary();
    }
  }

  /**
   * Build comprehensive game context for AI analysis
   */
  buildGameContext() {
    const { player1Score, player2Score, sets, currentSet, momentum } = this.gameState;
    
    return {
      score: `${player1Score}-${player2Score}`,
      sets: `${sets[0]}-${sets[1]}`,
      currentSet: currentSet,
      pointDifference: Math.abs(player1Score - player2Score),
      isSetPoint: this.isSetPoint(),
      isMatchPoint: this.isMatchPoint(),
      leading: player1Score > player2Score ? 'player1' : player2Score > player1Score ? 'player2' : 'tied',
      momentumLeader: momentum.player1 > momentum.player2 ? 'player1' : 'player2',
      momentumDifference: Math.abs(momentum.player1 - momentum.player2).toFixed(2)
    };
  }

  /**
   * Check if current point is a set point
   */
  isSetPoint() {
    const { player1Score, player2Score } = this.gameState;
    const minPoints = 11;
    
    return (player1Score >= minPoints - 1 && player1Score - player2Score >= 1) ||
           (player2Score >= minPoints - 1 && player2Score - player1Score >= 1);
  }

  /**
   * Check if current point is a match point
   */
  isMatchPoint() {
    const { sets, currentSet } = this.gameState;
    return (sets[0] === 1 || sets[1] === 1) && currentSet >= 3 && this.isSetPoint();
  }

  /**
   * Construct optimized prompt for AI analysis
   */
  constructPrompt(gameContext) {
    return `You are an experienced table tennis commentator. Provide a brief, exciting commentary (1-2 sentences) for this moment:

Current Score: ${gameContext.score} in Set ${gameContext.currentSet}
Sets: ${gameContext.sets}
${gameContext.isMatchPoint ? '🔥 MATCH POINT!' : gameContext.isSetPoint ? '⚡ SET POINT!' : ''}
${gameContext.momentumLeader === 'player1' ? 'Player 1 has momentum!' : 'Player 2 has momentum!'}

Commentary:`;
  }

  /**
   * Get fallback commentary when AI is unavailable
   */
  getFallbackCommentary() {
    const context = this.buildGameContext();
    const commentaries = [
      `Great rally! Score is now ${context.score} in set ${context.currentSet}.`,
      `Excellent shot! The match is intensifying at ${context.score}.`,
      `What a play! Current score: ${context.score}.`,
      `The momentum is building! It's ${context.score} in this set.`,
      `Incredible tennis! Score: ${context.score}.`
    ];
    
    return commentaries[Math.floor(Math.random() * commentaries.length)];
  }

  /**
   * Create a timeout promise
   */
  createTimeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI response timeout after ${ms}ms`)), ms)
    );
  }

  /**
   * Get current game state
   */
  getGameState() {
    return {
      ...this.gameState,
      momentum: {
        player1: parseFloat(this.gameState.momentum.player1.toFixed(2)),
        player2: parseFloat(this.gameState.momentum.player2.toFixed(2))
      }
    };
  }

  /**
   * Log errors with tracking
   */
  logError(errorType, error) {
    this.errorLog.push({
      timestamp: Date.now(),
      type: errorType,
      message: error.message,
      stack: error.stack
    });

    // Keep error log size manageable
    if (this.errorLog.length > this.maxErrors) {
      this.errorLog.shift();
    }

    // Mark system as unhealthy if too many errors
    if (this.errorLog.length >= this.maxErrors) {
      this.isHealthy = false;
    }
  }

  /**
   * Reset game state
   */
  resetGame() {
    try {
      this.gameState = {
        player1Score: 0,
        player2Score: 0,
        sets: [0, 0],
        currentSet: 1,
        isGameActive: true,
        lastPlay: null,
        momentum: { player1: 0, player2: 0 }
      };
      return true;
    } catch (error) {
      console.error('[Commentator] Error resetting game:', error.message);
      this.logError('RESET_ERROR', error);
      return false;
    }
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    return {
      isHealthy: this.isHealthy,
      errorCount: this.errorLog.length,
      recentErrors: this.errorLog.slice(-3),
      uptime: process.uptime(),
      gameState: this.getGameState()
    };
  }
}

module.exports = TableTennisCommentator;
