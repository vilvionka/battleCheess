import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Auth } from './components/auth/Auth';
import { Board } from './components/board/Board'; // Твой текущий Board

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Проверяем текущую сессию при загрузке страницы
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Слушаем изменения состояния (вход, выход, регистрация)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ color: '#fff', textAlign: 'center', marginTop: '20%' }}>Загрузка BattleChess...</div>;
  }

  // Если сессии нет — показываем экран авторизации
  if (!session) {
    return <Auth onAuthSuccess={() => console.log('Успешный вход!')} />;
  }

  // Если пользователь залогинен — запускаем игру
  return (
    <div className="app-container" id='center'>
      <Board />
    </div>
  );
}
