export const UPGRADE_RULES = {
  Pawn: {
    maxLevel: 5,
    baseCost: 10,
    desc: '+1 HP, +1 ATK за уровень',
    // Бонусы, которые ДОБАВЛЯЮТСЯ к базовым статам на каждом уровне
    bonuses: {
      1: { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 },
      2: { hp: 1, maxHp: 1, atk: 1, def: 0, speed: 0 },
      3: { hp: 2, maxHp: 2, atk: 2, def: 0, speed: 0 },
      4: { hp: 3, maxHp: 3, atk: 3, def: 0, speed: 0 },
      5: { hp: 4, maxHp: 4, atk: 4, def: 0, speed: 0, passive: 'evade' } // Уклонение
    },
    passiveDesc: '⭐ На 5 уровне: 25% шанс уклониться от любой атаки!'
  },
  Knight: {
    maxLevel: 5,
    baseCost: 15,
    desc: '+1 HP, +1 Speed за уровень',
    bonuses: {
      1: { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 },
      2: { hp: 1, maxHp: 1, atk: 0, def: 0, speed: 1 },
      3: { hp: 2, maxHp: 2, atk: 0, def: 0, speed: 2 },
      4: { hp: 3, maxHp: 3, atk: 0, def: 0, speed: 3 },
      5: { hp: 4, maxHp: 4, atk: 0, def: 0, speed: 4, passive: 'double_strike' } // Двойной ход
    },
    passiveDesc: '⭐ На 5 уровне: 20% шанс получить фазу повторного хода после движения!'
  },
  Bishop: {
    maxLevel: 5,
    baseCost: 15,
    desc: '+2 ATK за уровень',
    bonuses: {
      1: { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 },
      2: { hp: 0, maxHp: 0, atk: 2, def: 0, speed: 0 },
      3: { hp: 0, maxHp: 0, atk: 4, def: 0, speed: 0 },
      4: { hp: 0, maxHp: 0, atk: 6, def: 0, speed: 0 },
      5: { hp: 0, maxHp: 0, atk: 8, def: 0, speed: 0, passive: 'lifesteal' } // Вампиризм
    },
    passiveDesc: '⭐ На 5 уровне: Восстанавливает HP в размере 50% от нанесенного урона!'
  },
  Rook: {
    maxLevel: 5,
    baseCost: 20,
    desc: '+2 HP, +1 DEF за уровень',
    bonuses: {
      1: { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 },
      2: { hp: 2, maxHp: 2, atk: 0, def: 1, speed: 0 },
      3: { hp: 4, maxHp: 4, atk: 0, def: 2, speed: 0 },
      4: { hp: 6, maxHp: 6, atk: 0, def: 3, speed: 0 },
      5: { hp: 8, maxHp: 8, atk: 0, def: 4, speed: 0, passive: 'thorns' } // Ответный шип
    },
    passiveDesc: '⭐ На 5 уровне: Возвращает нападающему врагу 2 единицы чистого урона при ударе!'
  },
  Queen: {
    maxLevel: 5,
    baseCost: 30,
    desc: '+2 ATK, +1 Speed за уровень',
    bonuses: {
      1: { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 },
      2: { hp: 0, maxHp: 0, atk: 2, def: 0, speed: 1 },
      3: { hp: 0, maxHp: 0, atk: 4, def: 0, speed: 2 },
      4: { hp: 0, maxHp: 0, atk: 6, def: 0, speed: 3 },
      5: { hp: 0, maxHp: 0, atk: 8, def: 0, speed: 4, passive: 'execute' } // Казнь раненых
    },
    passiveDesc: '⭐ На 5 уровне: Наносит на 50% больше урона, если у цели осталось меньше половины HP!'
  },
  King: {
    maxLevel: 5,
    baseCost: 40,
    desc: '+3 HP, +1 DEF за уровень',
    bonuses: {
      1: { hp: 0, maxHp: 0, atk: 0, def: 0, speed: 0 },
      2: { hp: 3, maxHp: 3, atk: 0, def: 1, speed: 0 },
      3: { hp: 6, maxHp: 6, atk: 0, def: 2, speed: 0 },
      4: { hp: 9, maxHp: 9, atk: 0, def: 3, speed: 0 },
      5: { hp: 12, maxHp: 12, atk: 0, def: 4, speed: 0, passive: 'immortality' } // Бессмертие на 1 удар
    },
    passiveDesc: '⭐ На 5 уровне: Один раз за игру при получении смертельного урона выживает с 1 HP!'
  }
};

// Функция расчета стоимости следующего апгрейда
export const getUpgradeCost = (type, currentLevel) => {
  const config = UPGRADE_RULES[type];
  if (!config || currentLevel >= config.maxLevel) return null; // Если кап — цены нет
  return Math.ceil(config.baseCost * Math.pow(1.5, currentLevel - 1));
};
