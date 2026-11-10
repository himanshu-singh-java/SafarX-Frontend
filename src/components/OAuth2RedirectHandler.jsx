import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setAuthToken, parseJwt } from '../utils/auth';

/**
 * OAuth2RedirectHandler Component
 * 
 * Handles redirect from backend OAuth2 login (e.g., Google OAuth2).
 * Extracts JWT token from URL query params: ?token=...
 * If token exists:
 *   - Saves to localStorage ('jwtToken')
 *   - Parses user profile & role
 *   - Redirects to /dashboard
 * If token is missing:
 *   - Redirects to /login
 */
export default function OAuth2RedirectHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Try extracting from query params: ?token=...
    let token = searchParams.get('token');
    let name = searchParams.get('name');
    let isNew = searchParams.get('isNew') === 'true';

    // 2. Try extracting from URL hash fragment: #token=... (Spring Boot OAuth2SuccessHandler format)
    if (!token && window.location.hash) {
      const hashStr = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashStr);
      token = hashParams.get('token');
      name = hashParams.get('name');
      if (hashParams.has('isNew')) {
        isNew = hashParams.get('isNew') === 'true';
      }
    }

    if (token) {
      const cleanToken = token.trim();

      // Decode claims (email & role)
      const decoded = parseJwt(cleanToken);
      const email = decoded?.sub || '';
      const role =
        decoded?.role ||
        (email.toLowerCase().includes('admin') ? 'ROLE_ADMIN' : 'ROLE_RIDER');

      // Save token, email, and role to localStorage
      setAuthToken(cleanToken, email, role);

      if (name) {
        try {
          localStorage.setItem('userName', decodeURIComponent(name));
        } catch {
          localStorage.setItem('userName', name);
        }
      }

      // Mark session and route directly to dashboard (or onboarding if new)
      localStorage.setItem('profileCompleted', 'true');
      navigate('/dashboard', { replace: true });
    } else {
      // Token missing: redirect user to /login
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white select-none">
      <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-8 flex flex-col items-center space-y-6 shadow-2xl text-center animate-in fade-in zoom-in-95">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-1">
          <span className="text-3xl font-black tracking-tight text-white">Safar</span>
          <span className="text-3xl font-black tracking-tight text-[#d4af37]">X</span>
        </div>

        {/* Loading Spinner */}
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-neutral-800" />
          <div className="absolute inset-0 rounded-full border-4 border-[#d4af37] border-t-transparent animate-spin" />
        </div>

        {/* Status Message */}
        <div className="space-y-1.5">
          <h2 className="text-base font-bold tracking-tight text-white">
            Authenticating with Google
          </h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Securing your session token and setting up your SafarX profile...
          </p>
        </div>

      </div>
    </div>
  );
}

