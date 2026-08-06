import { create } from 'zustand';
import { BASE_PIECES, PIECE_TYPES } from '../game/constans';

export const useTacticalStore = create((set, get) => ({
  boardSize: 8,
  board: {}, // Структура: { 'row,col': { type, color, hp, maxHp, atk, def } }
  turn: 'w',
  selectedSquare: null,
  gameStatus: 'playing',
  damagePopups: [],
  deadPopups: [],

  // Фазы внутри одного хода: 
  // 'select' - выбираем фигуру
  // 'action' - фигура выбрана, можно сходить или атаковать
  // 'has_attacked' - если сначала атаковали, можно еще походить
  // 'has_moved' - если сначала походили, можно еще атаковать
  turnPhase: 'select',
  // 1. ДОБАВЛЯЕМ СЧЕТЧИКИ ВСЕГО СОЗДАННЫХ ФИГУР ЗА ИГРУ
  spawnedCountW: 1, // Король уже на поле со старта
  spawnedCountB: 1, // Король уже на поле со старта

  initGame: () => {
    const initialBoard = {
      '0,3': { ...BASE_PIECES.King, color: 'b' },
      '7,4': { ...BASE_PIECES.King, color: 'w' }
    };

    set({
      board: initialBoard,
      turn: 'w',
      selectedSquare: null,
      gameStatus: 'playing',
      turnPhase: 'select',
      deadPopups: [],
      damagePopups: [],
      spawnedCountW: 1,
      spawnedCountB: 1
    });
  },

  // Проверка вектора между двумя соседними клетками
  // Возвращает 'straight' (прямая), 'diagonal' (диагональ) или null (если они не соседи)
  getAdjacencyType: (fromKey, toKey) => {
    const [r1, c1] = fromKey.split(',').map(Number);
    const [r2, c2] = toKey.split(',').map(Number);

    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);

    if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) return null; // Не соседние клетки

    if (dr === 0 || dc === 0) return 'straight';  // По горизонтали или вертикали
    if (dr === dc) return 'diagonal';             // По диагонали
    return null;
  },

  // Может ли фигура атаковать в данном направлении (на соседнюю клетку)
  canPieceAttackInDirection: (type, color, direction, fromKey, toKey) => {
    if (type === 'King' || type === 'Queen' || type === 'Knight') return true; // Бьют во все стороны
    if (type === 'Rook') return direction === 'straight';
    if (type === 'Bishop') return direction === 'diagonal';

    if (type === 'Pawn') {
      // Пешка атакует ТОЛЬКО по диагонали и ТОЛЬКО вперед
      if (direction !== 'diagonal') return false;
      const [r1] = fromKey.split(',').map(Number);
      const [r2] = toKey.split(',').map(Number);
      return color === 'w' ? r2 < r1 : r2 > r1; // Белые бьют вверх (ряд уменьшается), черные вниз
    }
    return false;
  },

  // Валидация обычного ХОДА на пустую клетку (проверка дальности и препятствий)
  isValidMoveZone: (fromKey, toKey) => {
    const { board, boardSize } = get();
    const piece = board[fromKey];
    if (!piece) return false;

    const [r1, c1] = fromKey.split(',').map(Number);
    const [r2, c2] = toKey.split(',').map(Number);
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);

    if (r2 < 0 || r2 >= boardSize || c2 < 0 || c2 >= boardSize) return false;
    if (board[toKey]) return false; // Клетка должна быть пустой

    // Логика коня (перепрыгивает всех)
    if (piece.type === 'Knight') {
      return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
    }

    // Проверка направлений для остальных
    let isStraight = r1 === r2 || c1 === c2;
    let isDiagonal = dr === dc;

    if (piece.type === 'King') return (isStraight || isDiagonal) && dr <= 1 && dc <= 1;
    if (piece.type === 'Rook') if (!isStraight || dr > 3 || dc > 3) return false;
    if (piece.type === 'Bishop') if (!isDiagonal || dr > 4) return false;
    if (piece.type === 'Queen') if (!(isStraight || isDiagonal) || dr > 5 || dc > 5) return false;

    if (piece.type === 'Pawn') {
      const step = piece.color === 'w' ? -1 : 1; // Белые идут вверх (-1 ряд), черные вниз (+1)
      if (c1 !== c2) return false; // Пешка ходит строго по прямой
      if (r2 - r1 === step) return true; // Ход на 1 клетку
      // Ход на 2 клетки (только со стартовой линии)
      const isStartRow = piece.color === 'w' ? r1 === boardSize - 1 : r1 === 0;
      if (isStartRow && r2 - r1 === step * 2) {
        // Проверяем, пустая ли промежуточная клетка
        return !board[`${r1 + step},${c1}`];
      }
      return false;
    }

    // Проверка препятствий по пути (для Ладьи, Слона, Королевы)
    const rowStep = r2 === r1 ? 0 : (r2 > r1 ? 1 : -1);
    const colStep = c2 === c1 ? 0 : (c2 > c1 ? 1 : -1);
    let currR = r1 + rowStep;
    let currC = c1 + colStep;

    while (currR !== r2 || currC !== c2) {
      if (board[`${currR},${currC}`]) return false; // Путь заблокирован
      currR += rowStep;
      currC += colStep;
    }

    return true;
  },

  // Найти всех врагов вокруг конкретной клетки, которых эта фигура МОЖЕТ атаковать
  getAvailableTargets: (squareKey) => {
    const { board, getAdjacencyType, canPieceAttackInDirection } = get();
    const attacker = board[squareKey];
    if (!attacker) return [];

    const [r, c] = squareKey.split(',').map(Number);
    const targets = [];

    // Обходим все 8 соседних клеток
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

  // Выполнение обычного перемещения фигуры
  movePieceAction: (fromKey, toKey) => {
    const { board, turnPhase, getAvailableTargets } = get();
    if (!get().isValidMoveZone(fromKey, toKey)) return;

    // 1. Создаем обновленную доску
    const newBoard = { ...board };
    newBoard[toKey] = newBoard[fromKey];
    delete newBoard[fromKey];

    // 2. СНАЧАЛА сохраняем новую доску в стейт, чтобы getAvailableTargets() видела фигуру на новом месте!
    set({ board: newBoard });

    // Меняем фазу
    let nextPhase = 'select';
    if (turnPhase === 'action') {
      // Теперь функция правильно найдет цели, так как фигура уже на toKey в глобальном стейте
      const potentialTargets = getAvailableTargets(toKey);
      nextPhase = potentialTargets.length > 0 ? 'has_moved' : 'select';
    }

    // 3. Обновляем оставшиеся параметры состояния
    set({
      selectedSquare: nextPhase !== 'select' ? toKey : null,
      turnPhase: nextPhase
    });

    if (nextPhase === 'select') {
      get().endTurn();
    }
  },


  executeAttack: (attackerKey, targetKey) => {
    const { board, getAdjacencyType, canPieceAttackInDirection, turnPhase, getAvailableTargets } = get();
    const attacker = board[attackerKey];
    const target = board[targetKey];

    if (!attacker || !target) return;

    const newBoard = { ...board };
    const newPopups = [];
    const newDeadPopups = [];

    // ==========================================
    // 1. ПРЯМОЙ УРОН (Игрок бьет врага)
    // ==========================================
    const dmgToTarget = Math.max(1, attacker.atk - target.def);
    target.hp -= dmgToTarget;

    const popupTargetId = Date.now() + Math.random();
    newPopups.push({ id: popupTargetId, squareKey: targetKey, amount: dmgToTarget });

    if (target.hp <= 0) {
      delete newBoard[targetKey]; // Цель погибла

      const popupDeadTargetId = Date.now() + Math.random();
      newDeadPopups.push({ id: popupDeadTargetId, squareKey: targetKey });
    } else {
      newBoard[targetKey] = { ...target }; // Обновляем HP выжившего врага

      // ==========================================
      // 2. КОНТРУДАР (Выживает и дает сдачи)
      // ==========================================
      const revAdjType = getAdjacencyType(targetKey, attackerKey);
      if (canPieceAttackInDirection(target.type, target.color, revAdjType, targetKey, attackerKey)) {
        const counterAtk = Math.ceil(target.atk / 2);
        const dmgToAttacker = Math.max(1, counterAtk - attacker.def);
        attacker.hp -= dmgToAttacker;

        const popupAttackerId = Date.now() + Math.random() + 1;
        newPopups.push({ id: popupAttackerId, squareKey: attackerKey, amount: dmgToAttacker });
      }
    }

    // 4. Проверяем выживание самого нападающего после контрудара
    if (attacker.hp <= 0) {
      delete newBoard[attackerKey];

      const popupDeadAttackerId = Date.now() + Math.random();
      newDeadPopups.push({ id: popupDeadAttackerId, squareKey: attackerKey });
    } else {
      newBoard[attackerKey] = { ...attacker };
    }

    // ==========================================
    // 3. СОХРАНЯЕМ ПОПАПЫ УРОНА И ТАЙМАУТ
    // ==========================================
    if (newPopups.length > 0) {
      set((state) => ({ damagePopups: [...state.damagePopups, ...newPopups] }));
      setTimeout(() => {
        const idsToRemove = newPopups.map(p => p.id);
        set((state) => ({ damagePopups: state.damagePopups.filter(p => !idsToRemove.includes(p.id)) }));
      }, 1000);
    }

    // ==========================================
    // 5. СОХРАНЯЕМ ПОПАПЫ СМЕРТЕЙ И ТАЙМАУТ (ИСПРАВЛЕНО)
    // ==========================================
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

    // 7. Изменение фазы хода
    let nextPhase = 'select';
    if (turnPhase === 'action' && newBoard[attackerKey]) {
      nextPhase = 'has_attacked';
    }

    set({ selectedSquare: nextPhase !== 'select' ? attackerKey : null, turnPhase: nextPhase });

    if (nextPhase === 'select') {
      get().endTurn();
    }
  },



  // Завершение хода, сброс лимитов и спавн
  endTurn: () => {
    const { turn, gameStatus, spawnRandomPiece } = get();
    if (gameStatus !== 'playing') return;

    const nextTurn = turn === 'w' ? 'b' : 'w';
    set({ turn: nextTurn, selectedSquare: null, turnPhase: 'select' });
    spawnRandomPiece(nextTurn);
  },

  // Рандомный спавн (Ограничение: до 5 штук)
  getPieceCount: (color) => Object.values(get().board).filter(p => p.color === color).length,

  spawnRandomPiece: (color) => {
    const { getPieceCount, board, boardSize, spawnedCountW, spawnedCountB } = get();
    // 1. ПРОВЕРКА НА ОБЩИЙ ЛИМИТ ЗА ИГРУ (МАКСИМУМ 8)
    const totalSpawned = color === 'w' ? spawnedCountW : spawnedCountB;
    if (totalSpawned >= 8) return;

    if (getPieceCount(color) >= 5) return;

    const row = color === 'w' ? boardSize - 1 : 0;
    const freeCols = [];
    for (let c = 0; c < boardSize; c++) {
      if (!board[`${row},${c}`]) freeCols.push(c);
    }
    if (freeCols.length === 0) return;

    const randomCol = freeCols[Math.floor(Math.random() * freeCols.length)];
    const randomType = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];

    if (color === 'w') {
      set({
        board: { ...board, [`${row},${randomCol}`]: { ...BASE_PIECES[randomType], color } },
        spawnedCountW: spawnedCountW + 1
      });
    } else {
      set({
        board: { ...board, [`${row},${randomCol}`]: { ...BASE_PIECES[randomType], color } },
        spawnedCountB: spawnedCountB + 1
      });
    }
  }
}));
