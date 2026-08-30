import { useTacticalStore } from "../../store/useTacticalStore";

export const Chat = () => {

  const battleLogs = useTacticalStore(state => state.battleLogs);

  return (

    <div className="battle-logs-container" >
      <div className="logs-title">📜 История сражения:</div>
      <div className="logs-list">
        {battleLogs.length === 0 ? (
          <div className="log-empty">Ожидание первых действий...</div>
        ) : (
          battleLogs.map((log, index) => (
            <div key={index} className={`log-item ${index === 0 ? 'latest-log' : ''}`}>
              {log}
            </div>
          ))
        )}
      </div>
    </div >
  )
}