import React, { useState, useEffect } from 'react';
import { setAuthToken, parseJwt, setStorageItem } from '../utils/auth';
import apiClient from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export default function AuthModal({
  isOpen,
  initialMode = 'login',
  onClose,
  onLoginSuccess,
  sessionExpired = false,
  alertNotice = '',
  onSwitchToDriverOnboard,
}) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Loading State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Sync mode and alert notices when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'login');
      setSuccessMessage('');
      if (sessionExpired) {
        setErrorMessage('Session expired or unauthorized. Please sign in again.');
      } else if (alertNotice) {
        setErrorMessage(alertNotice);
      } else {
        setErrorMessage('');
      }
    }
  }, [isOpen, initialMode, sessionExpired, alertNotice]);

  if (!isOpen) return null;

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

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await apiClient.post('/api/auth/login', {
        email: normalizedEmail,
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

        setAuthToken(token, normalizedEmail, resolvedRole);
        setSuccessMessage(
          resolvedRole === 'ROLE_ADMIN'
            ? 'Admin verified! Redirecting to Admin Console...'
            : resolvedRole === 'ROLE_DRIVER'
            ? 'Driver verified! Redirecting to Driver Partner Console...'
            : 'Signed in successfully! Loading Rider Dashboard...'
        );
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(token, normalizedEmail, resolvedRole);
          }
          if (onClose) {
            onClose();
          }
        }, 350);
      } else {
        setErrorMessage('Invalid credentials. Please verify your email and password.');
      }
    } catch (err) {
      const status = err.response?.status;
      const errorText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message;
      if (status === 401) {
        setErrorMessage(errorText || 'Invalid credentials. Please check your email and password.');
      } else {
        setErrorMessage(errorText || 'Unable to connect to service. Please check your connection and try again.');
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
        role: 'ROLE_RIDER',
      });

      setSuccessMessage('Account registered! Signing you in automatically...');
      
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
          if (onClose) {
            onClose();
          }
        } catch {
          setMode('login');
          setSuccessMessage('Account created! Please sign in with your password.');
        }
      }, 500);
    } catch (err) {
      const errorText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message;
      setErrorMessage(errorText || 'Unable to register account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in select-none">
      
      {/* Click outside to close backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Container: CLEAN WHITE UBER THEME */}
      <div className="w-full max-w-md relative z-10 bg-white border border-neutral-200 rounded-3xl shadow-2xl p-6 sm:p-8 text-black space-y-5 animate-in zoom-in-95">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 3D Vehicle Icon (Real 3D White Car from yesterday) */}
            <div className="w-12 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center p-1 shadow-sm overflow-hidden shrink-0">
              <img
                src="/vehicle_car.jpg"
                alt="SafarX 3D Car"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-black tracking-tight">
                  Safar<span className="text-[#d4af37]">X</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 font-medium">
                {mode === 'login'
                  ? 'Sign in to access your ride or driver partner account'
                  : 'Create a rider account to book rides instantly'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-black flex items-center justify-center font-bold text-base transition-all"
            title="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: White Segmented Pill */}
        <div className="flex p-1 bg-neutral-100 rounded-2xl border border-neutral-200">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white text-black shadow-sm font-extrabold'
                : 'text-neutral-500 hover:text-black font-semibold'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white text-black shadow-sm font-extrabold'
                : 'text-neutral-500 hover:text-black font-semibold'
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in font-medium">
            <span className="text-sm shrink-0">⚠️</span>
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in font-medium">
            <span className="text-sm shrink-0">✓</span>
            <div className="leading-snug">{successMessage}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
              placeholder="name@example.com"
              className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-neutral-500 hover:text-black font-semibold"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
            />
          </div>

          {/* Register-only Fields */}
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
              />
            </div>
          )}

          {/* Submit Button: Uber Solid Black Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 bg-black hover:bg-neutral-800 active:scale-[0.99] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting to Spring Boot...</span>
              </>
            ) : mode === 'login' ? (
              <span>Sign In to SafarX</span>
            ) : (
              <span>Create SafarX Account</span>
            )}
          </button>

          {/* Divider */}
          <div className="relative my-3 pt-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-white px-3 text-neutral-400">or</span>
            </div>
          </div>

          {/* Google OAuth2 Button */}
          <a
            href={`${API_BASE_URL}/oauth2/authorization/google`}
            className="w-full py-3 px-4 bg-white hover:bg-neutral-50 active:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-800 flex items-center justify-center gap-2.5 transition-all shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </a>

          {/* Dedicated Driver Partner Link */}
          {onSwitchToDriverOnboard && (
            <div className="pt-2 text-center border-t border-neutral-100">
              <p className="text-[11px] text-neutral-500 font-medium">
                Want to drive and earn on your schedule?{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    onSwitchToDriverOnboard();
                  }}
                  className="font-extrabold text-black hover:text-[#d4af37] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Drive with SafarX →
                </button>
              </p>
            </div>
          )}
        </form>

      </div>

    </div>
  );
}
