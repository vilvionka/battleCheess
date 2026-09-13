import React, { useEffect, useMemo } from 'react';
import { useTacticalStore } from '../../store/useTacticalStore';
import { useTacticalAI } from '../../hooks/useTacticalAI'; // 1. Импортируем наш новый хук ИИ
import { Chat } from '../chat/Chat';
import { Turn } from '../turn/Turn';
import { Button } from '../button/Button';
import { Bench } from '../bench/Bench';
import { Win } from '../winer/Win';
import { Square } from '../square/Square';
import { Header } from '../header/Header';
import { UpgradeModal } from '../modals/UpgradeModal';
import { LeaderboardModal } from '../modals/LeaderboardModal';
import { supabase } from '../../supabaseClient';
import './Board.css';

// Импортируем картинки для Белых фигур
import kingW from '../../assets/king_w.jpeg';
import queenW from '../../assets/queen_w.jpeg';
import rookW from '../../assets/rook_w.jpg';
import bishopW from '../../assets/bishop_w.jpg';
import knightW from '../../assets/knight_w.jpg';
import pawnW from '../../assets/pawn_w.png';
// Импортируем картинки для Черных фигур
import kingB from '../../assets/king_b.jpg';
import queenB from '../../assets/queen_b.jpg';
import rookB from '../../assets/rook_b.jpg';
import bishopB from '../../assets/bishop_b.jpg';
import knightB from '../../assets/knight_b.jpg';
import pawnB from '../../assets/pawn_b.jpg';


const PIECE_IMAGES = {
  King_w: kingW, King_b: kingB,
  Queen_w: queenW, Queen_b: queenB,
  Rook_w: rookW, Rook_b: rookB,
  Bishop_w: bishopW, Bishop_b: bishopB,
  Knight_w: knightW, Knight_b: knightB,
  Pawn_w: pawnW, Pawn_b: pawnB,
};

export function Board() {
  const board = useTacticalStore(state => state.board);
  const boardSize = useTacticalStore(state => state.boardSize);
  const activeSquareKey = useTacticalStore(state => state.activeSquareKey);
  const turnPhase = useTacticalStore(state => state.turnPhase);
  const actionQueue = useTacticalStore(state => state.actionQueue);
  const gameStatus = useTacticalStore(state => state.gameStatus);
  const damagePopups = useTacticalStore(state => state.damagePopups);
  const deadPopups = useTacticalStore(state => state.deadPopups);

  const initGame = useTacticalStore(state => state.initGame);
  const endTurn = useTacticalStore(state => state.endTurn);
  const movePieceAction = useTacticalStore(state => state.movePieceAction);
  const executeAttack = useTacticalStore(state => state.executeAttack);
  const isValidMoveZone = useTacticalStore(state => state.isValidMoveZone);
  const getAvailableTargets = useTacticalStore(state => state.getAvailableTargets);
  const getAdjacencyType = useTacticalStore(state => state.getAdjacencyType);
  const canPieceAttackInDirection = useTacticalStore(state => state.canPieceAttackInDirection);

  const gameSnapshot = useTacticalStore(state => state.gameSnapshot);
  const undoTurn = useTacticalStore(state => state.undoTurn);

  const whiteBench = useTacticalStore(state => state.whiteBench);
  const placeWhitePiece = useTacticalStore(state => state.placeWhitePiece);
  const removeWhitePiece = useTacticalStore(state => state.removeWhitePiece);

  const loadUserData = useTacticalStore(state => state.loadUserData);


  useTacticalAI();
  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        loadUserData(user.id);
      }
    };
    initUser();
  }, [loadUserData]);

  const activePiece = activeSquareKey ? board[activeSquareKey] : null;

  // Расчет подсветок ходов и атак
  const { validMoves, validTargets } = useMemo(() => {
    const moves = [];
    let targets = [];
    if (activeSquareKey && activePiece) {
      if (turnPhase === 'action' || turnPhase === 'has_attacked') {
        for (let r = 0; r < boardSize; r++) {
          for (let c = 0; c < boardSize; c++) {
            if (isValidMoveZone && isValidMoveZone(activeSquareKey, `${r},${c}`)) {
              moves.push(`${r},${c}`);
            }
          }
        }
      }
      if (turnPhase === 'action' || turnPhase === 'has_moved') {
        if (getAvailableTargets) {
          targets = getAvailableTargets(activeSquareKey);
        }
      }
    }
    return { validMoves: moves, validTargets: targets };
  }, [activeSquareKey, turnPhase, boardSize, board, activePiece, isValidMoveZone, getAvailableTargets]);






  // Обработчики Drag & Drop для фазы расстановки
  const handleDragStart = (e, pieceId) => {
    e.dataTransfer.setData('text/plain', pieceId);
  };

  const handleDragOver = (e, row) => {
    // Разрешаем дроп только если это фаза расстановки и это 7-й ряд (последняя линия белых)
    if (gameStatus === 'setup' && row === 7) {
      e.preventDefault();
    }
  };

  const handleDrop = (e, row, col) => {
    e.preventDefault();
    const pieceId = e.dataTransfer.getData('text/plain');
    const targetKey = `${row},${col}`;

    // Проверяем, что клетка на первой линии белых свободна
    if (row === 7 && !board[targetKey]) {
      placeWhitePiece(pieceId, targetKey);
    }
  };

  // Срабатывает, когда мы тащим фигуру ИЗ доски ОБРАТНО на скамейку
  const handleBenchDragOver = (e) => {
    if (gameStatus === 'setup') {
      e.preventDefault(); // Разрешаем сброс на область скамейки
    }
  };

  const handleBenchDrop = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');

    // Проверяем, откуда идет перетаскивание. 
    // Если в данных записаны координаты клетки (например "7,3"), значит фигуру возвращают с доски
    if (data.includes(',')) {
      removeWhitePiece(data);
    }
  };





  const handleSquareClick = (row, col) => {

    const key = `${row},${col}`;
    if (!activeSquareKey) return;

    if (validMoves.includes(key)) {
      movePieceAction(activeSquareKey, key);
    } else if (validTargets.includes(key)) {
      executeAttack(activeSquareKey, key);
    }
  };

  // 2. Генерируем одномерный массив индексов для сетки 8x8 (0 до 63)
  const gridCells = useMemo(() => Array.from({ length: boardSize * boardSize }), [boardSize]);

  // Изменяем финальный return компонента Board, добавляя скамейку слева:
  return (
    <>
      {/* Выводим Header в самый верх приложения */}
      <Header />

      {/* Рендерим модальные окна (они сами контролируют видимость) */}
      <UpgradeModal />
      <LeaderboardModal />
      <div className="game-container">
        <div className='game-left'>
          {/* Если идет расстановка, показываем скамейку запасных вместо кнопок ходов */}
          {gameStatus === 'setup' ? (
            <Bench
              handleBenchDragOver={handleBenchDragOver}
              handleBenchDrop={handleBenchDrop}
              whiteBench={whiteBench}
              handleDragStart={handleDragStart}
              PIECE_IMAGES={PIECE_IMAGES}
            />

          ) : (
            <>
              <Button endTurn={endTurn} undoTurn={undoTurn} gameSnapshot={gameSnapshot} initGame={initGame} />
              <Turn turn={actionQueue} board={board} img={PIECE_IMAGES} />
            </>
          )}
        </div>

        <div className='game-center'>
          <div className='ui-container'>

          </div>

          <div className="board-grid" style={{ gridTemplateColumns: `repeat(${boardSize}, 1fr)` }}>
            {gridCells.map((_, index) => {
              const r = Math.floor(index / boardSize);
              const c = index % boardSize;
              return (
                <Square
                  key={`${r},${c}`}
                  row={r}
                  col={c}
                  board={board}
                  activeSquareKey={activeSquareKey}
                  validMoves={validMoves}
                  validTargets={validTargets}
                  damagePopups={damagePopups}
                  deadPopups={deadPopups}
                  gameStatus={gameStatus}
                  handleSquareClick={handleSquareClick}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  removeWhitePiece={removeWhitePiece}
                  PIECE_IMAGES={PIECE_IMAGES}
                />
              );
            })}
          </div>


        </div>

        <div className='game-left'>
          <Chat />
        </div>
        {gameStatus !== 'playing' && gameStatus !== 'setup' && (
          <Win initGame={initGame} gameStatus={gameStatus} />
        )}
      </div>
    </>
  );
}
