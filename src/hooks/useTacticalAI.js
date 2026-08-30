import { useEffect } from 'react';
import { useTacticalStore } from '../store/useTacticalStore'; // Проверь путь к своему стору

export function useTacticalAI() {
  const board = useTacticalStore(state => state.board);
  const boardSize = useTacticalStore(state => state.boardSize);
  const activeSquareKey = useTacticalStore(state => state.activeSquareKey);
  const turnPhase = useTacticalStore(state => state.turnPhase);
  const gameStatus = useTacticalStore(state => state.gameStatus);

  const endTurn = useTacticalStore(state => state.endTurn);
  const movePieceAction = useTacticalStore(state => state.movePieceAction);
  const executeAttack = useTacticalStore(state => state.executeAttack);
  const isValidMoveZone = useTacticalStore(state => state.isValidMoveZone);
  const getAvailableTargets = useTacticalStore(state => state.getAvailableTargets);
  const getAdjacencyType = useTacticalStore(state => state.getAdjacencyType);
  const canPieceAttackInDirection = useTacticalStore(state => state.canPieceAttackInDirection);

  useEffect(() => {
    if (gameStatus !== 'playing' || !activeSquareKey) return;

    const activePiece = board[activeSquareKey];
    if (!activePiece || activePiece.color !== 'b') return;

    const timer = setTimeout(() => {
      // --- ДИНАМИЧЕСКАЯ ЦЕННОСТЬ ФИГУРЫ С УЧЕТОМ ЕЕ ЗДОРОВЬЯ ---
      const getPieceBaseValue = (type) => {
        switch (type) {
          case 'King': return 10000;
          case 'Queen': return 900;
          case 'Rook': return 500;
          case 'Bishop': return 400;
          case 'Knight': return 400;
          case 'Pawn': return 150;
          default: return 0;
        }
      };

      const getPieceCurrentValue = (piece) => {
        if (!piece) return 0;
        const baseValue = getPieceBaseValue(piece.type);
        const hpRatio = Math.max(0.2, piece.hp / piece.maxHp);
        return baseValue * hpRatio;
      };

      // --- ФУНКЦИЯ ПРОВЕРКИ ТРАЕКТОРИИ ХОДА ---
      const checkValidMovePath = (fromKey, toKey, targetBoard) => {
        const piece = targetBoard[fromKey];
        if (!piece) return false;

        const [r1, c1] = fromKey.split(',').map(Number);
        const [r2, c2] = toKey.split(',').map(Number);
        const dr = Math.abs(r1 - r2);
        const dc = Math.abs(c1 - c2);

        if (r2 < 0 || r2 >= boardSize || c2 < 0 || c2 >= boardSize) return false;
        if (targetBoard[toKey]) return false;

        if (piece.type === 'Knight') {
          return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
        }

        let isStraight = r1 === r2 || c1 === c2;
        let isDiagonal = dr === dc;

        if (piece.type === 'King') return (isStraight || isDiagonal) && dr <= 1 && dc <= 1;
        if (piece.type === 'Rook') if (!isStraight || dr > 3 || dc > 3) return false;
        if (piece.type === 'Bishop') if (!isDiagonal || dr > 4) return false;
        if (piece.type === 'Queen') if (!(isStraight || isDiagonal) || dr > 5 || dc > 5) return false;

        if (piece.type === 'Pawn') {
          const step = piece.color === 'w' ? -1 : 1;
          if (c1 !== c2) return false;
          if (r2 - r1 === step) return true;
          const isStartRow = piece.color === 'w' ? r1 === 6 : r1 === 1;
          if (isStartRow && r2 - r1 === step * 2) {
            return !targetBoard[`${r1 + step},${c1}`];
          }
          return false;
        }

        const rowStep = r2 === r1 ? 0 : (r2 > r1 ? 1 : -1);
        const colStep = c2 === c1 ? 0 : (c2 > c1 ? 1 : -1);
        let currR = r1 + rowStep;
        let currC = c1 + colStep;

        while (currR !== r2 || currC !== c2) {
          if (targetBoard[`${currR},${currC}`]) return false;
          currR += rowStep;
          currC += colStep;
        }
        return true;
      };

      // --- РАСЧЕТ УРОНА НА СЛЕДУЮЩЕМ ХОДУ ВРАГА ---
      const getIncomingDamageNextTurn = (myTargetKey, targetBoard, myPiece) => {
        const [myR, myC] = myTargetKey.split(',').map(Number);
        let maxIncomingDamage = 0;

        const adjacentSquares = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = myR + dr, c = myC + dc;
            if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
              adjacentSquares.push({ key: `${r},${c}` });
            }
          }
        }

        Object.keys(targetBoard).forEach(enemyKey => {
          const enemy = targetBoard[enemyKey];
          if (!enemy || enemy.color !== 'w') return;

          const [eR, eC] = enemyKey.split(',').map(Number);
          if (Math.abs(eR - myR) <= 1 && Math.abs(eC - myC) <= 1) {
            if (getAdjacencyType && canPieceAttackInDirection) {
              const adjType = getAdjacencyType(enemyKey, myTargetKey);
              if (adjType && canPieceAttackInDirection(enemy.type, enemy.color, adjType, enemyKey, myTargetKey)) {
                const dmg = Math.max(1, enemy.atk - myPiece.def);
                if (dmg > maxIncomingDamage) maxIncomingDamage = dmg;
              }
            }
          }

          adjacentSquares.forEach(adj => {
            if (targetBoard[adj.key] && enemyKey !== adj.key) return;
            if (!checkValidMovePath(enemyKey, adj.key, targetBoard)) return;

            if (getAdjacencyType && canPieceAttackInDirection) {
              const adjType = getAdjacencyType(adj.key, myTargetKey);
              if (adjType && canPieceAttackInDirection(enemy.type, enemy.color, adjType, adj.key, myTargetKey)) {
                const dmg = Math.max(1, enemy.atk - myPiece.def);
                if (dmg > maxIncomingDamage) maxIncomingDamage = dmg;
              }
            }
          });
        });

        return maxIncomingDamage;
      };

      // --- СБОР ДЕЙСТВИЙ ---
      let targets = [];
      if (turnPhase === 'action' || turnPhase === 'has_moved') {
        if (getAvailableTargets) targets = getAvailableTargets(activeSquareKey);
      }

      const moves = [];
      if (turnPhase === 'action' || turnPhase === 'has_attacked') {
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            const targetKey = `${r},${c}`;
            if (isValidMoveZone && isValidMoveZone(activeSquareKey, targetKey)) {
              moves.push(targetKey);
            }
          }
        }
      }

      let bestAction = null;
      let maxScore = -Infinity;

      // А) ОЦЕНИВАЕМ АТАКИ
      targets.forEach(tKey => {
        const enemy = board[tKey];
        if (!enemy) return;

        const virtualBoard = { ...board };
        const virtualAttacker = { ...activePiece };
        const virtualTarget = { ...enemy };

        const attackerValueBeforeAttack = getPieceCurrentValue(activePiece);

        const enemyValueBefore = getPieceCurrentValue(enemy);
        const dmgToTarget = Math.max(1, virtualAttacker.atk - virtualTarget.def);
        virtualTarget.hp -= dmgToTarget;

        let turnGains = enemyValueBefore - (virtualTarget.hp <= 0 ? 0 : getPieceCurrentValue(virtualTarget));

        if (virtualTarget.hp <= 0) {
          turnGains += getPieceBaseValue(enemy.type) * 0.5;
          delete virtualBoard[tKey];
        } else {
          virtualBoard[tKey] = virtualTarget;
          if (getAdjacencyType && canPieceAttackInDirection) {
            const revAdj = getAdjacencyType(tKey, activeSquareKey);
            if (canPieceAttackInDirection(virtualTarget.type, virtualTarget.color, revAdj, tKey, activeSquareKey)) {
              const counterAtk = Math.ceil(virtualTarget.atk / 2);
              virtualAttacker.hp -= Math.max(1, counterAtk - virtualAttacker.def);
            }
          }
        }

        let turnLosses = 0;

        if (virtualAttacker.hp <= 0) {
          delete virtualBoard[activeSquareKey];
          turnLosses += attackerValueBeforeAttack;
        } else {
          virtualBoard[activeSquareKey] = virtualAttacker;
          const attackerValueAfterCombo = getPieceCurrentValue(virtualAttacker);
          turnLosses += (attackerValueBeforeAttack - attackerValueAfterCombo);

          const escapeMoves = [activeSquareKey];
          for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
              const escapeKey = `${r},${c}`;
              if (isValidMoveZone && isValidMoveZone(activeSquareKey, escapeKey)) {
                escapeMoves.push(escapeKey);
              }
            }
          }

          let minEscapeLosses = Infinity;
          let bestEscapeKey = null;

          escapeMoves.forEach(eKey => {
            const escapeBoard = { ...virtualBoard };
            if (eKey !== activeSquareKey) {
              escapeBoard[eKey] = { ...virtualAttacker };
              delete escapeBoard[activeSquareKey];
            }

            const incomingDmg = getIncomingDamageNextTurn(eKey, escapeBoard, virtualAttacker);
            let currentEscapeLosses = 0;

            if (incomingDmg > 0) {
              const nextTurnPiece = { ...virtualAttacker };
              nextTurnPiece.hp -= incomingDmg;
              if (nextTurnPiece.hp <= 0) {
                currentEscapeLosses = attackerValueAfterCombo;
              } else {
                currentEscapeLosses = attackerValueAfterCombo - getPieceCurrentValue(nextTurnPiece);
              }
            }

            if (currentEscapeLosses < minEscapeLosses) {
              minEscapeLosses = currentEscapeLosses;
              bestEscapeKey = eKey;
            }
          });

          if (bestEscapeKey !== null) {
            turnLosses += minEscapeLosses;
          }
        }

        let score = turnGains - turnLosses;
        if (activePiece.type === 'King' && turnLosses > 0) score -= 5000;

        if (score > maxScore) {
          maxScore = score;
          bestAction = { type: 'attack', key: tKey };
        }
      });

      // Б) ОЦЕНИВАЕМ ХОДЫ (Исправленная логика учета убытков от контрудара)
      moves.forEach(mKey => {
        const virtualBoard = { ...board };
        const virtualAttacker = { ...activePiece };
        virtualBoard[mKey] = virtualAttacker;
        delete virtualBoard[activeSquareKey];

        let turnGains = 0;
        let comboTargetKey = null;

        // 1. СИМУЛЯЦИЯ ФАЗЫ АТАКЫ ПОСЛЕ ШАГА
        const [mRow, mCol] = mKey.split(',').map(Number);
        let bestComboSubScore = -Infinity;

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const potentialTargetKey = `${mRow + dr},${mCol + dc}`;
            const enemy = virtualBoard[potentialTargetKey];

            if (enemy && enemy.color === 'w') {
              if (getAdjacencyType && canPieceAttackInDirection) {
                const adjType = getAdjacencyType(mKey, potentialTargetKey);
                if (canPieceAttackInDirection(virtualAttacker.type, virtualAttacker.color, adjType, mKey, potentialTargetKey)) {

                  const enemyValueBefore = getPieceCurrentValue(enemy);
                  const dmgToTarget = Math.max(1, virtualAttacker.atk - enemy.def);

                  const virtualTargetCopy = { ...enemy };
                  virtualTargetCopy.hp -= dmgToTarget;

                  const enemyValueAfter = virtualTargetCopy.hp <= 0 ? 0 : getPieceCurrentValue(virtualTargetCopy);
                  let currentComboGain = enemyValueBefore - enemyValueAfter;

                  if (virtualTargetCopy.hp <= 0) {
                    currentComboGain += getPieceBaseValue(enemy.type) * 0.5;
                  }

                  if (currentComboGain > bestComboSubScore) {
                    bestComboSubScore = currentComboGain;
                    turnGains = currentComboGain;
                    comboTargetKey = potentialTargetKey;
                  }
                }
              }
            }
          }
        }

        // 2. РАСЧЕТ УБЫТКОВ ОТ МГНОВЕННОГО КОНТРУДАРА ПРИ КОМБО
        let turnLosses = 0;
        const attackerValueBeforeCombo = getPieceCurrentValue(activePiece); // Запоминаем цену ИИ ДО каких-либо ударов

        if (comboTargetKey && virtualBoard[comboTargetKey]) {
          const finalEnemy = { ...virtualBoard[comboTargetKey] };
          const dmgToTarget = Math.max(1, virtualAttacker.atk - finalEnemy.def);
          finalEnemy.hp -= dmgToTarget;

          if (finalEnemy.hp <= 0) {
            delete virtualBoard[comboTargetKey];
            // Если враг умер, контрудара нет. Убытки от этой фазы = 0.
          } else {
            virtualBoard[comboTargetKey] = finalEnemy;

            // Враг выжил — наносит контрудар ИИ прямо сейчас
            if (getAdjacencyType && canPieceAttackInDirection) {
              const revAdj = getAdjacencyType(comboTargetKey, mKey);
              if (canPieceAttackInDirection(finalEnemy.type, finalEnemy.color, revAdj, comboTargetKey, mKey)) {
                const counterAtk = Math.ceil(finalEnemy.atk / 2);
                const dmgToMe = Math.max(1, counterAtk - virtualAttacker.def);

                // Наносим урон фигуре ИИ
                virtualAttacker.hp -= dmgToMe;
              }
            }
          }
        }

        // Проверяем состояние ИИ ПОСЛЕ фазы комбо и контрудара
        if (virtualAttacker.hp <= 0) {
          delete virtualBoard[mKey];
          turnLosses += attackerValueBeforeCombo; // Полный убыток (фигура умерла от сдачи)
        } else {
          virtualBoard[mKey] = virtualAttacker;

          // !!! ИСПРАВЛЕНИЕ: Если выжил, честно считаем, сколько ценности здоровья потеряно от контрудара !!!
          const attackerValueAfterCombo = getPieceCurrentValue(virtualAttacker);
          turnLosses += (attackerValueBeforeCombo - attackerValueAfterCombo);

          // 3. СИМУЛЯЦИЯ ПОТЕРЬ НА СЛЕДУЮЩЕМ ХОДУ ИГРОКА (Уже от других выживших фигур Белых)
          const incomingDmg = getIncomingDamageNextTurn(mKey, virtualBoard, virtualAttacker);
          if (incomingDmg > 0) {
            const nextTurnAttacker = { ...virtualAttacker };
            nextTurnAttacker.hp -= incomingDmg;

            if (nextTurnAttacker.hp <= 0) {
              // Если этот дополнительный урон добьет ИИ, то мы теряем всю его ОСТАВШУЮСЯ после контрудара ценность
              turnLosses += attackerValueAfterCombo;
            } else {
              // Если просто еще раз ранят, прибавляем потерю ценности от второго ранения
              turnLosses += (attackerValueAfterCombo - getPieceCurrentValue(nextTurnAttacker));
            }
          }
        }

        // Итоговый баланс для этого шага
        let score = turnGains - turnLosses;

        // Бонус за сближение (только если нет целей для атаки)
        if (!comboTargetKey) {
          let minDistanceToEnemy = Infinity;
          Object.keys(virtualBoard).forEach(eKey => {
            if (virtualBoard[eKey].color === 'w') {
              const [eRow, eCol] = eKey.split(',').map(Number);
              const dist = Math.abs(mRow - eRow) + Math.abs(mCol - eCol);
              if (dist < minDistanceToEnemy) minDistanceToEnemy = dist;
            }
          });
          score += (16 - minDistanceToEnemy) * 4;
        }

        if (activePiece.type === 'King' && turnLosses > 0) score -= 10000;
        score += Math.random() * 2;

        if (score > maxScore) {
          maxScore = score;
          bestAction = { type: 'move', key: mKey };
        }
      });


      if (bestAction) {
        if (bestAction.type === 'attack') {
          executeAttack(activeSquareKey, bestAction.key);
        } else if (bestAction.type === 'move') {
          movePieceAction(activeSquareKey, bestAction.key);
        }
      } else {
        endTurn();
      }
    }, 800); return () => clearTimeout(timer);
  }, [activeSquareKey, turnPhase, gameStatus, board, boardSize, isValidMoveZone, getAvailableTargets, getAdjacencyType, canPieceAttackInDirection]);
}
