import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { getAuthToken, clearAuthToken, setAuthToken, parseJwt, getStorageItem, setStorageItem } from '../utils/auth';

export default function CompleteProfile({ onProfileCompleted }) {
  const navigate = useNavigate();

  const [name, setName] = useState(() => getStorageItem('userName') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('userPhone') || '');
  const [role, setRole] = useState(() => localStorage.getItem('userRole') || 'ROLE_RIDER');
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail') || '');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      clearAuthToken();
      navigate('/login', { replace: true });
      return;
    }

    const decoded = parseJwt(token);
    if (decoded?.sub && !userEmail) {
      setUserEmail(decoded.sub);
    }
  }, [navigate, userEmail]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage('Please enter a valid phone number with country code (e.g. +91 9876543210).');
      return;
    }

    setIsLoading(true);

    try {
      const token = getAuthToken();

      
      const response = await apiClient.post(
        '/api/auth/complete-profile',
        {
          name: cleanName,
          phone: cleanPhone,
          role: role,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        setSuccessMessage('Profile setup complete! Welcome to SafarX.');

        setStorageItem('userName', cleanName);
        setStorageItem('userPhone', cleanPhone);
        setStorageItem('userRole', role);
        setStorageItem('profileCompleted', 'true');
        setAuthToken(token, userEmail, role);

        window.dispatchEvent(
          new CustomEvent('auth:user_updated', {
            detail: { name: cleanName, phone: cleanPhone, role: role },
          })
        );

        try {
          const meRes = await apiClient.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.data?.name) setStorageItem('userName', meRes.data.name);
          if (meRes.data?.riderId) setStorageItem('riderId', String(meRes.data.riderId));
          if (meRes.data?.driverId) setStorageItem('driverId', String(meRes.data.driverId));
        } catch (meErr) {
          console.warn('[CompleteProfile] Could not fetch me profile:', meErr);
        }

        if (onProfileCompleted) {
          onProfileCompleted(role);
        }

        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 800);
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        clearAuthToken();
        setErrorMessage('Session expired or unauthorized. Redirecting to login...');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1000);
      } else {
        const errorText =
          err.response?.data?.message ||
          (typeof err.response?.data === 'string' ? err.response.data : null) ||
          'Failed to complete profile. Please verify your details and try again.';

        if (
          err.response?.status === 403 ||
          errorText.toLowerCase().includes('already completed')
        ) {
          setStorageItem('userName', cleanName);
          setStorageItem('userPhone', cleanPhone);
          setStorageItem('profileCompleted', 'true');
          setSuccessMessage('✓ Profile verified and active! Heading to dashboard...');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 900);
          return;
        }

        setErrorMessage(errorText);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF5F7] dark:bg-[#0b0f19] flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans text-[#1F1218] dark:text-white">
      <div className="w-full max-w-lg bg-[#FFF9FA] dark:bg-neutral-900 border border-[#F3D1DC] dark:border-neutral-800 rounded-3xl shadow-xl p-6 sm:p-10 space-y-6 animate-in fade-in zoom-in-95 text-[#1F1218] dark:text-white">
        <div className="flex items-center justify-between border-b border-[#F3D1DC] dark:border-neutral-800 pb-5">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black tracking-tight text-[#1F1218] dark:text-white">Safar</span>
            <span className="text-2xl font-black tracking-tight text-[#E11D48] dark:text-[#d4af37]">X</span>
          </div>
          <span className="text-[11px] font-mono uppercase tracking-widest font-bold text-[#9F1239] dark:text-neutral-400 bg-[#FCE7EE] dark:bg-neutral-800 px-3 py-1 rounded-full border border-[#F4B8CA] dark:border-neutral-700">
            Step 2: Onboarding
          </span>
        </div>

        
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-[#1F1218] dark:text-white">
            Complete your profile
          </h1>
          <p className="text-xs text-[#664D58] dark:text-neutral-400 font-medium">
            {userEmail ? (
              <>Signed in with Google as <span className="font-semibold text-[#1F1218] dark:text-white">{userEmail}</span></>
            ) : (
              'Set your details and choose how you want to use SafarX'
            )}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in font-medium">
            <span className="text-base shrink-0">⚠️</span>
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in font-medium">
            <span className="text-base shrink-0">✓</span>
            <div className="leading-snug">{successMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-bold text-[#664D58] dark:text-neutral-400 block">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Himanshu Singh"
              className="w-full bg-[#FFF0F4] dark:bg-neutral-800 hover:bg-[#FCE7EE]/70 dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-[#F3D1DC] focus:border-[#E11D48] dark:border-transparent dark:focus:border-amber-400 rounded-xl text-[#1F1218] dark:text-white text-sm font-semibold px-4 py-3 outline-none transition-all placeholder:text-[#664D58]/60 dark:placeholder:text-neutral-500 shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-bold text-[#664D58] dark:text-neutral-400 block">
              Phone Number
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-[#FFF0F4] dark:bg-neutral-800 hover:bg-[#FCE7EE]/70 dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-[#F3D1DC] focus:border-[#E11D48] dark:border-transparent dark:focus:border-amber-400 rounded-xl text-[#1F1218] dark:text-white text-sm font-semibold px-4 py-3 outline-none transition-all placeholder:text-[#664D58]/60 dark:placeholder:text-neutral-500 shadow-sm"
              />
            </div>
            <p className="text-[10px] text-[#664D58] dark:text-neutral-500">Used for ride OTPs and driver contact</p>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-wider font-bold text-[#664D58] dark:text-neutral-400 block">
              Choose Account Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('ROLE_RIDER')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  role === 'ROLE_RIDER'
                    ? 'border-[#E11D48] bg-[#FFF0F4] text-[#1F1218] dark:border-amber-400 dark:bg-neutral-800 dark:text-white shadow-md'
                    : 'border-[#F3D1DC] bg-white hover:border-[#F4B8CA] dark:border-neutral-700 dark:bg-neutral-800/40 text-[#664D58] dark:text-neutral-300'
                }`}
              >
                <div className="text-xl mb-1.5">👤</div>
                <div className="font-extrabold text-xs">SafarX Rider</div>
                <div className={`text-[10px] mt-0.5 ${role === 'ROLE_RIDER' ? 'text-[#9F1239] dark:text-neutral-200' : 'text-[#664D58] dark:text-neutral-400'}`}>
                  Book rides & travel seamlessly
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('ROLE_DRIVER')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  role === 'ROLE_DRIVER'
                    ? 'border-[#E11D48] bg-[#FFF0F4] text-[#1F1218] dark:border-[#d4af37] dark:bg-neutral-800 dark:text-white shadow-md'
                    : 'border-[#F3D1DC] bg-white hover:border-[#F4B8CA] dark:border-neutral-700 dark:bg-neutral-800/40 text-[#664D58] dark:text-neutral-300'
                }`}
              >
                <div className="text-xl mb-1.5">🚗</div>
                <div className="font-extrabold text-xs">Driver Partner</div>
                <div className={`text-[10px] mt-0.5 ${role === 'ROLE_DRIVER' ? 'text-[#9F1239] dark:text-amber-300' : 'text-[#664D58] dark:text-neutral-400'}`}>
                  Accept trips & drive with us
                </div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3.5 bg-[#E11D48] hover:bg-[#BE123C] dark:bg-amber-400 dark:hover:bg-amber-500 active:scale-[0.99] text-white dark:text-black font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Completing your profile...</span>
              </>
            ) : (
              <span>Complete Profile & Start →</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[#664D58] dark:text-neutral-400 font-medium">
          © 2026 SafarX | By Himanshu Kumar
        </div>
      </div>

    </div>
  );
}
