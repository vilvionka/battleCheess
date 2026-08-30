import React, { useEffect, useState } from 'react';
import { useTacticalStore } from '../../store/useTacticalStore';
import { supabase } from '../../supabaseClient';
import './Modals.css';

export function LeaderboardModal() {
  const isLeaderboardOpen = useTacticalStore(state => state.isLeaderboardOpen);
  const setLeaderboardOpen = useTacticalStore(state => state.setLeaderboardOpen);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLeaderboardOpen) return;

    const fetchLeaders = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('username, wins, losses')
        .order('wins', { ascending: false })
        .limit(20);

      if (data) setLeaders(data);
      setLoading(false);
    };

    fetchLeaders();
  }, [isLeaderboardOpen]);

  if (!isLeaderboardOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setLeaderboardOpen(false)}>
      <div className="modal-content leaderboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📜 Зал Славы (Leaderboard)</h2>
          <button className="close-modal-btn" onClick={() => setLeaderboardOpen(false)}>✕</button>
        </div>

        {loading ? (
          <div className="modal-loading">Загрузка свитка почета...</div>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Место</th>
                <th>Игрок</th>
                <th>🏆 Победы</th>
                <th>💀 Матчи</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((player, index) => (
                <tr key={index} className={index === 0 ? 'top-one' : index === 1 ? 'top-two' : index === 2 ? 'top-three' : ''}>
                  <td>{index + 1}</td>
                  <td>{player.username}</td>
                  <td>{player.wins}</td>
                  <td>{player.wins + player.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
