

export const Turn = ({ turn, board, img }) => {
  return (
    <div className="turn-queue-container">
      <div className="queue-title">⏳ Очередь ходов:</div>
      <div className="queue-line">
        {turn.map((key, index) => {
          const piece = board[key];
          if (!piece) return null;
          return (
            <div key={index} className={`queue-card ${piece.color} ${index === 0 ? 'active-turn' : ''}`}>
              <img src={img[`${piece.type}_${piece.color}`]} alt={piece.type} />
              <span className="queue-speed">⚡{piece.speed}</span>
            </div>
          );
        })}
      </div>
    </div>
  )
}