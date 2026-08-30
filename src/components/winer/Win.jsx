

export const Win = ({ initGame, gameStatus }) => {
  return (
    <div className="win-screen">
      <div className="win-message">
        Победили {gameStatus === 'w-win' ? 'Белые' : 'Черные'}!
      </div>
      <button className="restart-btn" onClick={initGame}>
        Начать заново
      </button>
    </div>
  )
}