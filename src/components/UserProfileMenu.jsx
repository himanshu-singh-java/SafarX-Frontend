import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../utils/apiClient';
import { resolveUserName, getStorageItem, setStorageItem } from '../utils/auth';

/**
 * UserProfileMenu Component
 * Clean Uber-style profile dropdown and Account Info modal.
 * 
 * Features:
 * - Pill trigger showing avatar and user's name (or 'Profile' if name not set).
 * - Dropdown menu containing:
 *   1. Account Info (opens account detail modal with complete profile action)
 *   2. Sign out (clears credentials and redirects to login)
 * - Strict role preservation (no arbitrary switching in public view).
 */
export default function UserProfileMenu({
  userEmail,
  userName,
  userRole,
  onUserNameChange,
  onManageAccount,
  onSignOut,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const containerRef = useRef(null);

  // Reactive state for instantaneous UI updates without page refresh
  const [localName, setLocalName] = useState(() =>
    resolveUserName(userName || getStorageItem('userName'), userEmail)
  );

  useEffect(() => {
    if (userName) {
      setLocalName(resolveUserName(userName, userEmail));
    }
  }, [userName, userEmail]);

  useEffect(() => {
    const handleUserUpdate = (e) => {
      const updated = e.detail?.name || e.detail?.userName;
      if (updated) {
        setLocalName(updated);
      }
    };
    window.addEventListener('auth:user_updated', handleUserUpdate);
    return () => window.removeEventListener('auth:user_updated', handleUserUpdate);
  }, []);

  const displayName = localName;
  const userPhone = getStorageItem('userPhone') || '';

  useEffect(() => {
    if (isAccountModalOpen) {
      setEditName(displayName);
      setEditPhone(userPhone);
      setIsEditing(false);
      setStatusNotice('');
    }
  }, [isAccountModalOpen, displayName, userPhone]);

  const handleSaveProfileDetails = async (e) => {
    if (e) e.preventDefault();
    const cleanName = editName.trim();
    const cleanPhone = editPhone.trim();

    if (cleanName) {
      setLocalName(cleanName);
      setStorageItem('userName', cleanName);
      if (onUserNameChange) {
        onUserNameChange(cleanName);
      }
      window.dispatchEvent(
        new CustomEvent('auth:user_updated', {
          detail: { name: cleanName, phone: cleanPhone },
        })
      );
      window.dispatchEvent(
        new CustomEvent('safarx:profile-updated', {
          detail: { name: cleanName, phone: cleanPhone },
        })
      );
    }
    if (cleanPhone) {
      setStorageItem('userPhone', cleanPhone);
    }

    try {
      await apiClient.post('/api/auth/complete-profile', {
        name: cleanName,
        phone: cleanPhone,
        role: userRole || 'ROLE_RIDER',
      });
      setIsEditing(false);
      setStatusNotice('✓ Profile details updated successfully!');
      setTimeout(() => setStatusNotice(''), 2500);
    } catch (err) {
      console.warn('Could not sync profile to backend:', err);
      setIsEditing(false);
      setStatusNotice('✓ Profile details saved locally!');
      setTimeout(() => setStatusNotice(''), 2500);
    }
  };

  // Compute avatar initial letter
  const avatarInitial = (displayName || 'P').charAt(0).toUpperCase();

  // Role title helper
  const roleLabel =
    userRole === 'ROLE_ADMIN'
      ? 'Administrator'
      : userRole === 'ROLE_DRIVER'
      ? 'Driver Partner'
      : 'Rider';

  const roleBadgeStyle =
    userRole === 'ROLE_ADMIN'
      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
      : userRole === 'ROLE_DRIVER'
      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
      : 'bg-blue-500/10 text-blue-500 border-blue-500/30';

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <>
      <div ref={containerRef} className="relative select-none z-40">
        {/* 1. White Pill Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 bg-white hover:bg-neutral-100 text-black px-3.5 py-1.5 rounded-full font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer border border-neutral-200"
          title="Open account menu"
        >
          {/* User Circular Avatar */}
          <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[11px] font-black shrink-0 overflow-hidden ring-1 ring-neutral-300">
            <span>{avatarInitial}</span>
          </div>

          {/* User Name (or 'Profile' fallback) */}
          <span className="font-extrabold text-neutral-900 tracking-tight max-w-[120px] sm:max-w-[160px] truncate">
            {displayName}
          </span>

          {/* Chevron Up / Down */}
          <svg
            className={`w-3.5 h-3.5 text-neutral-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 2. Floating Dropdown Menu Card */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-neutral-200/80 py-2 text-neutral-900 z-50 animate-in fade-in zoom-in-95">
            {/* Account Profile Header */}
            <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                {avatarInitial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-sm text-neutral-900 truncate">
                  {displayName}
                </div>
                <div className="text-[11px] text-neutral-500 font-medium truncate">
                  {userEmail || 'Active SafarX Account'}
                </div>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleBadgeStyle}`}>
                    {userRole === 'ROLE_ADMIN' ? '🛡️ Admin' : userRole === 'ROLE_DRIVER' ? '🚗 Driver' : '👤 Rider'}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {/* Account Info Button */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsAccountModalOpen(true);
                }}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-neutral-50 text-neutral-900 font-bold text-sm transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-neutral-500 group-hover:text-black transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="group-hover:text-black">Account Info</span>
                </div>
                <svg className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="border-t border-neutral-100 my-1" />

            {/* Sign out */}
            <div className="px-2 pt-1 pb-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onSignOut) onSignOut();
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-extrabold text-sm transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign out</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Account Info Modal Dialog */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-neutral-200 text-neutral-900 relative animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-colors"
            >
              ✕
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-black text-white font-black text-lg flex items-center justify-center shrink-0 shadow">
                {avatarInitial}
              </div>
              <div>
                <h3 className="text-xl font-black text-black tracking-tight">Account Info</h3>
                <p className="text-xs text-neutral-500">Your SafarX identity & active role</p>
              </div>
            </div>

            {/* Status Notice Toast */}
            {statusNotice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center animate-in fade-in">
                {statusNotice}
              </div>
            )}

            {/* Account Details Card or Edit Form */}
            {isEditing ? (
              <form onSubmit={handleSaveProfileDetails} className="space-y-4 mb-6 text-sm">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-[#f6f6f6] focus:bg-white border-2 border-neutral-200 focus:border-black rounded-xl text-black text-sm font-semibold px-3 py-2.5 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#f6f6f6] focus:bg-white border-2 border-neutral-200 focus:border-black rounded-xl text-black text-sm font-semibold px-3 py-2.5 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-black hover:bg-neutral-800 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-3.5 mb-6 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name</span>
                  <span className="font-extrabold text-neutral-900">{displayName}</span>
                </div>

                <div className="border-t border-neutral-200/60" />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email</span>
                  <span className="font-medium text-neutral-800 text-xs sm:text-sm truncate max-w-[200px]">{userEmail || 'Not configured'}</span>
                </div>

                <div className="border-t border-neutral-200/60" />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone</span>
                  <span className="font-medium text-neutral-800">{userPhone || 'Not set'}</span>
                </div>

                <div className="border-t border-neutral-200/60" />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Active Role</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${roleBadgeStyle}`}>
                    {userRole === 'ROLE_ADMIN' ? '🛡️ Admin' : userRole === 'ROLE_DRIVER' ? '🚗 Driver' : '👤 Rider'}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!isEditing && (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full bg-black hover:bg-neutral-800 text-white font-black py-3 px-4 rounded-xl text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
                >
                  <span>✏️ Edit Profile Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
