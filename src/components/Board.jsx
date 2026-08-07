import React, { useEffect, useMemo } from 'react';
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
  const board = useTacticalStore(state => state.board);
  const boardSize = useTacticalStore(state => state.boardSize);
  const activeSquareKey = useTacticalStore(state => state.activeSquareKey);
  const turnPhase = useTacticalStore(state => state.turnPhase);
  const actionQueue = useTacticalStore(state => state.actionQueue);
  const gameStatus = useTacticalStore(state => state.gameStatus);
  const damagePopups = useTacticalStore(state => state.damagePopups);
  const deadPopups = useTacticalStore(state => state.deadPopups);

  const initGame = useTacticalStore(state => state.initGame);
  const endTurn = useTacticalStore(state => state.endTurn);
  const movePieceAction = useTacticalStore(state => state.movePieceAction);
  const executeAttack = useTacticalStore(state => state.executeAttack);
  const isValidMoveZone = useTacticalStore(state => state.isValidMoveZone);
  const getAvailableTargets = useTacticalStore(state => state.getAvailableTargets);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const activePiece = activeSquareKey ? board[activeSquareKey] : null;

  // Расчет подсветок ходов и атак
  const { validMoves, validTargets } = useMemo(() => {
    const moves = [];
    let targets = [];
    if (activeSquareKey && activePiece) {
      if (turnPhase === 'action' || turnPhase === 'has_attacked') {
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            if (isValidMoveZone && isValidMoveZone(activeSquareKey, `${r},${c}`)) {
              moves.push(`${r},${c}`);
            }
          }
        }
      }
      if (turnPhase === 'action' || turnPhase === 'has_moved') {
        if (getAvailableTargets) {
          targets = getAvailableTargets(activeSquareKey);
        }
      }
    }
    return { validMoves: moves, validTargets: targets };
  }, [activeSquareKey, turnPhase, boardSize, board, activePiece, isValidMoveZone, getAvailableTargets]);

  const handleSquareClick = (row, col) => {
    const key = `${row},${col}`;
    if (!activeSquareKey) return;

    if (validMoves.includes(key)) {
      movePieceAction(activeSquareKey, key);
    } else if (validTargets.includes(key)) {
      executeAttack(activeSquareKey, key);
    }
  };

  const squares = [];
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const key = `${r},${c}`;
      const piece = board[key];
      const activePopups = damagePopups.filter(p => p.squareKey === key);
      const activeDeadPopups = deadPopups ? deadPopups.filter(p => p.squareKey === key) : [];

      let bgClass = (r + c) % 2 === 1 ? 'black-sq' : 'white-sq';
      let mvClass = '';

      if (activeSquareKey === key) bgClass = 'selected';
      else if (validMoves.includes(key)) mvClass = 'move-zone';
      else if (validTargets.includes(key)) bgClass = 'attack-zone';

      squares.push(
        <div key={key} className={`square ${bgClass} ${mvClass}`} onClick={() => handleSquareClick(r, c)}>
          {activeDeadPopups.map(popup => <div key={popup.id} className="death-popup">💀</div>)}
          {activePopups.map(popup => <div key={popup.id} className="damage-popup">-{popup.amount}</div>)}

          {piece && (
            <div className={`piece-card ${piece.color}`}>
              <div className="piece-image-container">
                <img src={PIECE_IMAGES[`${piece.type}_${piece.color}`]} alt={`${piece.color} ${piece.type}`} className="piece-avatar" />
              </div>
              <div className="piece-health"><i>❤️</i><span>{piece.hp}/{piece.maxHp}</span></div>
              <div className="piece-stats"><i>🛡️</i><span>{piece.atk}/{piece.def}</span></div>
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <div className="game-container">
      <div className="turn-queue-container">
        <div className="queue-title">Очередь ходов:</div>
        <div className="queue-line">
          {actionQueue.map((key, index) => {
            const piece = board[key];
            if (!piece) return null;
            return (
              <div key={index} className={`queue-card ${piece.color} ${index === 0 ? 'active-turn' : ''}`}>
                <img src={PIECE_IMAGES[`${piece.type}_${piece.color}`]} alt={piece.type} />
                <span className="queue-speed">⚡{piece.speed}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ui-panel">
        {activePiece && (
          <div className='ui-panel__hod'>
            Сейчас ходит: <b className={activePiece.color}>{activePiece.color === 'w' ? 'Белая' : 'Черная'} {activePiece.type}</b> (Скорость: {activePiece.speed})
          </div>
        )}
        {turnPhase !== 'action' && <button className='end-turn' onClick={endTurn}>Завершить ход</button>}
      </div>

      {/* Контейнер доски с инлайн-стилем для колонок */}
      <div className="board-grid" style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}>
        {squares}
      </div>

      {gameStatus !== 'playing' && <div className="win-screen">Победили {gameStatus === 'w-win' ? 'Белые' : 'Черные'}!</div>}
    </div>
  );
}
