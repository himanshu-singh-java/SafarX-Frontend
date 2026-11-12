import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { getAuthToken, clearAuthToken, setAuthToken, parseJwt, getStorageItem, setStorageItem } from '../utils/auth';

/**
 * CompleteProfile Component
 * Onboarding screen for users who signed in via Google OAuth2.
 * Allows entering Name, Phone Number, and selecting their account Role (RIDER or DRIVER).
 */
export default function CompleteProfile({ onProfileCompleted }) {
  const navigate = useNavigate();

  // State
  const [name, setName] = useState(() => getStorageItem('userName') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('userPhone') || '');
  const [role] = useState(() => localStorage.getItem('userRole') || 'ROLE_RIDER');
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('userEmail') || '');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Pre-fill email and name from token / localStorage if available
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      // Not logged in -> redirect to login
      clearAuthToken();
      navigate('/login', { replace: true });
      return;
    }

    const decoded = parseJwt(token);
    if (decoded?.sub && !userEmail) {
      setUserEmail(decoded.sub);
    }
  }, [navigate, userEmail]);

  // Form submission handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validation
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

      // Send POST to http://localhost:8080/api/auth/complete-profile
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

      // On 200 OK success
      if (response.status === 200) {
        setSuccessMessage('Profile setup complete! Welcome to SafarX.');

        // Update local session
        setStorageItem('userName', cleanName);
        setStorageItem('userPhone', cleanPhone);
        setStorageItem('userRole', role);
        setStorageItem('profileCompleted', 'true');
        setAuthToken(token, userEmail, role);

        // Authoritatively sync newly generated riderId or driverId from /api/auth/me
        try {
          const meRes = await apiClient.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.data?.riderId) setStorageItem('riderId', String(meRes.data.riderId));
          if (meRes.data?.driverId) setStorageItem('driverId', String(meRes.data.driverId));
        } catch (meErr) {
          console.warn('[CompleteProfile] Could not fetch me profile:', meErr);
        }

        if (onProfileCompleted) {
          onProfileCompleted(role);
        }

        // Redirect to main map / dashboard screen after short toast
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 800);
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        // 401 Unauthorized: token expired or invalid credentials
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

        // If backend confirms profile is already completed in database:
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
    <div className="min-h-screen bg-[#f7f7f8] flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans text-neutral-900">
      
      {/* Container Card */}
      <div className="w-full max-w-lg bg-white border border-neutral-200/80 rounded-3xl shadow-xl p-6 sm:p-10 space-y-6 animate-in fade-in zoom-in-95">
        
        {/* Header & Logo */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black tracking-tight text-black">Safar</span>
            <span className="text-2xl font-black tracking-tight text-[#d4af37]">X</span>
          </div>
          <span className="text-[11px] font-mono uppercase tracking-widest font-bold text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200">
            Step 2: Onboarding
          </span>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">
            Complete your profile
          </h1>
          <p className="text-xs text-neutral-500 font-medium">
            {userEmail ? (
              <>Signed in with Google as <span className="font-semibold text-black">{userEmail}</span></>
            ) : (
              'Set your details and choose how you want to use SafarX'
            )}
          </p>
        </div>

        {/* Feedback Banners */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* 1. Full Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Himanshu Singh"
              className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-sm font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
            />
          </div>

          {/* 2. Phone Number */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
              Phone Number
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-sm font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
              />
            </div>
            <p className="text-[10px] text-neutral-400">Used for ride OTPs and driver contact</p>
          </div>

          {/* 3. Account Role Status (Auto-assigned: ROLE_RIDER for standard users) */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-lg shadow-sm">
                {role === 'ROLE_DRIVER' ? '🚗' : role === 'ROLE_ADMIN' ? '🛡️' : '👤'}
              </div>
              <div>
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Account Role</div>
                <div className="text-xs font-black text-neutral-900">
                  {role === 'ROLE_DRIVER' ? 'Driver Partner' : role === 'ROLE_ADMIN' ? 'Administrator' : 'SafarX Rider'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-neutral-200/70 text-neutral-700">
              Verified
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3.5 bg-black hover:bg-neutral-800 active:scale-[0.99] text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2.5 disabled:opacity-50"
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

      </div>

    </div>
  );
}

