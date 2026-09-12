import React from 'react';
import { useTacticalStore } from '../../store/useTacticalStore';
import { UPGRADE_RULES, getUpgradeCost } from '../../game/upgradeRules'; // Импортируем правила
import './Modals.css';

export function UpgradeModal() {
  const isUpgradeMenuOpen = useTacticalStore(state => state.isUpgradeMenuOpen);
  const setUpgradeMenuOpen = useTacticalStore(state => state.setUpgradeMenuOpen);
  const userPieces = useTacticalStore(state => state.userPieces);
  const userProfile = useTacticalStore(state => state.userProfile);
  const upgradePieceAction = useTacticalStore(state => state.upgradePieceAction);

  if (!isUpgradeMenuOpen) return null;

  const translation = { Pawn: 'Пешка', Knight: 'Конь', Bishop: 'Слон', Rook: 'Ладья', Queen: 'Ферзь', King: 'Король' };

  return (
    <div className="modal-overlay" onClick={() => setUpgradeMenuOpen(false)}>
      <div className="modal-content upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚔️ Кузница: Прокачка Войск</h2>
          <button className="close-modal-btn" onClick={() => setUpgradeMenuOpen(false)}>✕</button>
        </div>
        <p className="modal-subtitle">Ваши очки победы: <span className="highlight">🏆 {userProfile?.victory_points}</span></p>

        <div className="upgrade-list">
          {Object.keys(UPGRADE_RULES).map(type => {
            const currentLevel = userPieces[type] || 1;
            const config = UPGRADE_RULES[type];
            const nextUpgradeCost = getUpgradeCost(type, currentLevel);
            const isMaxLevel = currentLevel >= config.maxLevel;

            return (
              <div key={type} className={`upgrade-card ${isMaxLevel ? 'maxed-card' : ''}`}>
                <div className="upgrade-info">
                  <div className="title-row">
                    <span className="piece-type-title">{translation[type]}</span>
                    <span className={`piece-level-tag ${isMaxLevel ? 'max-tag' : ''}`}>
                      {isMaxLevel ? 'MAX кап' : `Уровень ${currentLevel}`}
                    </span>
                  </div>
                  <p className="piece-upgrade-desc">{config.desc}</p>
                  <p className="piece-passive-desc">{config.passiveDesc}</p>
                </div>

                {isMaxLevel ? (
                  <button className="buy-upgrade-btn max-level-btn" disabled>
                    ⚡ Изучено
                  </button>
                ) : (
                  <button
                    className="buy-upgrade-btn"
                    onClick={() => upgradePieceAction(type)}
                    disabled={(userProfile?.victory_points || 0) < nextUpgradeCost}
                  >
                    Улучшить за <br /> 🏆 {nextUpgradeCost}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
