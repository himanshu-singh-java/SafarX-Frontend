import React, { useState, useEffect, useRef } from 'react';
import wsService from '../utils/websocket';
import { getAuthHeaders, getAuthToken, getStorageItem, setStorageItem, resolveUserName } from '../utils/auth';
import { registerDriverProfile } from '../utils/driverDirectory';
import apiClient from '../utils/apiClient';
import { IS_DEMO_MODE } from '../config';

const KNOWN_DRIVERS = {
  'harsh@gmail.com': {
    id: 9,
    name: 'Harsh Kumar',
    rating: 5.0,
    vehicleType: 'CAR',
    model: 'Ertiga',
    plateNumber: 'HR-09-2023',
    city: 'Hyderabad',
    lat: 17.4435,
    lng: 78.4532,
  },
  'sheru@gmail.com': {
    id: 5,
    name: 'Sheru',
    rating: 5.0,
    vehicleType: 'CAR',
    model: 'BMW',
    plateNumber: 'BMW-TS-2026',
    city: 'Hyderabad',
    lat: 17.4435,
    lng: 78.4532,
  },
  'sandu@gmail.com': {
    id: 6,
    name: 'Sandu',
    rating: 5.0,
    vehicleType: 'AUTO',
    model: 'Bajaj RE Compact',
    plateNumber: 'BR-03-2345',
    city: 'Hyderabad',
    lat: 17.4435,
    lng: 78.4532,
  },
  'kukurji@gmail.com': {
    id: 7,
    name: 'Kuku Singh',
    rating: 5.0,
    vehicleType: 'AUTO',
    model: 'Bajaj RE Compact',
    plateNumber: 'KK-94-2834',
    city: 'Hyderabad',
    lat: 17.4435,
    lng: 78.4532,
  },
  'bakri@gmail.com': {
    id: 8,
    name: 'bakri Giri',
    rating: 5.0,
    vehicleType: 'CAR',
    model: 'Maruti Suzuki Dzire',
    plateNumber: 'BK-34-2039',
    city: 'Hyderabad',
    lat: 17.4435,
    lng: 78.4532,
  },
  'singhhimanshu85952@gmail.com': {
    id: 16,
    name: 'Himanshu Singh',
    rating: 5.0,
    vehicleType: 'CAR',
    model: 'SafarX Prime Cab',
    plateNumber: 'TS-09-UB-8888',
    city: 'Hyderabad',
    lat: 17.4435,
    lng: 78.4532,
  },
  'car.driver1@ride.com': {
    id: 11,
    name: 'Rajesh Khanna',
    rating: 4.9,
    vehicleType: 'CAR',
    model: 'Maruti Suzuki Dzire',
    plateNumber: 'DL-8C-CC-3001',
    city: 'Delhi NCR',
    lat: 28.6140,
    lng: 77.2095,
  },
  'bike.driver1@ride.com': {
    id: 6,
    name: 'Vikram Singh',
    rating: 4.9,
    vehicleType: 'BIKE',
    model: 'Hero Splendor Plus',
    plateNumber: 'DL-3S-BB-2001',
    city: 'Delhi NCR',
    lat: 28.6145,
    lng: 77.2085,
  },
  'auto.driver1@ride.com': {
    id: 1,
    name: 'Ramesh Kumar',
    rating: 4.7,
    vehicleType: 'AUTO',
    model: 'Bajaj RE Compact',
    plateNumber: 'DL-1R-AA-1001',
    city: 'Delhi NCR',
    lat: 28.6139,
    lng: 77.2090,
  },
};

function getInitialDriverProfile(userEmail) {
  const savedId = getStorageItem('driverId');
  const normalizedEmail = (userEmail || getStorageItem('userEmail') || '').toLowerCase().trim();

  const storedVehicleType = getStorageItem('driverVehicleType');
  const storedVehicleModel = getStorageItem('driverVehicleModel');
  const storedPlate = getStorageItem('driverPlateNumber');
  if (storedVehicleModel) {
    const vType = (storedVehicleType || 'CAR').toUpperCase();
    const vModel = storedVehicleModel;
    const vPlate = storedPlate || (vType === 'BIKE' ? 'TS-09-GK-2026' : 'TS-09-UB-8888');

    return {
      id: savedId ? Number(savedId) : 1,
      name: resolveUserName(getStorageItem('userName'), normalizedEmail),
      rating: 5.0,
      vehicleType: vType,
      model: vModel,
      plateNumber: vPlate,
      city: '',
      lat: null,
      lng: null,
    };
  }

  if (normalizedEmail && KNOWN_DRIVERS[normalizedEmail]) {
    const base = { ...KNOWN_DRIVERS[normalizedEmail] };
    if (savedId) base.id = Number(savedId);
    base.name = resolveUserName(base.name, normalizedEmail);
    return base;
  }

  const fallbackId = savedId
    ? Number(savedId)
    : 1;

  const fallbackVehicle =
    storedVehicleType ||
    (storedVehicleType === 'AUTO' || storedVehicleType === 'BIKE' ? storedVehicleType : 'CAR');

  return {
    id: fallbackId,
    name: resolveUserName(null, normalizedEmail),
    rating: 5.0,
    vehicleType: fallbackVehicle,
    model: fallbackVehicle === 'BIKE' ? 'Hero Splendor Plus' : fallbackVehicle === 'AUTO' ? 'Bajaj RE Compact' : 'Maruti Suzuki Dzire',
    plateNumber: 'TS-09-UB-8888',
    city: '',
    lat: null,
    lng: null,
  };
}

export default function DriverDashboard({ token, userEmail: rawUserEmail }) {
  const userEmail = (rawUserEmail || '').trim().toLowerCase();
  const [driverProfile, setDriverProfile] = useState(() => getInitialDriverProfile(userEmail));
  const [currentCoords, setCurrentCoords] = useState(() => {
    const prof = getInitialDriverProfile(userEmail);
    return {
      lat: prof.lat || 17.4435,
      lng: prof.lng || 78.4532,
    };
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));
          setCurrentCoords({ lat, lng });
          apiClient.put('/api/driver/location', { latitude: lat, longitude: lng }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    }
  }, []);

  const [isOnline, setIsOnline] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [completedTripReceipt, setCompletedTripReceipt] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });
  const [isAccepting, setIsAccepting] = useState(false);
  const gpsIntervalRef = useRef(null);
  const cancelTimerRef = useRef(null);
  const lastLocationSyncRef = useRef(0);

  const showCancellationAlert = (msg) => {
    setStatusMessage({ text: msg, isError: true });
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = setTimeout(() => {
      setStatusMessage((prev) => (prev.text === msg ? { text: '', isError: false } : prev));
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('activeRide');
      localStorage.removeItem('rideId');
      localStorage.removeItem('driverActiveTrip');
      sessionStorage.removeItem('activeRide');
      sessionStorage.removeItem('rideId');
      sessionStorage.removeItem('driverActiveTrip');
    } catch (e) {}

    wsService.clearRideSubscriptions();
  }, []);

  const [pickupAddressName, setPickupAddressName] = useState('');
  const [dropAddressName, setDropAddressName] = useState('');

  useEffect(() => {
    if (!incomingRequest) {
      setPickupAddressName('');
      setDropAddressName('');
      return;
    }

    if (incomingRequest.pickupLat && incomingRequest.pickupLng) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${incomingRequest.pickupLat}&lon=${incomingRequest.pickupLng}&zoom=18&addressdetails=1`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data && data.display_name) {
            const parts = data.display_name.split(',');
            setPickupAddressName(parts.slice(0, 3).join(',').trim());
          }
        })
        .catch(() => {});
    }

    if (incomingRequest.dropLat && incomingRequest.dropLng) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${incomingRequest.dropLat}&lon=${incomingRequest.dropLng}&zoom=18&addressdetails=1`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data && data.display_name) {
            const parts = data.display_name.split(',');
            setDropAddressName(parts.slice(0, 3).join(',').trim());
          }
        })
        .catch(() => {});
    }
  }, [incomingRequest]);

  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const handleUpdateCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ text: 'Geolocation is not supported by your browser.', isError: true });
      return;
    }
    setIsUpdatingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setCurrentCoords({ lat, lng });

        try {
          await apiClient.put('/api/driver/location', { latitude: lat, longitude: lng });
        } catch (err) {
          console.warn('[DriverDashboard] Failed to persist location to backend DB:', err);
        }

        wsService.ensureConnected().then(() => {
          wsService.sendLocationUpdate(activeTrip?.rideId || 0, driverProfile.id, lat, lng);
        }).catch(() => {});

        setIsUpdatingLocation(false);
        setStatusMessage({
          text: `📍 Location updated to live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          isError: false,
        });
      },
      (err) => {
        console.warn('[DriverDashboard] Failed to fetch current GPS:', err);
        setIsUpdatingLocation(false);
        setStatusMessage({
          text: 'Could not access device GPS. Please check browser location permissions.',
          isError: true,
        });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const [showEditVehicleModal, setShowEditVehicleModal] = useState(false);
  const [editVehicleType, setEditVehicleType] = useState('CAR');
  const [editVehicleModel, setEditVehicleModel] = useState('');
  const [editPlateNumber, setEditPlateNumber] = useState('');

  useEffect(() => {
    const resolved = getInitialDriverProfile(userEmail);
    setDriverProfile(resolved);
    if (resolved.lat && resolved.lng) {
      setCurrentCoords({ lat: resolved.lat, lng: resolved.lng });
    }
  }, [userEmail]);

  const [isDriverVerified, setIsDriverVerified] = useState(() => {
    const saved = getStorageItem('driverId');
    return Boolean(saved);
  });

  useEffect(() => {
    let isMounted = true;
    const fetchBackendProfile = async () => {
      try {
        const res = await apiClient.get('/api/auth/me');
        if (res.data && isMounted) {
          const data = res.data;
          const realId = data.driverId ? Number(data.driverId) : null;
          if (realId) {
            setStorageItem('driverId', String(realId));
            setIsDriverVerified(true);
          }
          if (data.currentLat && data.currentLng) {
            setCurrentCoords({ lat: data.currentLat, lng: data.currentLng });
          }
          if (data.status) {
            setIsOnline(data.status === 'AVAILABLE');
          }
          const realName = resolveUserName(data.name, userEmail);

          setDriverProfile((prev) => {
            const currentStoredType = getStorageItem('driverVehicleType');
            const currentStoredModel = getStorageItem('driverVehicleModel');
            const currentStoredPlate = getStorageItem('driverPlateNumber');

            const effectiveType = (data.vehicleType || prev?.vehicleType || currentStoredType || 'CAR').toUpperCase();
            const effectiveModel = data.vehicleModel || prev?.model || currentStoredModel || (effectiveType === 'BIKE' ? 'Hero Splendor Plus' : effectiveType === 'AUTO' ? 'Bajaj RE Compact' : 'Maruti Suzuki Dzire');
            const effectivePlate = (data.plateNumber || prev?.plateNumber || currentStoredPlate || 'TS-09-UB-8888').toUpperCase();

            const activeProfile = {
              ...prev,
              id: realId || prev?.id || 1,
              driverId: realId || prev?.driverId || prev?.id || 1,
              name: realName || prev?.name,
              vehicleType: effectiveType,
              model: effectiveModel,
              plateNumber: effectivePlate,
              rating: data.rating || prev?.rating || 5.0,
            };

            registerDriverProfile(activeProfile);
            setStorageItem('driverVehicleType', effectiveType);
            setStorageItem('driverVehicleModel', effectiveModel);
            setStorageItem('driverPlateNumber', effectivePlate);

            return activeProfile;
          });

          if (realId) {
            wsService.ensureConnected().then(() => {
              wsService.sendLocationUpdate(0, realId, currentCoords.lat, currentCoords.lng);
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[DriverDashboard] Backend driver profile sync issue:', err);
      }
    };

    if (token) {
      fetchBackendProfile();
    }
    return () => { isMounted = false; };
  }, [token, userEmail]);

  useEffect(() => {
    if (!isOnline || !driverProfile.id) return;

    if (!IS_DEMO_MODE && navigator.geolocation) {
      const sendLocationSync = async (lat, lng) => {
        const now = Date.now();
        if (now - lastLocationSyncRef.current < 15000) {
          return;
        }
        lastLocationSyncRef.current = now;

        try {
          await apiClient.put('/api/driver/location', { latitude: lat, longitude: lng });
        } catch (e) {
          console.warn('[DriverDashboard] Throttled location sync error:', e);
        }

        wsService.ensureConnected().then(() => {
          wsService.sendLocationUpdate(activeTrip?.rideId || 0, driverProfile.id, lat, lng);
        }).catch(() => {});
      };

      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));
          setCurrentCoords({ lat, lng });
          sendLocationSync(lat, lng);
        },
        (err) => {
          console.warn('[DriverDashboard] Geolocation watch error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isOnline, driverProfile.id, activeTrip?.rideId]);

  const handleToggleOnline = async () => {
    const nextOnline = !isOnline;
    setIsOnline(nextOnline);

    try {
      const backendStatus = nextOnline ? 'AVAILABLE' : 'OFFLINE';
      const res = await apiClient.patch(`/api/driver/status?status=${backendStatus}`);
      if (res.status === 200) {
        setStatusMessage({
          text: nextOnline ? '🟢 Online — Available to receive nearby passenger rides.' : '⚪ Offline — Rides paused.',
          isError: false,
        });
      }
    } catch (e) {
      console.warn('Driver status sync error:', e);
      const msg = e.response?.data?.message || 'Could not update status';
      setStatusMessage({ text: msg, isError: true });
    }

    if (nextOnline && driverProfile.id) {
      wsService.ensureConnected().then(() => {
        wsService.sendLocationUpdate(0, driverProfile.id, currentCoords.lat, currentCoords.lng);
      });
    }
  };

  useEffect(() => {
    if (!isOnline || !isDriverVerified || !driverProfile.id) return;

    wsService.ensureConnected().then(() => {
      wsService.sendLocationUpdate(activeTrip?.rideId || 0, driverProfile.id, currentCoords.lat, currentCoords.lng);
    }).catch(() => {});

    const heartbeat = setInterval(() => {
      if (isOnline && driverProfile.id) {
        wsService.ensureConnected().then(() => {
          wsService.sendLocationUpdate(activeTrip?.rideId || 0, driverProfile.id, currentCoords.lat, currentCoords.lng);
        }).catch(() => {});
      }
    }, 5000);

    return () => clearInterval(heartbeat);
  }, [isOnline, isDriverVerified, driverProfile.id, activeTrip?.rideId, currentCoords.lat, currentCoords.lng]);

  useEffect(() => {
    if (!isDriverVerified || !driverProfile.id || !isOnline) {
      return;
    }

    let unsubscribe = null;
    const topic = `/topic/driver/${driverProfile.id}`;

    wsService.connect()
      .then(() => {
        setWsConnected(true);
        console.log('[Driver WS] Connecting to verified driver topic:', topic);
        unsubscribe = wsService.subscribe(topic, (data) => {
          console.log('[Driver WS] Event received on ' + topic, data);
          if (!data) return;

          const rideStatus = data.status || data.rideStatus;
          const targetRideId = data.rideId || (data.ride ? data.ride.rideId : null);

          if (
            data.type === 'RIDE_CANCELLED' ||
            rideStatus === 'CANCELLED'
          ) {
            setIncomingRequest(null);
            setActiveTrip(null);
            wsService.clearRideSubscriptions();
            try {
              localStorage.removeItem('activeRide');
              localStorage.removeItem('rideId');
              localStorage.removeItem('driverActiveTrip');
              sessionStorage.removeItem('activeRide');
              sessionStorage.removeItem('rideId');
              sessionStorage.removeItem('driverActiveTrip');
            } catch (e) {}
            if (gpsIntervalRef.current) {
              clearInterval(gpsIntervalRef.current);
              gpsIntervalRef.current = null;
            }
            showCancellationAlert(`Ride #${targetRideId || ''} was cancelled by the passenger.`);
            apiClient.patch('/api/driver/status?status=AVAILABLE').catch(() => {});
            return;
          }

          if (
            data.type === 'RIDE_TAKEN' ||
            rideStatus === 'ACCEPTED' ||
            rideStatus === 'IN_PROGRESS' ||
            rideStatus === 'COMPLETED'
          ) {
            setIncomingRequest((prev) => {
              if (prev && (!targetRideId || Number(prev.rideId) === Number(targetRideId))) {
                return null;
              }
              return prev;
            });
            setStatusMessage({
              text: `Ride #${targetRideId || ''} was accepted by another driver.`,
              isError: false,
            });
            return;
          }

          if (data.type === 'TIMEOUT' || data.type === 'RIDE_TIMEOUT') {
            setIncomingRequest((prev) => {
              if (prev && (!targetRideId || Number(prev.rideId) === Number(targetRideId))) {
                return null;
              }
              return prev;
            });
            return;
          }

          if (rideStatus === 'REQUESTED' || (targetRideId && !data.type)) {
            setActiveTrip((current) => {
              const s = (current?.status || current?.rideStatus || '').toUpperCase();
              if (s === 'CANCELLED' || s === 'COMPLETED') {
                return null;
              }
              return current;
            });

            if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);

            setIncomingRequest(data);
            setStatusMessage({
              text: `New ride request received for ₹${data.fare ? Number(data.fare).toFixed(2) : '50.00'}!`,
              isError: false,
            });
          }
        });
      })
      .catch((err) => {
        console.warn('Driver WS connect issue:', err);
        setWsConnected(false);
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isDriverVerified, driverProfile.id, isOnline]);

  const handleAcceptRide = async (rideToAccept) => {
    const targetRide = rideToAccept || incomingRequest;
    if (!targetRide) return;

    setIsAccepting(true);
    setStatusMessage({ text: 'Accepting ride...', isError: false });

    try {
      registerDriverProfile(driverProfile);
      const response = await apiClient.put(
        `/api/rides/accept/${targetRide.rideId}?driverId=${driverProfile.id}`
      );
      const data = response.data || {};

      setActiveTrip({ ...targetRide, ...data, status: 'ACCEPTED' });
      setIncomingRequest(null);
      setStatusMessage({
        text: `Ride #${targetRide.rideId} accepted! Heading to pickup location.`,
        isError: false,
      });
    } catch (err) {
      setIncomingRequest(null);
      const data = err.response?.data || {};
      const errMsg =
        data.message ||
        data.error ||
        (typeof data === 'string' ? data : '') ||
        '';
      const lower = errMsg.toLowerCase();

      if (lower.includes('cancel')) {
        showCancellationAlert(`Ride #${targetRide.rideId} was cancelled by the passenger.`);
      } else if (
        lower.includes('accept') ||
        lower.includes('already') ||
        lower.includes('taken') ||
        lower.includes('too late')
      ) {
        setStatusMessage({
          text: `Ride #${targetRide.rideId} was already accepted by another driver.`,
          isError: false,
        });
      } else {
        setStatusMessage({
          text: errMsg || 'This ride is no longer available.',
          isError: true,
        });
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineRide = () => {
    setIncomingRequest(null);
    setStatusMessage({
      text: 'Ride request declined. Waiting for next request...',
      isError: false,
    });
    apiClient.patch('/api/driver/status?status=AVAILABLE').catch(() => {});
  };

  useEffect(() => {
    if (!activeTrip?.rideId) return;

    const currentRideId = activeTrip.rideId;
    const rideTopic = `/topic/ride/${currentRideId}`;
    const unsubscribeRide = wsService.subscribe(rideTopic, (data) => {
      console.log('[Driver WS] Live ride topic update:', data);
      if (!data) return;

      const currentStatus = (data?.status || data?.rideStatus || '').toUpperCase();

      if (currentStatus === 'CANCELLED' || data?.type === 'RIDE_CANCELLED') {
        console.log('[Driver WS] Ride cancelled on ride topic:', currentRideId);
        setActiveTrip(null);
        setIncomingRequest(null);
        wsService.clearRideSubscriptions();
        try {
          localStorage.removeItem('activeRide');
          localStorage.removeItem('rideId');
          localStorage.removeItem('driverActiveTrip');
          sessionStorage.removeItem('activeRide');
          sessionStorage.removeItem('rideId');
          sessionStorage.removeItem('driverActiveTrip');
        } catch (e) {}
        if (gpsIntervalRef.current) {
          clearInterval(gpsIntervalRef.current);
          gpsIntervalRef.current = null;
        }
        showCancellationAlert(`Ride #${data.rideId || currentRideId} was cancelled by the passenger.`);
        apiClient.patch('/api/driver/status?status=AVAILABLE').catch(() => {});
        return;
      }

      if (currentStatus === 'IN_PROGRESS') {
        setActiveTrip((prev) => ({ ...prev, status: 'IN_PROGRESS', rideStatus: 'IN_PROGRESS' }));
        setStatusMessage({
          text: `🚀 Ride #${currentRideId} is now IN_PROGRESS. Heading to passenger destination.`,
          isError: false,
        });
      } else if (currentStatus === 'COMPLETED') {
        setCompletedTripReceipt({
          rideId: currentRideId,
          fare: activeTrip.fare || (data.fare ?? 0),
        });
        setStatusMessage({
          text: `🏁 Ride #${currentRideId} completed! Please collect ₹${(activeTrip.fare || data.fare || 0).toFixed(2)} from passenger.`,
          isError: false,
        });
        setActiveTrip(null);
        wsService.clearRideSubscriptions();
        if (gpsIntervalRef.current) {
          clearInterval(gpsIntervalRef.current);
          gpsIntervalRef.current = null;
        }
      }
    });

    return () => {
      if (unsubscribeRide) unsubscribeRide();
      wsService.clearRideSubscriptions();
    };
  }, [activeTrip?.rideId]);

  useEffect(() => {
    if (!activeTrip?.rideId) {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      return;
    }

    wsService.sendLocationUpdate(activeTrip.rideId, driverProfile.id, currentCoords.lat, currentCoords.lng);

    let step = 0;
    const totalSteps = 15;
    const startLat = currentCoords.lat;
    const startLng = currentCoords.lng;
    const targetLat = activeTrip.dropLat || startLat + 0.015;
    const targetLng = activeTrip.dropLng || startLng + 0.015;

    gpsIntervalRef.current = setInterval(() => {
      step += 1;
      const progress = Math.min(step / totalSteps, 1);
      const nextLat = startLat + (targetLat - startLat) * progress;
      const nextLng = startLng + (targetLng - startLng) * progress;

      wsService.sendLocationUpdate(activeTrip.rideId, driverProfile.id, nextLat, nextLng);
      setCurrentCoords({ lat: nextLat, lng: nextLng });

      if (progress >= 1) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
    }, 2500);

    return () => {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
    };
  }, [activeTrip?.rideId, driverProfile.id]);

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    try {
      await apiClient.put(`/api/rides/start/${activeTrip.rideId}`);

      setActiveTrip((prev) => ({ ...prev, status: 'IN_PROGRESS', rideStatus: 'IN_PROGRESS' }));
      setStatusMessage({
        text: `🚀 Trip #${activeTrip.rideId} is now IN_PROGRESS! Heading to drop location.`,
        isError: false,
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to start trip';
      setStatusMessage({ text: msg, isError: true });
    }
  };

  const handleCompleteRide = async () => {
    if (!activeTrip) return;
    try {
      await apiClient.put(`/api/rides/complete/${activeTrip.rideId}`);

      setCompletedTripReceipt({
        rideId: activeTrip.rideId,
        fare: activeTrip.fare || 0,
      });
      setStatusMessage({
        text: `Trip #${activeTrip.rideId} completed! Please collect ₹${activeTrip.fare ? activeTrip.fare.toFixed(2) : '0.00'} from passenger.`,
        isError: false,
      });
      setActiveTrip(null);
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to complete trip.';
      setStatusMessage({ text: msg, isError: true });
    }
  };

  const handleDismissReceipt = () => {
    setCompletedTripReceipt(null);
    wsService.clearRideSubscriptions();
    apiClient.patch('/api/driver/status?status=AVAILABLE').catch(() => {});
    wsService.ensureConnected().then(() => {
      wsService.sendLocationUpdate(0, driverProfile.id, currentCoords.lat, currentCoords.lng);
    }).catch(() => {});
    setStatusMessage({
      text: '🟢 Ready for next ride request!',
      isError: false,
    });
  };

  const handleOpenEditVehicle = () => {
    setEditVehicleType(driverProfile.vehicleType || 'CAR');
    setEditVehicleModel(driverProfile.model || '');
    setEditPlateNumber(driverProfile.plateNumber || '');
    setShowEditVehicleModal(true);
  };

  const handleSaveVehicle = async (e) => {
    if (e) e.preventDefault();
    const cleanType = editVehicleType.toUpperCase();
    const cleanModel = editVehicleModel.trim();
    const cleanPlate = editPlateNumber.trim().toUpperCase();

    if (!cleanModel) {
      setStatusMessage({ text: 'Please enter a valid vehicle model.', isError: true });
      return;
    }
    if (!cleanPlate) {
      setStatusMessage({ text: 'Please enter a valid license plate number.', isError: true });
      return;
    }

    try {
      const payload = {
        vehicleType: cleanType,
        plateNumber: cleanPlate,
        carModel: cleanType === 'CAR' ? cleanModel : undefined,
        bikeModel: cleanType === 'BIKE' ? cleanModel : undefined,
        autoModel: cleanType === 'AUTO' ? cleanModel : undefined,
      };

      const res = await apiClient.put('/api/driver/vehicle', payload);
      const resData = res.data || {};

      const updated = {
        ...driverProfile,
        vehicleType: resData.vehicleType || cleanType,
        model: resData.model || cleanModel,
        plateNumber: resData.plateNumber || cleanPlate,
        isCustomEdit: true,
      };
      setDriverProfile(updated);
      setStorageItem('driverVehicleType', updated.vehicleType);
      setStorageItem('driverVehicleModel', updated.model);
      setStorageItem('driverPlateNumber', updated.plateNumber);
      registerDriverProfile(updated);

      setShowEditVehicleModal(false);
      setStatusMessage({
        text: `✓ Vehicle updated: ${updated.model} (${updated.vehicleType}) • Plate: ${updated.plateNumber}`,
        isError: false,
      });
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to update vehicle details.';
      setStatusMessage({ text: errMsg, isError: true });
    }
  };

  const avatarInitial = (driverProfile.name || 'D').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-[#0b0f19] text-neutral-900 dark:text-neutral-100 p-4 sm:p-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6">

        
        <div className="bg-white/95 dark:bg-[#121620]/95 backdrop-blur border border-[#d4af37]/35 rounded-3xl p-6 sm:p-7 shadow-xl shadow-amber-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
          
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-neutral-950 dark:text-white tracking-tight">Safar</span>
              <span className="text-2xl font-black text-[#d4af37]">X</span>
              <span className="bg-gradient-to-r from-amber-50 to-amber-100 text-[#8c6200] px-3 py-1 rounded-full text-xs font-black border border-[#d4af37]/40 shadow-sm uppercase tracking-wide">
                Driver Partner Console
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              Manage trips, navigate routes, and accept passenger ride requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-full text-[11px] font-mono font-bold text-neutral-700 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                GPS: {currentCoords?.lat ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}` : 'Locating...'}
              </span>
              <button
                type="button"
                onClick={handleUpdateCurrentLocation}
                disabled={isUpdatingLocation}
                className="text-[10px] bg-amber-400 hover:bg-amber-500 active:scale-95 text-neutral-950 font-sans font-extrabold px-2.5 py-1 rounded-md cursor-pointer transition-all flex items-center gap-1 shadow-sm border border-amber-500/30"
                title="Update and synchronize current live GPS location with backend"
              >
                {isUpdatingLocation ? (
                  <span className="animate-spin text-xs">⏳</span>
                ) : (
                  <span>📍</span>
                )}
                <span>Update Current Location</span>
              </button>
            </div>

            
            <button
              type="button"
              onClick={handleToggleOnline}
              className={`px-5 py-2.5 rounded-full text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-2 border ${
                isOnline
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white border-emerald-400 shadow-emerald-500/20 active:scale-95'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
              <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
              <span className="text-[10px] font-normal opacity-80">
                {isOnline ? '(Accepting Rides)' : '(Paused)'}
              </span>
            </button>
          </div>
        </div>

        
        {statusMessage.text && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in ${
              statusMessage.isError
                ? 'bg-red-50 border border-red-300 text-red-800'
                : 'bg-amber-50 border border-[#d4af37]/60 text-amber-950'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage({ text: '', isError: false })}
              className="text-xs opacity-70 hover:opacity-100 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        
        {completedTripReceipt && (
          <div className="bg-gradient-to-br from-white via-amber-50/40 to-white border-2 border-[#d4af37] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/15 space-y-5 animate-in zoom-in-95 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#d4af37] via-amber-300 to-[#d4af37]" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#d4af37] to-amber-300 text-black flex items-center justify-center font-black text-lg shadow-md">
                  ✓
                </span>
                <div>
                  <h3 className="text-xl font-black text-neutral-950">Ride Completed!</h3>
                  <p className="text-xs text-neutral-500 font-medium">Trip #{completedTripReceipt.rideId} • Destination safely reached</p>
                </div>
              </div>
              <span className="px-3.5 py-1 bg-[#d4af37]/15 text-[#8c6200] border border-[#d4af37]/40 rounded-full text-xs font-black uppercase tracking-wider shadow-sm">
                Trip Finished
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-amber-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <span className="text-xs text-neutral-400 uppercase font-extrabold tracking-wider block">Collect from Passenger</span>
                <span className="text-4xl font-black text-neutral-950 tracking-tight">₹{completedTripReceipt.fare.toFixed(2)}</span>
                <div className="text-xs text-[#b8860b] font-bold mt-1">💳 Cash / UPI on Arrival</div>
              </div>
              <button
                type="button"
                onClick={handleDismissReceipt}
                className="px-7 py-4 bg-gradient-to-r from-[#d4af37] via-amber-400 to-[#d4af37] hover:brightness-105 active:scale-95 text-black font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-xl shadow-amber-500/25 cursor-pointer whitespace-nowrap"
              >
                Payment Received • Ready for Next Ride →
              </button>
            </div>
          </div>
        )}

        
        <div className="bg-white border border-[#d4af37]/35 rounded-3xl p-6 sm:p-7 shadow-xl shadow-amber-500/5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#d4af37] via-amber-300 to-[#d4af37] text-black font-black text-2xl flex items-center justify-center shrink-0 shadow-lg ring-4 ring-[#d4af37]/25">
                {avatarInitial}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black text-neutral-950 tracking-tight">{driverProfile.name}</h2>
                  <span className="bg-amber-100 text-amber-900 border border-amber-300/80 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm">
                    ⭐ {driverProfile.rating.toFixed(1)} Driver
                  </span>
                </div>
                <div className="text-xs text-neutral-500 flex flex-wrap items-center gap-3 font-medium">
                  <span>{userEmail || 'Active Partner Account'}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5 bg-amber-50/80 border border-amber-200/80 px-2.5 py-0.5 rounded-lg text-neutral-800">
                    <span>Driver ID:</span>
                    <strong className="text-black font-mono">#{driverProfile.id}</strong>
                  </span>
                  <span>•</span>
                  <span className="font-mono text-[#b8860b] font-bold">Plate: {driverProfile.plateNumber}</span>
                  <span>•</span>
                  <span className="text-neutral-800 font-bold">{driverProfile.vehicleType}</span>
                  <span>•</span>
                  <span className="px-2.5 py-0.5 bg-amber-100/90 text-amber-950 border border-amber-300/80 rounded-md font-sans text-[11px] font-bold">
                    Matches: {driverProfile.vehicleType === 'CAR' ? 'SafarX AC & Sedan Premier' : driverProfile.vehicleType === 'BIKE' ? 'Bike' : 'Auto'}
                  </span>
                </div>
              </div>
            </div>

            
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl px-5 py-3 text-xs space-y-0.5 shadow-sm">
                <div className="text-[10px] text-amber-800/80 uppercase font-black tracking-wider">Operating City</div>
                <div className="font-black text-neutral-900">{driverProfile.city || 'Hyderabad'}</div>
              </div>

              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl px-5 py-3 text-xs space-y-0.5 shadow-sm">
                <div className="text-[10px] text-amber-800/80 uppercase font-black tracking-wider">Vehicle Model</div>
                <div className="font-black text-[#b8860b]">{driverProfile.model || 'Standard'}</div>
              </div>

              <button
                type="button"
                onClick={handleOpenEditVehicle}
                className="bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 font-extrabold px-4 py-3 rounded-2xl text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>✏️</span>
                <span>Edit Vehicle</span>
              </button>
            </div>

          </div>
        </div>

        
        {showEditVehicleModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white border-2 border-[#d4af37] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛵</span>
                  <h3 className="text-lg font-black text-neutral-950">Update Vehicle Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditVehicleModal(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs font-black cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveVehicle} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">Vehicle Fleet Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'BIKE', label: '🛵 Scooter / Bike' },
                      { id: 'CAR', label: '🚗 Car / Cab' },
                      { id: 'AUTO', label: '🛺 Auto' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setEditVehicleType(v.id)}
                        className={`py-2.5 px-1.5 rounded-xl border text-[11px] font-extrabold transition-all cursor-pointer text-center ${
                          editVehicleType === v.id
                            ? 'bg-amber-100 border-[#d4af37] text-amber-950 shadow-sm'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">Vehicle Model Name</label>
                  <input
                    type="text"
                    required
                    value={editVehicleModel}
                    onChange={(e) => setEditVehicleModel(e.target.value)}
                    placeholder={editVehicleType === 'BIKE' ? 'e.g. Honda Activa 6G (Scooter)' : 'e.g. Maruti Suzuki Dzire'}
                    className="w-full bg-[#f6f6f6] border border-neutral-300 focus:border-black rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none shadow-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">License Plate Number</label>
                  <input
                    type="text"
                    required
                    value={editPlateNumber}
                    onChange={(e) => setEditPlateNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. TS-09-KL-2026"
                    className="w-full bg-[#f6f6f6] border border-neutral-300 focus:border-black rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono outline-none shadow-sm uppercase"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowEditVehicleModal(false)}
                    className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] via-amber-400 to-[#d4af37] text-black font-black rounded-xl text-xs uppercase tracking-wider shadow-md hover:brightness-105 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        
        {incomingRequest && (!activeTrip || !['ACCEPTED', 'IN_PROGRESS'].includes((activeTrip.status || activeTrip.rideStatus || '').toUpperCase())) && (
          <div className="bg-gradient-to-br from-white via-amber-50/30 to-white border-2 border-[#d4af37] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/20 space-y-6 ring-8 ring-[#d4af37]/10 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-[#d4af37] animate-ping" />
                <h3 className="text-lg font-black tracking-tight text-neutral-950">
                  New Ride Request
                </h3>
              </div>
              <span className="bg-amber-100 border border-amber-300 text-amber-900 px-3.5 py-1 rounded-full text-xs font-mono font-bold shadow-sm">
                Ride #{incomingRequest.rideId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm">
                <span className="text-[11px] text-neutral-400 font-extrabold block uppercase">Offered Fare</span>
                <span className="text-2xl font-black text-emerald-600">
                  ₹{incomingRequest.fare && Number(incomingRequest.fare) > 0 ? Number(incomingRequest.fare).toFixed(2) : '50.00'}
                </span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm">
                <span className="text-[11px] text-neutral-400 font-extrabold block uppercase">Pickup Location</span>
                <span className="text-xs text-neutral-800 font-bold truncate block">
                  {pickupAddressName || (incomingRequest.pickupLat ? `${incomingRequest.pickupLat.toFixed(4)}, ${incomingRequest.pickupLng.toFixed(4)}` : 'Pickup Point')}
                </span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm">
                <span className="text-[11px] text-neutral-400 font-extrabold block uppercase">Drop Location</span>
                <span className="text-xs text-neutral-800 font-bold truncate block">
                  {dropAddressName || (incomingRequest.dropLat ? `${incomingRequest.dropLat.toFixed(4)}, ${incomingRequest.dropLng.toFixed(4)}` : 'Drop Location')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleAcceptRide(incomingRequest)}
                disabled={isAccepting}
                className="flex-1 py-4 bg-gradient-to-r from-[#d4af37] via-amber-400 to-[#d4af37] hover:brightness-105 active:scale-95 text-black font-black rounded-2xl text-base transition-all shadow-xl shadow-amber-500/25 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isAccepting ? 'Accepting...' : '✓ ACCEPT RIDE NOW'}
              </button>
              <button
                type="button"
                onClick={handleDeclineRide}
                className="px-6 py-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-2xl text-sm font-bold transition-all cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        
        {activeTrip && ['ACCEPTED', 'IN_PROGRESS'].includes((activeTrip.status || activeTrip.rideStatus || '').toUpperCase()) ? (
          <div className="bg-white border-2 border-[#d4af37] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 space-y-6">
            <div className="flex items-center justify-between border-b border-amber-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <h3 className="text-lg font-black text-neutral-950">
                    {(activeTrip.status || activeTrip.rideStatus || '').toUpperCase() === 'ACCEPTED'
                      ? 'Ride Accepted'
                      : 'Active Trip in Progress'}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Ride #{activeTrip.rideId} •{' '}
                    {(activeTrip.status || activeTrip.rideStatus || '').toUpperCase() === 'ACCEPTED'
                      ? 'En route to pickup'
                      : 'Passenger on board'}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-black text-neutral-950">
                ₹{activeTrip.fare ? Number(activeTrip.fare).toFixed(2) : '50.00'}
              </span>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/70 space-y-2">
                <span className="text-xs font-extrabold text-neutral-500 block uppercase">Destination</span>
                <div className="text-sm font-bold text-neutral-900">
                  {dropAddressName || 'Destination reached upon arrival'}
                </div>
                <div className="text-xs text-emerald-600 font-bold">
                  {(activeTrip.status || activeTrip.rideStatus || '').toUpperCase() === 'ACCEPTED'
                    ? '● En route to passenger pickup point'
                    : '● En route to passenger destination'}
                </div>
              </div>

              
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/70 space-y-2 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-neutral-500 block uppercase">Live Route Status</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Live Route Active
                  </span>
                </div>
                <div className="text-xs text-neutral-700 font-medium">
                  Sharing live route updates with passenger
                </div>
                <p className="text-[10px] text-neutral-500">
                  Passenger can track your vehicle approach on the map in real time.
                </p>
              </div>
            </div>

            
            <div className="pt-2">
              {(activeTrip.status || activeTrip.rideStatus || '').toUpperCase() === 'ACCEPTED' && (
                <button
                  type="button"
                  onClick={handleStartTrip}
                  className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black rounded-2xl text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Start Trip</span>
                  <span>🚀</span>
                </button>
              )}
              {(activeTrip.status || activeTrip.rideStatus || '').toUpperCase() === 'IN_PROGRESS' && (
                <button
                  type="button"
                  onClick={handleCompleteRide}
                  className="w-full py-4 bg-black hover:bg-neutral-800 text-white font-black rounded-2xl text-sm uppercase tracking-wider transition-all shadow-xl active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Complete Ride</span>
                  <span>✓</span>
                </button>
              )}
            </div>
          </div>
        ) : !isOnline ? (
          <div className="bg-white/90 border border-neutral-200 rounded-3xl p-12 text-center space-y-4 shadow-lg">
            <div className="w-20 h-20 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center mx-auto text-3xl text-neutral-400 shadow-inner">
              ⏸️
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-black text-neutral-900">You are currently Offline</h4>
              <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                You will not receive new ride requests while offline. Click "Go Online" when you are ready to accept trips.
              </p>
              <button
                type="button"
                onClick={handleToggleOnline}
                className="mt-3 px-7 py-3 bg-gradient-to-r from-[#d4af37] via-amber-400 to-[#d4af37] hover:brightness-105 text-black font-black rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xl shadow-amber-500/25 active:scale-95"
              >
                Go Online Now
              </button>
            </div>
          </div>
        ) : (
          !incomingRequest && (
            <div className="bg-white/90 backdrop-blur border border-[#d4af37]/35 rounded-3xl p-12 text-center space-y-4 shadow-xl shadow-amber-500/5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-100 via-amber-50 to-white border-2 border-[#d4af37]/50 flex items-center justify-center mx-auto text-3xl text-[#b8860b] shadow-md ring-8 ring-amber-100/50 animate-pulse">
                📡
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-black text-neutral-950 tracking-tight">
                  Radar Active • Waiting for Next Ride Request...
                </h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                  You are currently online as <span className="text-neutral-900 font-bold">{driverProfile.name}</span>. 
                  When a nearby rider books a trip, the request will appear on your screen instantly.
                </p>
              </div>
            </div>
          )
        )}

      </div>
    </div>
  );
}
