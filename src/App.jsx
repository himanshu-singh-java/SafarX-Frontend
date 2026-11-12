import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import RiderDashboard from './components/RiderDashboard';
import DriverDashboard from './components/DriverDashboard';
import AuthModal from './components/AuthModal';
import OAuth2RedirectHandler from './components/OAuth2RedirectHandler';
import CompleteProfile from './components/CompleteProfile';
import UserProfileMenu from './components/UserProfileMenu';
import DriverOnboardingModal from './components/DriverOnboardingModal';
import apiClient from './utils/apiClient';
import { getAuthToken, setAuthToken, clearAuthToken, parseJwt, getUserRole, getStorageItem, setStorageItem, resolveUserName, AUTH_UNAUTHORIZED_EVENT } from './utils/auth';

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Authentication & Role State (Tab-isolated session storage)
  const [token, setToken] = useState(() => getAuthToken());
  const [userEmail, setUserEmail] = useState(() => getStorageItem('userEmail') || '');
  const [userName, setUserName] = useState(() => {
    const email = getStorageItem('userEmail');
    return resolveUserName(getStorageItem('userName'), email);
  });
  const [userRole, setUserRole] = useState(() => getUserRole());

  // Auth Modal State (Popup Dialog)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'register'
  const [authAlertNotice, setAuthAlertNotice] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  // Dedicated Driver Partner Onboarding State (Drive with SafarX)
  const [isDriverOnboardingOpen, setIsDriverOnboardingOpen] = useState(false);

  // View Mode: 'rider' (SafarX Client) | 'admin' (Admin Console) | 'driver' (Driver Console)
  // Strict role-based landing: ADMIN -> admin, DRIVER -> driver, RIDER -> rider
  const [viewMode, setViewMode] = useState(() => {
    const t = getAuthToken();
    const r = getUserRole();
    if (t && r === 'ROLE_ADMIN') {
      return 'admin';
    }
    if (t && r === 'ROLE_DRIVER') {
      return 'driver';
    }
    return 'rider';
  });

  // Trigger My Trips drawer from navbar
  const [openHistoryTrigger, setOpenHistoryTrigger] = useState(0);
  // Trigger Return to Cinematic Animation Homepage
  const [resetHomeTrigger, setResetHomeTrigger] = useState(0);

  // Clicking SafarX brand logo always returns directly to the cinematic animation homepage
  const handleBrandClick = () => {
    setIsAuthModalOpen(false);
    setIsDriverOnboardingOpen(false);
    setSessionExpired(false);
    setViewMode('rider');
    navigate('/', { replace: true });
    setResetHomeTrigger((prev) => prev + 1);
  };

  // Verify token expiration on initial load & handle global 401/403 events
  useEffect(() => {
    if (token) {
      const decoded = parseJwt(token);
      if (decoded?.exp && decoded.exp * 1000 < Date.now()) {
        clearAuthToken();
        setToken(null);
        setUserEmail('');
        setUserRole('ROLE_RIDER');
        setViewMode('rider');
      } else {
        if (decoded?.sub && !userEmail) {
          setUserEmail(decoded.sub);
        }
        if (decoded?.role) {
          setUserRole(decoded.role);
          if (decoded.role === 'ROLE_ADMIN') {
            setViewMode('admin');
          } else if (decoded.role === 'ROLE_DRIVER') {
            setViewMode('driver');
          } else {
            setViewMode('rider');
          }
        }

        // Live server-side validation against backend DB (/api/auth/me)
        // Auto-syncs live profile and gracefully cleans up if DB was dropped or user removed
        apiClient
          .get('/api/auth/me', { silentAuth: true })
          .then((res) => {
            const profile = res.data;
            if (profile) {
              const effectiveEmail = profile.email || userEmail;
              if (effectiveEmail) setUserEmail(effectiveEmail);
              const effectiveName = resolveUserName(profile.name, effectiveEmail);
              setUserName(effectiveName);
              setStorageItem('userName', effectiveName);

              if (profile.riderId) {
                setStorageItem('riderId', String(profile.riderId));
              } else if (profile.role === 'ROLE_RIDER' || (!profile.role && userRole === 'ROLE_RIDER')) {
                apiClient
                  .post(
                    '/api/auth/complete-profile',
                    { role: 'ROLE_RIDER', name: effectiveName, phone: '' },
                    { silentAuth: true }
                  )
                  .then(() => apiClient.get('/api/auth/me', { silentAuth: true }))
                  .then((retry) => {
                    if (retry.data?.riderId) {
                      setStorageItem('riderId', String(retry.data.riderId));
                    }
                  })
                  .catch(() => {});
              }
              if (profile.driverId) {
                setStorageItem('driverId', String(profile.driverId));
              }
              if (profile.role) {
                setUserRole(profile.role);
                setStorageItem('userRole', profile.role);
                if (profile.role === 'ROLE_ADMIN') setViewMode('admin');
                else if (profile.role === 'ROLE_DRIVER') setViewMode('driver');
                else setViewMode('rider');
              }
            }
          })
          .catch((err) => {
            // Background sync failure (e.g. offline, endpoint pending, or minor network glitch)
            // NEVER wipe the user's active session on page refresh!
            console.debug('[App] Background profile sync:', err?.response?.status || err?.message);
          });
      }
    }

    const handleUnauthorized = () => {
      clearAuthToken();
      setToken(null);
      setUserEmail('');
      setUserRole('ROLE_RIDER');
      setViewMode('rider');
      setSessionExpired(true);
      setAuthModalMode('login');
      setAuthAlertNotice('Session expired or unauthorized. Please sign in again.');
      setIsAuthModalOpen(true);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    const handleUserUpdated = (e) => {
      const newName = e.detail?.name || e.detail?.userName || getStorageItem('userName');
      if (newName) {
        setUserName(newName);
      }
    };
    window.addEventListener('auth:user_updated', handleUserUpdated);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener('auth:user_updated', handleUserUpdated);
    };
  }, [token]);

  // Auto-redirect authenticated user away from /login to homepage
  useEffect(() => {
    if (location.pathname === '/login' && token) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, token, navigate]);

  // Auto-open login modal if route is /login and user is not authenticated
  useEffect(() => {
    if (location.pathname === '/login' && !token) {
      setAuthModalMode('login');
      const params = new URLSearchParams(location.search);
      const oauthError = params.get('error');
      if (oauthError === 'account_exists_use_password') {
        setAuthAlertNotice('⚠️ This email is already registered with password. Please enter your password to sign in, or enable Google login in backend.');
      } else if (oauthError) {
        setAuthAlertNotice(`Notice: ${oauthError.replace(/_/g, ' ')}`);
      }
      setIsAuthModalOpen(true);
    }
  }, [location.pathname, location.search, token]);

  // Sync token state on route change (e.g. after OAuth2 redirect sets token in localStorage)
  useEffect(() => {
    const currentToken = getAuthToken();
    if (currentToken && currentToken !== token) {
      setToken(currentToken);
      const email = getStorageItem('userEmail') || '';
      setUserEmail(email);
      setUserName(getStorageItem('userName') || '');
      const role = getUserRole();
      setUserRole(role);
      if (role === 'ROLE_ADMIN') {
        setViewMode('admin');
      } else if (role === 'ROLE_DRIVER') {
        setViewMode('driver');
      } else {
        setViewMode('rider');
      }
    } else {
      setUserName(getStorageItem('userName') || '');
    }
  }, [location.pathname, token]);

  // Open Auth Modal handler
  const openAuth = (mode = 'login', notice = '') => {
    setAuthModalMode(mode);
    setAuthAlertNotice(notice);
    setSessionExpired(false);
    setIsAuthModalOpen(true);
  };

  // Handle Login / Registration Success with Role Auto-Routing
  const handleLoginSuccess = (newToken, email, explicitRole) => {
    setToken(newToken);
    setUserEmail(email);
    const resolvedName = resolveUserName(getStorageItem('userName'), email);
    setUserName(resolvedName);
    setStorageItem('userName', resolvedName);

    // Auto-detect role from token payload, explicit param, or email pattern
    const decoded = parseJwt(newToken);
    const detectedRole =
      explicitRole ||
      decoded?.role ||
      (email.toLowerCase().includes('admin') ? 'ROLE_ADMIN' : 'ROLE_RIDER');

    setUserRole(detectedRole);
    setStorageItem('userRole', detectedRole);

    // Dynamic routing: ROLE_ADMIN -> Admin, ROLE_DRIVER -> Driver, ROLE_RIDER -> Rider
    if (detectedRole === 'ROLE_ADMIN') {
      setViewMode('admin');
    } else if (detectedRole === 'ROLE_DRIVER') {
      setViewMode('driver');
    } else {
      setViewMode('rider');
    }
    setIsAuthModalOpen(false);
    if (location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  };

  // Handle Driver Onboarding Success (Drive with SafarX)
  const handleDriverOnboardingSuccess = (newToken, email, driverId) => {
    setToken(newToken);
    setUserEmail(email);
    const resolvedName = resolveUserName(getStorageItem('userName'), email);
    setUserName(resolvedName);
    setStorageItem('userName', resolvedName);
    setUserRole('ROLE_DRIVER');
    setViewMode('driver');
    setIsDriverOnboardingOpen(false);
    if (location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  };

  // Handle Logout
  const handleLogout = () => {
    clearAuthToken();
    setToken(null);
    setUserEmail('');
    setUserName('');
    setUserRole('ROLE_RIDER');
    setViewMode('rider');
    setSessionExpired(false);
    navigate('/login');
  };

  return (
    <Routes>
      {/* 1. DEDICATED OAUTH2 REDIRECT ROUTE */}
      <Route path="/oauth2/redirect" element={<OAuth2RedirectHandler />} />

      {/* 2. ONBOARDING: COMPLETE PROFILE ROUTE */}
      <Route
        path="/complete-profile"
        element={
          <CompleteProfile
            onProfileCompleted={(newRole) => {
              setUserRole(newRole);
              if (newRole === 'ROLE_ADMIN') setViewMode('admin');
              else if (newRole === 'ROLE_DRIVER') setViewMode('driver');
              else setViewMode('rider');
              navigate('/dashboard');
            }}
          />
        }
      />

      {/* 3. MAIN APPLICATION ROUTE (matches /, /dashboard, /login, etc.) */}
      <Route
        path="*"
        element={
          <div className={`min-h-screen ${viewMode === 'admin' ? 'bg-[#0a0706]' : 'bg-[#faf8f5]'}`}>
      
      {/* 1. TOP NAVBAR (MATCHING OFFICIAL UBER SCREENSHOT - ZERO ADMIN CONTROLS FOR PUBLIC) */}
      <header className="sticky top-0 z-40 bg-black text-white px-4 sm:px-8 py-3 flex items-center justify-between border-b border-neutral-900 shadow-sm">
        
        {/* Left: Brand */}
        <div className="flex items-center gap-6 md:gap-8">
          <div
            onClick={handleBrandClick}
            className="flex items-center gap-1 cursor-pointer select-none group"
            title="Return to SafarX Homepage"
          >
            <span className="text-2xl font-black tracking-tight text-white group-hover:text-neutral-200 transition-colors">Safar</span>
            <span className="text-2xl font-black tracking-tight text-[#d4af37] group-hover:brightness-125 transition-all">X</span>
          </div>

          {/* Admin Switcher: ONLY VISIBLE IF LOGGED IN AS ROLE_ADMIN */}
          {token && userRole === 'ROLE_ADMIN' && (
            <div className="flex items-center p-0.5 bg-neutral-900 rounded-full border border-[#d4af37]/40 text-xs">
              <button
                onClick={() => setViewMode('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
                  viewMode === 'admin'
                    ? 'bg-[#d4af37] text-black shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>🛡️</span>
                <span>Admin Console</span>
              </button>
              <button
                onClick={() => setViewMode('rider')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
                  viewMode === 'rider'
                    ? 'bg-white text-black shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>👁️</span>
                <span className="hidden sm:inline">Preview Client</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Consumer Trips, Drive with SafarX, Log in & Sign up */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold">
          
          {/* My Trips (consumer trip drawer for riders) */}
          {token && viewMode === 'rider' && (
            <button
              onClick={() => setOpenHistoryTrigger((prev) => prev + 1)}
              className="text-neutral-300 hover:text-white hover:bg-neutral-900 px-3 py-1.5 rounded-full transition-colors font-medium"
            >
              My Trips
            </button>
          )}

          {/* Authentication State Controls: 3 Distinct Options */}
          {!token ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Option 1: Drive with SafarX (Dedicated Driver Partner Registration with 3D Car Thumbnail) */}
              <button
                type="button"
                onClick={() => setIsDriverOnboardingOpen(true)}
                className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 hover:border-[#d4af37]/80 font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer group"
                title="Register your vehicle and drive with SafarX"
              >
                <div className="w-5 h-4 rounded-md overflow-hidden bg-white/10 flex items-center justify-center shrink-0 border border-neutral-700/60 group-hover:border-[#d4af37]/80 transition-colors">
                  <img
                    src="/vehicle_car.jpg"
                    alt="SafarX 3D Car"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors">
                  Drive with SafarX
                </span>
              </button>

              {/* Option 2: Unified Log in (Routes automatically based on role: Rider or Driver) */}
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="text-white hover:text-neutral-300 font-bold px-2 sm:px-3 py-1.5 transition-colors cursor-pointer"
              >
                Log in
              </button>

              {/* Option 3: Rider Sign up (Automatic ROLE_RIDER) */}
              <button
                type="button"
                onClick={() => openAuth('register')}
                className="bg-white hover:bg-neutral-200 text-black font-extrabold px-3.5 sm:px-4 py-2 rounded-full transition-all shadow active:scale-95 whitespace-nowrap cursor-pointer"
              >
                Sign up
              </button>
            </div>
          ) : (
            <UserProfileMenu
              userEmail={userEmail}
              userName={userName}
              userRole={userRole}
              onUserNameChange={setUserName}
              onManageAccount={() => navigate('/complete-profile')}
              onSignOut={handleLogout}
            />
          )}

        </div>

      </header>

      {/* Admin Preview Mode Banner (Only when Admin is previewing Rider Dashboard) */}
      {token && userRole === 'ROLE_ADMIN' && viewMode === 'rider' && (
        <div className="bg-[#d4af37] text-black text-xs font-bold px-4 sm:px-8 py-2 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <span>🛡️</span>
            <span>Admin Preview Mode: You are previewing the consumer Rider experience.</span>
          </div>
          <button
            onClick={() => setViewMode('admin')}
            className="bg-black hover:bg-neutral-800 text-white px-3 py-1 rounded-full text-xs font-extrabold transition-all shadow"
          >
            Return to Admin Console →
          </button>
        </div>
      )}

      {/* Main Content View (Strictly role-dependent) */}
      <main>
        {viewMode === 'driver' ? (
          <DriverDashboard
            token={token}
            userEmail={userEmail}
          />
        ) : viewMode === 'admin' ? (
          <AdminDashboard
            token={token}
            userEmail={userEmail}
            onOpenAuth={openAuth}
          />
        ) : (
          <RiderDashboard
            token={token}
            userEmail={userEmail}
            onOpenAuth={openAuth}
            openHistoryTrigger={openHistoryTrigger}
            resetHomeTrigger={resetHomeTrigger}
          />
        )}
      </main>

      {/* Universal Auth Modal Dialog (Appears only on Log in / Sign up click) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        sessionExpired={sessionExpired}
        alertNotice={authAlertNotice}
        onSwitchToDriverOnboard={() => {
          setIsAuthModalOpen(false);
          setIsDriverOnboardingOpen(true);
        }}
      />

      {/* Dedicated Driver Partner Onboarding Modal Dialog (Drive with SafarX) */}
      <DriverOnboardingModal
        isOpen={isDriverOnboardingOpen}
        onClose={() => setIsDriverOnboardingOpen(false)}
        onSuccess={handleDriverOnboardingSuccess}
        onSwitchToLogin={() => {
          setIsDriverOnboardingOpen(false);
          openAuth('login');
        }}
      />

    </div>
        }
      />
    </Routes>
  );
}

export default App;