import React from 'react';
import { useTacticalStore } from '../../store/useTacticalStore';
import './Modals.css';

// Жестко прописанные правила бонусов для линейной прокачки
const UPGRADE_BONUSES = {
  Pawn: { desc: '+1 HP, +1 ATK за уровень', baseCost: 10 },
  Knight: { desc: '+1 Speed за уровень', baseCost: 15 },
  Bishop: { desc: '+2 ATK за уровень', baseCost: 15 },
  Rook: { desc: '+2 HP, +1 DEF за уровень', baseCost: 20 },
  Queen: { desc: '+2 ATK, +1 Speed за уровень', baseCost: 30 },
  King: { desc: '+3 HP, +1 DEF за уровень', baseCost: 40 }
};

export function UpgradeModal() {
  const isUpgradeMenuOpen = useTacticalStore(state => state.isUpgradeMenuOpen);
  const setUpgradeMenuOpen = useTacticalStore(state => state.setUpgradeMenuOpen);
  const userPieces = useTacticalStore(state => state.userPieces);
  const userProfile = useTacticalStore(state => state.userProfile);
  const upgradePieceAction = useTacticalStore(state => state.upgradePieceAction);

  if (!isUpgradeMenuOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setUpgradeMenuOpen(false)}>
      <div className="modal-content upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚔️ Кузница: Прокачка Войск</h2>
          <button className="close-modal-btn" onClick={() => setUpgradeMenuOpen(false)}>✕</button>
        </div>
        <p className="modal-subtitle">Ваши очки победы: <span className="highlight">🏆 {userProfile?.victory_points}</span></p>

        <div className="upgrade-list">
          {Object.keys(UPGRADE_BONUSES).map(type => {
            const currentLevel = userPieces[type] || 1;
            const config = UPGRADE_BONUSES[type];
            // Рассчитываем стоимость следующего апгрейда
            const nextUpgradeCost = Math.ceil(config.baseCost * Math.pow(1.5, currentLevel - 1));

            return (
              <div key={type} className="upgrade-card">
                <div className="upgrade-info">
                  <span className="piece-type-title">{type === 'Pawn' ? 'Пешка' : type === 'Knight' ? 'Конь' : type === 'Bishop' ? 'Слон' : type === 'Rook' ? 'Ладья' : type === 'Queen' ? 'Ферзь' : 'Король'}</span>
                  <span className="piece-level-tag">Уровень {currentLevel}</span>
                  <p className="piece-upgrade-desc">{config.desc}</p>
                </div>
                <button
                  className="buy-upgrade-btn"
                  onClick={() => upgradePieceAction(type)}
                  disabled={(userProfile?.victory_points || 0) < nextUpgradeCost}
                >
                  Улучшить за <br /> 🏆 {nextUpgradeCost}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
