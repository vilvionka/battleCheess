import React from 'react';

export function Square({
  row,
  col,
  board,
  activeSquareKey,
  validMoves,
  validTargets,
  damagePopups,
  deadPopups,
  gameStatus,
  handleSquareClick,
  handleDragOver,
  handleDrop,
  removeWhitePiece,
  PIECE_IMAGES,
}) {
  const key = `${row},${col}`;
  const piece = board[key];
  const activePopups = damagePopups.filter(p => p.squareKey === key);
  const activeDeadPopups = deadPopups ? deadPopups.filter(p => p.squareKey === key) : [];

  let bgClass = (row + col) % 2 === 1 ? 'black-sq' : 'white-sq';
  let mvClass = '';

  // Определяем подсветку клетки
  if (gameStatus === 'setup') {
    if (row === 7 && !piece) {
      bgClass = 'setup-zone';
    }
  } else {
    if (activeSquareKey === key) bgClass = 'selected';
    else if (validMoves.includes(key)) mvClass = 'move-zone';
    else if (validTargets.includes(key)) bgClass = 'attack-zone';
  }

  return (
    <div
      className={`square ${bgClass} ${mvClass}`}
      onClick={() => gameStatus === 'playing' && handleSquareClick(row, col)}
      onDragOver={(e) => handleDragOver(e, row)}
      onDrop={(e) => handleDrop(e, row, col)}
    >
      {/* Отображение поп-апов */}
      {activeDeadPopups.map(popup => <div key={popup.id} className="death-popup">💀</div>)}
      {activePopups.map(popup => <div key={popup.id} className="damage-popup">-{popup.amount}</div>)}

      {/* Отображение фигуры внутри клетки */}
      {piece && (
        <div
          className={`piece-card ${piece.color}`}
          draggable={gameStatus === 'setup' && piece.color === 'w'}
          onDragStart={(e) => {
            if (gameStatus === 'setup') {
              e.dataTransfer.setData('text/plain', key);
            }
          }}
          onClick={(e) => {
            if (gameStatus === 'setup' && piece.color === 'w') {
              e.stopPropagation(); // Отменяем клик по самой клетке
              removeWhitePiece(key);
            }
          }}
        >
          <div className="piece-image-container">
            <img
              src={PIECE_IMAGES[`${piece.type}_${piece.color}`]}
              alt={`${piece.color} ${piece.type}`}
              className="piece-avatar"
            />
          </div>
          <div className="piece-health"><i>❤️</i><span>{piece.hp}/{piece.maxHp}</span></div>
          <div className="piece-stats"><i>🛡️</i><span>{piece.atk}/{piece.def}</span></div>
        </div>
      )}
    </div>
  );
}
