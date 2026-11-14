import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setAuthToken, parseJwt, setStorageItem } from '../utils/auth';
import apiClient from '../utils/apiClient';

export default function OAuth2RedirectHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let isCancelled = false;

    const handleOAuth = async () => {
      let token = searchParams.get('token');
      let name = searchParams.get('name');
      let isNew = searchParams.get('isNew') === 'true';

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

      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      const cleanToken = token.trim();
      const decoded = parseJwt(cleanToken);
      const email = decoded?.sub || '';
      let role = decoded?.role || 'ROLE_RIDER';

      setAuthToken(cleanToken, email, role);

      if (name) {
        try {
          setStorageItem('userName', decodeURIComponent(name));
        } catch {
          setStorageItem('userName', name);
        }
      }

      try {
        const meRes = await apiClient.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${cleanToken}` },
        });
        if (meRes.data) {
          if (meRes.data.role) {
            role = meRes.data.role;
            setStorageItem('userRole', role);
          }
          if (meRes.data.name) {
            setStorageItem('userName', meRes.data.name);
          }
          if (meRes.data.riderId) {
            setStorageItem('riderId', String(meRes.data.riderId));
          } else if ((role === 'ROLE_RIDER' || !role) && !isNew) {
            try {
              await apiClient.post(
                '/api/auth/complete-profile',
                {
                  role: 'ROLE_RIDER',
                  name: meRes.data.name || name || email.split('@')[0],
                  phone: '',
                },
                { headers: { Authorization: `Bearer ${cleanToken}` } }
              );
              const retryMe = await apiClient.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${cleanToken}` },
              });
              if (retryMe.data?.riderId) {
                setStorageItem('riderId', String(retryMe.data.riderId));
              }
            } catch (autoErr) {
              console.warn('OAuth2 auto-profile creation error:', autoErr);
            }
          }
          if (meRes.data.driverId) {
            setStorageItem('driverId', String(meRes.data.driverId));
          }
        }
      } catch (err) {
        console.warn('Could not fetch /api/auth/me during OAuth redirect:', err);
      }

      if (isCancelled) return;

      if (isNew) {
        navigate('/complete-profile', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    };

    handleOAuth();

    return () => {
      isCancelled = true;
    };
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white select-none">
      <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-8 flex flex-col items-center space-y-6 shadow-2xl text-center animate-in fade-in zoom-in-95">
        
        
        <div className="flex items-center gap-1">
          <span className="text-3xl font-black tracking-tight text-white">Safar</span>
          <span className="text-3xl font-black tracking-tight text-[#d4af37]">X</span>
        </div>

        
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-neutral-800" />
          <div className="absolute inset-0 rounded-full border-4 border-[#d4af37] border-t-transparent animate-spin" />
        </div>

        
        <div className="space-y-1.5">
          <h2 className="text-base font-bold tracking-tight text-white">
            Authenticating with Google
          </h2>
          <p className="text-xs text-neutral-400">
            Securely syncing your credentials with SafarX...
          </p>
        </div>

      </div>
    </div>
  );
}
