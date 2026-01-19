'use client';

import { useState } from 'react';

type JwtLoginProps = {
  backendUrl: string | undefined;
  token: string | null;
  onLoginSuccess: (token: string) => void;
  onLogout: () => void;
  title?: string;
};

export default function JwtLogin({
  backendUrl,
  token,
  onLoginSuccess,
  onLogout,
  title = 'JWT Login',
}: JwtLoginProps) {
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const login = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (!backendUrl) {
        setAuthError('Backend URL not configured.');
        return;
      }
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data?.message ?? 'Login failed.');
        return;
      }
      onLoginSuccess(data.access_token);
      setLoginForm({ username: '', password: '' });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="mb-6 border p-4 rounded">
      <h2 className="font-semibold mb-2">{title}</h2>
      {token ? (
        <div className="flex items-center gap-3">
          <span className="text-green-600">Authenticated</span>
          <button
            onClick={onLogout}
            className="bg-gray-200 px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="border p-2"
            placeholder="Username or email"
            value={loginForm.username}
            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
          />
          <input
            type="password"
            className="border p-2"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <button
            onClick={login}
            className="bg-blue-500 text-white px-3 py-2 rounded"
            disabled={authLoading}
          >
            {authLoading ? 'Signing in...' : 'Sign in'}
          </button>
          {authError && <span className="text-red-600">{authError}</span>}
        </div>
      )}
    </div>
  );
}
