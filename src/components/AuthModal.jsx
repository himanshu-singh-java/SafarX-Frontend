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
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'login');
      setSignUpStep('email');
      setSuccessMessage('');
      setOtp('');
      setIsSendingOtp(false);
      setIsRegistering(false);
      setCooldown(0);
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
      const data = err.response?.data;
      const errorText = (typeof data === 'string' ? data : data?.message) || data?.error;
      if (status === 401) {
        setErrorMessage(errorText || 'Invalid credentials. Please check your email and password.');
      } else if (status === 429) {
        setErrorMessage(errorText || 'Too many requests. Please try again after 15 minutes.');
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

      setSuccessMessage('Account registered! Signing you in automatically...');

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
          setSignUpStep('email');
          setSuccessMessage('Account created! Please sign in with your password.');
        }
      }, 500);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const errorText = (typeof data === 'string' ? data : data?.message) || data?.error;
      if (status === 401) {
        setErrorMessage(errorText || 'Invalid or expired OTP. Please go back and resend a new OTP.');
      } else if (status === 429) {
        setErrorMessage(errorText || 'Too many requests. Please wait before trying again.');
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

  const switchToMode = (nextMode) => {
    setMode(nextMode);
    setSignUpStep('email');
    setErrorMessage('');
    setSuccessMessage('');
    setOtp('');
    setCooldown(0);
  };

  const inputClass =
    'w-full bg-[#FFF0F4] dark:bg-neutral-800 hover:bg-[#FCE7EE]/70 dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-[#F3D1DC] focus:border-[#E11D48] dark:border-transparent dark:focus:border-amber-400 rounded-xl text-[#1F1218] dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-[#664D58]/60 dark:placeholder:text-neutral-500 shadow-sm';

  const labelClass = 'text-[11px] uppercase tracking-wider font-bold text-[#664D58] dark:text-neutral-400 block';

  const primaryBtnClass =
    'w-full mt-2 py-3.5 bg-[#E11D48] hover:bg-[#BE123C] dark:bg-amber-400 dark:hover:bg-amber-500 active:scale-[0.99] text-white dark:text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in select-none">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="w-full max-w-md relative z-10 bg-[#FFF9FA] dark:bg-neutral-900 border border-[#F3D1DC] dark:border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-[#1F1218] dark:text-white space-y-5 animate-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-10 rounded-xl bg-[#FFF0F4] dark:bg-neutral-800 border border-[#F3D1DC] dark:border-neutral-700 flex items-center justify-center p-1 shadow-sm overflow-hidden shrink-0">
              <img
                src="/vehicle_car.jpg"
                alt="SafarX 3D Car"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-[#1F1218] dark:text-white tracking-tight">
                  Safar<span className="text-[#E11D48] dark:text-[#d4af37]">X</span>
                </span>
              </div>
              <p className="text-[11px] text-[#664D58] dark:text-neutral-400 font-medium">
                {mode === 'login'
                  ? 'Sign in to access your ride or driver partner account'
                  : signUpStep === 'email'
                  ? 'Create an account to book or drive with SafarX'
                  : signUpStep === 'otp'
                  ? 'Verify your email with the OTP we sent'
                  : 'Set a secure password for your account'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FCE7EE] dark:bg-neutral-800 hover:bg-[#FAD4E1] dark:hover:bg-neutral-700 text-[#664D58] dark:text-neutral-400 hover:text-[#1F1218] dark:hover:text-white flex items-center justify-center font-bold text-base transition-all cursor-pointer"
            title="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="flex p-1 bg-[#FCE7EE] dark:bg-neutral-800 rounded-2xl border border-[#F3D1DC] dark:border-neutral-700">
          <button
            type="button"
            onClick={() => switchToMode('login')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-[#9F1239] shadow-sm font-extrabold dark:bg-white dark:text-black'
                : 'text-[#664D58] hover:text-[#1F1218] font-semibold dark:text-neutral-500 dark:hover:text-black'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => switchToMode('register')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-[#9F1239] shadow-sm font-extrabold dark:bg-white dark:text-black'
                : 'text-[#664D58] hover:text-[#1F1218] font-semibold dark:text-neutral-500 dark:hover:text-black'
            }`}
          >
            Sign up
          </button>
        </div>

        {mode === 'register' && signUpStep !== 'email' && (
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${signUpStep === 'email' ? 'text-[#E11D48] dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${signUpStep !== 'email' ? 'bg-emerald-500 text-white' : 'bg-[#E11D48] dark:bg-amber-400 text-white dark:text-black'}`}>✓</span>
              Email
            </div>
            <div className="flex-1 h-px bg-[#F3D1DC] dark:bg-neutral-700" />
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${signUpStep === 'otp' ? 'text-[#E11D48] dark:text-amber-400' : signUpStep === 'password' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#664D58]/50 dark:text-neutral-600'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${signUpStep === 'otp' ? 'bg-[#E11D48] dark:bg-amber-400 text-white dark:text-black' : signUpStep === 'password' ? 'bg-emerald-500 text-white' : 'bg-[#F3D1DC] dark:bg-neutral-700 text-[#664D58] dark:text-neutral-500'}`}>
                {signUpStep === 'password' ? '✓' : '2'}
              </span>
              Verify
            </div>
            <div className="flex-1 h-px bg-[#F3D1DC] dark:bg-neutral-700" />
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${signUpStep === 'password' ? 'text-[#E11D48] dark:text-amber-400' : 'text-[#664D58]/50 dark:text-neutral-600'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${signUpStep === 'password' ? 'bg-[#E11D48] dark:bg-amber-400 text-white dark:text-black' : 'bg-[#F3D1DC] dark:bg-neutral-700 text-[#664D58] dark:text-neutral-500'}`}>3</span>
              Password
            </div>
          </div>
        )}

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

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                placeholder="name@example.com"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-[#664D58] dark:text-neutral-400 hover:text-[#1F1218] dark:hover:text-white font-semibold cursor-pointer"
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
                className={inputClass}
              />
            </div>

            <button type="submit" disabled={isLoading} className={primaryBtnClass}>
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Spring Boot...</span>
                </>
              ) : (
                <span>Sign In to SafarX</span>
              )}
            </button>

            <div className="relative my-3 pt-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#F3D1DC] dark:border-neutral-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-[#FFF9FA] dark:bg-neutral-900 px-3 text-[#664D58] dark:text-neutral-500">or</span>
              </div>
            </div>

            <a
              href={`${API_BASE_URL}/oauth2/authorization/google`}
              className="w-full py-3 px-4 bg-white dark:bg-neutral-800 hover:bg-[#FFF0F4] dark:hover:bg-neutral-700 active:bg-[#FCE7EE] dark:active:bg-neutral-600 border border-[#F3D1DC] dark:border-neutral-700 rounded-xl text-xs font-bold text-[#1F1218] dark:text-neutral-200 flex items-center justify-center gap-2.5 transition-all shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </a>

            {onSwitchToDriverOnboard && (
              <div className="pt-2 text-center border-t border-[#F3D1DC] dark:border-neutral-800">
                <p className="text-[11px] text-[#664D58] dark:text-neutral-400 font-medium">
                  Want to drive and earn on your schedule?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (onClose) onClose();
                      onSwitchToDriverOnboard();
                    }}
                    className="font-extrabold text-[#E11D48] dark:text-amber-400 hover:text-[#BE123C] dark:hover:text-[#d4af37] underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Drive with SafarX →
                  </button>
                </p>
              </div>
            )}
          </form>
        )}

        {mode === 'register' && signUpStep === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                placeholder="name@example.com"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isSendingOtp || cooldown > 0}
              className={primaryBtnClass}
            >
              {isSendingOtp ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                  <span>Sending OTP to Email...</span>
                </>
              ) : cooldown > 0 ? (
                <span>Resend OTP in {cooldown}s</span>
              ) : (
                <span>Send OTP</span>
              )}
            </button>

            <div className="relative my-3 pt-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#F3D1DC] dark:border-neutral-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-[#FFF9FA] dark:bg-neutral-900 px-3 text-[#664D58] dark:text-neutral-500">or</span>
              </div>
            </div>

            <a
              href={`${API_BASE_URL}/oauth2/authorization/google`}
              className="w-full py-3 px-4 bg-white dark:bg-neutral-800 hover:bg-[#FFF0F4] dark:hover:bg-neutral-700 active:bg-[#FCE7EE] dark:active:bg-neutral-600 border border-[#F3D1DC] dark:border-neutral-700 rounded-xl text-xs font-bold text-[#1F1218] dark:text-neutral-200 flex items-center justify-center gap-2.5 transition-all shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </a>

            {onSwitchToDriverOnboard && (
              <div className="pt-2 text-center border-t border-[#F3D1DC] dark:border-neutral-800">
                <p className="text-[11px] text-[#664D58] dark:text-neutral-400 font-medium">
                  Want to drive and earn on your schedule?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (onClose) onClose();
                      onSwitchToDriverOnboard();
                    }}
                    className="font-extrabold text-[#E11D48] dark:text-amber-400 hover:text-[#BE123C] dark:hover:text-[#d4af37] underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Drive with SafarX →
                  </button>
                </p>
              </div>
            )}
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
                  className="text-[11px] text-[#E11D48] hover:text-[#BE123C] dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Change email
                </button>
              </div>
              <input
                type="email"
                disabled
                value={email}
                className="w-full bg-[#FCE7EE]/60 dark:bg-neutral-800/60 border-2 border-[#F3D1DC] dark:border-transparent rounded-xl text-[#664D58] dark:text-neutral-400 text-xs font-semibold px-4 py-3 outline-none cursor-not-allowed shadow-sm"
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
                    className="text-[11px] text-[#E11D48] hover:text-[#BE123C] dark:text-amber-400 hover:underline font-semibold cursor-pointer disabled:opacity-50"
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
                className="w-full bg-[#FFF0F4] dark:bg-neutral-800 hover:bg-[#FCE7EE]/70 dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-[#F3D1DC] focus:border-[#E11D48] dark:border-transparent dark:focus:border-amber-400 rounded-xl text-[#1F1218] dark:text-white text-sm font-mono font-semibold px-4 py-3 outline-none tracking-widest text-center transition-all placeholder:text-[#664D58]/60 dark:placeholder:text-neutral-500 shadow-sm"
              />
              <p className="text-[10px] text-[#664D58] dark:text-neutral-500 text-center">
                Check your inbox at <span className="font-bold text-[#1F1218] dark:text-neutral-300">{email}</span>
              </p>
            </div>

            <button type="submit" className={primaryBtnClass}>
              <span>Verify OTP & Continue →</span>
            </button>
          </form>
        )}

        {mode === 'register' && signUpStep === 'password' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="p-3 rounded-xl bg-[#FFF0F4] dark:bg-neutral-800 border border-[#F3D1DC] dark:border-neutral-700 flex items-center gap-2">
              <span className="text-emerald-500 text-base shrink-0">✓</span>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-[#664D58] dark:text-neutral-400">Email Verified</p>
                <p className="text-xs font-semibold text-[#1F1218] dark:text-white truncate">{email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSignUpStep('otp');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="ml-auto text-[10px] text-[#E11D48] dark:text-amber-400 hover:underline font-semibold cursor-pointer shrink-0"
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
                  className="text-[11px] text-[#664D58] dark:text-neutral-400 hover:text-[#1F1218] dark:hover:text-white font-semibold cursor-pointer"
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
                  <span className="w-3.5 h-3.5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-4 pt-2 text-center text-[11px] text-[#664D58] dark:text-neutral-400 font-medium border-t border-[#F3D1DC] dark:border-neutral-800">
          © 2026 SafarX | By Himanshu Kumar
        </div>
      </div>
    </div>
  );
}
