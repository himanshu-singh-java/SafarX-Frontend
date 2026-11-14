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
    if (isOpen) {
      setErrorMessage('');
      setIsEmailRegistered(false);
      setSuccessMessage('');

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

    if (!coords || !coords.lat || !coords.lng) {
      setErrorMessage('Please enable device GPS access to register as an active driver partner.');
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
      if (
        status === 409 ||
        (data.message && data.message.toLowerCase().includes('already exists'))
      ) {
        setIsEmailRegistered(true);
        setErrorMessage(
          'This email is already registered in our system! If you already have an account, please sign in.'
        );
      } else {
        setErrorMessage(
          data.message || data.error || 'Unable to connect to service. Please check your connection and try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in select-none">
      
      
      <div className="fixed inset-0" onClick={onClose} />

      
      <div className="relative z-10 bg-white border border-neutral-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-neutral-900 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        
        
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-black flex items-center justify-center font-bold text-base transition-all cursor-pointer"
          title="Close dialog"
        >
          ✕
        </button>

        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            
            <div className="w-12 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center p-1 shadow-sm overflow-hidden shrink-0">
              <img
                src="/vehicle_car.jpg"
                alt="SafarX 3D Car"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-black tracking-tight">
                  Safar<span className="text-[#d4af37]">X</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-[#996515] bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Partner Fleet
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-neutral-900">
                Drive with SafarX
              </h2>
            </div>
          </div>

          <p className="text-xs text-neutral-500 font-medium">
            Register your driver account and vehicle in one quick step. Start accepting passenger trips immediately.
          </p>

          
          <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200 px-3.5 py-2 rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-neutral-700 font-mono text-[11px] font-semibold">{gpsStatus}</span>
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
            <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 border-b border-neutral-100 pb-1.5 flex items-center gap-2">
              <span>1. Partner Account Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
                  Mobile Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
                  placeholder="driver@example.com"
                  className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-neutral-500 hover:text-black font-semibold"
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
                  className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black text-xs font-semibold px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
                />
              </div>
            </div>
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
                  <div className="w-full h-14 sm:h-16 rounded-xl bg-white border border-neutral-100 p-1 flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                    <img
                      src="/vehicle_car.jpg"
                      alt="3D Car"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-neutral-900 text-xs sm:text-sm">Car / Cab</span>
                      {vehicleType === 'CAR' && (
                        <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-medium">Sedan, SUV, Mini</div>
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
                  <div className="w-full h-14 sm:h-16 rounded-xl bg-white border border-neutral-100 p-1 flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                    <img
                      src="/vehicle_moto.jpg"
                      alt="3D Moto"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-neutral-900 text-xs sm:text-sm">SafarX Moto</span>
                      {vehicleType === 'BIKE' && (
                        <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-medium">Bike & Scooter</div>
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
                  <div className="w-full h-14 sm:h-16 rounded-xl bg-white border border-neutral-100 p-1 flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                    <img
                      src="/vehicle_auto.jpg"
                      alt="3D Auto"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-neutral-900 text-xs sm:text-sm">Auto</span>
                      {vehicleType === 'AUTO' && (
                        <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[9px] font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-medium">City 3-Wheeler</div>
                  </div>
                </button>

              </div>
            </div>

            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider font-bold text-neutral-600 block">
                  Vehicle License Plate Number *
                </label>
                <span className="text-[10px] text-neutral-400 font-mono font-semibold">RTO Registered</span>
              </div>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="e.g. TS-09-UB-8888 or DL-8C-CC-3001"
                className="w-full bg-[#f6f6f6] hover:bg-[#efefef] focus:bg-white border-2 border-transparent focus:border-black rounded-xl text-black font-mono text-xs font-black uppercase tracking-wider px-4 py-3 outline-none transition-all placeholder:text-neutral-400 shadow-sm"
              />
            </div>

            
            {vehicleType === 'CAR' && (
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-4 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                      Car Model
                    </label>
                    <input
                      type="text"
                      value={carModel}
                      onChange={(e) => setCarModel(e.target.value)}
                      placeholder="Maruti Suzuki Dzire"
                      className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-black text-xs font-semibold outline-none shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                      Category
                    </label>
                    <select
                      value={carCategory}
                      onChange={(e) => setCarCategory(e.target.value)}
                      className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-black text-xs font-bold outline-none cursor-pointer shadow-sm"
                    >
                      <option value="SEDAN">SEDAN</option>
                      <option value="SUV">SUV</option>
                      <option value="MINI">MINI</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                      Capacity
                    </label>
                    <select
                      value={carCapacity}
                      onChange={(e) => setCarCapacity(Number(e.target.value))}
                      className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-black text-xs font-bold outline-none cursor-pointer shadow-sm"
                    >
                      <option value={4}>4 Passengers</option>
                      <option value={6}>6 Passengers (SUV)</option>
                    </select>
                  </div>
                </div>

                
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsAcAvailable(!isAcAvailable)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isAcAvailable
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{isAcAvailable ? '✓' : '+'}</span>
                    <span>AC Available</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasLuggageCarrier(!hasLuggageCarrier)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      hasLuggageCarrier
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{hasLuggageCarrier ? '✓' : '+'}</span>
                    <span>Luggage Carrier</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasWifiOrScreen(!hasWifiOrScreen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      hasWifiOrScreen
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{hasWifiOrScreen ? '✓' : '+'}</span>
                    <span>WiFi / Screen</span>
                  </button>
                </div>
              </div>
            )}

            
            {vehicleType === 'BIKE' && (
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-4 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                      Bike Model
                    </label>
                    <input
                      type="text"
                      value={bikeModel}
                      onChange={(e) => setBikeModel(e.target.value)}
                      placeholder="Hero Splendor Plus"
                      className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-black text-xs font-semibold outline-none shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                      Bike Type
                    </label>
                    <select
                      value={bikeType}
                      onChange={(e) => setBikeType(e.target.value)}
                      className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-black text-xs font-bold outline-none cursor-pointer shadow-sm"
                    >
                      <option value="COMMUTER">COMMUTER</option>
                      <option value="SCOOTER">SCOOTER</option>
                      <option value="SPORTS">SPORTS</option>
                      <option value="ELECTRIC">ELECTRIC</option>
                    </select>
                  </div>
                </div>

                
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
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
                    <span>Extra Passenger Helmet</span>
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
                    <span>Parcel Delivery</span>
                  </button>
                </div>
              </div>
            )}

            
            {vehicleType === 'AUTO' && (
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-4 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                      Auto Model
                    </label>
                    <input
                      type="text"
                      value={autoModel}
                      onChange={(e) => setAutoModel(e.target.value)}
                      placeholder="Bajaj RE Compact"
                      className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-black text-xs font-semibold outline-none shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                      Permit Type
                    </label>
                    <select
                      value={permitType}
                      onChange={(e) => setPermitType(e.target.value)}
                      className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-black text-xs font-bold outline-none cursor-pointer shadow-sm"
                    >
                      <option value="CITY_PERMIT">CITY_PERMIT</option>
                      <option value="STATE_PERMIT">STATE_PERMIT</option>
                      <option value="ALL_NCR">ALL_NCR</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 block">
                      Capacity
                    </label>
                    <select
                      value={autoCapacity}
                      onChange={(e) => setAutoCapacity(Number(e.target.value))}
                      className="w-full bg-white border border-neutral-200 focus:border-black rounded-xl px-3 py-2 text-black text-xs font-bold outline-none cursor-pointer shadow-sm"
                    >
                      <option value={3}>3 Passengers</option>
                      <option value={4}>4 Passengers</option>
                    </select>
                  </div>
                </div>

                
                <div className="flex items-center gap-2 pt-1 text-xs">
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
              className="w-full py-4 bg-black hover:bg-neutral-800 active:scale-[0.99] text-white font-extrabold rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-all shadow-xl disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

          
          <div className="text-center text-xs text-neutral-500 pt-1 border-t border-neutral-100">
            <span>Already a registered Driver Partner? </span>
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                if (onSwitchToLogin) onSwitchToLogin(email);
              }}
              className="text-black font-extrabold hover:text-[#d4af37] underline underline-offset-2 cursor-pointer ml-1 transition-colors"
            >
              Sign In here →
            </button>
          </div>

        </form>

        <div className="mt-4 pt-2 text-center text-[11px] text-neutral-400 font-medium border-t border-neutral-100">
          © 2026 SafarX | By Himanshu Kumar
        </div>
      </div>
    </div>
  );
}
