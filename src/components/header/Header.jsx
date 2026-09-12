import React from 'react';
import { useTacticalStore } from '../../store/useTacticalStore';
import { supabase } from '../../supabaseClient';
import './Header.css';

export function Header() {
  const userProfile = useTacticalStore(state => state.userProfile);
  const setLeaderboardOpen = useTacticalStore(state => state.setLeaderboardOpen);
  const setUpgradeMenuOpen = useTacticalStore(state => state.setUpgradeMenuOpen);

  if (!userProfile) return <div className="game-header-loading">Загрузка данных игрока...</div>;

  return (
    <header className="game-header">

      <div className="header-side">
        <div className="header-user-info header-currency">
          <span className="player-avatar">🛡️</span>
          <div className="user-text">
            <span className="player-name">{userProfile.username}</span>
            <span className="player-stats-brief">Победы: <b>{userProfile.wins}</b> | Металл: <b>{userProfile.losses}</b></span>
          </div>
        </div>
        <div className="header-currency">
          <span className="currency-icon">🏆</span>
          <span className="currency-value">{userProfile.victory_points} <small>очков</small></span>
        </div>
      </div>


      <div className="header-center">
        <span className="name-game">BattleChess</span>
      </div>


      <div className="header-side">
        <div className="header-actions">
          <button className="header-btn upgrade-btn" onClick={() => setUpgradeMenuOpen(true)}>
            ⚔️ Прокачка
          </button>
          <button className="header-btn leaderboard-btn" onClick={() => setLeaderboardOpen(true)}>
            📜 Рейтинг
          </button>
          <button className="header-logout-btn" onClick={() => supabase.auth.signOut()}>
            🚪 Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
