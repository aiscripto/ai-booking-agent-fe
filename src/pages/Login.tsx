import React, { useState } from 'react';
import { KeyRound, Mail, CalendarCheck } from 'lucide-react';
import { api } from '../services/api';
import { setSession } from '../services/session';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // The server checks the password and returns a signed token. It also decides the
      // tenant and role, so nothing about them is chosen or stored by this page.
      const { token, user } = await api.login(email.trim(), password);
      setSession(token, user);
      onLogin();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

      {/* Login Card */}
      <div className="card w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-slate-900/65 backdrop-blur-md shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex bg-sky-500/10 p-3 rounded-2xl text-sky-400 mb-4 border border-sky-500/10">
            <CalendarCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">
            Voice Agent Booking
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">
            Sign in to manage your appointments & call logs
          </p>
        </div>

        {error && (
          <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs font-semibold mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username or email */}
          <div className="space-y-2">
            <label htmlFor="login-email" className="text-xs text-slate-400 font-bold uppercase tracking-wider">Username or email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Mail className="w-5 h-5" aria-hidden="true" />
              </span>
              <input
                id="login-email"
                type="text"
                autoComplete="username"
                required
                placeholder="Username or email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm font-medium focus:outline-none focus:border-sky-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-xs text-slate-400 font-bold uppercase tracking-wider">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <KeyRound className="w-5 h-5" aria-hidden="true" />
              </span>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm font-medium focus:outline-none focus:border-sky-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg hover:shadow-sky-500/10 transition-all duration-200"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
};
