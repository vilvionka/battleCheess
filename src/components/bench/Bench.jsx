

export const Bench = ({ handleBenchDrop,
  handleBenchDragOver,
  whiteBench,
  handleDragStart,
  selectedBenchPieceId,
  setSelectedBenchPieceId,
  PIECE_IMAGES }) => {
  return (
    <div className="setup-bench-container"
      onDragOver={handleBenchDragOver}
      onDrop={handleBenchDrop}
    >
      <div className="bench-title">♙ <span>Выставите фигуры (тяните на нижний ряд):</span></div>
      <div className="bench-list">
        {whiteBench.map(piece => {
          const isSelected = selectedBenchPieceId === piece.id;
          return (
            <div
              key={piece.id}
              className={`bench-piece-item ${isSelected ? 'selected-bench-item' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, piece.id)}
              // 🎯 ТАП НА СМАРТФОНЕ: выбираем фигуру
              onClick={() => setSelectedBenchPieceId(isSelected ? null : piece.id)}
            >
              <img src={PIECE_IMAGES[`${piece.type}_w`]} alt={piece.type} className="bench-avatar" />
              <span className="bench-name">{piece.type}</span>
            </div>
          );
        })}

      </div>
    </div>
  )
}