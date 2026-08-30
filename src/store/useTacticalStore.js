import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { BASE_PIECES, PIECE_TYPES } from '../game/constans'; // Проверьте правильность пути к константам

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
      // Сбрасываем скамейку в дефолт
      whiteBench: [
        { type: 'Pawn', color: 'w', hp: 5, maxHp: 5, atk: 3, def: 1, speed: 5, atb: 0, id: 'w-pawn' },
        { type: 'Knight', color: 'w', hp: 5, maxHp: 5, atk: 4, def: 2, speed: 6, atb: 0, id: 'w-knight' },
        { type: 'Bishop', color: 'w', hp: 6, maxHp: 6, atk: 4, def: 1, speed: 7, atb: 0, id: 'w-bishop' },
        { type: 'King', color: 'w', hp: 10, maxHp: 10, atk: 5, def: 3, speed: 5, atb: 0, id: 'w-king' },
        { type: 'Rook', color: 'w', hp: 7, maxHp: 7, atk: 5, def: 3, speed: 5, atb: 0, id: 'w-rook' },
        { type: 'Queen', color: 'w', hp: 5, maxHp: 5, atk: 8, def: 2, speed: 8, atb: 0, id: 'w-queen' },
      ]
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


  autoPlaceBlackPieces: (currentBoard) => {
    const blackPieces = [
      { type: 'Pawn', color: 'b', hp: 4, maxHp: 4, atk: 3, def: 1, speed: 5, atb: 0 },
      { type: 'Knight', color: 'b', hp: 5, maxHp: 5, atk: 4, def: 2, speed: 6, atb: 0 },
      { type: 'Bishop', color: 'b', hp: 6, maxHp: 6, atk: 12, def: 1, speed: 2, atb: 0 },
      { type: 'King', color: 'b', hp: 10, maxHp: 10, atk: 5, def: 3, speed: 5, atb: 0 },
      { type: 'Rook', color: 'b', hp: 7, maxHp: 7, atk: 5, def: 3, speed: 5, atb: 0 },
      { type: 'Queen', color: 'b', hp: 6, maxHp: 6, atk: 6, def: 2, speed: 9, atb: 0 },
    ];

    const newBoard = { ...currentBoard };
    // Доступные колонки на первой линии черных (ряд 0)
    const availableCols = [1, 2, 3, 4, 5, 6];

    // Перемешиваем колонки случайным образом (алгоритм Фишера-Йетса)
    for (let i = availableCols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCols[i], availableCols[j]] = [availableCols[j], availableCols[i]];
    }

    // Расставляем черные фигуры по перемешанным клеткам ряда 0
    blackPieces.forEach((piece, index) => {
      const col = availableCols[index];
      newBoard[`0,${col}`] = piece;
    });

    // Переводим игру в активную фазу и считаем первый ход
    set({ board: newBoard, gameStatus: 'playing' });
    get().addLog('Сражение началось! Компьютер разместил свои фигуры.');
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
  // Перемещение активной фигуры
  movePieceAction: (fromKey, toKey) => {
    const { board, turnPhase, getAvailableTargets, addLog, gameSnapshot } = get();
    if (!get().isValidMoveZone(fromKey, toKey)) return;

    const piece = board[fromKey];


    if (piece.color === 'w' && turnPhase === 'action') {

      // Проверяем: если в прошлый раз мы сохраняли этот же ход (совпадает activeSquareKey) 
      // И количество логов не изменилось — значит это старый снимок, его НАДО обновить свежим ходом!
      set({
        gameSnapshot: {
          board: JSON.parse(JSON.stringify(board)), // Чистая доска ДО текущего шага
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

    // Формируем красивое имя, например: "Игрок А (Конь)"
    const pieceFullName = `${playerName} [${pieceNames[piece.type] || piece.type}]`;

    const newBoard = { ...board };
    newBoard[toKey] = { ...newBoard[fromKey] };
    delete newBoard[fromKey];

    set({ board: newBoard });

    // --- ВОТ ТУТ ДОБАВЛЯЕМ ЛОГ ДВИЖЕНИЯ ---
    addLog(`${pieceFullName} ходит с клетки [${fromKey}] на клетку [${toKey}]`);

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

    // 1. БЕЗОПАСНАЯ ПРОВЕРКА (Берем ссылки, ничего не копируя)
    const originalAttacker = board[attackerKey];
    const originalTarget = board[targetKey];

    // Если кого-то нет — мгновенно и безопасно выходим, код никогда не упадет
    if (!originalAttacker || !originalTarget) return;

    // --- ЖЕЛЕЗНЫЙ ТРИГГЕР ОБНОВЛЕНИЯ ИСТОРИИ ПРИ ПРЯМОМ УДАРЕ ---
    // Если человек бьет сразу из фазы 'action' (без предварительного шага) — обновляем историю свежими данными
    if (originalAttacker.color === 'w' && turnPhase === 'action') {
      set({
        gameSnapshot: {
          board: JSON.parse(JSON.stringify(board)), // Чистая доска ДО удара
          gameStatus: get().gameStatus,
          activeSquareKey: attackerKey,
          turnPhase: 'action',
          actionQueue: [...get().actionQueue],
          battleLogs: [...get().battleLogs]
        }
      });
    }

    // 2. ПОДГОТОВКА НОВЫХ ДАННЫХ
    const newBoard = { ...board };
    const newPopups = [];
    const newDeadPopups = [];

    // Создаем изолированные копии объектов для безопасного изменения их HP
    const target = { ...originalTarget };
    const attacker = { ...originalAttacker }; // ТЕПЕРЬ ПЕРЕМЕННАЯ СУЩЕСТВУЕТ И БЕЗОПАСНА


    // Найди место в executeAttack ПЕРЕД проверкой условий победы (Шаг 6)
    // Создаем текстовое описание боя:
    const attackerName = originalAttacker.color === 'w' ? 'Игрок А' : 'Игрок B (Компьютер)';
    const targetName = originalTarget.color === 'w' ? 'Игрок А' : 'Игрок B (Компьютер)';
    const pieceNames = { King: 'Король', Queen: 'Ферзь', Rook: 'Ладья', Bishop: 'Слон', Knight: 'Конь', Pawn: 'Пешка' };

    const attStr = `${attackerName} [${pieceNames[originalAttacker.type]}]`;
    const tarStr = `${targetName} [${pieceNames[originalTarget.type]}]`;



    // ==========================================
    // 1. ПРЯМОЙ УРОН (Игрок бьет врага)
    // ==========================================
    const dmgToTarget = Math.max(1, attacker.atk - target.def);
    // 1. Текст про основной удар
    let logMessage = `${attStr} атакует ${tarStr} на клетке [${targetKey}] и наносит -${dmgToTarget} урона.`;
    target.hp -= dmgToTarget;

    const popupTargetId = `${Date.now()}-t-${Math.random()}`;
    newPopups.push({ id: popupTargetId, squareKey: targetKey, amount: dmgToTarget });

    // Обновление цели на доске
    if (target.hp <= 0) {
      delete newBoard[targetKey]; // Враг умер, удаляем из новой доски
      newDeadPopups.push({ id: `${Date.now()}-dt-${Math.random()}`, squareKey: targetKey });
      logMessage += ` ${tarStr} погибает! 💀`;
    } else {
      newBoard[targetKey] = target; // Враг выжил, сохраняем обновленную копию
    }



    // ==========================================
    // 2. ЛОГИКА КОНТРУДАРА В ОТВЕТ (Только если цель выжила!)
    // ==========================================
    if (target.hp > 0) {
      const revAdjType = getAdjacencyType(targetKey, attackerKey);

      if (canPieceAttackInDirection(target.type, target.color, revAdjType, targetKey, attackerKey)) {
        const counterAtk = Math.ceil(target.atk / 2);
        const dmgToAttacker = Math.max(1, counterAtk - attacker.def);
        logMessage += ` Получает контрудар на -${dmgToAttacker} урона.`;
        attacker.hp -= dmgToAttacker;

        const popupAttackerId = `${Date.now()}-a-${Math.random()}`;
        newPopups.push({ id: popupAttackerId, squareKey: attackerKey, amount: dmgToAttacker });
      }
    }

    // ==========================================
    // 3. Проверяем выживание самого нападающего
    // ==========================================
    if (attacker.hp <= 0) {
      delete newBoard[attackerKey];
      newDeadPopups.push({ id: `${Date.now()}-da-${Math.random()}`, squareKey: attackerKey });
      logMessage += ` ${attStr} погибает от ответного удара! 💀`;

    } else {
      newBoard[attackerKey] = attacker;
    }

    // ==========================================
    // 4. Менеджмент поп-апов урона
    // ==========================================
    if (newPopups.length > 0) {
      set((state) => ({ damagePopups: [...state.damagePopups, ...newPopups] }));
      setTimeout(() => {
        const idsToRemove = newPopups.map(p => p.id);
        set((state) => ({ damagePopups: state.damagePopups.filter(p => !idsToRemove.includes(p.id)) }));
      }, 1000);
    }

    // ==========================================
    // 5. Менеджмент поп-апов смертей
    // ==========================================
    if (newDeadPopups.length > 0) {
      set((state) => ({ deadPopups: [...state.deadPopups, ...newDeadPopups] }));
      setTimeout(() => {
        const idsToRemove = newDeadPopups.map(p => p.id);
        set((state) => ({ deadPopups: state.deadPopups.filter(p => !idsToRemove.includes(p.id)) }));
      }, 1000);
    }

    // Записываем обновленную доску в Zustand
    set({ board: newBoard });
    get().addLog(logMessage);

    // ==========================================
    // 6. Проверка условий победы
    // ==========================================
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

    // ==========================================
    // 7. Смена фаз
    // ==========================================
    let nextPhase = 'end_turn';
    if (turnPhase === 'action' && newBoard[attackerKey]) {
      nextPhase = 'has_attacked';
    }

    if (nextPhase === 'end_turn') {
      set({ activeSquareKey: null });
      get().endTurn(); // Завершаем ход
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
