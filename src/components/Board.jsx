// src/components/Board.jsx
import React, { useEffect } from 'react';
import { useTacticalStore } from '../store/useTacticalStore';
import './Board.css';

export function Board() {
  const {
    board, boardSize, initGame, turn, gameStatus, turnPhase, selectedSquare,
    isValidMoveZone, getAvailableTargets, movePieceAction, executeAttack, endTurn
  } = useTacticalStore();

  useEffect(() => { initGame(); }, []);

  const selectedPiece = selectedSquare ? board[selectedSquare] : null;

  // Вычисляем зоны для подсветки, если фигура выбрана
  const validMoves = [];
  let validTargets = [];

  if (selectedSquare && selectedPiece) {
    // Если еще не ходили — можно ходить
    if (turnPhase === 'action' || turnPhase === 'has_attacked') {
      for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
          if (isValidMoveZone(selectedSquare, `${r},${c}`)) validMoves.push(`${r},${c}`);
        }
      }
    }
    // Если еще не атаковали — получаем список врагов в упор
    if (turnPhase === 'action' || turnPhase === 'has_moved') {
      validTargets = getAvailableTargets(selectedSquare);
    }
  }

  const handleSquareClick = (row, col) => {
    const key = `${row},${col}`;
    const piece = board[key];

    // 1. Выбор своей фигуры
    if (turnPhase === 'select') {
      if (piece && piece.color === turn) {
        useTacticalStore.setState({ selectedSquare: key, turnPhase: 'action' });
      }
      return;
    }

    // 2. Действия с выбранной фигурой
    if (selectedSquare) {
      if (key === selectedSquare) {
        // Отмена выбора (только если еще ничего не сделали)
        if (turnPhase === 'action') useTacticalStore.setState({ selectedSquare: null, turnPhase: 'select' });
        return;
      }

      if (validMoves.includes(key)) {
        movePieceAction(selectedSquare, key);
      } else if (validTargets.includes(key)) {
        executeAttack(selectedSquare, key);
      }
    }
  };

  // Отрендерим сетку
  const squares = [];
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const key = `${r},${c}`;
      const piece = board[key];

      let bgClass = (r + c) % 2 === 1 ? 'black-sq' : 'white-sq';
      let mvClass = '';
      if (selectedSquare === key) bgClass = 'selected';
      else if (validMoves.includes(key)) mvClass = 'move-zone';
      else if (validTargets.includes(key)) bgClass = 'attack-zone';

      squares.push(
        <div key={key} className={`square ${bgClass} ${mvClass}`} onClick={() => handleSquareClick(r, c)}>
          {piece && (
            <div className={`piece-card ${piece.color}`}>
              <div className="piece-name">{piece.type}</div>
              <div className="piece-health">
                <i>❤️</i><span>{piece.hp}/{piece.maxHp}</span>
              </div>
              <div className="piece-stats">
                <i>🛡️</i>
                <span> {piece.atk}/{piece.def}</span>
              </div>
            </div>

          )}
        </div>
      );
    }
  }

  return (
    <div className="game-container">
      <div className="ui-panel">
        <div className='ui-panel__hod'>Ходят: {turn === 'w' ? 'Белые' : 'Черные'} | Фаза: {turnPhase === "select" ? "Выбора фигуры" : "Хода"}</div>
        {turnPhase !== 'select' && <button className='end-turn' onClick={endTurn}>Завершить ход</button>}
      </div>
      <div className="board-12x12">{squares}</div>
      {gameStatus !== 'playing' && <div className="win-screen">Победили {gameStatus === 'w-win' ? 'Белые' : 'Черные'}!</div>}
    </div>
  );
}
