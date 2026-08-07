import { create } from 'zustand';
import { BASE_PIECES, PIECE_TYPES } from '../game/constans'; // Проверьте правильность пути к константам

export const useTacticalStore = create((set, get) => ({
  boardSize: 8,
  board: {}, // Структура: { 'row,col': { type, color, hp, maxHp, atk, def, speed, atb } }
  gameStatus: 'playing',
  damagePopups: [],
  deadPopups: [],

  // ХАРАКТЕРИСТИКИ ДЛЯ СИСТЕМЫ СКОРОСТИ И ИНИЦИАТИВЫ
  activeSquareKey: null, // Клетка фигуры, которая ходит СЕЙЧАС
  turnPhase: 'action',   // Фазы внутри хода: 'action', 'has_moved', 'has_attacked'
  actionQueue: [],       // Лента будущих ходов (массив из 6 элементов squareKey)

  // Инициализация игры: выставляем сразу по 6 фигур каждому игроку
  initGame: () => {
    const initialBoard = {
      // Черные фигуры (верхний ряд, r = 0)
      '0,1': { ...BASE_PIECES.Pawn, color: 'b', hp: 10, maxHp: 10, atk: 3, def: 1, speed: 5, atb: 0 },
      '0,2': { ...BASE_PIECES.Knight, color: 'b', hp: 12, maxHp: 12, atk: 4, def: 2, speed: 8, atb: 0 },
      '0,3': { ...BASE_PIECES.Bishop, color: 'b', hp: 10, maxHp: 10, atk: 4, def: 1, speed: 7, atb: 0 },
      '0,4': { ...BASE_PIECES.King, color: 'b', hp: 20, maxHp: 20, atk: 5, def: 3, speed: 4, atb: 0 },
      '0,5': { ...BASE_PIECES.Rook, color: 'b', hp: 15, maxHp: 15, atk: 5, def: 3, speed: 5, atb: 0 },
      '0,6': { ...BASE_PIECES.Queen, color: 'b', hp: 16, maxHp: 16, atk: 6, def: 2, speed: 9, atb: 0 },

      // Белые фигуры (нижний ряд, r = 7)
      '7,1': { ...BASE_PIECES.Pawn, color: 'w', hp: 10, maxHp: 10, atk: 3, def: 1, speed: 5, atb: 0 },
      '7,2': { ...BASE_PIECES.Knight, color: 'w', hp: 12, maxHp: 12, atk: 4, def: 2, speed: 8, atb: 0 },
      '7,3': { ...BASE_PIECES.Bishop, color: 'w', hp: 10, maxHp: 10, atk: 4, def: 1, speed: 7, atb: 0 },
      '7,4': { ...BASE_PIECES.King, color: 'w', hp: 20, maxHp: 20, atk: 5, def: 3, speed: 4, atb: 0 },
      '7,5': { ...BASE_PIECES.Rook, color: 'w', hp: 15, maxHp: 15, atk: 5, def: 3, speed: 5, atb: 0 },
      '7,6': { ...BASE_PIECES.Queen, color: 'w', hp: 16, maxHp: 16, atk: 6, def: 2, speed: 9, atb: 0 },
    };

    set({
      board: initialBoard,
      gameStatus: 'playing',
      deadPopups: [],
      damagePopups: [],
      turnPhase: 'action',
      activeSquareKey: null,
      actionQueue: []
    });

    // Сразу же рассчитываем, кто будет ходить первым, и строим ленту
    get().calculateNextTurns();
  },

  // ВАЛИДАЦИЯ ТИПОВ СОСЕДСТВА КЛЕТОК
  getAdjacencyType: (fromKey, toKey) => {
    const [r1, c1] = fromKey.split(',').map(Number);
    const [r2, c2] = toKey.split(',').map(Number);
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) return null;
    if (dr === 0 || dc === 0) return 'straight';
    if (dr === dc) return 'diagonal';
    return null;
  },

  // ПРОВЕРКА НАПРАВЛЕНИЯ АТАКИ
  canPieceAttackInDirection: (type, color, direction, fromKey, toKey) => {
    if (type === 'King' || type === 'Queen' || type === 'Knight') return true;
    if (type === 'Rook') return direction === 'straight';
    if (type === 'Bishop') return direction === 'diagonal';
    if (type === 'Pawn') {
      if (direction !== 'diagonal') return false;
      const [r1] = fromKey.split(',').map(Number);
      const [r2] = toKey.split(',').map(Number);
      return color === 'w' ? r2 < r1 : r2 > r1;
    }
    return false;
  },

  // ВАЛИДАЦИЯ ДВИЖЕНИЯ ФИГУРЫ В ПУСТУЮ ЗОНУ
  isValidMoveZone: (fromKey, toKey) => {
    const { board, boardSize } = get();
    const piece = board[fromKey];
    if (!piece) return false;

    const [r1, c1] = fromKey.split(',').map(Number);
    const [r2, c2] = toKey.split(',').map(Number);
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);

    if (r2 < 0 || r2 >= boardSize || c2 < 0 || c2 >= boardSize) return false;
    if (board[toKey]) return false;

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
        return !board[`${r1 + step},${c1}`];
      }
      return false;
    }

    const rowStep = r2 === r1 ? 0 : (r2 > r1 ? 1 : -1);
    const colStep = c2 === c1 ? 0 : (c2 > c1 ? 1 : -1);
    let currR = r1 + rowStep;
    let currC = c1 + colStep;

    while (currR !== r2 || currC !== c2) {
      if (board[`${currR},${currC}`]) return false;
      currR += rowStep;
      currC += colStep;
    }
    return true;
  },

  // ПОИСК ДОСТУПНЫХ ВРАГОВ ДЛЯ АТАКЫ БЛИЖНЕГО БОЯ
  getAvailableTargets: (squareKey) => {
    const { board, getAdjacencyType, canPieceAttackInDirection } = get();
    const attacker = board[squareKey];
    if (!attacker) return [];
    const [r, c] = squareKey.split(',').map(Number);
    const targets = [];

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const tKey = `${r + dr},${c + dc}`;
        const target = board[tKey];
        if (target && target.color !== attacker.color) {
          const adjType = getAdjacencyType(squareKey, tKey);
          if (canPieceAttackInDirection(attacker.type, attacker.color, adjType, squareKey, tKey)) {
            targets.push(tKey);
          }
        }
      }
    }
    return targets;
  },
  // Перемещение активной фигуры
  movePieceAction: (fromKey, toKey) => {
    const { board, turnPhase, getAvailableTargets } = get();
    if (!get().isValidMoveZone(fromKey, toKey)) return;

    const newBoard = { ...board };
    newBoard[toKey] = { ...newBoard[fromKey] };
    delete newBoard[fromKey];

    set({ board: newBoard });

    let nextPhase = 'end_turn';
    if (turnPhase === 'action') {
      const potentialTargets = getAvailableTargets(toKey);
      nextPhase = potentialTargets.length > 0 ? 'has_moved' : 'end_turn';
    }

    if (nextPhase === 'end_turn') {
      set({ activeSquareKey: null });
      get().endTurn();
    } else {
      set({ activeSquareKey: toKey, turnPhase: nextPhase });
    }
  },

  // Проведение атаки активной фигурой
  executeAttack: (attackerKey, targetKey) => {
    const { board, getAdjacencyType, canPieceAttackInDirection, turnPhase } = get();

    const attacker = { ...board[attackerKey] };
    const target = { ...board[targetKey] };

    if (!board[attackerKey] || !board[targetKey]) return;

    const newBoard = { ...board };
    const newPopups = [];
    const newDeadPopups = [];

    // 1. Расчет прямого урона
    const dmgToTarget = Math.max(1, attacker.atk - target.def);
    target.hp -= dmgToTarget;

    const popupTargetId = `${Date.now()}-t-${Math.random()}`;
    newPopups.push({ id: popupTargetId, squareKey: targetKey, amount: dmgToTarget });

    if (target.hp <= 0) {
      delete newBoard[targetKey];
      newDeadPopups.push({ id: `${Date.now()}-dt-${Math.random()}`, squareKey: targetKey });
    } else {
      newBoard[targetKey] = target;

      // 2. Логика контрудара в ответ
      const revAdjType = getAdjacencyType(targetKey, attackerKey);
      if (canPieceAttackInDirection(target.type, target.color, revAdjType, targetKey, attackerKey)) {
        const counterAtk = Math.ceil(target.atk / 2);
        const dmgToAttacker = Math.max(1, counterAtk - attacker.def);
        attacker.hp -= dmgToAttacker;

        const popupAttackerId = `${Date.now()}-a-${Math.random()}`;
        newPopups.push({ id: popupAttackerId, squareKey: attackerKey, amount: dmgToAttacker });
      }
    }

    // 3. Проверяем выживание самого нападающего
    if (attacker.hp <= 0) {
      delete newBoard[attackerKey];
      newDeadPopups.push({ id: `${Date.now()}-da-${Math.random()}`, squareKey: attackerKey });
    } else {
      newBoard[attackerKey] = attacker;
    }

    // 4. Менеджмент поп-апов урона
    if (newPopups.length > 0) {
      set((state) => ({ damagePopups: [...state.damagePopups, ...newPopups] }));
      setTimeout(() => {
        const idsToRemove = newPopups.map(p => p.id);
        set((state) => ({ damagePopups: state.damagePopups.filter(p => !idsToRemove.includes(p.id)) }));
      }, 1000);
    }

    // 5. Менеджмент поп-апов смертей
    if (newDeadPopups.length > 0) {
      set((state) => ({ deadPopups: [...state.deadPopups, ...newDeadPopups] }));
      setTimeout(() => {
        const idsToRemove = newDeadPopups.map(p => p.id);
        set((state) => ({ deadPopups: state.deadPopups.filter(p => !idsToRemove.includes(p.id)) }));
      }, 1000);
    }

    set({ board: newBoard });

    // 6. Проверка условий победы
    const figures = Object.values(newBoard);
    const isWhiteKingAlive = figures.some(p => p.type === 'King' && p.color === 'w');
    const isBlackKingAlive = figures.some(p => p.type === 'King' && p.color === 'b');

    if (!isWhiteKingAlive) {
      set({ gameStatus: 'b-win' });
      return;
    }
    if (!isBlackKingAlive) {
      set({ gameStatus: 'w-win' });
      return;
    }

    // 7. Смена фаз
    let nextPhase = 'end_turn';
    if (turnPhase === 'action' && newBoard[attackerKey]) {
      nextPhase = 'has_attacked';
    }

    if (nextPhase === 'end_turn') {
      set({ activeSquareKey: null });
      get().endTurn();
    } else {
      set({ turnPhase: nextPhase });
    }
  },

  // Завершение хода
  endTurn: () => {
    const { gameStatus, calculateNextTurns } = get();
    if (gameStatus !== 'playing') return;

    calculateNextTurns();
  },

  // Алгоритм симуляции шкал готовности (ATB) для построения ленты ходов
  calculateNextTurns: () => {
    const { board } = get();
    if (Object.keys(board).length === 0) return;

    // Создаем копию шкал ATB для симуляции ходов наперед
    const simAtb = {};
    Object.keys(board).forEach(key => {
      simAtb[key] = board[key].atb || 0;
    });

    const queue = [];
    const ATB_THRESHOLD = 100; // Порог готовности хода

    // Наполняем виртуальную ленту ходов до 6 штук
    while (queue.length < 6) {
      Object.keys(board).forEach(key => {
        simAtb[key] += board[key].speed;
      });

      const readyKeys = Object.keys(board)
        .filter(key => simAtb[key] >= ATB_THRESHOLD)
        .sort((a, b) => simAtb[b] - simAtb[a]);

      readyKeys.forEach(key => {
        if (queue.length < 6) {
          queue.push(key);
          simAtb[key] -= ATB_THRESHOLD;
        }
      });
    }

    // ПРИМЕНЯЕМ ПРОДВИЖЕНИЕ ВРЕМЕНИ НА ДОСКЕ СИНХРОННО С ЛЕНТОЙ
    const newBoard = { ...board };
    const realTurnFound = queue[0]; // Первой ходит та фигура, которая стоит на 0 месте в ленте!

    // Вычисляем, сколько тиков "времени" нужно, чтобы лидер добежал до порога 100
    const leaderCurrentAtb = newBoard[realTurnFound].atb || 0;
    const neededAtb = Math.max(0, 100 - leaderCurrentAtb);
    const timeTicks = Math.ceil(neededAtb / newBoard[realTurnFound].speed);

    // Наращиваем ATB ВСЕМ фигурам строго на это количество тиков
    Object.keys(newBoard).forEach(key => {
      const currentAtb = newBoard[key].atb || 0;
      newBoard[key] = {
        ...newBoard[key],
        atb: currentAtb + (newBoard[key].speed * timeTicks)
      };
    });

    // Официально списываем 100 очков у того, чей ход наступил
    newBoard[realTurnFound].atb -= 100;

    set({
      board: newBoard,
      activeSquareKey: realTurnFound,
      actionQueue: queue,
      turnPhase: 'action'
    });
  },







}));
