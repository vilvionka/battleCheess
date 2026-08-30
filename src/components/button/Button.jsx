

export const Button = ({ endTurn, undoTurn, gameSnapshot, initGame }) => {
  return (
    <div className="ui-panel">
      <button className='end-turn' onClick={endTurn}>Завершить ход</button>
      <button
        className="undo-btn"
        onClick={undoTurn}
        disabled={!gameSnapshot}
      >
        ↩ Назад
      </button>
      <button className='start-turn' onClick={initGame}>Начать заново</button>
    </div>
  )
}