// Classe pour représenter une pièce d'échecs
class Piece {
  constructor(type, color, square) {
    this.type = type;  // 'p', 'n', 'b', 'r', 'q', 'k'
    this.color = color;  // 'w' ou 'b'
    this.square = square;  // 'a1' à 'h8'
  }
}

// Classe pour analyser la position
class ChessAnalyzer {
  constructor() {
    this.pieces = [];
    this.initializePieces();
    this.stockfish = null;
    this.initializeStockfish();
    this.currentAnalysis = null;
    this.analysisCallback = null;
  }

  initializeStockfish() {
    try {
      this.stockfish = new Worker(chrome.runtime.getURL('stockfish.js'));
      this.stockfish.onmessage = this.handleStockfishMessage.bind(this);
      this.stockfish.postMessage('uci');
      this.stockfish.postMessage('setoption name MultiPV value 1');
      this.stockfish.postMessage('setoption name Threads value 4');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de Stockfish:', error);
    }
  }

  // Initialise les pièces à partir de l'échiquier
  initializePieces() {
    const pieces = document.querySelectorAll('.piece');
    pieces.forEach(piece => {
      const classes = piece.className.split(' ');
      // Chercher la classe du type de pièce (ex: br, wn, etc.)
      const typeClass = classes.find(c => /^[bw][prnbqk]$/.test(c));
      // Chercher la classe de la case (ex: square-88)
      const squareClass = classes.find(c => c.startsWith('square-'));
      if (typeClass && squareClass) {
        const color = typeClass[0];
        const type = typeClass[1];
        const square = this.convertSquareNotation(squareClass.replace('square-', ''));
        this.pieces.push(new Piece(type, color, square));
      }
    });
  }

  // Convertit la notation numérique en notation algébrique
  convertSquareNotation(numNotation) {
    const file = String.fromCharCode(96 + parseInt(numNotation[0]));
    const rank = numNotation[1];
    return file + rank;
  }

  // Convertit la position en notation FEN
  getFEN() {
    let fen = '';
    const board = Array(8).fill().map(() => Array(8).fill(null));
    
    // Placer les pièces sur le plateau
    this.pieces.forEach(piece => {
      const file = piece.square.charCodeAt(0) - 97;
      const rank = 8 - parseInt(piece.square[1]);
      const pieceChar = piece.type.toUpperCase();
      board[rank][file] = piece.color === 'w' ? pieceChar : pieceChar.toLowerCase();
    });

    // Convertir en FEN
    for (let rank = 0; rank < 8; rank++) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece === null) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += piece;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (rank < 7) fen += '/';
    }

    // Ajouter les autres informations FEN (tour, roque, etc.)
    fen += ' w KQkq - 0 1';
    return fen;
  }

  // Gère les messages de Stockfish
  handleStockfishMessage(event) {
    const message = event.data;
    if (message.startsWith('info depth')) {
      const evalMatch = message.match(/score (cp|mate) (-?\d+)/);
      if (evalMatch) {
        const type = evalMatch[1];
        const value = parseInt(evalMatch[2]);
        const evaluation = type === 'cp' ? value / 100 : (value > 0 ? 100 : -100);
        
        if (this.analysisCallback) {
          this.analysisCallback({
            evaluation: evaluation,
            pieces: this.pieces.map(piece => ({
              type: piece.type,
              color: piece.color,
              square: piece.square
            }))
          });
        }
      }
    }
  }

  // Analyse la position actuelle
  analyzePosition(callback) {
    if (!this.stockfish) {
      console.error('Stockfish n\'est pas initialisé');
      callback({
        evaluation: 0,
        pieces: this.pieces.map(piece => ({
          type: piece.type,
          color: piece.color,
          square: piece.square
        }))
      });
      return;
    }

    this.analysisCallback = callback;
    const fen = this.getFEN();
    this.stockfish.postMessage('position fen ' + fen);
    this.stockfish.postMessage('go depth 15');
  }
}

// Fonction pour évaluer la qualité du coup
function evaluateMoveQuality(evaluation) {
  const evalValue = parseFloat(evaluation);
  let quality = '';
  let explanation = '';
  let tacticalElements = [];
  let strategicElements = [];

  // Analyse tactique
  if (Math.abs(evalValue) > 3) {
    tacticalElements.push('Avantage tactique décisif');
  } else if (Math.abs(evalValue) > 2) {
    tacticalElements.push('Avantage tactique significatif');
  }

  // Analyse stratégique
  if (Math.abs(evalValue) > 1.5) {
    strategicElements.push('Avantage positionnel important');
  }

  // Évaluation détaillée pour les blancs
  if (evalValue > 0) {
    if (evalValue > 3) {
      quality = 'Coup brillant';
      explanation = 'Ce coup donne un avantage décisif aux blancs. ';
      if (tacticalElements.length > 0) {
        explanation += 'Les blancs ont un avantage tactique écrasant. ';
      }
      if (strategicElements.length > 0) {
        explanation += 'La position est stratégiquement dominante. ';
      }
      explanation += 'Les noirs sont dans une position très difficile.';
    } else if (evalValue > 2) {
      quality = 'Excellent coup';
      explanation = 'Ce coup donne un avantage significatif aux blancs. ';
      if (tacticalElements.length > 0) {
        explanation += 'Les blancs ont un avantage tactique clair. ';
      }
      if (strategicElements.length > 0) {
        explanation += 'La position est stratégiquement favorable. ';
      }
      explanation += 'Les noirs doivent jouer avec précision pour maintenir l\'équilibre.';
    } else if (evalValue > 1) {
      quality = 'Bon coup';
      explanation = 'Ce coup donne un avantage modéré aux blancs. ';
      if (tacticalElements.length > 0) {
        explanation += 'Les blancs ont un petit avantage tactique. ';
      }
      if (strategicElements.length > 0) {
        explanation += 'La position est légèrement favorable. ';
      }
      explanation += 'Les noirs peuvent encore défendre avec précision.';
    } else if (evalValue > 0.5) {
      quality = 'Coup correct';
      explanation = 'Ce coup donne un petit avantage aux blancs. ';
      explanation += 'La position est légèrement favorable, mais les noirs peuvent facilement maintenir l\'équilibre.';
    } else if (evalValue > 0.2) {
      quality = 'Coup théorique';
      explanation = 'Ce coup maintient un léger avantage pour les blancs. ';
      explanation += 'La position est équilibrée avec une petite initiative blanche.';
    }
  }
  // Évaluation détaillée pour les noirs
  else if (evalValue < 0) {
    if (evalValue < -3) {
      quality = 'Coup faible';
      explanation = 'Ce coup donne un avantage décisif aux noirs. ';
      if (tacticalElements.length > 0) {
        explanation += 'Les blancs sont dans une position tactiquement désespérée. ';
      }
      if (strategicElements.length > 0) {
        explanation += 'La position est stratégiquement perdue. ';
      }
      explanation += 'Les blancs sont dans une position très difficile.';
    } else if (evalValue < -2) {
      quality = 'Coup médiocre';
      explanation = 'Ce coup donne un avantage significatif aux noirs. ';
      if (tacticalElements.length > 0) {
        explanation += 'Les blancs ont une position tactiquement faible. ';
      }
      if (strategicElements.length > 0) {
        explanation += 'La position est stratégiquement défavorable. ';
      }
      explanation += 'Les blancs doivent jouer avec précision pour maintenir l\'équilibre.';
    } else if (evalValue < -1) {
      quality = 'Coup douteux';
      explanation = 'Ce coup donne un avantage modéré aux noirs. ';
      if (tacticalElements.length > 0) {
        explanation += 'Les blancs ont une position tactiquement difficile. ';
      }
      if (strategicElements.length > 0) {
        explanation += 'La position est stratégiquement désavantageuse. ';
      }
      explanation += 'Les blancs peuvent encore défendre avec précision.';
    } else if (evalValue < -0.5) {
      quality = 'Coup passable';
      explanation = 'Ce coup donne un petit avantage aux noirs. ';
      explanation += 'La position est légèrement défavorable, mais les blancs peuvent facilement maintenir l\'équilibre.';
    } else if (evalValue < -0.2) {
      quality = 'Coup théorique';
      explanation = 'Ce coup maintient un léger désavantage pour les blancs. ';
      explanation += 'La position est équilibrée avec une petite initiative noire.';
    }
  } else {
    quality = 'Coup théorique';
    explanation = 'Ce coup maintient l\'équilibre parfait de la position. ';
    explanation += 'Aucun camp n\'a d\'avantage significatif.';
  }

  // Ajout d'éléments tactiques et stratégiques à l'explication
  if (tacticalElements.length > 0) {
    explanation += '\n\nÉléments tactiques : ' + tacticalElements.join(', ');
  }
  if (strategicElements.length > 0) {
    explanation += '\n\nÉléments stratégiques : ' + strategicElements.join(', ');
  }

  return {
    quality,
    explanation,
    evaluation: evalValue,
    tacticalElements,
    strategicElements
  };
}

// Fonction pour analyser les statistiques des coups
function analyzeGameStats() {
  const moveList = document.querySelector('.analysis-view-movelist');
  if (!moveList) {
    return {
      status: false,
      message: "Liste des coups non trouvée"
    };
  }

  const moves = [];
  const moveRows = moveList.querySelectorAll('.main-line-row');
  
  moveRows.forEach(row => {
    const moveNumber = row.getAttribute('data-whole-move-number');
    const whiteMove = row.querySelector('.white-move');
    const blackMove = row.querySelector('.black-move');
    
    if (whiteMove) {
      const moveText = whiteMove.textContent.trim();
      const evaluation = evaluateMoveQuality(parseFloat(whiteMove.getAttribute('data-eval') || '0'));
      moves.push({
        number: moveNumber,
        color: 'white',
        move: moveText,
        quality: evaluation.quality,
        explanation: evaluation.explanation
      });
    }
    
    if (blackMove) {
      const moveText = blackMove.textContent.trim();
      const evaluation = evaluateMoveQuality(parseFloat(blackMove.getAttribute('data-eval') || '0'));
      moves.push({
        number: moveNumber,
        color: 'black',
        move: moveText,
        quality: evaluation.quality,
        explanation: evaluation.explanation
      });
    }
  });

  return {
    status: true,
    message: "Statistiques analysées avec succès",
    stats: {
      totalMoves: moves.length,
      moves: moves,
      whiteGoodMoves: moves.filter(m => m.color === 'white' && m.quality.includes('bon')).length,
      blackGoodMoves: moves.filter(m => m.color === 'black' && m.quality.includes('bon')).length,
      whiteExcellentMoves: moves.filter(m => m.color === 'white' && m.quality.includes('excellent')).length,
      blackExcellentMoves: moves.filter(m => m.color === 'black' && m.quality.includes('excellent')).length
    }
  };
}

// Gestionnaire de messages pour l'extension
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "analyzePosition") {
    try {
      const analyzer = new ChessAnalyzer();
      analyzer.analyzePosition(function(analysis) {
        const moveEvaluation = evaluateMoveQuality(analysis.evaluation);
        sendResponse({
          status: true,
          message: "Analyse terminée",
          analysis: {
            evaluation: analysis.evaluation,
            pieces: analysis.pieces,
            moveQuality: moveEvaluation.quality,
            moveExplanation: moveEvaluation.explanation
          }
        });
      });
    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
      sendResponse({
        status: false,
        message: "Erreur lors de l'analyse: " + error.message
      });
    }
    return true;
  }
  
  if (request.action === "clickNextMove") {
    const nextMoveButton = document.querySelector('button.cc-button-component[aria-label="Coup suivant"]');
    if (nextMoveButton) {
      nextMoveButton.click();
      sendResponse({
        status: true,
        message: "Coup joué avec succès"
      });
    } else {
      sendResponse({
        status: false,
        message: "Bouton 'Coup suivant' non trouvé"
      });
    }
    return true;
  }

  if (request.action === "showStats") {
    const stats = analyzeGameStats();
    sendResponse(stats);
    return true;
  }
});

// Observer les changements sur l'échiquier
function observeBoardChanges() {
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' && mutation.target.classList.contains('board')) {
        const analyzer = new ChessAnalyzer();
        const analysis = analyzer.analyzePosition();
        
        chrome.runtime.sendMessage({
          action: "positionUpdated",
          analysis: {
            evaluation: analysis.evaluation,
            pieces: analysis.pieces
          }
        });
      }
    });
  });

  const board = document.querySelector('.board');
  if (board) {
    observer.observe(board, {
      childList: true,
      subtree: true
    });
  }
}

// Démarrer l'observation
observeBoardChanges();