import React, { useState } from 'react';
import { supabase } from '../../supabaseClient'; // Мы создадим этот клиент на следующем шаге
import './Auth.css';

export function Auth({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        // --- РЕГИСТРАЦИЯ ---
        // Создаем пользователя в Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // Передаем username в metadata, чтобы потом сохранить в профиль
          options: {
            data: { username: username || email.split('@')[0] }
          }
        });
        if (error) throw error;
        alert('Регистрация успешна! Проверьте вашу почту для подтверждения (если включено в Supabase).');
      } else {
        // --- ВХОД ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      if (onAuthSuccess) onAuthSuccess();
    } catch (error) {
      setErrorMsg(error.message || 'Произошла ошибка при авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-container">
        <h2 className="auth-title">⚔️ BattleChess RPG</h2>
        <p className="auth-subtitle">
          {isSignUp ? 'Создайте аккаунт для сохранения прогресса' : 'Войдите, чтобы продолжить битву'}
        </p>

        <form onSubmit={handleAuth} className="auth-form">
          {isSignUp && (
            <div className="form-group">
              <label>Имя в рейтинге (Username)</label>
              <input
                type="text"
                placeholder="Ваш никнейм"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errorMsg && <div className="auth-error">{errorMsg}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Загрузка...' : isSignUp ? 'Зарегистрироваться' : 'Войти в игру'}
          </button>
        </form>

        <div className="auth-toggle">
          {isSignUp ? 'Уже есть аккаунт?' : 'Впервые тут?'}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}>
            {isSignUp ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
      </div>
    </div>
  );
}
