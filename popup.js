document.addEventListener('DOMContentLoaded', function() {
  const showStatsButton = document.getElementById('showStats');
  const suggestMoveButton = document.getElementById('suggestMove');
  const nextMoveButton = document.getElementById('nextMove');
  const statusDiv = document.getElementById('status');
  const analysisPanel = document.getElementById('analysisPanel');
  const evaluationDiv = document.getElementById('evaluation');
  const miniBoard = document.getElementById('miniBoard');

  // Créer le mini-échiquier
  function createMiniBoard() {
    miniBoard.innerHTML = '';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = document.createElement('div');
        square.className = `mini-square ${(rank + file) % 2 === 0 ? 'white' : 'black'}`;
        square.style.left = `${file * 12.5}%`;
        square.style.top = `${rank * 12.5}%`;
        square.dataset.square = files[file] + ranks[rank];
        
        // Ajouter les coordonnées
        if (file === 0) {
          const rankCoord = document.createElement('span');
          rankCoord.className = 'coordinates coordinate-rank';
          rankCoord.textContent = ranks[rank];
          square.appendChild(rankCoord);
        }
        if (rank === 7) {
          const fileCoord = document.createElement('span');
          fileCoord.className = 'coordinates coordinate-file';
          fileCoord.textContent = files[file];
          square.appendChild(fileCoord);
        }
        
        miniBoard.appendChild(square);
      }
    }
  }

  // Mettre à jour le mini-échiquier avec les pièces
  function updateMiniBoard(pieces) {
    // Supprimer toutes les pièces existantes
    const existingPieces = miniBoard.querySelectorAll('.piece');
    existingPieces.forEach(piece => piece.remove());

    // Placer les nouvelles pièces
    pieces.forEach(piece => {
      const file = piece.square[0].charCodeAt(0) - 'a'.charCodeAt(0);
      const rank = 8 - parseInt(piece.square[1]);

      const pieceElement = document.createElement('div');
      pieceElement.className = `piece ${piece.color}${piece.type}`;
      pieceElement.style.position = 'absolute';
      pieceElement.style.width = '12.5%';
      pieceElement.style.height = '12.5%';
      pieceElement.style.left = `${file * 12.5}%`;
      pieceElement.style.top = `${rank * 12.5}%`;
      pieceElement.style.zIndex = '2';
      pieceElement.style.backgroundSize = '100% 100%';
      pieceElement.style.backgroundRepeat = 'no-repeat';
      pieceElement.style.backgroundPosition = 'center';

      // Utiliser chrome.runtime.getURL pour obtenir le chemin correct
      const imagePath = chrome.runtime.getURL(`images/${piece.color}${piece.type}.png`);
      pieceElement.style.backgroundImage = `url('${imagePath}')`;

      miniBoard.appendChild(pieceElement);
    });
  }

  function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? '#ff4444' : '#ffffff';
  }

  function showAnalysis(analysis) {
    analysisPanel.style.display = 'block';
    
    // Afficher l'évaluation
    evaluationDiv.textContent = `Évaluation: ${analysis.evaluation}`;
    
    // Afficher la qualité du coup
    const moveQualityDiv = document.getElementById('moveQuality');
    moveQualityDiv.textContent = analysis.moveQuality;
    
    // Afficher l'explication
    const moveExplanationDiv = document.getElementById('moveExplanation');
    moveExplanationDiv.textContent = analysis.moveExplanation;
    
    // Mettre à jour le mini-échiquier
    if (analysis.pieces) {
      updateMiniBoard(analysis.pieces);
    }
  }

  // Créer le mini-échiquier au chargement
  createMiniBoard();

  // Analyser automatiquement la position au chargement
  function analyzeCurrentPosition() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        updateStatus("Aucun onglet actif trouvé", true);
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, {action: "analyzePosition"}, function(response) {
        if (chrome.runtime.lastError) {
          updateStatus("Erreur de communication avec la page", true);
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

  // Lancer l'analyse initiale
  analyzeCurrentPosition();

  // Écouter les messages d'analyse des coups
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "moveAnalyzed") {
      updateStatus("Analyse du coup terminée");
      if (request.analysis) {
        showAnalysis(request.analysis);
      }
    }
  });

  function showStats() {
    const statsButton = document.getElementById('showStats');
    if (!statsButton) return;

    statsButton.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
          updateStatus("Aucun onglet actif trouvé", true);
          return;
        }

        chrome.tabs.sendMessage(tab.id, { action: "showStats" }, function(response) {
          if (chrome.runtime.lastError) {
            updateStatus("Erreur de communication avec la page", true);
            return;
          }

          if (response && response.status) {
            const stats = response.stats;
            const statsDiv = document.getElementById('stats');
            statsDiv.innerHTML = `
              <div class="stats-summary">
                <h3>Résumé de la partie</h3>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-label">Total des coups</span>
                    <span class="stat-value">${stats.totalMoves}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Bons coups blancs</span>
                    <span class="stat-value">${stats.whiteGoodMoves}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Bons coups noirs</span>
                    <span class="stat-value">${stats.blackGoodMoves}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Coups excellents blancs</span>
                    <span class="stat-value">${stats.whiteExcellentMoves}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Coups excellents noirs</span>
                    <span class="stat-value">${stats.blackExcellentMoves}</span>
                  </div>
                </div>
              </div>
              <div class="moves-table">
                <h3>Analyse détaillée des coups</h3>
                <table>
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Couleur</th>
                      <th>Coup</th>
                      <th>Qualité</th>
                      <th>Explication</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${stats.moves.map(move => `
                      <tr class="${move.color}">
                        <td>${move.number}</td>
                        <td>${move.color === 'white' ? 'Blancs' : 'Noirs'}</td>
                        <td>${move.move}</td>
                        <td>${move.quality}</td>
                        <td>${move.explanation}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          } else {
            document.getElementById('stats').innerHTML = `
              <div class="error-message">
                Impossible d'analyser les statistiques. Assurez-vous d'être sur une partie d'échecs.
              </div>
            `;
          }
        });
      } catch (error) {
        updateStatus("Erreur lors de l'analyse des statistiques", true);
      }
    });
  }

  // Appeler la fonction showStats lors du chargement
  showStats();

  suggestMoveButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        updateStatus("Aucun onglet actif trouvé", true);
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, {action: "suggestMove"}, function(response) {
        if (chrome.runtime.lastError) {
          updateStatus("Erreur de communication avec la page", true);
          return;
        }

        if (response && response.status) {
          updateStatus(response.message);
          if (response.suggestion) {
            showAnalysis({
              evaluation: response.suggestion.evaluation,
              pieces: response.suggestion.pieces
            });
          }
        } else {
          updateStatus(response?.message || "Erreur lors de la suggestion de coup", true);
        }
      });
    });
  });

  // Gestionnaire pour le bouton "Jouer le coup suivant"
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
          updateStatus("Coup joué avec succès");
          setTimeout(() => {
            chrome.tabs.sendMessage(tabs[0].id, {action: "analyzePosition"}, function(analysisResponse) {
              if (chrome.runtime.lastError) {
                updateStatus("Erreur lors de l'analyse", true);
                return;
              }

              if (analysisResponse && analysisResponse.status) {
                updateStatus("Analyse terminée");
                if (analysisResponse.analysis) {
                  showAnalysis(analysisResponse.analysis);
                }
              }
            });
          }, 1000);
        } else {
          updateStatus(response?.message || "Erreur lors du coup", true);
        }
      });
    });
  });
}); 