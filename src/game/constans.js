export const BASE_PIECES = {
  King: { type: 'King', maxHp: 10, hp: 10, atk: 3, def: 2 },
  Queen: { type: 'Queen', maxHp: 8, hp: 8, atk: 5, def: 3 },
  Rook: { type: 'Rook', maxHp: 6, hp: 6, atk: 4, def: 2 },
  Bishop: { type: 'Bishop', maxHp: 5, hp: 5, atk: 5, def: 2 },
  Knight: { type: 'Knight', maxHp: 5, hp: 5, atk: 4, def: 1 },
  Pawn: { type: 'Pawn', maxHp: 3, hp: 3, atk: 2, def: 0 },
};

export const PIECE_TYPES = ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen'];
