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

  // Analyse la position actuelle
  analyzePosition() {
    const analysis = {
      material: this.calculateMaterial(),
      development: this.assessDevelopment(),
      kingSafety: this.assessKingSafety(),
      pawnStructure: this.assessPawnStructure()
    };

    return {
      evaluation: this.calculateEvaluation(analysis),
      pieces: this.pieces.map(piece => ({
        type: piece.type,
        color: piece.color,
        square: piece.square
      }))
    };
  }

  // Calcule l'avantage matériel
  calculateMaterial() {
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let whiteMaterial = 0;
    let blackMaterial = 0;

    this.pieces.forEach(piece => {
      const value = values[piece.type];
      if (piece.color === 'w') {
        whiteMaterial += value;
      } else {
        blackMaterial += value;
      }
    });

    return whiteMaterial - blackMaterial;
  }

  // Évalue le développement des pièces
  assessDevelopment() {
    let whiteDevelopment = 0;
    let blackDevelopment = 0;

    this.pieces.forEach(piece => {
      if (piece.type !== 'p' && piece.type !== 'k') {
        const rank = parseInt(piece.square[1]);
        const development = piece.color === 'w' ? rank - 1 : 8 - rank;
        if (piece.color === 'w') {
          whiteDevelopment += development;
        } else {
          blackDevelopment += development;
        }
      }
    });

    return whiteDevelopment - blackDevelopment;
  }

  // Évalue la sécurité du roi
  assessKingSafety() {
    const whiteKing = this.pieces.find(p => p.type === 'k' && p.color === 'w');
    const blackKing = this.pieces.find(p => p.type === 'k' && p.color === 'b');
    
    let whiteSafety = 0;
    let blackSafety = 0;

    if (whiteKing) {
      whiteSafety = this.calculateKingSafety(whiteKing);
    }
    if (blackKing) {
      blackSafety = this.calculateKingSafety(blackKing);
    }

    return whiteSafety - blackSafety;
  }

  // Calcule la sécurité du roi
  calculateKingSafety(king) {
    const rank = parseInt(king.square[1]);
    const file = king.square.charCodeAt(0) - 97;
    
    if (rank === 1 && file === 4) return -2;
    if (rank === 1 && (file === 6 || file === 2)) return 2;
    
    return 0;
  }

  // Évalue la structure de pions
  assessPawnStructure() {
    let whitePawns = this.pieces.filter(p => p.type === 'p' && p.color === 'w');
    let blackPawns = this.pieces.filter(p => p.type === 'p' && p.color === 'b');
    
    return {
      white: this.evaluatePawnStructure(whitePawns),
      black: this.evaluatePawnStructure(blackPawns)
    };
  }

  // Évalue la structure de pions d'une couleur
  evaluatePawnStructure(pawns) {
    let score = 0;
    const files = new Set(pawns.map(p => p.square[0]));
    
    score -= (pawns.length - files.size) * 0.5;
    
    pawns.forEach(pawn => {
      const file = pawn.square[0];
      const hasAdjacentPawn = pawns.some(p => 
        Math.abs(p.square.charCodeAt(0) - file.charCodeAt(0)) === 1
      );
      if (!hasAdjacentPawn) score -= 0.5;
    });
    
    return score;
  }

  // Calcule l'évaluation globale
  calculateEvaluation(analysis) {
    const materialScore = analysis.material;
    const developmentScore = analysis.development * 0.1;
    const kingSafetyScore = analysis.kingSafety * 0.5;
    const pawnStructureScore = (analysis.pawnStructure.white - analysis.pawnStructure.black) * 0.3;
    
    return (materialScore + developmentScore + kingSafetyScore + pawnStructureScore).toFixed(2);
  }
}

// Initialisation de Stockfish et chess.js
let stockfish = null;
let chess = new Chess();

// Fonction pour initialiser Stockfish
function initStockfish() {
  if (!stockfish) {
    stockfish = new Worker('stockfish.js');
    stockfish.postMessage('uci');
    stockfish.postMessage('setoption name MultiPV value 1');
    stockfish.postMessage('setoption name Skill Level value 20');
  }
}

// Fonction pour analyser une position avec Stockfish
function analyzePositionWithStockfish(fen, depth = 20) {
  return new Promise((resolve) => {
    let bestMove = null;
    let evaluation = 0;

    stockfish.onmessage = function(event) {
      const message = event.data;
      
      if (message.includes('bestmove')) {
        const move = message.split(' ')[1];
        resolve({
          bestMove: move,
          evaluation: evaluation
        });
      } else if (message.includes('cp ')) {
        // Extraction de l'évaluation en centipawns
        const cpMatch = message.match(/cp (-?\d+)/);
        if (cpMatch) {
          evaluation = parseInt(cpMatch[1]) / 100;
        }
      }
    };

    chess.load(fen);
    stockfish.postMessage('position fen ' + fen);
    stockfish.postMessage('go depth ' + depth);
  });
}

// Fonction améliorée pour évaluer la qualité du coup
async function evaluateMoveQuality(evaluation, fen, move) {
  const analysis = await analyzePositionWithStockfish(fen);
  const evalValue = analysis.evaluation;
  
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
  const position = chess.position();
  const pieceCount = Object.keys(position).length;
  const pawnCount = Object.values(position).filter(p => p.type === 'p').length;
  
  if (pieceCount < 10) {
    strategicElements.push('Finale');
  } else if (pawnCount < 8) {
    strategicElements.push('Middlegame avancé');
  } else {
    strategicElements.push('Middlegame');
  }

  // Évaluation détaillée
  if (evalValue > 0) {
    if (evalValue > 3) {
      quality = 'Coup brillant';
      explanation = `Ce coup donne un avantage décisif aux blancs (${evalValue.toFixed(2)}). `;
    } else if (evalValue > 2) {
      quality = 'Excellent coup';
      explanation = `Ce coup donne un avantage significatif aux blancs (${evalValue.toFixed(2)}). `;
    } else if (evalValue > 1) {
      quality = 'Bon coup';
      explanation = `Ce coup donne un avantage modéré aux blancs (${evalValue.toFixed(2)}). `;
    } else if (evalValue > 0.5) {
      quality = 'Coup correct';
      explanation = `Ce coup donne un petit avantage aux blancs (${evalValue.toFixed(2)}). `;
    } else {
      quality = 'Coup théorique';
      explanation = `Ce coup maintient l'équilibre (${evalValue.toFixed(2)}). `;
    }
  } else {
    if (evalValue < -3) {
      quality = 'Coup faible';
      explanation = `Ce coup donne un avantage décisif aux noirs (${Math.abs(evalValue).toFixed(2)}). `;
    } else if (evalValue < -2) {
      quality = 'Coup médiocre';
      explanation = `Ce coup donne un avantage significatif aux noirs (${Math.abs(evalValue).toFixed(2)}). `;
    } else if (evalValue < -1) {
      quality = 'Coup douteux';
      explanation = `Ce coup donne un avantage modéré aux noirs (${Math.abs(evalValue).toFixed(2)}). `;
    } else if (evalValue < -0.5) {
      quality = 'Coup passable';
      explanation = `Ce coup donne un petit avantage aux noirs (${Math.abs(evalValue).toFixed(2)}). `;
    } else {
      quality = 'Coup théorique';
      explanation = `Ce coup maintient l'équilibre (${Math.abs(evalValue).toFixed(2)}). `;
    }
  }

  // Ajout des éléments tactiques et stratégiques
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
    strategicElements,
    bestMove: analysis.bestMove
  };
}

// Fonction pour obtenir la notation FEN de la position actuelle
function getCurrentFEN() {
  const pieces = document.querySelectorAll('.piece');
  let fen = '';
  let emptySquares = 0;
  
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = String.fromCharCode(97 + file) + rank;
      const piece = Array.from(pieces).find(p => p.classList.contains(`square-${file + 1}${rank}`));
      
      if (piece) {
        if (emptySquares > 0) {
          fen += emptySquares;
          emptySquares = 0;
        }
        const pieceClass = Array.from(piece.classList).find(c => /^[bw][prnbqk]$/.test(c));
        if (pieceClass) {
          const color = pieceClass[0] === 'w' ? '' : pieceClass[0].toUpperCase();
          const type = pieceClass[1].toUpperCase();
          fen += color + type;
        }
      } else {
        emptySquares++;
      }
    }
    
    if (emptySquares > 0) {
      fen += emptySquares;
      emptySquares = 0;
    }
    if (rank > 1) fen += '/';
  }
  
  return fen + ' w KQkq - 0 1';
}

// Initialiser Stockfish au chargement
initStockfish();

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
      const evaluation = evaluateMoveQuality(parseFloat(whiteMove.getAttribute('data-eval') || '0'), getCurrentFEN(), moveText);
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
      const evaluation = evaluateMoveQuality(parseFloat(blackMove.getAttribute('data-eval') || '0'), getCurrentFEN(), moveText);
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
    const analyzer = new ChessAnalyzer();
    const analysis = analyzer.analyzePosition();
    const moveEvaluation = evaluateMoveQuality(analysis.evaluation, getCurrentFEN(), '');
    
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