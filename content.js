class Piece {
  constructor(type, color, square) {
    this.type = type;  // 'p', 'n', 'b', 'r', 'q', 'k'
    this.color = color;  // 'w' ou 'b'
    this.square = square;  // 'a1' à 'h8'
  }
}

class ChessAnalyzer {
  constructor() {
    this.pieces = [];
    this.initializePieces();
    this.currentAnalysis = null;
    this.analysisCallback = null;
  }

  initializePieces() {
    const pieces = document.querySelectorAll('.piece');
    pieces.forEach(piece => {
      const classes = piece.className.split(' ');
      const typeClass = classes.find(c => /^[bw][prnbqk]$/.test(c));
      const squareClass = classes.find(c => c.startsWith('square-'));
      if (typeClass && squareClass) {
        const color = typeClass[0];
        const type = typeClass[1];
        const square = this.convertSquareNotation(squareClass.replace('square-', ''));
        this.pieces.push(new Piece(type, color, square));
      }
    });
  }

  convertSquareNotation(numNotation) {
    const file = String.fromCharCode(96 + parseInt(numNotation[0]));
    const rank = numNotation[1];
    return file + rank;
  }

  getFEN() {
    let fen = '';
    const board = Array(8).fill().map(() => Array(8).fill(null));
    
    this.pieces.forEach(piece => {
      const file = piece.square.charCodeAt(0) - 97;
      const rank = 8 - parseInt(piece.square[1]);
      const pieceChar = piece.type.toUpperCase();
      board[rank][file] = piece.color === 'w' ? pieceChar : pieceChar.toLowerCase();
    });

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

    fen += ' w KQkq - 0 1';
    return fen;
  }

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

  analyzePosition(callback) {
    const fen = this.getFEN();
    analyzeWithStockfish(fen, (result) => {
      if (!result) {
        callback({ evaluation: 0, pieces: this.pieces });
        return;
      }
      let evaluation = 0;
      const lines = result.split('\n');
      let lastScoreLine = lines.reverse().find(line => line.includes('score'));
      if (!lastScoreLine) lastScoreLine = result;
      const evalMatch = lastScoreLine.match(/score (cp|mate) (-?\\d+)/);
      if (evalMatch) {
        const type = evalMatch[1];
        const value = parseInt(evalMatch[2]);
        evaluation = type === 'cp' ? value / 100 : (value > 0 ? 100 : -100);
      }
      callback({
        evaluation: evaluation,
        pieces: this.pieces.map(piece => ({
          type: piece.type,
          color: piece.color,
          square: piece.square
        }))
      });
    });
  }
}

function evaluateMoveQuality(evaluation) {
  const evalValue = parseFloat(evaluation);
  let quality = '';
  let explanation = '';
  let tacticalElements = [];
  let strategicElements = [];

  if (Math.abs(evalValue) > 3) {
    tacticalElements.push('Avantage tactique décisif');
  } else if (Math.abs(evalValue) > 2) {
    tacticalElements.push('Avantage tactique significatif');
  }

  if (Math.abs(evalValue) > 1.5) {
    strategicElements.push('Avantage positionnel important');
  }

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
  } else if (evalValue < 0) {
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

function analyzeWithStockfish(fen, callback) {
  chrome.runtime.sendMessage(
    { action: "analyzeWithStockfish", command: "position fen " + fen },
    (response) => {
      if (response && response.result) {
        callback(response.result);
      } else {
        callback(null);
      }
    }
  );
}

let stockfishWorker = null;
let pendingResponses = {};

function getWorker() {
  if (!stockfishWorker) {
    stockfishWorker = new Worker(chrome.runtime.getURL('stockfish.js'));
  }
  return stockfishWorker;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeWithStockfish") {
    const worker = getWorker();
    const command = request.command;
    const onMessage = (event) => {
      sendResponse({ result: event.data });
      worker.removeEventListener('message', onMessage);
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage(command);
    return true; // réponse asynchrone
  }

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
      nextMoveButton.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (!tabs[0]) {
            updateStatus("Aucun onglet actif trouvé", true);
            return;
          }

          chrome.tabs.sendMessage(tabs[0].id, {action: "clickNextMove"}, function(response) {
            if (chrome.runtime.lastError) {
              updateStatus("Erreur de communication avec la page", true);
              return;
            }

            if (response && response.status) {
              updateStatus("Coup joué, analyse en cours...");
            } else {
              updateStatus(response?.message || "Erreur lors du coup", true);
            }
          });
        });
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

  if (request.action === "moveAnalyzed") {
    updateStatus("Analyse du coup terminée");
    if (request.analysis) {
      showAnalysis(request.analysis);
    }
  }
});

let lastSentAnalysis = null;

function observeBoardChanges() {
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' && mutation.target.classList.contains('board')) {
        const analyzer = new ChessAnalyzer();
        analyzer.analyzePosition(function(analysis) {
          lastSentAnalysis = analysis;
          chrome.runtime.sendMessage({
            action: "moveAnalyzed",
            analysis: analysis
          });
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

observeBoardChanges();

chrome.runtime.sendMessage(
  { action: "analyzeWithStockfish", command: "position fen ..." },
  (response) => {
    // Utilise response.result ici
  }
);

const analyzer = new ChessAnalyzer();
analyzer.analyzePosition(function(analysis) {
  // analysis.evaluation contient l'évaluation Stockfish
  // analysis.pieces contient les pièces
  // Tu peux ensuite afficher le résultat dans ton popup ou ailleurs
});

function analyzeCurrentPosition() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0] || !tabs[0].url.includes("chess.com")) {
      updateStatus("Ouvre une partie sur chess.com pour utiliser l'extension.", true);
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {action: "analyzePosition"}, function(response) {
      if (chrome.runtime.lastError) {
        updateStatus("Impossible de communiquer avec la page. Es-tu bien sur une partie chess.com ?", true);
        return;
      }

      if (response && response.status) {
        updateStatus(response.message);
        if (response.analysis) {
          showAnalysis(response.analysis);
        }
      } else {
        updateStatus(response?.message || "Erreur lors de l'analyse", true);
      }
    });
  });
}