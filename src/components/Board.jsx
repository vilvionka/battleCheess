// src/components/Board.jsx
import React, { useEffect } from 'react';
import { useTacticalStore } from '../store/useTacticalStore';
import './Board.css';
// Импортируем картинки для Белых фигур
import kingW from '../assets/king_w.png';
import queenW from '../assets/queen_w.png';
import rookW from '../assets/rook_w.png';
import bishopW from '../assets/bishop_w.png';
import knightW from '../assets/knight_w.png';
import pawnW from '../assets/pawn_w.png';

// Импортируем картинки для Черных фигур
import kingB from '../assets/king_b.png';
import queenB from '../assets/queen_b.png';
import rookB from '../assets/rook_b.png';
import bishopB from '../assets/bishop_b.png';
import knightB from '../assets/knight_b.png';
import pawnB from '../assets/pawn_b.png';


const PIECE_IMAGES = {
  King_w: kingW, King_b: kingB,
  Queen_w: queenW, Queen_b: queenB,
  Rook_w: rookW, Rook_b: rookB,
  Bishop_w: bishopW, Bishop_b: bishopB,
  Knight_w: knightW, Knight_b: knightB,
  Pawn_w: pawnW, Pawn_b: pawnB,
};

export function Board() {
  const {
    board, boardSize, initGame, turn, gameStatus, turnPhase, selectedSquare,
    isValidMoveZone, getAvailableTargets, movePieceAction, executeAttack, endTurn, damagePopups, deadPopups
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

      // Ищем, летит ли сейчас урон над этой конкретной клеткой
      const activePopups = damagePopups.filter(p => p.squareKey === key);
      const activeDeadPopups = deadPopups ? deadPopups.filter(p => p.squareKey === key) : [];


      let bgClass = (r + c) % 2 === 1 ? 'black-sq' : 'white-sq';
      let mvClass = '';
      if (selectedSquare === key) bgClass = 'selected';
      else if (validMoves.includes(key)) mvClass = 'move-zone';
      else if (validTargets.includes(key)) bgClass = 'attack-zone';

      squares.push(
        <div key={key} className={`square ${bgClass} ${mvClass}`} onClick={() => handleSquareClick(r, c)}>
          {activeDeadPopups.map(popup => (
            <div key={popup.id} className="death-popup">
              💀
            </div>
          ))}

          {/* 🌟 ОТРЕНДЕРИМ ВСЕ ПОПАПЫ ДЛЯ ЭТОЙ КЛЕТКИ */}
          {activePopups.map(popup => (
            <div key={popup.id} className="damage-popup">
              -{popup.amount}
            </div>
          ))}
          {piece && (
            <div className={`piece-card ${piece.color}`}>
              <div className="piece-image-container">
                <img
                  src={PIECE_IMAGES[`${piece.type}_${piece.color}`]}
                  alt={`${piece.color} ${piece.type}`}
                  className="piece-avatar"
                />
              </div>
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
