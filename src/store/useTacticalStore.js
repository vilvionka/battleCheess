import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { BASE_PIECES, PIECE_TYPES } from '../game/constans'; // Проверьте правильность пути к константам
import { UPGRADE_RULES } from '../game/upgradeRules';




export const useTacticalStore = create(devtools((set, get) => ({
  boardSize: 8,
  board: {}, // Структура: { 'row,col': { type, color, hp, maxHp, atk, def, speed, atb } }
  gameStatus: 'setup',
  damagePopups: [],
  deadPopups: [],
  battleLogs: [],
  gameSnapshot: null,


  // МЕТА-ДАННЫЕ ИГРОКА И ПРОКАЧКА
  userProfile: null, // { id, username, wins, losses, victory_points }
  userPieces: {},    // { Pawn: 1, Knight: 1, ... }
  isLeaderboardOpen: false,
  isUpgradeMenuOpen: false,

  // Управление модальными окнами
  setLeaderboardOpen: (isOpen) => set({ isLeaderboardOpen: isOpen }),
  setUpgradeMenuOpen: (isOpen) => set({ isUpgradeMenuOpen: isOpen }),

  // Загрузка данных игрока из Supabase
  loadUserData: async (userId) => {
    const { supabase } = await import('../supabaseClient');

    // 1. Загружаем профиль (ники, победы, очки)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // 2. Загружаем уровни фигур
    const { data: pieces } = await supabase
      .from('user_pieces')
      .select('piece_type, level')
      .eq('user_id', userId);

    const piecesMap = {};
    if (pieces) {
      pieces.forEach(p => {
        piecesMap[p.piece_type] = p.level;
      });
    }

    set({ userProfile: profile, userPieces: piecesMap });
  },

  // Линейный апгрейд фигуры за Очки Победы (Victory Points)
  upgradePieceAction: async (pieceType) => {
    const { userProfile, userPieces } = get();
    if (!userProfile) return;

    const currentLevel = userPieces[pieceType] || 1;

    // ЖЕСТКИЙ БЛОК: Запрещаем качать выше 5 уровня
    if (currentLevel >= 5) {
      alert('Фигура уже достигла максимального уровня прокачки!');
      return;
    }

    // Рассчитываем стоимость улучшения (базовая стоимость * 1.5 за каждый уровень)
    const baseCosts = { Pawn: 10, Knight: 15, Bishop: 15, Rook: 20, Queen: 30, King: 40 };
    const cost = Math.ceil((baseCosts[pieceType] || 10) * Math.pow(1.5, currentLevel - 1));

    if (userProfile.victory_points < cost) {
      alert('Недостаточно очков победы! Сражайтесь и побеждайте в битвах.');
      return;
    }

    const { supabase } = await import('../supabaseClient');

    // 1. Списываем очки из профиля в БД
    const newPoints = userProfile.victory_points - cost;
    await supabase
      .from('profiles')
      .update({ victory_points: newPoints })
      .eq('id', userProfile.id);

    // 2. Повышаем уровень фигуры в БД
    const nextLevel = currentLevel + 1;
    await supabase
      .from('user_pieces')
      .update({ level: nextLevel })
      .match({ user_id: userProfile.id, piece_type: pieceType });

    // 3. Обновляем локальное состояние в Zustand, чтобы интерфейс мгновенно перерисовался
    set({
      userProfile: { ...userProfile, victory_points: newPoints },
      userPieces: { ...userPieces, [pieceType]: nextLevel }
    });
  },


  // ХАРАКТЕРИСТИКИ ДЛЯ СИСТЕМЫ СКОРОСТИ И ИНИЦИАТИВЫ
  activeSquareKey: null, // Клетка фигуры, которая ходит СЕЙЧАС
  turnPhase: 'action',   // Фазы внутри хода: 'action', 'has_moved', 'has_attacked'
  actionQueue: [],       // Лента будущих ходов (массив из 6 элементов squareKey)

  whiteBench: [
    { type: 'Pawn', color: 'w', hp: 5, maxHp: 5, atk: 3, def: 1, speed: 5, atb: 0, id: 'w-pawn' },
    { type: 'Knight', color: 'w', hp: 5, maxHp: 5, atk: 4, def: 2, speed: 6, atb: 0, id: 'w-knight' }, // ИСПРАВЛЕН БАГ 4:12
    { type: 'Bishop', color: 'w', hp: 6, maxHp: 6, atk: 4, def: 1, speed: 7, atb: 0, id: 'w-bishop' },
    { type: 'King', color: 'w', hp: 10, maxHp: 10, atk: 5, def: 3, speed: 5, atb: 0, id: 'w-king' },
    { type: 'Rook', color: 'w', hp: 7, maxHp: 7, atk: 5, def: 3, speed: 5, atb: 0, id: 'w-rook' },
    { type: 'Queen', color: 'w', hp: 5, maxHp: 5, atk: 8, def: 2, speed: 8, atb: 0, id: 'w-queen' },
  ],

  addLog: (text) => {
    set((state) => ({
      // Ограничим ленту, например, последними 50 сообщениями, чтобы не забивать память
      battleLogs: [text, ...state.battleLogs].slice(0, 50)
    }));
  },

  // Инициализация игры: выставляем сразу по 6 фигур каждому игроку
  initGame: () => {
    const { userPieces } = get();

    // Базовые характеристики фигур Игрока А (как в первой части вашего кода)
    const BASE_WHITE_PIECES = {
      Pawn: { type: 'Pawn', color: 'w', hp: 5, maxHp: 5, atk: 3, def: 1, speed: 5, atb: 0 },
      Knight: { type: 'Knight', color: 'w', hp: 5, maxHp: 5, atk: 4, def: 2, speed: 6, atb: 0 },
      Bishop: { type: 'Bishop', color: 'w', hp: 6, maxHp: 6, atk: 4, def: 1, speed: 7, atb: 0 },
      King: { type: 'King', color: 'w', hp: 10, maxHp: 10, atk: 5, def: 3, speed: 5, atb: 0 },
      Rook: { type: 'Rook', color: 'w', hp: 7, maxHp: 7, atk: 5, def: 3, speed: 5, atb: 0 },
      Queen: { type: 'Queen', color: 'w', hp: 5, maxHp: 5, atk: 8, def: 2, speed: 8, atb: 0 },
    };

    // Динамически собираем скамейку на основе уровней из Supabase/Zustand
    const dynamicWhiteBench = Object.keys(BASE_WHITE_PIECES).map(type => {
      const base = BASE_WHITE_PIECES[type];
      const level = userPieces[type] || 1; // Если данных нет, по умолчанию 1 уровень

      // Достаем бонусы для текущего уровня из таблицы правил
      const bonus = UPGRADE_RULES[type]?.bonuses[level] || { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 };

      return {
        ...base,
        id: `w-${type.toLowerCase()}`,
        level: level, // Записываем уровень прямо в объект фигуры для отображения!
        hp: base.hp + (bonus.hp || 0),
        maxHp: base.maxHp + (bonus.maxHp || 0),
        atk: base.atk + (bonus.atk || 0),
        def: base.def + (bonus.def || 0),
        speed: base.speed + (bonus.speed || 0),
        passive: bonus.passive || null // Если есть пассивка 5-го уровня, она пойдет в бой
      };
    });

    set({
      board: {}, // Доска пустая, ждем расстановку
      gameStatus: 'setup',
      deadPopups: [],
      damagePopups: [],
      turnPhase: 'action',
      activeSquareKey: null,
      actionQueue: [],
      battleLogs: ['Началась фаза расстановки фигур. Разместите войска на нижней линии!'],
      gameSnapshot: null,
      whiteBench: dynamicWhiteBench // Кладим в стор прокачанные фигуры
    });
  },

  // Экшен установки фигуры игроком на доску
  placeWhitePiece: (pieceId, squareKey) => {
    const { board, whiteBench } = get();
    const pieceIndex = whiteBench.findIndex(p => p.id === pieceId);
    if (pieceIndex === -1) return;

    const piece = whiteBench[pieceIndex];
    const newBoard = { ...board, [squareKey]: piece };
    const newBench = whiteBench.filter(p => p.id !== pieceId);

    set({ board: newBoard, whiteBench: newBench });

    // Если игрок выставил все 6 фигур, запускаем автоматическую расстановку ИИ и начинаем бой!
    if (newBench.length === 0) {
      get().autoPlaceBlackPieces(newBoard);
    }
  },

  // Экшен возврата фигуры с доски обратно на скамейку
  removeWhitePiece: (squareKey) => {
    const { board, whiteBench, gameStatus } = get();
    // Возвращать фигуры можно ТОЛЬКО во время фазы расстановки!
    if (gameStatus !== 'setup') return;

    const piece = board[squareKey];
    if (!piece || piece.color !== 'w') return;

    // Создаем копию доски и удаляем фигуру с клетки
    const newBoard = { ...board };
    delete newBoard[squareKey];

    // Возвращаем фигуру обратно на скамейку запасных
    const newBench = [...whiteBench, piece];

    set({
      board: newBoard,
      whiteBench: newBench
    });
  },


  // Автоматическая рандомная расстановка и динамическая прокачка ИИ (Черные)
  autoPlaceBlackPieces: (currentBoard) => {
    const { userPieces } = get();

    // 1. СЧИТАЕМ ИНВЕСТИЦИИ ИГРОКА (Сколько всего очков победы потрачено на текущие уровни)
    let totalPlayerSpent = 0;
    const baseCosts = { Pawn: 10, Knight: 15, Bishop: 15, Rook: 20, Queen: 30, King: 40 };

    Object.keys(baseCosts).forEach(type => {
      const currentLevel = userPieces[type] || 1;
      // Суммируем стоимость каждого купленного уровня для этой фигуры
      for (let lvl = 1; lvl < currentLevel; lvl++) {
        totalPlayerSpent += Math.ceil(baseCosts[type] * Math.pow(1.5, lvl - 1));
      }
    });

    // 2. СИМУЛЯЦИЯ КУЗНИЦЫ ДЛЯ ИИ (Тратим этот же бюджет случайным образом)
    const aiLevels = { Pawn: 1, Knight: 1, Bishop: 1, Rook: 1, Queen: 1, King: 1 };
    let aiBudget = totalPlayerSpent;
    const pieceTypes = ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'];

    // Компьютер пытается тратить очки, пока они есть
    let attempts = 0;
    while (aiBudget > 0 && attempts < 100) {
      attempts++;
      // Выбираем случайную фигуру
      const randomType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
      const currentAiLvl = aiLevels[randomType];

      // Проверяем ограничение максимального 5-го уровня
      if (currentAiLvl < 5) {
        const cost = Math.ceil(baseCosts[randomType] * Math.pow(1.5, currentAiLvl - 1));

        // Если хватает бюджета — ИИ "покупает" уровень себе
        if (aiBudget >= cost) {
          aiBudget -= cost;
          aiLevels[randomType] += 1;
        }
      }
    }

    // 3. БАЗОВЫЕ СТАТЫ ДЛЯ ЧЕРНЫХ ФИГУР
    const BASE_BLACK_PIECES = {
      Pawn: { type: 'Pawn', color: 'b', hp: 4, maxHp: 4, atk: 3, def: 1, speed: 5, atb: 0 },
      Knight: { type: 'Knight', color: 'b', hp: 5, maxHp: 5, atk: 4, def: 2, speed: 6, atb: 0 },
      Bishop: { type: 'Bishop', color: 'b', hp: 6, maxHp: 6, atk: 12, def: 1, speed: 2, atb: 0 },
      King: { type: 'King', color: 'b', hp: 10, maxHp: 10, atk: 5, def: 3, speed: 5, atb: 0 },
      Rook: { type: 'Rook', color: 'b', hp: 7, maxHp: 7, atk: 5, def: 3, speed: 5, atb: 0 },
      Queen: { type: 'Queen', color: 'b', hp: 6, maxHp: 6, atk: 6, def: 2, speed: 9, atb: 0 },
    };

    // Собираем массив готовых черных фигур с учетом случайной прокачки ИИ

    const dynamicBlackPieces = Object.keys(BASE_BLACK_PIECES).map(type => {
      const base = BASE_BLACK_PIECES[type];
      const level = aiLevels[type];

      // Находим бонус для уровня, сгенерированного для ИИ
      const bonus = UPGRADE_RULES[type]?.bonuses[level] || { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 };

      return {
        ...base,
        level: level, // Записываем сгенерированный уровень ИИ в объект для UI
        hp: base.hp + (bonus.hp || 0),
        maxHp: base.maxHp + (bonus.maxHp || 0),
        atk: base.atk + (bonus.atk || 0),
        def: base.def + (bonus.def || 0),
        speed: base.speed + (bonus.speed || 0),
        passive: bonus.passive || null // ИИ тоже получает суперспособности 5 уровня!
      };
    });

    // 4. РАНДОМНАЯ РАССТАНОВКА НА ПЕРВОЙ ЛИНИИ (Ряд 0)
    const newBoard = { ...currentBoard };
    const availableCols = [1, 2, 3, 4, 5, 6];

    // Перемешиваем колонки (алгоритм Фишера-Йетса)
    for (let i = availableCols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = availableCols[i];
      availableCols[i] = availableCols[j];
      availableCols[j] = temp;
    }

    // Выставляем прокачанные фигуры ИИ на доску
    dynamicBlackPieces.forEach((piece, index) => {
      const col = availableCols[index];
      newBoard[`0,${col}`] = piece;

      // Если у ИИ получилась фигура 5 уровня, пишем об этом в лог
      if (piece.level === 5) {
        get().addLog(`⚠️ Внимание! Компьютер выставил легендарного воина: Черный [${piece.type}] 5-го уровня!`);
      }
    });

    // Переводим игру в активную фазу и считаем первый ход
    set({ board: newBoard, gameStatus: 'playing' });
    get().addLog(`Сражение началось! Баланс сил соблюден: ИИ распределил ${totalPlayerSpent} очков на прокачку.`);
    get().calculateNextTurns();
  },


  undoTurn: () => {
    const { gameSnapshot } = get();
    if (!gameSnapshot) return; // Если истории нет (самый первый ход), ничего не делаем

    // Восстанавливаем всё состояние из сохраненного снимка
    set({
      board: gameSnapshot.board,
      gameStatus: gameSnapshot.gameStatus,
      activeSquareKey: gameSnapshot.activeSquareKey,
      turnPhase: gameSnapshot.turnPhase,
      actionQueue: gameSnapshot.actionQueue,
      battleLogs: gameSnapshot.battleLogs,
      // Попапы лучше очистить, чтобы они не зависали при откате
      damagePopups: [],
      deadPopups: [],
      // Очищаем историю, чтобы нельзя было бесконечно спамить назад за один ход 
      // (или оставьте, если хотите сделать глубокую историю)
      gameSnapshot: null
    });
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
  movePieceAction: (fromKey, toKey) => {
    const { board, turnPhase, getAvailableTargets, addLog } = get();
    if (!get().isValidMoveZone(fromKey, toKey)) return;

    const piece = board[fromKey];

    // Сохранение снимка истории для Бевых ДО совершения шага
    if (piece.color === 'w' && turnPhase === 'action') {
      set({
        gameSnapshot: {
          board: JSON.parse(JSON.stringify(board)),
          gameStatus: get().gameStatus,
          activeSquareKey: fromKey,
          turnPhase: 'action',
          actionQueue: [...get().actionQueue],
          battleLogs: [...get().battleLogs]
        }
      });
    }

    const playerName = piece.color === 'w' ? 'Игрок А' : 'Игрок B (Компьютер)';
    const pieceNames = { King: 'Король', Queen: 'Ферзь', Rook: 'Ладья', Bishop: 'Слон', Knight: 'Конь', Pawn: 'Пешка' };
    const pieceFullName = `${playerName} [${pieceNames[piece.type] || piece.type}]`;

    // Создаем копию доски и перемещаем фигуру
    let newBoard = { ...board };
    newBoard[toKey] = { ...newBoard[fromKey] };
    delete newBoard[fromKey];

    // =========================================================================
    // ВРОЖДЕННАЯ СПОСОБНОСТЬ: ПРЕВРАЩЕНИЕ ПЕШКИ В ФЕРЗЯ ALWAYS
    // =========================================================================
    const [targetRow] = toKey.split(',').map(Number);

    // Белая пешка дошла до 0 ряда или Черная пешка дошла до 7 ряда
    const isPromotion = piece.type === 'Pawn' && ((piece.color === 'w' && targetRow === 0) || (piece.color === 'b' && targetRow === 7));

    if (isPromotion) {
      // Базовые характеристики Ферзя для Белых и Черных
      const baseStats = piece.color === 'w'
        ? { hp: 5, maxHp: 5, atk: 8, def: 2, speed: 8 }
        : { hp: 6, maxHp: 6, atk: 6, def: 2, speed: 9 };

      // Вычисляем уровень нового Ферзя
      let targetLevel = 1;
      if (piece.color === 'w') {
        const { userPieces } = get();
        targetLevel = userPieces['Queen'] || 1; // Берем уровень прокачки Ферзя игрока
      } else {
        targetLevel = piece.level || 1; // Для ИИ берем уровень самой пешки, которая дошла
      }

      // Подтягиваем бонусы характеристик для этого уровня Ферзя
      const { UPGRADE_RULES } = get();
      const bonus = UPGRADE_RULES['Queen']?.bonuses[targetLevel] || { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 };

      // Заменяем пешку на полноценного прокачанного Ферзя
      newBoard[toKey] = {
        type: 'Queen',
        color: piece.color,
        level: targetLevel,
        hp: baseStats.hp + (bonus.hp || 0),
        maxHp: baseStats.maxHp + (bonus.maxHp || 0),
        atk: baseStats.atk + (bonus.atk || 0),
        def: baseStats.def + (bonus.def || 0),
        speed: baseStats.speed + (bonus.speed || 0),
        atb: piece.atb, // Сохраняем шкалу хода
        passive: bonus.passive || null // Пассивка "Казнь" включится, если Ферзь 5-го уровня
      };

      addLog(`✨ Коронация! ${pieceFullName} прорывается к краю и превращается в мощного Ферзя [Lvl ${targetLevel}]!`);
    } else {
      // Обычный лог движения
      addLog(`${pieceFullName} ходит с клетки [${fromKey}] на клетку [${toKey}]`);
    }

    // Записываем обновленную доску в Zustand
    set({ board: newBoard });

    // Проверяем фазы хода дальше
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


  executeAttack: (attackerKey, targetKey) => {
    const { board, getAdjacencyType, canPieceAttackInDirection, turnPhase } = get();

    const originalAttacker = board[attackerKey];
    const originalTarget = board[targetKey];

    if (!originalAttacker || !originalTarget) return;

    // Триггер обновления истории при прямом ударе из фазы action
    if (originalAttacker.color === 'w' && turnPhase === 'action') {
      set({
        gameSnapshot: {
          board: JSON.parse(JSON.stringify(board)),
          gameStatus: get().gameStatus,
          activeSquareKey: attackerKey,
          turnPhase: 'action',
          actionQueue: [...get().actionQueue],
          battleLogs: [...get().battleLogs]
        }
      });
    }

    const newBoard = { ...board };
    const newPopups = [];
    const newDeadPopups = [];

    const target = { ...originalTarget };
    const attacker = { ...originalAttacker };

    const attackerName = originalAttacker.color === 'w' ? 'Игрок А' : 'Игрок B (Компьютер)';
    const targetName = originalTarget.color === 'w' ? 'Игрок А' : 'Игрок B (Компьютер)';
    const pieceNames = { King: 'Король', Queen: 'Ферзь', Rook: 'Ладья', Bishop: 'Слон', Knight: 'Конь', Pawn: 'Пешка' };

    const attStr = `${attackerName} [${pieceNames[originalAttacker.type]}]`;
    const tarStr = `${targetName} [${pieceNames[originalTarget.type]}]`;

    let logMessage = '';

    // =========================================================================
    // ПАССИВКА 1: УКЛОНЕНИЕ (Пешка 5 уровня, 25% шанс полностью избежать урона)
    // =========================================================================
    if (target.passive === 'evade' && Math.random() < 0.25) {
      logMessage = `${attStr} атакует ${tarStr}, но цель ловко уклоняется от удара! 💨`;

      // Показываем поп-ап уклонения вместо цифры урона
      newPopups.push({ id: `${Date.now()}-ev-${Math.random()}`, squareKey: targetKey, amount: 'Промах' });
    } else {
      // =========================================================================
      // РАСЧЕТ БАЗОВОГО УРОНА И ПАССИВКА 5: КАЗНЬ (Ферзь 5 уровня, +50% урона раненым)
      // =========================================================================
      let baseAtk = attacker.atk;
      if (attacker.passive === 'execute' && target.hp <= target.maxHp / 2) {
        baseAtk = Math.floor(baseAtk * 1.5);
        logMessage += `[💥 КАЗНЬ] `;
      }

      let dmgToTarget = Math.max(1, baseAtk - target.def);
      logMessage += `${attStr} атакует ${tarStr} на клетке [${targetKey}] и наносит -${dmgToTarget} урона.`;

      target.hp -= dmgToTarget;
      newPopups.push({ id: `${Date.now()}-t-${Math.random()}`, squareKey: targetKey, amount: dmgToTarget });

      // =========================================================================
      // ПАССИВКА 3: ВАМПИРИЗМ (Слон 5 уровня, 50% отхила от нанесенного урона)
      // =========================================================================
      if (attacker.passive === 'lifesteal' && attacker.hp > 0) {
        const healAmount = Math.floor(dmgToTarget * 0.5);
        if (healAmount > 0) {
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
          logMessage += ` Вкусив крови, Слон исцеляется на +${healAmount} HP.`;
        }
      }

      // =========================================================================
      // ПАССИВКА 4: ОТВЕТНЫЙ ШИП (Ладья 5 уровня, возвращает 2 ед. чистого урона)
      // =========================================================================
      if (target.passive === 'thorns' && attacker.hp > 0) {
        attacker.hp -= 2;
        logMessage += ` Острые шипы Ладьи возвращают -2 урона нападающему.`;
        newPopups.push({ id: `${Date.now()}-th-${Math.random()}`, squareKey: attackerKey, amount: 2 });
      }
    }

    // =========================================================================
    // ПАССИВКА 6: БЕССМЕРТИЕ (Король 5 уровня, выживает с 1 HP один раз за игру)
    // =========================================================================
    if (target.hp <= 0 && target.passive === 'immortality' && !target.hasUsedImmortality) {
      target.hp = 1;
      target.hasUsedImmortality = true; // Вешаем флаг, чтобы способность сработала только 1 раз
      logMessage += ` ✨ Королевский оберег спасает от гибели, оставляя 1 HP!`;
    }

    // Обработка смерти или выживания цели
    if (target.hp <= 0) {
      delete newBoard[targetKey];
      newDeadPopups.push({ id: `${Date.now()}-dt-${Math.random()}`, squareKey: targetKey });
      logMessage += ` ${tarStr} погибает! 💀`;
    } else {
      newBoard[targetKey] = target;
    }

    // ==========================================
    // ЛОГИКА КОНТРУДАРА В ОТВЕТ (Только если цель выжила и нападающий жив)
    // ==========================================
    if (target.hp > 0 && attacker.hp > 0) {
      const revAdjType = getAdjacencyType(targetKey, attackerKey);

      if (canPieceAttackInDirection(target.type, target.color, revAdjType, targetKey, attackerKey)) {
        const counterAtk = Math.ceil(target.atk / 2);
        const dmgToAttacker = Math.max(1, counterAtk - attacker.def);
        logMessage += ` Получает контрудар на -${dmgToAttacker} урона.`;
        attacker.hp -= dmgToAttacker;

        newPopups.push({ id: `${Date.now()}-a-${Math.random()}`, squareKey: attackerKey, amount: dmgToAttacker });
      }
    }

    // Проверяем выживание самого нападающего (мог умереть от шипов или контрудара)
    if (attacker.hp <= 0) {
      delete newBoard[attackerKey];
      newDeadPopups.push({ id: `${Date.now()}-da-${Math.random()}`, squareKey: attackerKey });
      logMessage += ` ${attStr} погибает в бою! 💀`;
    } else {
      newBoard[attackerKey] = attacker;
    }

    // Менеджмент поп-апов урона
    if (newPopups.length > 0) {
      set((state) => ({ damagePopups: [...state.damagePopups, ...newPopups] }));
      setTimeout(() => {
        const idsToRemove = newPopups.map(p => p.id);
        set((state) => ({ damagePopups: state.damagePopups.filter(p => !idsToRemove.includes(p.id)) }));
      }, 1000);
    }

    // Менеджмент поп-апов смертей
    if (newDeadPopups.length > 0) {
      set((state) => ({ deadPopups: [...state.deadPopups, ...newDeadPopups] }));
      setTimeout(() => {
        const idsToRemove = newDeadPopups.map(p => p.id);
        set((state) => ({ deadPopups: state.deadPopups.filter(p => !idsToRemove.includes(p.id)) }));
      }, 1000);
    }

    set({ board: newBoard });
    get().addLog(logMessage);

    // Проверка условий победы
    const figures = Object.values(newBoard);
    const isWhiteKingAlive = figures.some(p => p.type === 'King' && p.color === 'w');
    const isBlackKingAlive = figures.some(p => p.type === 'King' && p.color === 'b');

    // Функция сохранения статистики в Supabase
    const updateDatabaseStats = async (isWin) => {
      const { userProfile } = get();
      if (!userProfile) return;

      try {
        const { supabase } = await import('../supabaseClient');
        const rewardPoints = isWin ? 15 : 0;
        const newWins = isWin ? userProfile.wins + 1 : userProfile.wins;
        const newLosses = isWin ? userProfile.losses : userProfile.losses + 1;
        const newVictoryPoints = userProfile.victory_points + rewardPoints;

        await supabase
          .from('profiles')
          .update({ wins: newWins, losses: newLosses, victory_points: newVictoryPoints })
          .eq('id', userProfile.id);

        set({
          userProfile: { ...userProfile, wins: newWins, losses: newLosses, victory_points: newVictoryPoints }
        });

        if (isWin) get().addLog(`🎉 Вы победили! Вам начислено +${rewardPoints} Очков Победы.`);
        else get().addLog(`💀 Вы проиграли. Попробуйте изменить тактику расстановки.`);
      } catch (err) {
        console.error('Ошибка сохранения статистики:', err.message);
      }
    };

    if (!isWhiteKingAlive) {
      set({ gameStatus: 'b-win' });
      updateDatabaseStats(false);
      return;
    }
    if (!isBlackKingAlive) {
      set({ gameStatus: 'w-win' });
      updateDatabaseStats(true);
      return;
    }

    // Смена фаз
    let nextPhase = 'end_turn';

    // =========================================================================
    // ПАССИВКА 2: ДВОЙНОЙ ХОД (Конь 5 уровня, 20% шанс не завершать ход после атаки)
    // =========================================================================
    if (attacker.passive === 'double_strike' && newBoard[attackerKey] && Math.random() < 0.20 && turnPhase === 'action') {
      nextPhase = 'action'; // Фаза остается 'action', позволяя Коню походить или ударить еще раз!
      get().addLog(`⚡ [ПОВТОРНЫЙ ХОД] Скорость Коня позволяет ему совершить еще одно действие!`);
    } else if (turnPhase === 'action' && newBoard[attackerKey]) {
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
    const { board, gameSnapshot } = get();
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

})));
