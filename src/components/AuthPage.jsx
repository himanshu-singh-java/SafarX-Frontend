import React, { useState } from 'react';
import { setAuthToken, setStorageItem, parseJwt } from '../utils/auth';
import apiClient from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export default function AuthPage({ onLoginSuccess, sessionExpired }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('ROLE_RIDER'); // 'ROLE_RIDER' | 'ROLE_ADMIN'
  const [showPassword, setShowPassword] = useState(false);

  // Status & Loading State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(sessionExpired ? 'Session expired or unauthorized. Please sign in again.' : '');
  const [successMessage, setSuccessMessage] = useState('');

  // Handle Login Submit
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/api/auth/login', {
        email: email.trim(),
        password: password.trim(),
      });

      const rawToken = typeof response.data === 'string' ? response.data : response.data?.token || '';
      const token = rawToken.replace(/^["']|["']$/g, '').trim();

      if (token && token !== 'Fail') {
        let resolvedRole = 'ROLE_RIDER';
        try {
          const meRes = await apiClient.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.data?.role) resolvedRole = meRes.data.role;
          if (meRes.data?.name) setStorageItem('userName', meRes.data.name);
          if (meRes.data?.riderId) setStorageItem('riderId', String(meRes.data.riderId));
          if (meRes.data?.driverId) setStorageItem('driverId', String(meRes.data.driverId));
        } catch {
          const decoded = parseJwt(token);
          if (decoded?.role) resolvedRole = decoded.role;
        }

        setAuthToken(token, email.trim(), resolvedRole);
        setSuccessMessage('Authentication successful! Loading dashboard...');
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(token, email.trim(), resolvedRole);
          }
        }, 400);
      } else {
        setErrorMessage('Invalid credentials. Please verify your email and password.');
      }
    } catch (err) {
      const status = err.response?.status;
      const errorText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message;
      if (status === 401) {
        setErrorMessage(errorText || 'Invalid credentials. Please check your email and password.');
      } else {
        setErrorMessage(errorText || 'Unable to connect to service. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register Submit
  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide an email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post('/api/auth/register', {
        email: email.trim(),
        password: password.trim(),
        role: role,
      });

      setSuccessMessage('Account registered successfully! Signing you in automatically...');
      
      // Auto-login upon successful registration
      setTimeout(async () => {
        try {
          const loginRes = await apiClient.post('/api/auth/login', {
            email: email.trim(),
            password: password.trim(),
          });

          const rawToken = typeof loginRes.data === 'string' ? loginRes.data : loginRes.data?.token || '';
          const token = rawToken.replace(/^["']|["']$/g, '').trim();

          let resolvedRole = 'ROLE_RIDER';
          try {
            const meRes = await apiClient.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (meRes.data?.role) resolvedRole = meRes.data.role;
            if (meRes.data?.name) setStorageItem('userName', meRes.data.name);
            if (meRes.data?.riderId) setStorageItem('riderId', String(meRes.data.riderId));
            if (meRes.data?.driverId) setStorageItem('driverId', String(meRes.data.driverId));
          } catch {
            const decoded = parseJwt(token);
            if (decoded?.role) resolvedRole = decoded.role;
          }

          setAuthToken(token, email.trim(), resolvedRole);
          if (onLoginSuccess) {
            onLoginSuccess(token, email.trim(), resolvedRole);
          }
        } catch {
          setMode('login');
          setSuccessMessage('Account created! Please sign in with your credentials.');
        }
      }, 600);
    } catch (err) {
      const errorText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message;
      setErrorMessage(errorText || 'Registration failed. Email may already be in use.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick fill helper for testing
  const fillDemo = (demoEmail, demoPass, demoRole = 'ROLE_RIDER') => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setConfirmPassword(demoPass);
    setRole(demoRole);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#0a0706] text-[#f4efe6] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      
      {/* Background Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#8a5a44]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand Emblem & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1e1915] via-[#2d251e] to-[#45372b] border border-[#d4af37]/40 shadow-xl shadow-black/50 mb-2">
            <span className="text-2xl">🚗</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            Safar<span className="text-[#d4af37]">X</span>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#a89685] bg-[#1e1915] px-2 py-0.5 rounded-full border border-[#3d3227]">
              Security
            </span>
          </h1>
          <p className="text-xs text-[#a89685] max-w-xs mx-auto">
            Intelligent urban mobility gateway secured with Spring Security & 256-bit JWT Tokens
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#120f0d]/90 backdrop-blur-xl border border-[#2d251e] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 bg-[#1e1915] rounded-2xl border border-[#3d3227]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-[#b88c34] via-[#d4af37] to-[#e6c564] text-[#120f0d] shadow-md'
                  : 'text-[#a89685] hover:text-[#d4af37]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-[#b88c34] via-[#d4af37] to-[#e6c564] text-[#120f0d] shadow-md'
                  : 'text-[#a89685] hover:text-[#d4af37]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <span className="text-base shrink-0">⚠️</span>
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <span className="text-base shrink-0">✓</span>
              <div className="leading-snug">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                  placeholder="rider@safarx.in"
                  className="w-full bg-[#1a1512] border border-[#3d3227] focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-white text-xs rounded-xl px-3.5 py-3 outline-none transition-all placeholder-[#5e5348]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-[#a89685] hover:text-[#d4af37] font-semibold"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#1a1512] border border-[#3d3227] focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-white text-xs rounded-xl px-3.5 py-3 outline-none transition-all placeholder-[#5e5348]"
                />
              </div>
            </div>

            {/* Register Extra Fields */}
            {mode === 'register' && (
              <>
                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#1a1512] border border-[#3d3227] focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-white text-xs rounded-xl px-3.5 py-3 outline-none transition-all placeholder-[#5e5348]"
                  />
                </div>

                {/* Role Selector */}
                <div className="space-y-2 pt-1">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                    Select Account Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('ROLE_RIDER')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        role === 'ROLE_RIDER'
                          ? 'bg-[#2b2219] border-[#d4af37] text-white shadow-sm'
                          : 'bg-[#1a1512] border-[#3d3227] text-[#a89685] hover:border-[#5e5348]'
                      }`}
                    >
                      <div className="text-base mb-0.5">🚗</div>
                      <div className="font-bold text-xs text-white">Rider</div>
                      <div className="text-[10px] text-[#a89685]">Book & reserve rides</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('ROLE_ADMIN')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        role === 'ROLE_ADMIN'
                          ? 'bg-[#2b2219] border-[#d4af37] text-white shadow-sm'
                          : 'bg-[#1a1512] border-[#3d3227] text-[#a89685] hover:border-[#5e5348]'
                      }`}
                    >
                      <div className="text-base mb-0.5">🛡️</div>
                      <div className="font-bold text-xs text-white">Administrator</div>
                      <div className="text-[10px] text-[#a89685]">Fleet dispatch console</div>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#b88c34] via-[#d4af37] to-[#e6c564] hover:brightness-110 active:scale-[0.99] text-[#120f0d] font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#120f0d] border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Backend...</span>
                </>
              ) : mode === 'login' ? (
                <span>Sign In to SafarX</span>
              ) : (
                <span>Create SafarX Account</span>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="pt-2 border-t border-[#2d251e] space-y-2">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#736353] text-center">
              Quick Test Autofill
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fillDemo('himanshu@safarx.in', 'password123', 'ROLE_RIDER')}
                className="flex-1 py-1.5 px-2 bg-[#1a1512] hover:bg-[#251f1a] border border-[#3d3227] text-[10px] text-[#a89685] hover:text-[#d4af37] rounded-lg transition-all text-center"
              >
                👤 Test Rider
              </button>
              <button
                type="button"
                onClick={() => fillDemo('admin@safarx.in', 'admin123', 'ROLE_ADMIN')}
                className="flex-1 py-1.5 px-2 bg-[#1a1512] hover:bg-[#251f1a] border border-[#3d3227] text-[10px] text-[#a89685] hover:text-[#d4af37] rounded-lg transition-all text-center"
              >
                🛡️ Test Admin
              </button>
            </div>
          </div>

        </div>

        {/* Security Footer */}
        <div className="text-center text-[11px] text-[#736353] flex items-center justify-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Backend: <code className="text-[#a89685]">{API_BASE_URL.replace(/^https?:\/\//, '')}</code>
          </span>
          <span>•</span>
          <span>JWT Filter Enabled</span>
        </div>

      </div>

    </div>
  );
}

