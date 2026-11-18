import React, { useState, useEffect } from 'react';
import { setAuthToken, setStorageItem, getStorageItem } from '../utils/auth';
import apiClient from '../utils/apiClient';
import { registerDriverProfile } from '../utils/driverDirectory';

export default function DriverOnboardingModal({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToLogin,
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');

  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [coords, setCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('Detecting live GPS...');

  const [vehicleType, setVehicleType] = useState('CAR');
  const [plateNumber, setPlateNumber] = useState('');

  const [carModel, setCarModel] = useState('Maruti Suzuki Dzire');
  const [carCategory, setCarCategory] = useState('SEDAN');
  const [carCapacity, setCarCapacity] = useState(4);
  const [isAcAvailable, setIsAcAvailable] = useState(true);
  const [hasLuggageCarrier, setHasLuggageCarrier] = useState(true);
  const [hasWifiOrScreen, setHasWifiOrScreen] = useState(false);

  const [bikeModel, setBikeModel] = useState('Hero Splendor Plus');
  const [bikeType, setBikeType] = useState('COMMUTER');
  const [hasExtraHelmet, setHasExtraHelmet] = useState(true);
  const [isParcelDeliveryEnabled, setIsParcelDeliveryEnabled] = useState(true);

  const [autoModel, setAutoModel] = useState('Bajaj RE Compact');
  const [permitType, setPermitType] = useState('CITY_PERMIT');
  const [autoCapacity, setAutoCapacity] = useState(3);
  const [isSharedAuto, setIsSharedAuto] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEmailRegistered, setIsEmailRegistered] = useState(false);
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
      setErrorMessage('');
      setIsEmailRegistered(false);
      setSuccessMessage('');
      setIsOtpSent(false);
      setOtp('');
      setCooldown(0);
      setIsSendingOtp(false);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const detectedLat = parseFloat(pos.coords.latitude.toFixed(6));
            const detectedLng = parseFloat(pos.coords.longitude.toFixed(6));
            setCoords({ lat: detectedLat, lng: detectedLng });
            setGpsStatus(`GPS Active (${detectedLat.toFixed(4)}, ${detectedLng.toFixed(4)})`);
          },
          (err) => {
            console.warn('[DriverOnboarding] GPS access denied or failed:', err);
            setGpsStatus('GPS Permission Denied. Please enable location in browser.');
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      } else {
        setGpsStatus('GPS not supported on this browser.');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendDriverOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setIsEmailRegistered(false);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('Please enter your email address to receive an OTP.');
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
      setCooldown(60);
      setSuccessMessage('OTP sent successfully to ' + normalizedEmail + '! Enter the 6-digit code below.');
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const message = (typeof data === 'string' ? data : data?.message) || data?.error;

      if (status === 429) {
        setErrorMessage(message || 'Please wait 60 seconds before requesting a new OTP.');
        setCooldown(60);
      } else {
        setErrorMessage(message || 'Failed to send OTP. Please check your email address.');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOnboardSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setIsEmailRegistered(false);
    setSuccessMessage('');

    if (!fullName.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      setErrorMessage('Please fill in all personal information fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (!isOtpSent || !otp.trim()) {
      setErrorMessage('Please verify your email address with the 6-digit OTP.');
      return;
    }

    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
      setErrorMessage('Please enable device GPS access to register as an active driver partner.');
      return;
    }

    if (coords.lat < -90 || coords.lat > 90) {
      setErrorMessage('Invalid GPS latitude. Must be between -90.0 and 90.0.');
      return;
    }

    if (coords.lng < -180 || coords.lng > 180) {
      setErrorMessage('Invalid GPS longitude. Must be between -180.0 and 180.0.');
      return;
    }

    if (!plateNumber.trim()) {
      setErrorMessage('Please enter your vehicle license plate / registration number.');
      return;
    }

    if (vehicleType === 'CAR' && !carModel.trim()) {
      setErrorMessage('Please enter your car model name.');
      return;
    }
    if (vehicleType === 'BIKE' && !bikeModel.trim()) {
      setErrorMessage('Please enter your bike model name.');
      return;
    }
    if (vehicleType === 'AUTO' && !autoModel.trim()) {
      setErrorMessage('Please enter your auto model name.');
      return;
    }

    const payload = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      phone: phone.trim(),
      latitude: coords.lat,
      longitude: coords.lng,
      vehicleType: vehicleType.toUpperCase(),
      plateNumber: plateNumber.trim().toUpperCase(),
      otp: otp.trim(),
    };

    if (vehicleType === 'CAR') {
      payload.carModel = carModel.trim() || 'Maruti Suzuki Dzire';
      payload.carCategory = carCategory;
      payload.carPassengerCapacity = Number(carCapacity) || 4;
      payload.isAcAvailable = Boolean(isAcAvailable);
      payload.hasLuggageCarrier = Boolean(hasLuggageCarrier);
      payload.hasWifiOrScreen = Boolean(hasWifiOrScreen);
    } else if (vehicleType === 'BIKE') {
      payload.bikeModel = bikeModel.trim() || 'Hero Splendor Plus';
      payload.bikeType = bikeType;
      payload.hasExtraHelmet = Boolean(hasExtraHelmet);
      payload.isParcelDeliveryEnabled = Boolean(isParcelDeliveryEnabled);
    } else if (vehicleType === 'AUTO') {
      payload.autoModel = autoModel.trim() || 'Bajaj RE Compact';
      payload.permitType = permitType;
      payload.autoPassengerCapacity = Number(autoCapacity) || 3;
      payload.isSharedAuto = Boolean(isSharedAuto);
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/api/driver/onboard', payload);
      const data = response.data || {};

      setErrorMessage('');
      setSuccessMessage('🎉 Partner Account & Vehicle Registered! Welcome to SafarX Fleet.');

      try {
        const normalizedEmail = (data.email || email).trim().toLowerCase();
        const resolvedDriverId = data.driverId ? String(data.driverId) : '';
        const resolvedModel =
          vehicleType === 'CAR'
            ? (carModel.trim() || 'Maruti Suzuki Dzire')
            : vehicleType === 'BIKE'
            ? (bikeType === 'SCOOTER' ? (bikeModel.trim() || 'Honda Activa (Scooter)') : (bikeModel.trim() || 'Hero Splendor Plus'))
            : (autoModel.trim() || 'Bajaj RE Compact');
        const resolvedPlate = plateNumber.trim().toUpperCase();

        setAuthToken(data.token, normalizedEmail, 'ROLE_DRIVER');
        if (resolvedDriverId) setStorageItem('driverId', resolvedDriverId);
        setStorageItem('userEmail', normalizedEmail);
        setStorageItem('userName', fullName.trim());
        setStorageItem('userPhone', phone.trim());
        setStorageItem('driverVehicleType', vehicleType);
        setStorageItem('driverVehicleModel', resolvedModel);
        setStorageItem('driverPlateNumber', resolvedPlate);

        const activeProfile = {
          driverId: resolvedDriverId ? Number(resolvedDriverId) : 1,
          id: resolvedDriverId ? Number(resolvedDriverId) : 1,
          name: fullName.trim(),
          vehicleType: vehicleType,
          model: resolvedModel,
          plateNumber: resolvedPlate,
          phone: phone.trim(),
          isCustomEdit: true,
        };
        registerDriverProfile(activeProfile);

      } catch (storageErr) {
        console.warn('[DriverOnboarding] Local profile storage warning:', storageErr);
      }

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(data.token, data.email || email.trim(), data.driverId);
        }
        if (onClose) {
          onClose();
        }
      }, 700);
    } catch (err) {
      console.warn('Driver onboarding network issue:', err);
      const status = err.response?.status;
      const data = err.response?.data || {};
      const message = (typeof data === 'string' ? data : data?.message) || data?.error;

      if (status === 401) {
        setErrorMessage(message || 'Invalid or expired OTP! Please re-enter the code or request a new OTP.');
      } else if (status === 429) {
        setErrorMessage(message || 'Too many requests. Please wait before trying again.');
      } else if (
        status === 409 ||
        (message && message.toLowerCase().includes('already exists')) ||
        (message && message.toLowerCase().includes('already registered'))
      ) {
        setIsEmailRegistered(true);
        setErrorMessage(
          'This email is already registered in our system! If you already have an account, please sign in.'
        );
      } else {
        setErrorMessage(
          message || 'Unable to connect to service. Please check your connection and try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in select-none">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-neutral-900 dark:text-white animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white flex items-center justify-center font-bold text-base transition-all cursor-pointer"
          title="Close dialog"
        >
          ✕
        </button>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center p-1 shadow-sm overflow-hidden shrink-0">
              <img
                src="/vehicle_car.jpg"
                alt="SafarX 3D Car"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-black dark:text-white tracking-tight">
                  Safar<span className="text-[#d4af37]">X</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-[#996515] dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full">
                  Partner Fleet
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">
                Drive with SafarX
              </h2>
            </div>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Register your driver account and vehicle in one quick step. Start accepting passenger trips immediately.
          </p>

          <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 px-3.5 py-2 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-neutral-700 dark:text-neutral-300 font-mono text-[11px] font-semibold">{gpsStatus}</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider">
              Auto Dispatch GPS
            </span>
          </div>
        </div>

        {errorMessage && !successMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2.5 animate-in fade-in font-medium">
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0">⚠️</span>
              <span className="leading-snug flex-1">{errorMessage}</span>
            </div>
            {isEmailRegistered && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    if (onSwitchToLogin) onSwitchToLogin(email);
                  }}
                  className="bg-black hover:bg-neutral-800 text-white px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer shadow flex items-center gap-1.5"
                >
                  <span>Sign In to Driver Partner Account</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <span className="text-sm">✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleOnboardSubmit} className="space-y-6">
          <div className="space-y-3">
            <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 pb-1.5 flex items-center gap-2">
              <span>1. Partner Account Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                  Mobile Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                    Email Address *
                  </label>
                  {isOtpSent && cooldown > 0 ? (
                    <span className="text-[10px] text-neutral-400 font-mono font-semibold">
                      Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isSendingOtp || cooldown > 0}
                      onClick={handleSendDriverOtp}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingOtp ? 'Sending...' : isOtpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    disabled={isOtpSent}
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                    placeholder="driver@example.com"
                    className="flex-1 bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm disabled:opacity-80"
                  />
                  {!isOtpSent && (
                    <button
                      type="button"
                      disabled={isSendingOtp || cooldown > 0}
                      onClick={handleSendDriverOtp}
                      className="px-3.5 py-3 bg-black hover:bg-neutral-800 dark:bg-amber-400 dark:hover:bg-amber-500 text-white dark:text-black font-extrabold text-xs rounded-xl transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isSendingOtp && (
                        <span className="w-3 h-3 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                      )}
                      <span>Send OTP</span>
                    </button>
                  )}
                  {isOtpSent && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOtpSent(false);
                        setOtp('');
                      }}
                      className="px-3 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-bold text-xs rounded-xl transition-all shrink-0 cursor-pointer"
                      title="Change email"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-neutral-500 hover:text-black dark:hover:text-white font-semibold cursor-pointer"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                />
              </div>
            </div>

            {isOtpSent && (
              <div className="space-y-1 pt-1 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                    Enter 6-Digit Email OTP *
                  </label>
                  {cooldown > 0 ? (
                    <span className="text-[10px] text-neutral-400 font-mono font-semibold">
                      Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isSendingOtp}
                      onClick={handleSendDriverOtp}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-extrabold cursor-pointer disabled:opacity-50"
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
                  className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-semibold px-4 py-3 outline-none tracking-widest text-center transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm font-mono text-sm"
                />
              </div>
            )}
          </div>

          <div className="space-y-3.5 pt-1">
            <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 pb-1.5 flex items-center gap-2">
              <span>2. Vehicle Fleet Category</span>
            </div>

            <div>
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setVehicleType('CAR')}
                  className={`p-3 rounded-2xl border-2 text-left cursor-pointer transition-all flex flex-col justify-between relative ${
                    vehicleType === 'CAR'
                      ? 'border-black bg-neutral-50 shadow-md ring-1 ring-black/5'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                  }`}
                >
                  <div className="w-full h-14 sm:h-16 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 p-1 flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                    <img
                      src="/vehicle_car.jpg"
                      alt="3D Car"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-neutral-900 dark:text-white text-xs sm:text-sm">Car / Cab</span>
                      {vehicleType === 'CAR' && (
                        <span className="w-4 h-4 rounded-full bg-black dark:bg-amber-400 text-white dark:text-black flex items-center justify-center text-[9px] font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">Sedan, SUV, Mini</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleType('BIKE')}
                  className={`p-3 rounded-2xl border-2 text-left cursor-pointer transition-all flex flex-col justify-between relative ${
                    vehicleType === 'BIKE'
                      ? 'border-black bg-neutral-50 shadow-md ring-1 ring-black/5'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                  }`}
                >
                  <div className="w-full h-14 sm:h-16 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 p-1 flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                    <img
                      src="/vehicle_moto.jpg"
                      alt="3D Moto"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-neutral-900 dark:text-white text-xs sm:text-sm">SafarX Moto</span>
                      {vehicleType === 'BIKE' && (
                        <span className="w-4 h-4 rounded-full bg-black dark:bg-amber-400 text-white dark:text-black flex items-center justify-center text-[9px] font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">Bike & Scooter</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleType('AUTO')}
                  className={`p-3 rounded-2xl border-2 text-left cursor-pointer transition-all flex flex-col justify-between relative ${
                    vehicleType === 'AUTO'
                      ? 'border-black bg-neutral-50 shadow-md ring-1 ring-black/5'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                  }`}
                >
                  <div className="w-full h-14 sm:h-16 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 p-1 flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                    <img
                      src="/vehicle_auto.jpg"
                      alt="3D Auto"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-neutral-900 dark:text-white text-xs sm:text-sm">Auto</span>
                      {vehicleType === 'AUTO' && (
                        <span className="w-4 h-4 rounded-full bg-black dark:bg-amber-400 text-white dark:text-black flex items-center justify-center text-[9px] font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">City 3-Wheeler</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400 block">
                  Vehicle License Plate Number *
                </label>
                <span className="text-[10px] text-neutral-400 font-mono font-semibold">RTO Registered</span>
              </div>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="TS 09 AB 1234 / MH 02 CD 5678"
                className="w-full bg-[#f6f6f6] dark:bg-neutral-800 hover:bg-[#efefef] dark:hover:bg-neutral-750 focus:bg-white dark:focus:bg-neutral-900 border-2 border-transparent focus:border-black dark:focus:border-amber-400 rounded-xl text-black dark:text-white text-xs font-mono font-bold tracking-wider px-4 py-3 outline-none transition-all placeholder:font-sans placeholder:tracking-normal placeholder:font-normal placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
              />
            </div>

            {vehicleType === 'CAR' && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 animate-in fade-in">
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Car Configuration
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
                      Model Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={carModel}
                      onChange={(e) => setCarModel(e.target.value)}
                      placeholder="e.g. Maruti Dzire, Honda City"
                      className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs px-3 py-2.5 outline-none font-semibold text-neutral-900 dark:text-white focus:border-black dark:focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
                      Body Category
                    </label>
                    <select
                      value={carCategory}
                      onChange={(e) => setCarCategory(e.target.value)}
                      className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs px-3 py-2.5 outline-none font-semibold text-neutral-900 dark:text-white focus:border-black dark:focus:border-amber-400 cursor-pointer"
                    >
                      <option value="SEDAN">SEDAN (Dzire, Amaze)</option>
                      <option value="HATCHBACK">HATCHBACK (WagonR, Swift)</option>
                      <option value="SUV">SUV (Innova, Ertiga, Scorpio)</option>
                      <option value="PREMIUM">PREMIUM (Camry, Audi A4)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
                      Passenger Seats
                    </label>
                    <select
                      value={carCapacity}
                      onChange={(e) => setCarCapacity(Number(e.target.value))}
                      className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs px-3 py-2.5 outline-none font-semibold text-neutral-900 dark:text-white focus:border-black dark:focus:border-amber-400 cursor-pointer"
                    >
                      <option value={4}>4 Passengers (Standard)</option>
                      <option value={6}>6 Passengers (XL / SUV)</option>
                      <option value={7}>7 Passengers (Max XL)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
                      Comfort Features
                    </label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAcAvailable(!isAcAvailable)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                          isAcAvailable
                            ? 'bg-black text-white border-black shadow-sm'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        {isAcAvailable ? '✓ AC Active' : '+ AC'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasLuggageCarrier(!hasLuggageCarrier)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                          hasLuggageCarrier
                            ? 'bg-black text-white border-black shadow-sm'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        {hasLuggageCarrier ? '✓ Boot / Carrier' : '+ Carrier'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {vehicleType === 'BIKE' && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 animate-in fade-in">
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Two-Wheeler Details
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
                      Model Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={bikeModel}
                      onChange={(e) => setBikeModel(e.target.value)}
                      placeholder="e.g. Hero Splendor, Honda Activa"
                      className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs px-3 py-2.5 outline-none font-semibold text-neutral-900 dark:text-white focus:border-black dark:focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
                      Bike Type
                    </label>
                    <select
                      value={bikeType}
                      onChange={(e) => setBikeType(e.target.value)}
                      className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs px-3 py-2.5 outline-none font-semibold text-neutral-900 dark:text-white focus:border-black dark:focus:border-amber-400 cursor-pointer"
                    >
                      <option value="COMMUTER">COMMUTER (Splendor, HF Deluxe)</option>
                      <option value="SCOOTER">SCOOTER (Activa, Jupiter, Access)</option>
                      <option value="SPORTS">SPORTS (Pulsar, Apache, R15)</option>
                      <option value="CRUISER">CRUISER (Royal Enfield, Avenger)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setHasExtraHelmet(!hasExtraHelmet)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      hasExtraHelmet
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{hasExtraHelmet ? '✓' : '+'}</span>
                    <span>Spare Passenger Helmet Available</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsParcelDeliveryEnabled(!isParcelDeliveryEnabled)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isParcelDeliveryEnabled
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{isParcelDeliveryEnabled ? '✓' : '+'}</span>
                    <span>Accept Package Deliveries</span>
                  </button>
                </div>
              </div>
            )}

            {vehicleType === 'AUTO' && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 animate-in fade-in">
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Auto Rickshaw Details
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
                      Auto Model *
                    </label>
                    <input
                      type="text"
                      required
                      value={autoModel}
                      onChange={(e) => setAutoModel(e.target.value)}
                      placeholder="e.g. Bajaj RE, Piaggio Ape"
                      className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs px-3 py-2.5 outline-none font-semibold text-neutral-900 dark:text-white focus:border-black dark:focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 block">
                      Permit Type
                    </label>
                    <select
                      value={permitType}
                      onChange={(e) => setPermitType(e.target.value)}
                      className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs px-3 py-2.5 outline-none font-semibold text-neutral-900 dark:text-white focus:border-black dark:focus:border-amber-400 cursor-pointer"
                    >
                      <option value="CITY_PERMIT">CITY METRO PERMIT</option>
                      <option value="DISTRICT_PERMIT">DISTRICT SUB-URBAN PERMIT</option>
                      <option value="ALL_INDIA_PERMIT">STATE PERMIT</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSharedAuto(!isSharedAuto)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSharedAuto
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{isSharedAuto ? '✓' : '+'}</span>
                    <span>Shared Auto Permitted</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-black hover:bg-neutral-800 dark:bg-amber-400 dark:hover:bg-amber-500 active:scale-[0.99] text-white dark:text-black font-extrabold rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-all shadow-xl disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                  <span>Registering Driver & Vehicle...</span>
                </>
              ) : (
                <>
                  <span>Complete Driver Onboarding & Go Online</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>

          <div className="text-center text-xs text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800">
            <span>Already a registered Driver Partner? </span>
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                if (onSwitchToLogin) onSwitchToLogin(email);
              }}
              className="text-black dark:text-amber-400 font-extrabold hover:text-[#d4af37] underline underline-offset-2 cursor-pointer ml-1 transition-colors"
            >
              Sign In here →
            </button>
          </div>
        </form>

        <div className="mt-4 pt-2 text-center text-[11px] text-neutral-400 dark:text-neutral-500 font-medium border-t border-neutral-100 dark:border-neutral-800">
          © 2026 SafarX | By Himanshu Kumar
        </div>
      </div>
    </div>
  );
}
