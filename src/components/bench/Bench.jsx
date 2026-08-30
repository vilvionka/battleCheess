

export const Bench = ({ handleBenchDrop,
  handleBenchDragOver,
  whiteBench,
  handleDragStart,
  PIECE_IMAGES }) => {
  return (
    <div className="setup-bench-container"
      onDragOver={handleBenchDragOver}
      onDrop={handleBenchDrop}
    >
      <div className="bench-title">♙ <span>Выставите фигуры (тяните на нижний ряд):</span></div>
      <div className="bench-list">
        {whiteBench.map(piece => (
          <div
            key={piece.id}
            className="bench-piece-item"
            draggable
            onDragStart={(e) => handleDragStart(e, piece.id)}
          >
            <img src={PIECE_IMAGES[`${piece.type}_w`]} alt={piece.type} className="bench-avatar" />
            <span className="bench-name">{piece.type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}