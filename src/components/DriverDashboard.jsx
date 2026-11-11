import React, { useState, useEffect, useRef } from 'react';
import wsService from '../utils/websocket';
import { getAuthHeaders, getAuthToken, getStorageItem, setStorageItem, resolveUserName } from '../utils/auth';
import { registerDriverProfile } from '../utils/driverDirectory';
import apiClient from '../utils/apiClient';
import { IS_DEMO_MODE } from '../config';

/**
 * DriverDashboard Component
 * Dedicated console for authenticated Driver Partners (ROLE_DRIVER).
 * 
 * Features:
 * - Displays the authenticated driver's personal profile (Name, Rating, Vehicle, Location).
 * - Real-time WebSocket connection to /topic/driver/{driverId}.
 * - Live incoming ride request modal with sound/visual alert.
 * - Accept ride & complete trip flow.
 * - Real-time GPS tracking sent to rider over STOMP (watchPosition in prod, demo hub in IS_DEMO_MODE).
 */
// Database known driver profiles for seamless testing and role linking
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
  'kmrvishalsingh122@gmail.com': {
    id: 1,
    name: 'Vishal Singh',
    rating: 5.0,
    vehicleType: 'CAR',
    model: 'Maruti Suzuki Dzire',
    plateNumber: 'FNWEJ302-23I-223',
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

  // 1. Check verified KNOWN_DRIVERS first (matches MySQL truth directly)
  if (normalizedEmail && KNOWN_DRIVERS[normalizedEmail]) {
    const base = { ...KNOWN_DRIVERS[normalizedEmail] };
    if (savedId) base.id = Number(savedId);
    base.name = resolveUserName(base.name, normalizedEmail);

    // Check if driver has an explicit custom vehicle edit saved in local registry
    try {
      const raw = localStorage.getItem('safarx_drivers_registry');
      if (raw) {
        const reg = JSON.parse(raw);
        const match = reg[normalizedEmail] || (savedId && reg[String(savedId)]);
        if (match && match.isCustomEdit) {
          base.vehicleType = match.vehicleType || base.vehicleType;
          base.model = match.model || base.model;
          base.plateNumber = match.plateNumber || base.plateNumber;
        }
      }
    } catch (e) {}

    // Synchronize storage items so old cached values never corrupt the state
    try {
      setStorageItem('driverVehicleType', base.vehicleType);
      setStorageItem('driverVehicleModel', base.model);
      setStorageItem('driverPlateNumber', base.plateNumber);
    } catch (e) {}

    return base;
  }

  // 2. Check tab session storage
  const storedVehicleType = getStorageItem('driverVehicleType');
  const storedVehicleModel = getStorageItem('driverVehicleModel');
  const storedPlate = getStorageItem('driverPlateNumber');
  if (storedVehicleType) {
    return {
      id: savedId ? Number(savedId) : 1,
      name: resolveUserName(getStorageItem('userName'), normalizedEmail),
      rating: 5.0,
      vehicleType: storedVehicleType,
      model: storedVehicleModel || (storedVehicleType === 'BIKE' ? 'Hero Splendor Plus' : storedVehicleType === 'AUTO' ? 'Bajaj RE Compact' : 'Maruti Suzuki Dzire'),
      plateNumber: storedPlate || (storedVehicleType === 'BIKE' ? 'TS-09-GK-2026' : 'TS-09-UB-8888'),
      city: 'Hyderabad',
      lat: 17.4435,
      lng: 78.4532,
    };
  }

  // 3. Check dynamic local drivers registry
  try {
    const raw = localStorage.getItem('safarx_drivers_registry');
    if (raw) {
      const reg = JSON.parse(raw);
      const match =
        (normalizedEmail && reg[normalizedEmail]) ||
        (savedId && reg[String(savedId)]) ||
        Object.values(reg).find((d) => 
          (d.email && d.email.toLowerCase() === normalizedEmail) ||
          (d.driverId && String(d.driverId) === String(savedId))
        );

      if (match && match.vehicleType) {
        const isNearHub = match.lat && Math.abs(match.lat - 17.4435) < 0.05;
        return {
          id: match.driverId ? Number(match.driverId) : (savedId ? Number(savedId) : 1),
          name: resolveUserName(match.name, normalizedEmail),
          rating: match.rating || 5.0,
          vehicleType: match.vehicleType,
          model: match.model || (match.vehicleType === 'BIKE' ? 'Hero Splendor Plus' : match.vehicleType === 'AUTO' ? 'Bajaj RE Compact' : 'Maruti Suzuki Dzire'),
          plateNumber: match.plateNumber || (match.vehicleType === 'BIKE' ? 'TS-09-GK-2026' : 'TS-09-UB-8888'),
          city: match.city || 'Hyderabad',
          lat: isNearHub ? match.lat : 17.4435,
          lng: isNearHub ? match.lng : 78.4532,
        };
      }
    }
  } catch (e) {}

  // 4. Default fallback matching email or ID
  const fallbackId = savedId
    ? Number(savedId)
    : normalizedEmail.includes('vishal')
    ? 1
    : normalizedEmail.includes('sheru')
    ? 5
    : normalizedEmail.includes('sandu')
    ? 6
    : normalizedEmail.includes('kuku')
    ? 7
    : normalizedEmail.includes('bakri')
    ? 8
    : normalizedEmail.includes('harsh')
    ? 9
    : normalizedEmail.includes('himanshu')
    ? 16
    : 1;

  const fallbackVehicle =
    storedVehicleType ||
    (fallbackId === 6 || fallbackId === 7 ? 'AUTO' : 'CAR');

  return {
    id: fallbackId,
    name: resolveUserName(null, normalizedEmail),
    rating: 5.0,
    vehicleType: fallbackVehicle,
    model: fallbackId === 1 ? 'Maruti Suzuki Dzire' : fallbackId === 5 ? 'BMW' : fallbackId === 9 ? 'Ertiga' : fallbackId === 8 ? 'Maruti Suzuki Dzire' : fallbackId === 16 ? 'SafarX Prime Cab' : fallbackVehicle === 'AUTO' ? 'Bajaj RE Compact' : 'Maruti Suzuki Dzire',
    plateNumber: fallbackId === 1 ? 'FNWEJ302-23I-223' : fallbackId === 5 ? 'BMW-TS-2026' : fallbackId === 9 ? 'HR-09-2023' : fallbackId === 8 ? 'BK-34-2039' : fallbackId === 6 ? 'BR-03-2345' : fallbackId === 7 ? 'KK-94-2834' : 'TS-09-UB-8888',
    city: 'Hyderabad',
    lat: 17.4435,
    lng: 78.4532,
  };
}

export default function DriverDashboard({ token, userEmail: rawUserEmail }) {
  const userEmail = (rawUserEmail || '').trim().toLowerCase();
  // Driver Personal Profile State initialized dynamically
  const [driverProfile, setDriverProfile] = useState(() => getInitialDriverProfile(userEmail));
  const [currentCoords, setCurrentCoords] = useState(() => {
    const prof = getInitialDriverProfile(userEmail);
    // Ensure coordinates default to active Hyderabad hub (17.4435, 78.4532) rather than out-of-range areas
    const lat = prof.lat && Math.abs(prof.lat - 17.4435) < 0.05 ? prof.lat : 17.4435;
    const lng = prof.lng && Math.abs(prof.lng - 78.4532) < 0.05 ? prof.lng : 78.4532;
    return { lat, lng };
  });

  const [isOnline, setIsOnline] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [completedTripReceipt, setCompletedTripReceipt] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });
  const [isAccepting, setIsAccepting] = useState(false);
  const gpsIntervalRef = useRef(null);
  const cancelTimerRef = useRef(null);

  // Auto-dismiss cancellation alert after 5 seconds
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

  // Cleanup any stale ride state & ride subscriptions on driver mount/login
  useEffect(() => {
    try {
      localStorage.removeItem('activeRide');
      localStorage.removeItem('rideId');
      localStorage.removeItem('driverActiveTrip');
      sessionStorage.removeItem('activeRide');
      sessionStorage.removeItem('rideId');
      sessionStorage.removeItem('driverActiveTrip');
    } catch (e) {}

    // Ensure no unauthorized /topic/ride/* subscriptions linger in STOMP client
    wsService.clearRideSubscriptions();
  }, []);

  // Human-readable address names for incoming requests
  const [pickupAddressName, setPickupAddressName] = useState('');
  const [dropAddressName, setDropAddressName] = useState('');

  // Reverse geocode incoming request locations for a realistic Uber driver experience
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

  // Geolocation auto-detection: keeps driver location synchronized with device GPS or Hyderabad hub

  // Handler to manually snap GPS location directly to active Hyderabad Hub (Nature Cure / Ameerpet)
  const handleSnapToHub = () => {
    const hubLat = 17.4435;
    const hubLng = 78.4532;
    setCurrentCoords({ lat: hubLat, lng: hubLng });
    wsService.ensureConnected().then(() => {
      wsService.sendLocationUpdate(activeTrip?.rideId || 0, driverProfile.id, hubLat, hubLng);
    }).catch(() => {});
    setStatusMessage({
      text: `📍 GPS snapped to Hyderabad Hub (${hubLat}, ${hubLng})`,
      isError: false,
    });
  };

  // Edit Vehicle Modal State
  const [showEditVehicleModal, setShowEditVehicleModal] = useState(false);
  const [editVehicleType, setEditVehicleType] = useState('CAR');
  const [editVehicleModel, setEditVehicleModel] = useState('');
  const [editPlateNumber, setEditPlateNumber] = useState('');

  // Sync profile when userEmail changes
  useEffect(() => {
    const resolved = getInitialDriverProfile(userEmail);
    setDriverProfile(resolved);
    setCurrentCoords({ lat: resolved.lat, lng: resolved.lng });
  }, [userEmail]);

  // Verified Driver ID state (Ensures WebSocket NEVER subscribes to unverified guessed IDs)
  const [isDriverVerified, setIsDriverVerified] = useState(() => {
    const saved = getStorageItem('driverId');
    return Boolean(saved);
  });

  // Dynamic Backend Profile Sync (fetches real Driver ID, Role & Status from DB)
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
          if (data.status) {
            setIsOnline(data.status === 'AVAILABLE');
          }
          setDriverProfile((prev) => {
            const nextVehicleType = data.vehicleType || prev.vehicleType || 'CAR';
            const nextModel = data.vehicleModel || prev.model || (nextVehicleType === 'BIKE' ? 'Hero Splendor Plus' : nextVehicleType === 'AUTO' ? 'Bajaj RE Compact' : 'Maruti Suzuki Dzire');
            const nextPlate = data.plateNumber || prev.plateNumber || 'TS-09-UB-8888';
            return {
              ...prev,
              id: realId || prev.id,
              name: resolveUserName(data.name, userEmail),
              vehicleType: nextVehicleType,
              model: nextModel,
              plateNumber: nextPlate,
            };
          });
          if (data.vehicleType) setStorageItem('driverVehicleType', data.vehicleType);
          if (data.vehicleModel) setStorageItem('driverVehicleModel', data.vehicleModel);
          if (data.plateNumber) setStorageItem('driverPlateNumber', data.plateNumber);

          // Initial location update
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

  // Live GPS tracking: uses watchPosition in production, demo hub simulation when IS_DEMO_MODE is true
  useEffect(() => {
    if (!isOnline || !driverProfile.id) return;

    if (!IS_DEMO_MODE && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));
          setCurrentCoords({ lat, lng });
          wsService.ensureConnected().then(() => {
            wsService.sendLocationUpdate(activeTrip?.rideId || 0, driverProfile.id, lat, lng);
          }).catch(() => {});
        },
        (err) => {
          console.warn('[DriverDashboard] Geolocation watch error:', err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isOnline, driverProfile.id, activeTrip?.rideId]);

  // Online / Offline toggle with backend DB synchronization
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

  // Heartbeat & GPS Keep-Alive: keeps WebSocket connection warm & keeps MySQL coordinates fresh
  useEffect(() => {
    if (!isOnline || !isDriverVerified || !driverProfile.id) return;

    // Send immediately upon verification & going online
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

  // Connect to WebSocket and subscribe ONLY to driver's VERIFIED personal topic
  useEffect(() => {
    // CRITICAL: Do NOT subscribe until driver ID is confirmed from backend (/api/auth/me)
    // Subscribing to an unverified/wrong ID causes Spring Boot to throw ForbiddenException and terminate WebSocket!
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

          // Case B: CANCELLED (Pre-acceptance passenger cancel or during broadcast or after acceptance)
          if (
            data.type === 'RIDE_CANCELLED' ||
            rideStatus === 'CANCELLED'
          ) {
            // Unconditionally clear BOTH incomingRequest AND activeTrip
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

          // Case C: ACCEPTED (by another driver) or IN_PROGRESS or COMPLETED
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

          // Case D: TIMEOUT / RIDE_TIMEOUT
          if (data.type === 'TIMEOUT' || data.type === 'RIDE_TIMEOUT') {
            setIncomingRequest((prev) => {
              if (prev && (!targetRideId || Number(prev.rideId) === Number(targetRideId))) {
                return null;
              }
              return prev;
            });
            return;
          }

          // Case A: REQUESTED (New Ride Broadcast)
          if (rideStatus === 'REQUESTED' || (targetRideId && !data.type)) {
            // If activeTrip somehow has status === 'CANCELLED' or 'COMPLETED', ignore and clear it!
            setActiveTrip((current) => {
              const s = (current?.status || current?.rideStatus || '').toUpperCase();
              if (s === 'CANCELLED' || s === 'COMPLETED') {
                return null;
              }
              return current;
            });

            // Clear any lingering cancellation alert timer & text
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

  // Accept Ride API handler
  const handleAcceptRide = async (rideToAccept) => {
    const targetRide = rideToAccept || incomingRequest;
    if (!targetRide) return;

    setIsAccepting(true);
    setStatusMessage({ text: 'Accepting ride...', isError: false });

    try {
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

  // Decline Ride handler
  const handleDeclineRide = () => {
    setIncomingRequest(null);
    setStatusMessage({
      text: 'Ride request declined. Waiting for next request...',
      isError: false,
    });
    apiClient.patch('/api/driver/status?status=AVAILABLE').catch(() => {});
  };

  // Sync ride updates: listens to /topic/ride/{rideId} ONLY for the ASSIGNED driver when activeTrip exists
  useEffect(() => {
    if (!activeTrip?.rideId) return;

    const currentRideId = activeTrip.rideId;
    const rideTopic = `/topic/ride/${currentRideId}`;
    const unsubscribeRide = wsService.subscribe(rideTopic, (data) => {
      console.log('[Driver WS] Live ride topic update:', data);
      if (!data) return;

      const currentStatus = (data?.status || data?.rideStatus || '').toUpperCase();

      // Check cancellation FIRST
      if (currentStatus === 'CANCELLED' || data?.type === 'RIDE_CANCELLED') {
        console.log('[Driver WS] Ride cancelled on ride topic:', currentRideId);
        // Unconditionally clear activeTrip and incomingRequest
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

  // Automatic Live GPS streaming to rider as soon as ride is accepted
  useEffect(() => {
    if (!activeTrip?.rideId) {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      return;
    }

    // Immediately transmit current coordinates over WebSocket
    wsService.sendLocationUpdate(activeTrip.rideId, driverProfile.id, currentCoords.lat, currentCoords.lng);

    // Auto-advance driver coordinates towards drop location every 2.5s
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

  // Start Ride API handler (transitions ACCEPTED -> IN_PROGRESS)
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

  // Complete Ride API handler (from Driver side)
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

  // Handler when driver acknowledges completed trip payment
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

  // Open & Save handlers for vehicle details
  const handleOpenEditVehicle = () => {
    setEditVehicleType(driverProfile.vehicleType || 'CAR');
    setEditVehicleModel(driverProfile.model || '');
    setEditPlateNumber(driverProfile.plateNumber || '');
    setShowEditVehicleModal(true);
  };

  const handleSaveVehicle = (e) => {
    if (e) e.preventDefault();
    const cleanType = editVehicleType.toUpperCase();
    const cleanModel = editVehicleModel.trim() || (cleanType === 'BIKE' ? 'Hero Splendor Plus' : cleanType === 'AUTO' ? 'Bajaj RE Compact' : 'Maruti Suzuki Dzire');
    const cleanPlate = editPlateNumber.trim().toUpperCase() || 'BMW-TS-2026';

    const updated = {
      ...driverProfile,
      vehicleType: cleanType,
      model: cleanModel,
      plateNumber: cleanPlate,
      isCustomEdit: true,
    };
    setDriverProfile(updated);
    setStorageItem('driverVehicleType', cleanType);
    setStorageItem('driverVehicleModel', cleanModel);
    setStorageItem('driverPlateNumber', cleanPlate);

    if (userEmail && KNOWN_DRIVERS[userEmail.toLowerCase().trim()]) {
      KNOWN_DRIVERS[userEmail.toLowerCase().trim()] = {
        ...KNOWN_DRIVERS[userEmail.toLowerCase().trim()],
        vehicleType: cleanType,
        model: cleanModel,
        plateNumber: cleanPlate,
      };
    }

    try {
      const raw = localStorage.getItem('safarx_drivers_registry');
      const reg = raw ? JSON.parse(raw) : {};
      const dId = String(updated.id);
      reg[dId] = updated;
      if (userEmail) reg[userEmail.toLowerCase().trim()] = updated;
      reg[cleanPlate] = updated;
      localStorage.setItem('safarx_drivers_registry', JSON.stringify(reg));
    } catch (err) {}

    registerDriverProfile(updated);

    setShowEditVehicleModal(false);
    setStatusMessage({
      text: `✓ Vehicle updated: ${cleanModel} (${cleanType}) • Plate: ${cleanPlate}`,
      isError: false,
    });
  };

  const avatarInitial = (driverProfile.name || 'D').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#faf8f5] text-neutral-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header Card: White & Golden Luxury */}
        <div className="bg-white/95 backdrop-blur border border-[#d4af37]/35 rounded-3xl p-6 sm:p-7 shadow-xl shadow-amber-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
          
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-neutral-950 tracking-tight">Safar</span>
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
            {/* GPS Hub Position Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-full text-[11px] font-mono font-bold text-neutral-700 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>GPS: {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}</span>
              <button
                type="button"
                onClick={handleSnapToHub}
                className="text-[10px] bg-black hover:bg-neutral-800 text-white font-sans font-extrabold px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                title="Snap coordinates to Ameerpet / Nature Cure Hospital Hub"
              >
                Snap to Hub 📍
              </button>
            </div>

            {/* Online / Offline Status Toggle */}
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



        {/* Status Message Banner */}
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

        {/* Completed Trip Fare Collection Card: White & Golden */}
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

        {/* Driver Personal Profile Card: White & Golden */}
        <div className="bg-white border border-[#d4af37]/35 rounded-3xl p-6 sm:p-7 shadow-xl shadow-amber-500/5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* Left: Driver Identity & Avatar */}
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
                    Matches: {driverProfile.vehicleType === 'CAR' ? 'Uber Go AC & Sedan Premier' : driverProfile.vehicleType === 'BIKE' ? 'Bike' : 'Auto'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Operational Details */}
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

        {/* Edit Vehicle Modal */}
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

        {/* Incoming Ride Alert Modal / Banner: White & Golden */}
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

        {/* Active Trip Mode Card: White & Golden */}
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

            {/* Trip Details Grid */}
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

              {/* Real-time Location Broadcast Status */}
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

            {/* Trip Action Buttons: ONLY Start Trip when ACCEPTED, ONLY Complete Ride when IN_PROGRESS */}
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
