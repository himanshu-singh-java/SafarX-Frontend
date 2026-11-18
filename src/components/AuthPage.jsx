import React, { useState } from 'react';
import { setAuthToken, setStorageItem, parseJwt } from '../utils/auth';
import apiClient from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export default function AuthPage({ onLoginSuccess, sessionExpired }) {
  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('ROLE_RIDER');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMessage, setErrorMessage] = useState(sessionExpired ? 'Session expired or unauthorized. Please sign in again.' : '');
  const [successMessage, setSuccessMessage] = useState('');

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
                  name: meRes.data?.name || email.trim().split('@')[0],
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
            } catch (autoInitErr) {
              console.warn('[AuthPage] Auto rider init error:', autoInitErr);
            }
          }
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

      setSuccessMessage('Account registered successfully! Signing you in automatically...');

      setTimeout(async () => {
        try {
          const loginRes = await apiClient.post('/api/auth/login', {
            email: normalizedEmail,
            password: password.trim(),
          });

          const rawToken = typeof loginRes.data === 'string' ? loginRes.data : loginRes.data?.token || '';
          const token = rawToken.replace(/^["']|["']$/g, '').trim();

          let resolvedRole = role === 'ROLE_DRIVER' ? 'ROLE_DRIVER' : 'ROLE_RIDER';
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
                    role: role === 'ROLE_DRIVER' ? 'ROLE_DRIVER' : 'ROLE_RIDER',
                    name: name.trim() || normalizedEmail.split('@')[0],
                    phone: '',
                  },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                const retryMe = await apiClient.get('/api/auth/me', {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (retryMe.data?.riderId) {
                  setStorageItem('riderId', String(retryMe.data.riderId));
                }
                if (retryMe.data?.driverId) {
                  setStorageItem('driverId', String(retryMe.data.driverId));
                }
              } catch (regInitErr) {
                console.warn('[AuthPage] Auto-profile creation on register:', regInitErr);
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
        } catch {
          setMode('login');
          setSuccessMessage('Account created! Please sign in with your credentials.');
        }
      }, 600);
    } catch (err) {
      const status = err.response?.status;
      const errorText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message;
      if (status === 401) {
        setErrorMessage(errorText || 'Invalid or expired OTP. Please check the code.');
      } else if (status === 409) {
        setErrorMessage(errorText || 'Registration failed. Email may already be in use.');
      } else {
        setErrorMessage(errorText || 'Unable to register account. Please try again.');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const fillDemo = (demoEmail, demoPass, demoRole = 'ROLE_RIDER') => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setConfirmPassword(demoPass);
    setRole(demoRole);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#0a0706] text-[#f4efe6] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#8a5a44]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
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

        <div className="bg-[#120f0d]/90 backdrop-blur-xl border border-[#2d251e] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex p-1 bg-[#1e1915] rounded-2xl border border-[#3d3227]">
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
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
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
                setIsOtpSent(false);
                setOtp('');
                setName('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-[#b88c34] via-[#d4af37] to-[#e6c564] text-[#120f0d] shadow-md'
                  : 'text-[#a89685] hover:text-[#d4af37]'
              }`}
            >
              Create Account
            </button>
          </div>

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

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-[#a89685] hover:text-[#d4af37] font-semibold cursor-pointer"
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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#b88c34] via-[#d4af37] to-[#e6c564] hover:brightness-110 active:scale-[0.99] text-[#120f0d] font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#120f0d] border-t-transparent rounded-full animate-spin" />
                      <span>Connecting to Backend...</span>
                    </>
                  ) : (
                    <span>Sign In to SafarX</span>
                  )}
                </button>
              </>
            ) : !isOtpSent ? (
              <>
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

                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#b88c34] via-[#d4af37] to-[#e6c564] hover:brightness-110 active:scale-[0.99] text-[#120f0d] font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSendingOtp ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#120f0d] border-t-transparent rounded-full animate-spin" />
                      <span>Sending OTP...</span>
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
                    <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
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
                      className="text-[10px] text-[#d4af37] hover:underline font-semibold cursor-pointer"
                    >
                      Change Email
                    </button>
                  </div>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full bg-[#1a1512]/60 border border-[#3d3227] text-neutral-400 text-xs rounded-xl px-3.5 py-3 outline-none cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                      Enter 6-digit OTP
                    </label>
                    <button
                      type="button"
                      disabled={isSendingOtp}
                      onClick={handleSendOtp}
                      className="text-[10px] text-[#a89685] hover:text-[#d4af37] font-semibold cursor-pointer disabled:opacity-50"
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
                    className="w-full bg-[#1a1512] border border-[#3d3227] focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-white text-xs rounded-xl px-3.5 py-3 outline-none tracking-widest text-center transition-all placeholder-[#5e5348] font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-[#1a1512] border border-[#3d3227] focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-white text-xs rounded-xl px-3.5 py-3 outline-none transition-all placeholder-[#5e5348]"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                    Select Account Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('ROLE_RIDER')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
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
                      onClick={() => setRole('ROLE_DRIVER')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        role === 'ROLE_DRIVER'
                          ? 'bg-[#2b2219] border-[#d4af37] text-white shadow-sm'
                          : 'bg-[#1a1512] border-[#3d3227] text-[#a89685] hover:border-[#5e5348]'
                      }`}
                    >
                      <div className="text-base mb-0.5">🚘</div>
                      <div className="font-bold text-xs text-white">Driver Partner</div>
                      <div className="text-[10px] text-[#a89685]">Drive & earn income</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-[#a89685] block">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-[#a89685] hover:text-[#d4af37] font-semibold cursor-pointer"
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
                    className="w-full bg-[#1a1512] border border-[#3d3227] focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-white text-xs rounded-xl px-3.5 py-3 outline-none transition-all placeholder-[#5e5348]"
                  />
                </div>

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

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#b88c34] via-[#d4af37] to-[#e6c564] hover:brightness-110 active:scale-[0.99] text-[#120f0d] font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isRegistering ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#120f0d] border-t-transparent rounded-full animate-spin" />
                      <span>Signing Up...</span>
                    </>
                  ) : (
                    <span>Sign Up</span>
                  )}
                </button>
              </>
            )}
          </form>

          <div className="pt-2 border-t border-[#2d251e] space-y-2">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#736353] text-center">
              Quick Test Autofill
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fillDemo('himanshu@safarx.in', 'password123', 'ROLE_RIDER')}
                className="flex-1 py-1.5 px-2 bg-[#1a1512] hover:bg-[#251f1a] border border-[#3d3227] text-[10px] text-[#a89685] hover:text-[#d4af37] rounded-lg transition-all text-center cursor-pointer"
              >
                👤 Test Rider
              </button>
              <button
                type="button"
                onClick={() => fillDemo('driver@safarx.in', 'driver123', 'ROLE_DRIVER')}
                className="flex-1 py-1.5 px-2 bg-[#1a1512] hover:bg-[#251f1a] border border-[#3d3227] text-[10px] text-[#a89685] hover:text-[#d4af37] rounded-lg transition-all text-center cursor-pointer"
              >
                🚘 Test Driver
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-[#736353] flex items-center justify-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Backend: <code className="text-[#a89685]">{API_BASE_URL.replace(/^https?:\/\//, '')}</code>
          </span>
          <span>•</span>
          <span>JWT Filter Enabled</span>
        </div>

        <div className="mt-4 text-center text-xs text-neutral-500 font-medium">
          © 2026 SafarX | By Himanshu Kumar
        </div>
      </div>
    </div>
  );
}
