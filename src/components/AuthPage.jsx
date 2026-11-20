import React, { useState, useEffect } from 'react';
import { setAuthToken, setStorageItem, parseJwt } from '../utils/auth';
import apiClient from '../utils/apiClient';
import { API_BASE_URL } from '../config';

export default function AuthPage({ onLoginSuccess, sessionExpired }) {
  const [mode, setMode] = useState('login');
  const [signUpStep, setSignUpStep] = useState('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMessage, setErrorMessage] = useState(sessionExpired ? 'Session expired or unauthorized. Please sign in again.' : '');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError === 'unverified_email') {
      setErrorMessage('Your Google account email is not verified. Please verify it or sign up with email & password.');
    } else if (oauthError === 'oauth_failed') {
      setErrorMessage('Google sign-in failed. Please try again.');
    } else if (oauthError) {
      setErrorMessage(`Notice: ${oauthError.replace(/_/g, ' ')}`);
    }
  }, []);

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
      const data = err.response?.data;
      const errorText = (typeof data === 'string' ? data : data?.message) || data?.error;
      if (status === 401) {
        setErrorMessage(errorText || 'Invalid credentials. Please check your email and password.');
      } else if (status === 429) {
        setErrorMessage(errorText || 'Too many requests. Please try again after 15 minutes.');
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

      setSignUpStep('otp');
      setCooldown(60);
      setSuccessMessage('OTP sent! Check your inbox.');
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const errorText = (typeof data === 'string' ? data : data?.message) || data?.error;

      if (status === 429) {
        setErrorMessage(errorText || 'Please wait 60 seconds before requesting a new OTP.');
        setCooldown(60);
      } else {
        setErrorMessage(errorText || 'Failed to send OTP. Please check your email address.');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    setIsSendingOtp(true);

    try {
      await apiClient.post('/api/auth/send-otp', { email: normalizedEmail });
      setCooldown(60);
      setSuccessMessage('OTP resent! Check your inbox.');
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const errorText = (typeof data === 'string' ? data : data?.message) || data?.error;
      if (status === 429) {
        setErrorMessage(errorText || 'Please wait 60 seconds before requesting a new OTP.');
        setCooldown(60);
      } else {
        setErrorMessage(errorText || 'Failed to resend OTP. Please try again.');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!otp.trim() || otp.trim().length < 6) {
      setErrorMessage('Please enter the full 6-digit OTP sent to your email.');
      return;
    }

    setSignUpStep('password');
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedEmail = email.trim().toLowerCase();

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

    const derivedName = normalizedEmail.split('@')[0] || '';

    try {
      await apiClient.post('/api/auth/register', {
        email: normalizedEmail,
        password: password.trim(),
        name: derivedName,
        role: 'ROLE_RIDER',
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
            if (meRes.data?.driverId) {
              setStorageItem('driverId', String(meRes.data.driverId));
            }

            if (resolvedRole === 'ROLE_RIDER' && !resolvedRiderId) {
              try {
                await apiClient.post(
                  '/api/auth/complete-profile',
                  {
                    role: 'ROLE_RIDER',
                    name: derivedName,
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
          setSignUpStep('email');
          setSuccessMessage('Account created! Please sign in with your credentials.');
        }
      }, 600);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const errorText = (typeof data === 'string' ? data : data?.message) || data?.error;
      if (status === 401) {
        setErrorMessage(errorText || 'Invalid or expired OTP. Please go back and resend a new OTP.');
      } else if (status === 429) {
        setErrorMessage(errorText || 'Too many requests. Please wait before trying again.');
      } else if (status === 409) {
        setErrorMessage(errorText || 'Registration failed. Email may already be in use.');
      } else {
        setErrorMessage(errorText || 'Unable to register account. Please try again.');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const switchToMode = (nextMode) => {
    setMode(nextMode);
    setSignUpStep('email');
    setErrorMessage('');
    setSuccessMessage('');
    setOtp('');
    setCooldown(0);
  };

  const fillDemo = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setConfirmPassword(demoPass);
    setErrorMessage('');
  };

  const inputClass =
    'w-full bg-[#FFF0F4] border border-[#F3D1DC] focus:border-[#E11D48] focus:ring-1 focus:ring-[#E11D48] text-[#1F1218] dark:bg-[#1a1512] dark:border-[#3d3227] dark:focus:border-[#d4af37] dark:focus:ring-1 dark:focus:ring-[#d4af37] dark:text-white text-xs rounded-xl px-3.5 py-3 outline-none transition-all placeholder:text-[#664D58]/60 dark:placeholder-[#5e5348]';

  const labelClass = 'text-[11px] uppercase tracking-wider font-bold text-[#664D58] dark:text-[#a89685] block';

  const primaryBtnClass =
    'w-full mt-2 py-3.5 bg-[#E11D48] hover:bg-[#BE123C] text-white dark:bg-gradient-to-r dark:from-[#b88c34] dark:via-[#d4af37] dark:to-[#e6c564] dark:hover:brightness-110 active:scale-[0.99] dark:text-[#120f0d] font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';

  return (
    <div className="min-h-screen bg-[#FFF5F7] dark:bg-[#0a0706] text-[#1F1218] dark:text-[#f4efe6] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#E11D48]/10 dark:bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#F43F5E]/10 dark:bg-[#8a5a44]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFF0F4] dark:bg-gradient-to-tr dark:from-[#1e1915] dark:via-[#2d251e] dark:to-[#45372b] border border-[#F3D1DC] dark:border-[#d4af37]/40 shadow-xl mb-2 text-[#E11D48] dark:text-[#d4af37]">
            <span className="text-2xl">🚗</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#1F1218] dark:text-white flex items-center justify-center gap-2">
            Safar<span className="text-[#E11D48] dark:text-[#d4af37]">X</span>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#664D58] bg-[#FCE7EE] dark:text-[#a89685] dark:bg-[#1e1915] px-2 py-0.5 rounded-full border border-[#F3D1DC] dark:border-[#3d3227]">
              Security
            </span>
          </h1>
          <p className="text-xs text-[#664D58] dark:text-[#a89685] max-w-xs mx-auto">
            Intelligent urban mobility gateway secured with Spring Security & 256-bit JWT Tokens
          </p>
        </div>

        <div className="bg-[#FFF9FA] dark:bg-[#120f0d]/90 backdrop-blur-xl border border-[#F3D1DC] dark:border-[#2d251e] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-[#1F1218] dark:text-white">
          <div className="flex p-1 bg-[#FCE7EE] dark:bg-[#1e1915] rounded-2xl border border-[#F3D1DC] dark:border-[#3d3227]">
            <button
              type="button"
              onClick={() => switchToMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#E11D48] text-white shadow-md dark:bg-gradient-to-r dark:from-[#b88c34] dark:via-[#d4af37] dark:to-[#e6c564] dark:text-[#120f0d]'
                  : 'text-[#664D58] hover:text-[#1F1218] dark:text-[#a89685] dark:hover:text-[#d4af37]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchToMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#E11D48] text-white shadow-md dark:bg-gradient-to-r dark:from-[#b88c34] dark:via-[#d4af37] dark:to-[#e6c564] dark:text-[#120f0d]'
                  : 'text-[#664D58] hover:text-[#1F1218] dark:text-[#a89685] dark:hover:text-[#d4af37]'
              }`}
            >
              Create Account
            </button>
          </div>

          {mode === 'register' && signUpStep !== 'email' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black bg-emerald-500 text-white">✓</span>
                Email
              </div>
              <div className="flex-1 h-px bg-[#F3D1DC] dark:bg-[#3d3227]" />
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${signUpStep === 'otp' ? 'text-[#E11D48] dark:text-[#d4af37]' : signUpStep === 'password' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#664D58]/50 dark:text-[#5e5348]'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${signUpStep === 'otp' ? 'bg-[#E11D48] dark:bg-[#d4af37] text-white dark:text-[#120f0d]' : signUpStep === 'password' ? 'bg-emerald-500 text-white' : 'bg-[#F3D1DC] dark:bg-[#3d3227] text-[#664D58] dark:text-[#a89685]'}`}>
                  {signUpStep === 'password' ? '✓' : '2'}
                </span>
                Verify
              </div>
              <div className="flex-1 h-px bg-[#F3D1DC] dark:bg-[#3d3227]" />
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${signUpStep === 'password' ? 'text-[#E11D48] dark:text-[#d4af37]' : 'text-[#664D58]/50 dark:text-[#5e5348]'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${signUpStep === 'password' ? 'bg-[#E11D48] dark:bg-[#d4af37] text-white dark:text-[#120f0d]' : 'bg-[#F3D1DC] dark:bg-[#3d3227] text-[#664D58] dark:text-[#a89685]'}`}>3</span>
                Password
              </div>
            </div>
          )}

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

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                    placeholder="rider@safarx.in"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-[#664D58] hover:text-[#1F1218] dark:text-[#a89685] dark:hover:text-[#d4af37] font-semibold cursor-pointer"
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
                    className={inputClass}
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className={primaryBtnClass}>
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white dark:border-[#120f0d] border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to Backend...</span>
                  </>
                ) : (
                  <span>Sign In to SafarX</span>
                )}
              </button>

              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center pt-2">
                  <div className="w-full border-t border-[#F3D1DC] dark:border-[#2d251e]" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                  <span className="bg-[#FFF9FA] dark:bg-[#120f0d]/90 px-3 text-[#664D58] dark:text-[#736353]">or</span>
                </div>
              </div>

              <a
                href={`${API_BASE_URL}/oauth2/authorization/google`}
                className="w-full py-3 px-4 bg-white dark:bg-[#1a1512] hover:bg-[#FFF0F4] dark:hover:bg-[#251f1a] border border-[#F3D1DC] dark:border-[#3d3227] rounded-xl text-xs font-bold text-[#1F1218] dark:text-[#d4af37] flex items-center justify-center gap-2.5 transition-all shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </a>
            </form>
          )}

          {mode === 'register' && signUpStep === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                    placeholder="rider@safarx.in"
                    className={inputClass}
                  />
                </div>
              </div>

              <button type="submit" disabled={isSendingOtp || cooldown > 0} className={primaryBtnClass}>
                {isSendingOtp ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white dark:border-[#120f0d] border-t-transparent rounded-full animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : cooldown > 0 ? (
                  <span>Resend OTP in {cooldown}s</span>
                ) : (
                  <span>Send OTP</span>
                )}
              </button>

              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center pt-2">
                  <div className="w-full border-t border-[#F3D1DC] dark:border-[#2d251e]" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                  <span className="bg-[#FFF9FA] dark:bg-[#120f0d]/90 px-3 text-[#664D58] dark:text-[#736353]">or</span>
                </div>
              </div>

              <a
                href={`${API_BASE_URL}/oauth2/authorization/google`}
                className="w-full py-3 px-4 bg-white dark:bg-[#1a1512] hover:bg-[#FFF0F4] dark:hover:bg-[#251f1a] border border-[#F3D1DC] dark:border-[#3d3227] rounded-xl text-xs font-bold text-[#1F1218] dark:text-[#d4af37] flex items-center justify-center gap-2.5 transition-all shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </a>
            </form>
          )}

          {mode === 'register' && signUpStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Email Address</label>
                  <button
                    type="button"
                    onClick={() => {
                      setSignUpStep('email');
                      setOtp('');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-[10px] text-[#E11D48] hover:text-[#BE123C] dark:text-[#d4af37] hover:underline font-semibold cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full bg-[#FCE7EE]/60 border border-[#F3D1DC] text-[#664D58] dark:bg-[#1a1512]/60 dark:border-[#3d3227] dark:text-neutral-400 text-xs rounded-xl px-3.5 py-3 outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Enter 6-digit OTP</label>
                  {cooldown > 0 ? (
                    <span className="text-[10px] text-[#664D58] dark:text-neutral-400 font-mono font-semibold">
                      Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isSendingOtp}
                      onClick={handleResendOtp}
                      className="text-[10px] text-[#E11D48] hover:text-[#BE123C] dark:text-[#a89685] dark:hover:text-[#d4af37] font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {isSendingOtp ? 'Sending...' : 'Resend OTP'}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  autoFocus
                  className="w-full bg-[#FFF0F4] border border-[#F3D1DC] focus:border-[#E11D48] focus:ring-1 focus:ring-[#E11D48] text-[#1F1218] dark:bg-[#1a1512] dark:border-[#3d3227] dark:focus:border-[#d4af37] dark:focus:ring-1 dark:focus:ring-[#d4af37] dark:text-white text-xs rounded-xl px-3.5 py-3 outline-none tracking-widest text-center transition-all placeholder:text-[#664D58]/60 dark:placeholder-[#5e5348] font-mono text-sm"
                />
                <p className="text-[10px] text-[#664D58] dark:text-[#736353] text-center">
                  Check your inbox at <span className="font-bold text-[#1F1218] dark:text-[#a89685]">{email}</span>
                </p>
              </div>

              <button type="submit" className={primaryBtnClass}>
                <span>Verify OTP & Continue →</span>
              </button>
            </form>
          )}

          {mode === 'register' && signUpStep === 'password' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="p-3 rounded-xl bg-[#FFF0F4] dark:bg-[#1a1512] border border-[#F3D1DC] dark:border-[#3d3227] flex items-center gap-2">
                <span className="text-emerald-500 text-base shrink-0">✓</span>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[#664D58] dark:text-[#a89685]">Email Verified</p>
                  <p className="text-xs font-semibold text-[#1F1218] dark:text-white truncate">{email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSignUpStep('otp');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="ml-auto text-[10px] text-[#E11D48] dark:text-[#d4af37] hover:underline font-semibold cursor-pointer shrink-0"
                >
                  Back
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Create Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-[#664D58] hover:text-[#1F1218] dark:text-[#a89685] dark:hover:text-[#d4af37] font-semibold cursor-pointer"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoFocus
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={inputClass}
                />
              </div>

              <button type="submit" disabled={isRegistering} className={primaryBtnClass}>
                {isRegistering ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white dark:border-[#120f0d] border-t-transparent rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Create Account</span>
                )}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-[#F3D1DC] dark:border-[#2d251e] space-y-2">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#664D58] dark:text-[#736353] text-center">
              Quick Test Autofill
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fillDemo('himanshu@safarx.in', 'password123')}
                className="flex-1 py-1.5 px-2 bg-[#FCE7EE] hover:bg-[#FAD4E1] border border-[#F4B8CA] text-[10px] text-[#9F1239] dark:bg-[#1a1512] dark:hover:bg-[#251f1a] dark:border-[#3d3227] dark:text-[#a89685] dark:hover:text-[#d4af37] rounded-lg transition-all text-center cursor-pointer"
              >
                👤 Test Rider
              </button>
              <button
                type="button"
                onClick={() => fillDemo('driver@safarx.in', 'driver123')}
                className="flex-1 py-1.5 px-2 bg-[#FCE7EE] hover:bg-[#FAD4E1] border border-[#F4B8CA] text-[10px] text-[#9F1239] dark:bg-[#1a1512] dark:hover:bg-[#251f1a] dark:border-[#3d3227] dark:text-[#a89685] dark:hover:text-[#d4af37] rounded-lg transition-all text-center cursor-pointer"
              >
                🚘 Test Driver
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-[#664D58] dark:text-[#736353] flex items-center justify-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Backend: <code className="text-[#1F1218] dark:text-[#a89685]">{API_BASE_URL.replace(/^https?:\/\//, '')}</code>
          </span>
          <span>•</span>
          <span>JWT Filter Enabled</span>
        </div>

        <div className="mt-4 text-center text-xs text-[#664D58] dark:text-neutral-500 font-medium">
          © 2026 SafarX | By Himanshu Kumar
        </div>
      </div>
    </div>
  );
}
