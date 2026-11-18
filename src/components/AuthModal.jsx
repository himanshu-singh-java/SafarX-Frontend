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
  const [mode, setMode] = useState(initialMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('RIDER');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'login');
      setSuccessMessage('');
      setIsOtpSent(false);
      setOtp('');
      setName('');
      setRole('RIDER');
      setIsSendingOtp(false);
      setIsRegistering(false);
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
        let resolvedRiderId = null;
        try {
          const meRes = await apiClient.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.data?.role) resolvedRole = meRes.data.role;
          if (meRes.data?.name) setStorageItem('userName', meRes.data.name);
          if (meRes.data?.riderId) {
            resolvedRiderId = meRes.data.riderId;
            setStorageItem('riderId', String(meRes.data.riderId));
          }
          if (meRes.data?.driverId) setStorageItem('driverId', String(meRes.data.driverId));

          if (resolvedRole === 'ROLE_RIDER' && !resolvedRiderId) {
            try {
              await apiClient.post(
                '/api/auth/complete-profile',
                {
                  role: 'ROLE_RIDER',
                  name: meRes.data?.name || normalizedEmail.split('@')[0],
                  phone: '',
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const retryMe = await apiClient.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (retryMe.data?.riderId) {
                resolvedRiderId = retryMe.data.riderId;
                setStorageItem('riderId', String(retryMe.data.riderId));
              }
            } catch (initErr) {
              console.warn('[AuthModal] Auto-profile creation error:', initErr);
            }
          }
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
      } else if (status === 403) {
        setErrorMessage(errorText || 'Access forbidden. This account may be linked with Google.');
      } else {
        setErrorMessage(errorText || 'Unable to connect to service. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('Please provide an email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    setIsSendingOtp(true);

    try {
      await apiClient.post('/api/auth/send-otp', {
        email: normalizedEmail,
      });

      setIsOtpSent(true);
      setSuccessMessage('OTP sent to your email!');
    } catch (err) {
      const errorText = typeof err.response?.data === 'string'
        ? err.response.data
        : err.response?.data?.message;
      setErrorMessage(errorText || 'Failed to send OTP. Please check your email address.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage('Please provide an email address.');
      return;
    }

    if (!otp.trim()) {
      setErrorMessage('Please enter the 6-digit OTP sent to your email.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Please provide your full name.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Please provide a password.');
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

    setIsRegistering(true);

    try {
      await apiClient.post('/api/auth/register', {
        email: normalizedEmail,
        password: password.trim(),
        name: name.trim(),
        role: role,
        otp: otp.trim(),
      });

      setSuccessMessage('Account registered! Signing you in automatically...');

      setTimeout(async () => {
        try {
          const loginRes = await apiClient.post('/api/auth/login', {
            email: normalizedEmail,
            password: password.trim(),
          });

          const rawToken = typeof loginRes.data === 'string' ? loginRes.data : loginRes.data?.token || '';
          const token = rawToken.replace(/^["']|["']$/g, '').trim();

          let resolvedRole = role === 'DRIVER' ? 'ROLE_DRIVER' : 'ROLE_RIDER';
          let resolvedRiderId = null;

          try {
            const meRes = await apiClient.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (meRes.data?.role) resolvedRole = meRes.data.role;
            if (meRes.data?.name) setStorageItem('userName', meRes.data.name);
            if (meRes.data?.riderId) {
              resolvedRiderId = meRes.data.riderId;
              setStorageItem('riderId', String(meRes.data.riderId));
            }
            if (meRes.data?.driverId) {
              setStorageItem('driverId', String(meRes.data.driverId));
            }

            if (resolvedRole === 'ROLE_RIDER' && !resolvedRiderId) {
              try {
                await apiClient.post(
                  '/api/auth/complete-profile',
                  {
                    role: role === 'DRIVER' ? 'ROLE_DRIVER' : 'ROLE_RIDER',
                    name: name.trim() || normalizedEmail.split('@')[0],
                    phone: '',
                  },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                const retryMe = await apiClient.get('/api/auth/me', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (retryMe.data?.role) resolvedRole = retryMe.data.role;
                if (retryMe.data?.riderId) {
                  setStorageItem('riderId', String(retryMe.data.riderId));
                }
                if (retryMe.data?.driverId) {
                  setStorageItem('driverId', String(retryMe.data.driverId));
                }
              } catch (regInitErr) {
                console.warn('[AuthModal] Auto-profile creation on register:', regInitErr);
              }
            }
          } catch {
            const decoded = parseJwt(token);
            if (decoded?.role) resolvedRole = decoded.role;
          }

          setAuthToken(token, normalizedEmail, resolvedRole);
          if (onLoginSuccess) {
            onLoginSuccess(token, normalizedEmail, resolvedRole);
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
      const status = err.response?.status;
      const errorText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message;
      if (status === 401) {
        setErrorMessage(errorText || 'Invalid or expired OTP. Please verify or resend a new OTP.');
      } else if (status === 409) {
        setErrorMessage(errorText || 'This email is already registered. Please log in.');
      } else if (status === 403) {
        setErrorMessage(errorText || 'Cannot self-assign Admin role.');
      } else {
        setErrorMessage(errorText || 'Unable to register account. Please try again.');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in select-none">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="w-full max-w-md relative z-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-black dark:text-white space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center p-1 shadow-sm overflow-hidden shrink-0">
              <img
                src="/vehicle_car.jpg"
                alt="SafarX 3D Car"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-black dark:text-white tracking-tight">
                  Safar<span className="text-[#d4af37]">X</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                {mode === 'login'
                  ? 'Sign in to access your ride or driver partner account'
                  : 'Create an account to book or drive with SafarX'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center justify-center font-bold text-base transition-all cursor-pointer"
            title="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage('');
              setSuccessMessage('');
              setIsOtpSent(false);
              setOtp('');
              setName('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
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
              setIsOtpSent(false);
              setOtp('');
              setName('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-black shadow-sm font-extrabold'
                : 'text-neutral-500 hover:text-black font-semibold'
            }`}
          >
            Sign up
          </button>
        </div>

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

        <form
          onSubmit={
            mode === 'login'
              ? handleLogin
              : !isOtpSent
              ? handleSendOtp
              : handleRegister
          }
          className="space-y-4"
        >
          {mode === 'login' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                  placeholder="name@example.com"
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white font-semibold cursor-pointer"
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
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 bg-black hover:bg-neutral-800 dark:bg-amber-400 dark:hover:bg-amber-500 active:scale-[0.99] text-white dark:text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to Spring Boot...</span>
                  </>
                ) : (
                  <span>Sign In to SafarX</span>
                )}
              </button>
            </>
          ) : !isOtpSent ? (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                  placeholder="name@example.com"
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                className="w-full mt-2 py-3.5 bg-black hover:bg-neutral-800 dark:bg-amber-400 dark:hover:bg-amber-500 active:scale-[0.99] text-white dark:text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSendingOtp ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                    <span>Sending OTP to Email...</span>
                  </>
                ) : (
                  <span>Send OTP</span>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                    Email Address
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpSent(false);
                      setOtp('');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                  >
                    Change email
                  </button>
                </div>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full bg-[#efefef] dark:bg-neutral-800/60 border-2 border-transparent rounded-xl text-neutral-500 dark:text-neutral-400 text-xs font-semibold px-4 py-3 outline-none cursor-not-allowed shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                    Enter 6-digit OTP
                  </label>
                  <button
                    type="button"
                    disabled={isSendingOtp}
                    onClick={handleSendOtp}
                    className="text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isSendingOtp ? 'Sending...' : 'Resend OTP'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none tracking-widest text-center transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('RIDER')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      role === 'RIDER'
                        ? 'bg-neutral-50 dark:bg-neutral-800 border-black dark:border-amber-400 text-black dark:text-white shadow-sm'
                        : 'bg-[#f6f6f6] dark:bg-neutral-800/50 border-transparent text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-base mb-0.5">🚗</div>
                    <div className="font-extrabold text-xs text-black dark:text-white">Rider</div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Book & reserve rides</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('DRIVER')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      role === 'DRIVER'
                        ? 'bg-neutral-50 dark:bg-neutral-800 border-black dark:border-amber-400 text-black dark:text-white shadow-sm'
                        : 'bg-[#f6f6f6] dark:bg-neutral-800/50 border-transparent text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-base mb-0.5">🚘</div>
                    <div className="font-extrabold text-xs text-black dark:text-white">Driver</div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Drive & earn income</div>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white font-semibold cursor-pointer"
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
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full mt-2 py-3.5 bg-black hover:bg-neutral-800 dark:bg-amber-400 dark:hover:bg-amber-500 active:scale-[0.99] text-white dark:text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isRegistering ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                    <span>Signing Up...</span>
                  </>
                ) : (
                  <span>Sign Up</span>
                )}
              </button>
            </>
          )}

          <div className="relative my-3 pt-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-white dark:bg-neutral-900 px-3 text-neutral-400 dark:text-neutral-500">or</span>
            </div>
          </div>

          <a
            href={`${API_BASE_URL}/oauth2/authorization/google`}
            className="w-full py-3 px-4 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100 dark:active:bg-neutral-600 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center justify-center gap-2.5 transition-all shadow-sm"
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

          {onSwitchToDriverOnboard && (
            <div className="pt-2 text-center border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                Want to drive and earn on your schedule?{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    onSwitchToDriverOnboard();
                  }}
                  className="font-extrabold text-black dark:text-amber-400 hover:text-[#d4af37] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Drive with SafarX →
                </button>
              </p>
            </div>
          )}
        </form>

        <div className="mt-4 pt-2 text-center text-[11px] text-neutral-400 font-medium border-t border-neutral-100 dark:border-neutral-800">
          © 2026 SafarX | By Himanshu Kumar
        </div>
      </div>
    </div>
  );
}
