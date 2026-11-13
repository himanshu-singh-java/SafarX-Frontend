import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken, getAuthHeaders, handleAuthResponse, getStorageItem, setStorageItem } from '../utils/auth';
import apiClient from '../utils/apiClient';
import wsService from '../utils/websocket';
import LiveRouteMap from './LiveRouteMap';
import FullPageCarMotionScene from './CarMotionScene';
import { getDriverDetails } from '../utils/driverDirectory';
import { initiateRazorpayPayment } from '../utils/razorpay';

// Preset standard cities
const CITIES = [
  { name: 'Hyderabad, IN', lat: 17.3850, lng: 78.4867 },
  { name: 'Jaipur, IN', lat: 26.9124, lng: 75.7873 },
  { name: 'Bengaluru, IN', lat: 12.9716, lng: 77.5946 },
  { name: 'Mumbai, IN', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi NCR, IN', lat: 28.6139, lng: 77.2090 },
];

/**
 * EXACT 1:1 Implementation of Backend `LocationUtils.java`:
 * public static Double calculateDistance(Double startLat, Double startLng, Double endLat, Double endLng)
 */
function calculateDistanceKm(startLat, startLng, endLat, endLng) {
  if (!startLat || !startLng || !endLat || !endLng) return 0;
  const EARTH_RADIUS_KM = 6371;
  const toRadians = (deg) => (deg * Math.PI) / 180;

  const latDistance = toRadians(endLat - startLat);
  const lngDistance = toRadians(endLng - startLng);

  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(toRadians(startLat)) *
      Math.cos(toRadians(endLat)) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Preset Hyderabad Recent Locations matching official Uber experience
const DEFAULT_RECENT_LOCATIONS = [
  {
    title: 'Ameerpet Metro Station Near South India Shopping Mall',
    subtitle: 'Yella Reddy Guda, Hyderabad, Telangana',
    lat: 17.4375,
    lng: 78.4482,
  },
  {
    title: 'Street Number 2',
    subtitle: 'Street No. 2, Vani Nagar, Malkajgiri, Secunderabad, Telangana',
    lat: 17.4526,
    lng: 78.5358,
  },
  {
    title: 'Datapoint IT & Hardware Tech Pvt Ltd',
    subtitle: 'Sanjeeva Reddy Nagar, Ameerpet, Hyderabad, Telangana',
    lat: 17.4399,
    lng: 78.4983,
  },
  {
    title: 'Hostel',
    subtitle: 'Near Metro Pillar 1042, Ameerpet, Hyderabad',
    lat: 17.4410,
    lng: 78.4490,
  },
];

/**
 * EXACT 1:1 Rates matching Backend Models & Official Uber Screenshot:
 * - Bike: ₹31.00 base/short trip (Backend: BIKE)
 * - Bike Saver: ₹30.00 (Backend: BIKE)
 * - Auto: ₹53.64 (Backend: AUTO)
 * - SafarX AC: ₹124.90 (Backend: CAR)
 * - Sedan Premier: ₹145.00 (Backend: CAR)
 */
const VEHICLE_TIERS = [
  {
    type: 'BIKE',
    backendType: 'BIKE',
    name: 'Bike',
    capacity: 1,
    tag: '⚡ Faster',
    icon: '🏍️',
    image: '/vehicle_moto.jpg',
    desc: 'Swift & affordable single-rider transit',
    etaMins: 2,
    baseFare: 20,
    ratePerKm: 6,
    calculateFare: (dist) => +(Math.max(31, 20 + dist * 6)).toFixed(2),
  },
  {
    type: 'AUTO',
    backendType: 'AUTO',
    name: 'Auto',
    capacity: 3,
    icon: '🛺',
    image: '/vehicle_auto.jpg',
    desc: 'No bargaining, doorstep pick-up',
    etaMins: 3,
    baseFare: 50,
    ratePerKm: 15,
    calculateFare: (dist) => +(Math.max(53.64, 50 + dist * 15)).toFixed(2),
  },
  {
    type: 'CAR',
    backendType: 'CAR',
    name: 'SafarX AC',
    capacity: 4,
    badge: '❄️',
    icon: '🚗',
    image: '/vehicle_car.jpg',
    desc: 'Affordable, compact AC rides',
    etaMins: 1,
    baseFare: 50,
    ratePerKm: 12,
    calculateFare: (dist) => +(Math.max(124.90, 50 + dist * 12)).toFixed(2),
  },
  {
    type: 'SEDAN',
    backendType: 'CAR',
    name: 'Sedan Premier',
    capacity: 4,
    icon: '🚙',
    image: '/vehicle_car.jpg',
    desc: 'Comfortable sedans with top drivers',
    etaMins: 4,
    baseFare: 65,
    ratePerKm: 14,
    calculateFare: (dist) => +(Math.max(145.00, 65 + dist * 14)).toFixed(2),
  },
];

export default function RiderDashboard({ token, userEmail, userName: propUserName, onOpenAuth, openHistoryTrigger, resetHomeTrigger }) {
  const [currentRiderName, setCurrentRiderName] = useState(() => propUserName || getStorageItem('userName') || resolveUserName(null, userEmail));

  useEffect(() => {
    if (propUserName) {
      setCurrentRiderName(propUserName);
    }
  }, [propUserName]);

  useEffect(() => {
    const handleProfileUpdate = (e) => {
      if (e.detail?.name) {
        setCurrentRiderName(e.detail.name);
      }
    };
    window.addEventListener('safarx:profile-updated', handleProfileUpdate);
    window.addEventListener('auth:user_updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('safarx:profile-updated', handleProfileUpdate);
      window.removeEventListener('auth:user_updated', handleProfileUpdate);
    };
  }, []);
  // Screen mode: 'home' (City Hub Homepage) | 'product-selection' (Uber Product Selection)
  const [currentScreen, setCurrentScreen] = useState('home');
  // Home view mode: 'motion' (Cinematic Vector Car Scene) | 'map' (Standard 2-Column Live Route Map)
  const [homeViewMode, setHomeViewMode] = useState('motion');
  const [selectedProductTab, setSelectedProductTab] = useState('ride'); // 'ride' | 'parcel' | 'rentals'
  const bookingSectionRef = useRef(null);
  const pickupContainerRef = useRef(null);
  const isLoggedIn = Boolean(token || getAuthToken());

  // Recent Locations State (Saved to localStorage)
  const [recentLocations, setRecentLocations] = useState(() => {
    try {
      const saved = localStorage.getItem('safarx_recent_locations');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_RECENT_LOCATIONS;
  });

  const addToRecentLocations = (title, subtitle, lat, lng) => {
    if (!title) return;
    setRecentLocations((prev) => {
      const filtered = prev.filter((p) => p.title.toLowerCase() !== title.toLowerCase());
      const updated = [{ title, subtitle: subtitle || 'Hyderabad, Telangana', lat, lng }, ...filtered].slice(0, 6);
      try {
        localStorage.setItem('safarx_recent_locations', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Helper for dynamic arrival drop time (e.g. 20:58)
  const getEtaDropTime = (minsAhead = 2) => {
    const d = new Date(Date.now() + minsAhead * 60 * 1000);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Rider Identification: strictly loaded from /api/auth/me (no hardcoded default)
  const [riderId, setRiderId] = useState(() => {
    const saved = getStorageItem('riderId');
    return saved ? Number(saved) : null;
  });

  // Sync verified riderId from /api/auth/me
  useEffect(() => {
    let isMounted = true;
    const fetchMe = async () => {
      try {
        const res = await apiClient.get('/api/auth/me');
        if (!isMounted) return;
        if (res.data?.riderId) {
          const id = Number(res.data.riderId);
          setRiderId(id);
          setStorageItem('riderId', String(id));
        } else if (res.data?.role === 'ROLE_RIDER' || !res.data?.role) {
          try {
            await apiClient.post('/api/auth/complete-profile', {
              role: 'ROLE_RIDER',
              name: res.data?.name || (userEmail ? userEmail.split('@')[0] : 'SafarX Rider'),
              phone: '',
            });
            const retryRes = await apiClient.get('/api/auth/me');
            if (retryRes.data?.riderId && isMounted) {
              const id = Number(retryRes.data.riderId);
              setRiderId(id);
              setStorageItem('riderId', String(id));
            }
          } catch (initErr) {
            console.warn('[RiderDashboard] Auto-init rider failed:', initErr);
          }
        }
      } catch (err) {
        console.warn('[RiderDashboard] Could not fetch rider profile from /api/auth/me', err);
      }
    };
    if (token || getAuthToken()) {
      fetchMe();
    }
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Trigger My Trips drawer from navbar
  useEffect(() => {
    if (openHistoryTrigger > 0) {
      setShowHistory(true);
      fetchHistory();
    }
  }, [openHistoryTrigger]);

  // Return to home screen & cinematic animation whenever SafarX logo is clicked
  useEffect(() => {
    if (resetHomeTrigger > 0) {
      setCurrentScreen('home');
      setHomeViewMode('motion');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [resetHomeTrigger]);

  const handleSeePrices = () => {
    if (!pickupText) {
      setStatusMessage({ text: 'Please enter a pickup location', isError: true });
      return;
    }
    if (!dropText) {
      setStatusMessage({ text: 'Please enter a destination', isError: true });
      return;
    }
    // Push history state so browser Back button cleanly returns to home view without logging out
    try {
      window.history.pushState({ screen: 'product-selection' }, '');
    } catch (e) {}
    setCurrentScreen('product-selection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    if (window.history.state?.screen === 'product-selection') {
      window.history.back();
    } else {
      setCurrentScreen('home');
    }
  };

  // Intercept browser Back button (popstate) to return to home view smoothly without route change / logout
  useEffect(() => {
    const handlePopState = () => {
      if (currentScreen === 'product-selection') {
        setCurrentScreen('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentScreen]);

  // Selected City
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [showCityPicker, setShowCityPicker] = useState(false);

  // Locations state (Defaults matching official Hyderabad screenshot)
  const [pickupText, setPickupText] = useState('Hostel');
  const [pickupCoords, setPickupCoords] = useState({ lat: 17.4410, lng: 78.4490 });

  const [dropText, setDropText] = useState('Datapoint IT & Hardware Tech Pvt Ltd');
  const [dropCoords, setDropCoords] = useState({ lat: 17.4399, lng: 78.4983 });

  // Autocomplete Geocoding Suggestions
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDrop, setIsSearchingDrop] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null); // 'pickup' | 'drop' | null
  const [showCoordsModal, setShowCoordsModal] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationFetched, setLocationFetched] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('CAR'); // Default to SafarX AC (CAR) to match driver fleet
  const [pickupTime, setPickupTime] = useState('Pickup now');
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [passengerMode, setPassengerMode] = useState('For me');
  const [showPassengerDropdown, setShowPassengerDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('UPI Scan and Pay');
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickupContainerRef.current && !pickupContainerRef.current.contains(e.target)) {
        if (focusedInput === 'pickup') {
          setFocusedInput(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [focusedInput]);

  // Booking Execution State
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });
  const [activeRide, setActiveRide] = useState(null);
  const [liveDriverGps, setLiveDriverGps] = useState(null);
  const [isPayingRazorpay, setIsPayingRazorpay] = useState(false);
  const [razorpaySuccessData, setRazorpaySuccessData] = useState(null);

  // Subscribe to real-time ride updates over STOMP WebSocket
  useEffect(() => {
    if (!activeRide?.rideId) return;

    const topic = `/topic/ride/${activeRide.rideId}`;
    const unsubscribe = wsService.subscribe(topic, (data) => {
      console.log('[Rider WS] Live update on ' + topic, data);
      if (data && data.status) {
        setActiveRide((prev) => {
          const base = prev ? { ...prev, ...data } : data;
          return {
            ...base,
            status: data.status,
            fare: data.fare || prev?.fare,
            driver: data.driver || prev?.driver,
            driverName: data.driverName || data.driver?.name || prev?.driverName,
            driverPhone: data.driverPhone || data.driver?.phone || prev?.driverPhone,
            driverRating: data.driverRating || data.driver?.rating || prev?.driverRating,
            plateNumber: data.plateNumber || data.vehicleNumber || data.driver?.plateNumber || prev?.plateNumber,
            vehicleModel: data.vehicleModel || data.driver?.model || prev?.vehicleModel,
            vehicleType: data.vehicleType || data.driver?.vehicleType || prev?.vehicleType,
            driverId: data.driverId || data.driver?.id || prev?.driverId,
          };
        });
        if (data.status === 'ACCEPTED') {
          setStatusMessage({
            text: `🎉 Driver accepted your ride #${data.rideId}! Driver is on the way.`,
            isError: false,
          });
          setLiveDriverGps((prev) => prev || {
            lat: data.pickupLat ? data.pickupLat + 0.004 : pickupCoords.lat + 0.004,
            lng: data.pickupLng ? data.pickupLng + 0.004 : pickupCoords.lng + 0.004,
          });
        } else if (data.status === 'IN_PROGRESS') {
          setStatusMessage({
            text: `🚀 Driver started the trip for Ride #${data.rideId}! En route to destination.`,
            isError: false,
          });
        } else if (data.status === 'COMPLETED') {
          setStatusMessage({
            text: `🏁 Ride #${data.rideId} completed! Please complete settlement below.`,
            isError: false,
          });
          setLiveDriverGps(null);
          fetchHistory(true);
        } else if (data.status === 'CANCELLED') {
          setStatusMessage({
            text: `Ride #${data.rideId} was cancelled.`,
            isError: true,
          });
          setActiveRide(null);
          setLiveDriverGps(null);
          fetchHistory(true);
        }
      } else if (data && data.latitude && data.longitude) {
        setLiveDriverGps({ lat: data.latitude, lng: data.longitude });
        setActiveRide((prev) => {
          if (!prev) return prev;
          const updatedDriver = {
            ...(prev.driver || {}),
            id: data.driverId || prev.driver?.id || prev.driverId,
            driverId: data.driverId || prev.driver?.driverId || prev.driverId,
            name: data.driverName || prev.driver?.name || prev.driverName,
            driverName: data.driverName || prev.driver?.driverName || prev.driverName,
            vehicleNumber: data.vehicleNumber || prev.driver?.vehicleNumber || prev.plateNumber,
            plateNumber: data.vehicleNumber || prev.driver?.plateNumber || prev.plateNumber,
            model: data.vehicleModel || prev.driver?.model || prev.vehicleModel,
            vehicleModel: data.vehicleModel || prev.driver?.vehicleModel || prev.vehicleModel,
            vehicleType: data.vehicleType || prev.driver?.vehicleType || prev.vehicleType,
            rating: data.rating || prev.driver?.rating || prev.driverRating,
          };
          return {
            ...prev,
            driverId: data.driverId || prev.driverId,
            driverName: data.driverName || prev.driverName,
            plateNumber: data.vehicleNumber || prev.plateNumber,
            vehicleModel: data.vehicleModel || prev.vehicleModel,
            vehicleType: data.vehicleType || prev.vehicleType,
            driverRating: data.rating || prev.driverRating,
            driver: updatedDriver,
          };
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeRide?.rideId]);

  // Fail-safe Polling to guarantee Rider screen updates via /api/rides/history/{riderId} (Strictly RBAC-compliant)
  useEffect(() => {
    if (!activeRide?.rideId || activeRide.status === 'COMPLETED') return;

    const pollInterval = setInterval(async () => {
      try {
        const effectiveRiderId = riderId || (getStorageItem('riderId') ? Number(getStorageItem('riderId')) : null);
        if (!effectiveRiderId) return;
        const res = await apiClient.get(`/api/rides/history/${effectiveRiderId}`);
        const myRides = Array.isArray(res.data) ? res.data : [];
        const current = myRides.find((r) => r.rideId === activeRide.rideId);
        if (current) {
          const currentStatus = current.rideStatus || current.status;
          setActiveRide((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ...current,
              status: currentStatus,
              fare: current.fare ?? prev.fare,
              driver: current.driver || prev.driver,
              driverName: current.driverName || current.driver?.name || prev.driverName,
              plateNumber: current.plateNumber || current.vehicleNumber || current.driver?.plateNumber || prev.plateNumber,
              vehicleModel: current.vehicleModel || current.driver?.model || prev.vehicleModel,
              vehicleType: current.vehicleType || current.driver?.vehicleType || prev.vehicleType,
              driverPhone: current.driverPhone || current.driver?.phone || prev.driverPhone,
              driverRating: current.driverRating || current.driver?.rating || prev.driverRating,
              driverId: current.driverId || current.driver?.id || prev.driverId,
            };
          });
          if (currentStatus === 'COMPLETED' && activeRide.status !== 'COMPLETED') {
            setStatusMessage({
              text: `🏁 Ride #${current.rideId} completed! Please complete settlement below.`,
              isError: false,
            });
            setLiveDriverGps(null);
            fetchHistory(true);
          }
        }
      } catch (e) {
        // silent
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeRide?.rideId, activeRide?.status, riderId]);

  // Trip history drawer
  const [showHistory, setShowHistory] = useState(false);
  const [rideHistory, setRideHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Selected ride for detailed receipt modal
  const [selectedRideReceipt, setSelectedRideReceipt] = useState(null);
  const [receiptPickupName, setReceiptPickupName] = useState('');
  const [receiptDropName, setReceiptDropName] = useState('');

  // Reverse geocoding for selected receipt modal
  useEffect(() => {
    if (!selectedRideReceipt) {
      setReceiptPickupName('');
      setReceiptDropName('');
      return;
    }

    let isMounted = true;
    const { pickupLat, pickupLng, dropLat, dropLng } = selectedRideReceipt;

    if (pickupLat && pickupLng) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pickupLat}&lon=${pickupLng}&zoom=16`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data?.display_name) {
            setReceiptPickupName(data.display_name.split(',').slice(0, 3).join(', '));
          }
        })
        .catch(() => {});
    }

    if (dropLat && dropLng) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${dropLat}&lon=${dropLng}&zoom=16`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data?.display_name) {
            setReceiptDropName(data.display_name.split(',').slice(0, 3).join(', '));
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [selectedRideReceipt]);

  const formatDateTime = (val) => {
    if (!val) return 'Recently';
    if (Array.isArray(val)) {
      const [year, month, day, hour = 0, minute = 0] = val;
      const d = new Date(year, month - 1, day, hour, minute);
      return d.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getVehicleImage = (vehicle) => {
    if (!vehicle) return '/vehicle_car.jpg';
    if (vehicle.carModel) return '/vehicle_car.jpg';
    if (vehicle.autoModel) return '/vehicle_auto.jpg';
    if (vehicle.bikeModel) return '/vehicle_moto.jpg';
    const type = (vehicle.vehicleType || '').toUpperCase();
    if (type.includes('AUTO')) return '/vehicle_auto.jpg';
    if (type.includes('BIKE') || type.includes('MOTO')) return '/vehicle_moto.jpg';
    return '/vehicle_car.jpg';
  };

  const getVehicleModelName = (vehicle) => {
    if (!vehicle) return 'Standard Cab';
    return vehicle.carModel || vehicle.autoModel || vehicle.bikeModel || (vehicle.vehicleType ? `SafarX ${vehicle.vehicleType}` : 'Comfort Sedan');
  };

  // Real-time distance using backend formula (defaults to 5.5 km if identical or nearby test coords)
  const rawDistance = calculateDistanceKm(
    pickupCoords.lat,
    pickupCoords.lng,
    dropCoords.lat,
    dropCoords.lng
  );
  const displayDistance = rawDistance >= 0.5 ? rawDistance.toFixed(1) : '5.5';

  // Reverse Geocoding helper using OpenStreetMap Nominatim
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          const parts = data.display_name.split(',');
          return parts.slice(0, 3).join(',').trim();
        }
      }
    } catch (err) {
      console.warn('Reverse geocode warning:', err);
    }
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  // Auto-fetch rider live location on mount, on login, or when user clicks 📍
  const fetchCurrentLocation = (isAuto = false) => {
    if (!navigator.geolocation) {
      if (!isAuto) {
        setStatusMessage({ text: 'Geolocation is not supported by your browser.', isError: true });
      }
      return;
    }

    setIsFetchingLocation(true);

    const onLocationSuccess = async (pos) => {
      const lat = parseFloat(pos.coords.latitude.toFixed(6));
      const lng = parseFloat(pos.coords.longitude.toFixed(6));

      setPickupCoords({ lat, lng });
      const address = await reverseGeocode(lat, lng);
      setPickupText(address);
      setIsFetchingLocation(false);
      setLocationFetched(true);

      if (!isAuto) {
        setStatusMessage({
          text: `📍 Live location detected: ${address}`,
          isError: false,
        });
        setTimeout(() => setStatusMessage({ text: '', isError: false }), 4000);
      }
    };

    const onLocationFail = (err) => {
      console.warn('High-accuracy GPS unavailable, falling back to standard network location:', err.message);
      // Fallback: Wi-Fi / IP based location for laptops and desktop browsers
      navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        (fallbackErr) => {
          console.warn('All geolocation methods failed or permission denied:', fallbackErr.message);
          setIsFetchingLocation(false);
          if (!isAuto) {
            setStatusMessage({
              text: 'Location permission denied. Please allow location access in your browser or enter pickup manually.',
              isError: true,
            });
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      onLocationFail,
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
    );
  };

  // Auto-fetch rider location when component loads and on login (Real-world Uber experience)
  useEffect(() => {
    fetchCurrentLocation(true);
  }, [token]);

  // Debounced search using OpenStreetMap Nominatim Geocoding API
  const pickupSearchTimeout = useRef(null);
  const dropSearchTimeout = useRef(null);

  const fetchGeocodingSuggestions = async (query, type) => {
    if (!query || query.trim().length < 3) {
      if (type === 'pickup') setPickupSuggestions([]);
      else setDropSuggestions([]);
      return;
    }

    if (type === 'pickup') setIsSearchingPickup(true);
    else setIsSearchingDrop(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=in&limit=5&addressdetails=1`
      );
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map((item) => ({
          name: item.display_name,
          shortName: item.display_name.split(',').slice(0, 3).join(','),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
        if (type === 'pickup') setPickupSuggestions(formatted);
        else setDropSuggestions(formatted);
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
    } finally {
      if (type === 'pickup') setIsSearchingPickup(false);
      else setIsSearchingDrop(false);
    }
  };

  const handlePickupChange = (text) => {
    setPickupText(text);
    if (pickupSearchTimeout.current) clearTimeout(pickupSearchTimeout.current);
    pickupSearchTimeout.current = setTimeout(() => {
      fetchGeocodingSuggestions(text, 'pickup');
    }, 400);
  };

  const handleDropChange = (text) => {
    setDropText(text);
    if (dropSearchTimeout.current) clearTimeout(dropSearchTimeout.current);
    dropSearchTimeout.current = setTimeout(() => {
      fetchGeocodingSuggestions(text, 'drop');
    }, 400);
  };

  const handleSelectSuggestion = (place, type) => {
    const title = place.shortName || place.name;
    const subtitle = place.name;
    if (type === 'pickup') {
      setPickupText(title);
      setPickupCoords({ lat: place.lat, lng: place.lng });
      setPickupSuggestions([]);
      addToRecentLocations(title, subtitle, place.lat, place.lng);
    } else {
      setDropText(title);
      setDropCoords({ lat: place.lat, lng: place.lng });
      setDropSuggestions([]);
      addToRecentLocations(title, subtitle, place.lat, place.lng);
    }
    setFocusedInput(null);
  };

  // Switch City
  const handleCityChange = (city) => {
    setSelectedCity(city);
    setPickupText(`City Center, ${city.name.split(',')[0]}`);
    setPickupCoords({ lat: city.lat, lng: city.lng });
    setDropText(`Central Station, ${city.name.split(',')[0]}`);
    setDropCoords({
      lat: parseFloat((city.lat - 0.05).toFixed(4)),
      lng: parseFloat((city.lng + 0.03).toFixed(4)),
    });
    setShowCityPicker(false);
  };

  // Generate dynamic OpenStreetMap embed URL centered on both points
  const minLng = Math.min(pickupCoords.lng, dropCoords.lng) - 0.05;
  const minLat = Math.min(pickupCoords.lat, dropCoords.lat) - 0.05;
  const maxLng = Math.max(pickupCoords.lng, dropCoords.lng) + 0.05;
  const maxLat = Math.max(pickupCoords.lat, dropCoords.lat) + 0.05;
  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${pickupCoords.lat}%2C${pickupCoords.lng}`;

  // ================= API: BOOK RIDE =================
  const handleBookRide = async () => {
    // 1. First ensure user is logged in
    const activeToken = token || getAuthToken();
    if (!activeToken) {
      if (onOpenAuth) {
        onOpenAuth('login', 'Please sign in or create an account to confirm your ride.');
      }
      return;
    }

    // 2. Prevent booking if there is already an active ride
    if (activeRide && (activeRide.status === 'REQUESTED' || activeRide.status === 'ACCEPTED' || activeRide.status === 'IN_PROGRESS')) {
      setStatusMessage({
        text: `You already have an active trip (#${activeRide.rideId}) in progress! Please complete or cancel it first before booking a new vehicle.`,
        isError: true,
        hasActiveRideConflict: true,
      });
      return;
    }

    // 3. Location validation
    if (pickupCoords.lat === dropCoords.lat && pickupCoords.lng === dropCoords.lng) {
      setStatusMessage({ text: 'Pickup and Drop locations cannot be identical.', isError: true });
      return;
    }

    const selectedTier = VEHICLE_TIERS.find((v) => v.type === selectedVehicle) || VEHICLE_TIERS[0];
    const finalDropLat = parseFloat(dropCoords.lat);
    const finalDropLng = parseFloat(dropCoords.lng);
    const initialDist = calculateDistanceKm(pickupCoords.lat, pickupCoords.lng, finalDropLat, finalDropLng);
    if (initialDist < 0.5) {
      setStatusMessage({
        text: 'Drop location must be at least 0.5 km away from pickup location. Please choose a different drop point.',
        isError: true,
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ text: '', isError: false });

    // 4. Resolve valid riderId from state, storage, or live API
    let activeRiderId = riderId;
    if (!activeRiderId) {
      const stored = getStorageItem('riderId');
      if (stored && !isNaN(Number(stored)) && Number(stored) > 0) {
        activeRiderId = Number(stored);
        setRiderId(activeRiderId);
      }
    }

    if (!activeRiderId) {
      try {
        const meRes = await apiClient.get('/api/auth/me');
        if (meRes.data?.riderId) {
          activeRiderId = Number(meRes.data.riderId);
          setRiderId(activeRiderId);
          setStorageItem('riderId', String(activeRiderId));
        } else if (meRes.data?.role === 'ROLE_RIDER' || !meRes.data?.role) {
          await apiClient.post('/api/auth/complete-profile', {
            role: 'ROLE_RIDER',
            name: meRes.data?.name || (userEmail ? userEmail.split('@')[0] : 'SafarX Rider'),
            phone: '',
          });
          const retryMe = await apiClient.get('/api/auth/me');
          if (retryMe.data?.riderId) {
            activeRiderId = Number(retryMe.data.riderId);
            setRiderId(activeRiderId);
            setStorageItem('riderId', String(activeRiderId));
          }
        }
      } catch (err) {
        console.warn('[RiderDashboard] Failed to resolve riderId:', err);
      }
    }

    if (!activeRiderId) {
      setIsLoading(false);
      setStatusMessage({
        text: 'Unable to verify your Rider account. Please sign out and sign in again.',
        isError: true,
      });
      return;
    }

    const requestPayload = {
      riderId: parseInt(activeRiderId, 10),
      vehicleType: selectedTier.backendType, // 'BIKE' | 'AUTO' | 'CAR'
      pickupLat: parseFloat(pickupCoords.lat),
      pickupLng: parseFloat(pickupCoords.lng),
      dropLat: finalDropLat,
      dropLng: finalDropLng,
    };

    try {
      const response = await apiClient.post('/api/rides/book', requestPayload);
      const data = response.data || {};

      setActiveRide(data);
      setCurrentScreen('product-selection');
      setStatusMessage({
        text:
          data.status === 'REQUESTED'
            ? `Ride #${data.rideId} requested! Searching for nearby drivers...`
            : `Success! SafarX Ride #${data.rideId} confirmed. Driver dispatched.`,
        isError: false,
        hasActiveRideConflict: false,
      });
      fetchHistory(true);
    } catch (err) {
      const data = err.response?.data || {};
      const status = err.response?.status;
      const errMsg =
        data.message ||
        data.error ||
        `No drivers available nearby for ${selectedTier.name} (${selectedTier.backendType}). Please verify your driver is Online and registered as ${selectedTier.backendType} in the database.`;

      const isConflict = status === 409 || errMsg.toLowerCase().includes('already have an active ride');
      setStatusMessage({
        text: isConflict
          ? `${errMsg} (Please complete or cancel your active ride before requesting a new one.)`
          : errMsg,
        isError: true,
        hasActiveRideConflict: isConflict,
      });
      if (isConflict) {
        fetchHistory(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ================= API: CANCEL RIDE (ROLE_RIDER) =================
  const handleCancelRide = async (overrideRideId = null) => {
    // Strictly guard against React SyntheticEvent objects being passed as overrideRideId
    const validId = (typeof overrideRideId === 'number' || (typeof overrideRideId === 'string' && /^\d+$/.test(overrideRideId)))
      ? Number(overrideRideId)
      : activeRide?.rideId;
    if (!validId) return;
    const cancelledId = validId;

    try {
      await apiClient.put(`/api/rides/cancel/${cancelledId}`);

      setStatusMessage({
        text: `Ride #${cancelledId} cancelled successfully. Ready to book your ride!`,
        isError: false,
        hasActiveRideConflict: false,
      });
      setActiveRide(null);
      setLiveDriverGps(null);
      fetchHistory(true);
    } catch (err) {
      console.warn('Ride cancel error:', err);
      const msg = err.response?.data?.message || (typeof err.response?.data === 'string' ? err.response.data : '') || 'Cannot cancel ride after it has started';
      setStatusMessage({ text: msg, isError: true });
    }
  };

  // ================= RAZORPAY ONLINE CHECKOUT =================
  const handlePayOnlineWithRazorpay = async () => {
    if (!activeRide) return;
    setIsPayingRazorpay(true);
    setStatusMessage({ text: 'Opening secure Razorpay payment gateway...', isError: false });

    await initiateRazorpayPayment({
      amount: activeRide.fare || 100,
      rideId: activeRide.rideId,
      userEmail: userEmail || getStorageItem('userEmail') || '',
      userName: getStorageItem('userName') || '',
      userPhone: getStorageItem('userPhone') || '',
      onSuccess: (result) => {
        setIsPayingRazorpay(false);
        setRazorpaySuccessData(result);
        setStatusMessage({
          text: `🎉 Payment of ₹${result.amount} verified successfully via Razorpay (Payment ID: ${result.paymentId})!`,
          isError: false,
        });
        fetchHistory(true);
      },
      onError: (err) => {
        setIsPayingRazorpay(false);
        setStatusMessage({
          text: err.message || 'Payment could not be completed.',
          isError: true,
        });
      },
      onDismiss: () => {
        setIsPayingRazorpay(false);
        setStatusMessage({
          text: 'Payment modal closed. You can retry online payment or choose Cash.',
          isError: false,
        });
      },
    });
  };

  // ================= API: FETCH HISTORY =================
  const fetchHistory = async (silent = false) => {
    if (!silent) setLoadingHistory(true);
    try {
      let targetId = riderId;
      if (!targetId) {
        const meRes = await apiClient.get('/api/auth/me');
        if (meRes.data?.riderId) {
          targetId = Number(meRes.data.riderId);
          setRiderId(targetId);
          setStorageItem('riderId', String(targetId));
        }
      }
      if (!targetId) {
        if (!silent) setLoadingHistory(false);
        return;
      }

      const response = await apiClient.get(`/api/rides/history/${targetId}`);
      let data = Array.isArray(response.data) ? response.data : [];

      // Sort newest trip first
      data.sort((a, b) => (b.rideId || b.id || 0) - (a.rideId || a.id || 0));
      setRideHistory(data);

      // Auto-restore any currently active ride so rider can see/manage/cancel it
      const currentActive = data.find(
        (r) => r.rideStatus === 'REQUESTED' || r.rideStatus === 'ACCEPTED' || r.rideStatus === 'IN_PROGRESS'
      );
      if (currentActive && (!activeRide || activeRide.rideId !== currentActive.rideId)) {
        setActiveRide({
          ...currentActive,
          status: currentActive.rideStatus,
        });
      }
    } catch (err) {
      if (!silent) setStatusMessage({ text: 'Could not load trip history.', isError: true });
    } finally {
      if (!silent) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory(true);
  }, [riderId]);

  const currentTier = VEHICLE_TIERS.find((v) => v.type === selectedVehicle) || VEHICLE_TIERS[0];
  const currentFare = currentTier.calculateFare(rawDistance);

  // Reusable Request-a-Ride card (used in 2-column logged-in view & floating on full-page guest view)
  const renderRequestCard = (isFloating = false) => (
    <div
      className={
        isFloating
          ? "w-full bg-black/25 hover:bg-black/35 backdrop-blur-[4px] rounded-3xl border border-white/25 p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between space-y-5 transition-all text-white"
          : "lg:col-span-6 bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm flex flex-col justify-between space-y-6"
      }
    >
      <div className="space-y-5">
        {/* City Switcher */}
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${isFloating ? 'text-neutral-200 drop-shadow-sm' : 'text-neutral-600'}`}>
          <span className="text-sm">📍</span>
          <span>{selectedCity.name}</span>
          <div className="relative inline-block ml-1">
            <button
              type="button"
              onClick={() => setShowCityPicker(!showCityPicker)}
              className={
                isFloating
                  ? "text-[#d4af37] font-bold underline hover:text-[#f3d97d] cursor-pointer drop-shadow-sm"
                  : "text-black font-bold underline hover:text-neutral-600 cursor-pointer"
              }
            >
              Change city
            </button>
            {showCityPicker && (
              <div
                className={`absolute left-0 top-6 rounded-xl shadow-2xl py-1 z-30 w-44 text-xs border ${
                  isFloating
                    ? 'bg-[#121620]/95 backdrop-blur-md border-neutral-700 text-white'
                    : 'bg-white border-neutral-200 text-black'
                }`}
              >
                {CITIES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleCityChange(c)}
                    className={`w-full text-left px-3 py-2 font-medium ${
                      isFloating ? 'hover:bg-white/10 text-neutral-200' : 'hover:bg-neutral-100'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Title: Welcome to Hyderabad (matching Screenshot 1) */}
        <h2
          className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight ${
            isFloating ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]' : 'text-black'
          }`}
        >
          Welcome to {selectedCity.name.split(',')[0]}
        </h2>

        {/* Pickup now dropdown */}
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setShowTimeDropdown(!showTimeDropdown)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              isFloating
                ? 'bg-black/30 hover:bg-black/45 text-white border border-white/20 backdrop-blur-sm drop-shadow-sm'
                : 'bg-[#f3f3f3] hover:bg-[#eaeaea] text-black'
            }`}
          >
            <span>🕒</span>
            <span>{pickupTime}</span>
            <span className="text-xs">▾</span>
          </button>

          {showTimeDropdown && (
            <div
              className={`absolute top-11 left-0 rounded-xl shadow-2xl py-1 z-30 w-48 text-xs border ${
                isFloating
                  ? 'bg-[#121620]/95 backdrop-blur-md border-neutral-700 text-white'
                  : 'bg-white border-neutral-200 text-black'
              }`}
            >
              <button
                type="button"
                onClick={() => { setPickupTime('Pickup now'); setShowTimeDropdown(false); }}
                className={`w-full text-left px-3 py-2 font-medium cursor-pointer ${
                  isFloating ? 'hover:bg-white/10 text-neutral-200' : 'hover:bg-neutral-100'
                }`}
              >
                Pickup now
              </button>
              <button
                type="button"
                onClick={() => { setPickupTime('Schedule for later'); setShowTimeDropdown(false); }}
                className={`w-full text-left px-3 py-2 font-medium cursor-pointer ${
                  isFloating ? 'hover:bg-white/10 text-neutral-200' : 'hover:bg-neutral-100'
                }`}
              >
                Schedule for later
              </button>
            </div>
          )}
        </div>

        {/* Connecting Line Inputs */}
        <div className="relative space-y-2 pt-1">
          <div className="absolute left-[18px] top-5 bottom-5 flex flex-col items-center pointer-events-none z-10">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isFloating ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-black'
              }`}
            />
            <div
              className={`w-[1.5px] flex-1 my-1 ${
                isFloating ? 'bg-white/30' : 'bg-black'
              }`}
            />
            <div
              className={`w-2.5 h-2.5 shrink-0 ${
                isFloating ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-black'
              }`}
            />
          </div>

          {/* Pickup Input Container with Interactive Dropdown */}
          <div ref={pickupContainerRef} className="relative">
            <input
              type="text"
              value={pickupText}
              onFocus={() => setFocusedInput('pickup')}
              onClick={() => setFocusedInput('pickup')}
              onChange={(e) => handlePickupChange(e.target.value)}
              placeholder="Enter location"
              className={`w-full pl-10 pr-20 py-3.5 rounded-xl text-xs sm:text-sm font-semibold outline-none transition-all ${
                isFloating
                  ? 'bg-black/30 hover:bg-black/45 focus:bg-black/60 border-2 border-white/20 focus:border-amber-400 text-white placeholder:text-neutral-300 backdrop-blur-sm shadow-sm'
                  : 'bg-[#f3f3f3] hover:bg-[#eaeaea] focus:bg-white border-2 border-transparent focus:border-black text-black placeholder:text-neutral-500'
              }`}
            />
            <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fetchCurrentLocation(false)}
                disabled={isFetchingLocation}
                className={`p-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center ${
                  locationFetched
                    ? isFloating
                      ? 'bg-amber-400 text-black font-bold'
                      : 'bg-neutral-900 text-white'
                    : isFloating
                    ? 'bg-black/40 hover:bg-black/60 text-white border border-white/20 backdrop-blur-sm'
                    : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300'
                }`}
                title="Auto-detect current GPS location"
              >
                {isFetchingLocation ? (
                  <span className="text-xs animate-spin">⏳</span>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="7" />
                    <polyline points="12 2 12 5" />
                    <polyline points="12 19 12 22" />
                    <polyline points="2 12 5 12" />
                    <polyline points="19 12 22 12" />
                  </svg>
                )}
              </button>
              {pickupText && (
                <button
                  type="button"
                  onClick={() => {
                    setPickupText('');
                    setLocationFetched(false);
                  }}
                  className={`font-bold text-sm px-1 cursor-pointer ${
                    isFloating ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-black'
                  }`}
                  title="Clear location"
                >
                  ✕
                </button>
              )}
            </div>

            {/* INTERACTIVE POPUP DROPDOWN (Current location option + Recent locations) */}
            {focusedInput === 'pickup' && (
              <div
                className={`absolute top-14 left-0 right-0 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in border ${
                  isFloating
                    ? 'bg-[#121620]/95 backdrop-blur-2xl border-neutral-700 text-white'
                    : 'bg-white border-neutral-200 text-black'
                }`}
              >
                {/* 1. Use Current Location option */}
                <button
                  type="button"
                  onClick={() => {
                    fetchCurrentLocation(false);
                    setFocusedInput(null);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer group ${
                    isFloating ? 'hover:bg-white/10' : 'hover:bg-neutral-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                        isFloating
                          ? 'bg-white/10 text-white border-white/20'
                          : 'bg-neutral-100 text-neutral-900 border-neutral-200'
                      }`}
                    >
                      <svg className={`w-4 h-4 ${isFloating ? 'text-amber-400' : 'text-black'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="7" />
                        <polyline points="12 2 12 5" />
                        <polyline points="12 19 12 22" />
                        <polyline points="2 12 5 12" />
                        <polyline points="19 12 22 12" />
                      </svg>
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${isFloating ? 'text-white' : 'text-black'}`}>
                        Use current location
                      </div>
                      <div className={`text-[11px] ${isFloating ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        Auto-detect using device GPS
                      </div>
                    </div>
                  </div>
                  {isFetchingLocation ? (
                    <span className="text-xs animate-spin">⏳</span>
                  ) : (
                    <span className={`text-xs ${isFloating ? 'text-neutral-400 group-hover:text-white' : 'text-neutral-400 group-hover:text-black'}`}>›</span>
                  )}
                </button>

                {/* Autocomplete Suggestions if query typed */}
                {pickupSuggestions.length > 0 ? (
                  <div className={`pt-1 border-t space-y-1 ${isFloating ? 'border-white/10' : 'border-neutral-100'}`}>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase px-2 py-0.5">
                      Search Results
                    </div>
                    {pickupSuggestions.map((place, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(place, 'pickup')}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-start gap-2 ${
                          isFloating ? 'hover:bg-white/10 text-neutral-200' : 'hover:bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        <span className="text-xs mt-0.5">📍</span>
                        <span className="truncate">{place.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* 2. Recent Locations List */
                  <div className={`pt-1 border-t space-y-1 ${isFloating ? 'border-white/10' : 'border-neutral-100'}`}>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase px-3 py-1 tracking-wider">
                      Recent locations
                    </div>
                    {recentLocations.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPickupText(item.title);
                          setPickupCoords({ lat: item.lat, lng: item.lng });
                          setFocusedInput(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors cursor-pointer group ${
                          isFloating ? 'hover:bg-white/10' : 'hover:bg-neutral-100'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                            isFloating ? 'bg-white/10 text-amber-300' : 'bg-neutral-200 text-neutral-700 group-hover:bg-neutral-300'
                          }`}
                        >
                          🕒
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${isFloating ? 'text-white' : 'text-black'}`}>{item.title}</div>
                          <div className={`text-[11px] truncate ${isFloating ? 'text-neutral-400' : 'text-neutral-500'}`}>{item.subtitle}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dropoff Input Container */}
          <div className="relative">
            <input
              type="text"
              value={dropText}
              onFocus={() => setFocusedInput('drop')}
              onChange={(e) => handleDropChange(e.target.value)}
              placeholder="Enter destination"
              className={`w-full pl-10 pr-9 py-3.5 rounded-xl text-xs sm:text-sm font-semibold outline-none transition-all ${
                isFloating
                  ? 'bg-black/30 hover:bg-black/40 focus:bg-black/60 border-2 border-white/20 focus:border-amber-400 text-white placeholder:text-neutral-300 backdrop-blur-sm shadow-sm'
                  : 'bg-[#f3f3f3] hover:bg-[#eaeaea] focus:bg-white border-2 border-transparent focus:border-black text-black placeholder:text-neutral-500'
              }`}
            />
            {dropText && (
              <button
                type="button"
                onClick={() => setDropText('')}
                className={`absolute right-3 top-3.5 font-bold text-sm cursor-pointer ${
                  isFloating ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-black'
                }`}
                title="Clear destination"
              >
                ✕
              </button>
            )}

            {/* Drop Suggestions */}
            {dropSuggestions.length > 0 && focusedInput === 'drop' && (
              <div
                className={`absolute top-14 left-0 right-0 rounded-xl shadow-2xl p-1.5 z-40 space-y-1 border ${
                  isFloating
                    ? 'bg-[#121620]/95 backdrop-blur-2xl border-neutral-700 text-white'
                    : 'bg-white border-neutral-200 text-black'
                }`}
              >
                <div className="text-[10px] font-bold text-neutral-400 px-2 py-1 uppercase flex justify-between">
                  <span>Search Results</span>
                  <button type="button" onClick={() => setDropSuggestions([])}>✕</button>
                </div>
                {dropSuggestions.map((place, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(place, 'drop')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-start gap-2 border-b last:border-0 ${
                      isFloating
                        ? 'hover:bg-white/10 text-neutral-200 border-white/10'
                        : 'hover:bg-neutral-100 text-neutral-800 border-neutral-50'
                    }`}
                  >
                    <span className="text-xs mt-0.5">🏁</span>
                    <span className="truncate">{place.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT LOCATIONS LIST ON CARD (Matching Screenshot 1) */}
        <div className={`space-y-3 pt-2 border-t ${isFloating ? 'border-white/15' : 'border-neutral-100'}`}>
          {recentLocations.slice(0, 2).map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                setPickupText(item.title);
                setPickupCoords({ lat: item.lat, lng: item.lng });
              }}
              className={`flex items-start gap-3.5 p-2 rounded-xl cursor-pointer transition-colors group ${
                isFloating ? 'hover:bg-white/10' : 'hover:bg-neutral-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 font-bold mt-0.5 ${
                  isFloating ? 'bg-black/40 text-amber-300 border border-white/15 backdrop-blur-sm' : 'bg-neutral-200 text-neutral-800'
                }`}
              >
                🕒
              </div>
              <div className="min-w-0">
                <div
                  className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                    isFloating
                      ? 'text-white group-hover:text-amber-300 drop-shadow-sm'
                      : 'text-black group-hover:text-blue-600'
                  }`}
                >
                  {item.title}
                </div>
                <div className={`text-[11px] truncate ${isFloating ? 'text-neutral-300 drop-shadow-sm' : 'text-neutral-500'}`}>
                  {item.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* See prices CTA button (Transitions to Product Selection screen) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleSeePrices}
          className={
            isFloating
              ? "px-8 py-3.5 bg-gradient-to-r from-[#d4af37] via-[#f3d97d] to-[#d4af37] hover:brightness-110 text-black font-black rounded-xl text-sm transition-all shadow-[0_4px_25px_rgba(212,175,55,0.4)] active:scale-95 flex items-center gap-2 cursor-pointer"
              : "px-8 py-3.5 bg-black hover:bg-neutral-800 text-white font-extrabold rounded-xl text-sm transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
          }
        >
          <span>See prices</span>
          <span>→</span>
        </button>
      </div>

    </div>
  );

  return (
    <div className="min-h-screen bg-white text-[#000000] font-sans antialiased">
      
      {/* GLOBAL ALERT NOTIFICATION */}
      {statusMessage.text && (
        <div
          className={`px-6 py-3 text-xs md:text-sm font-semibold flex items-center justify-between border-b ${
            statusMessage.isError
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusMessage.isError ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span>{statusMessage.text}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {statusMessage.hasActiveRideConflict && (
                <button
                  type="button"
                  onClick={async () => {
                    const active = rideHistory.find(
                      (r) => r.rideStatus === 'REQUESTED' || r.rideStatus === 'ACCEPTED' || r.rideStatus === 'IN_PROGRESS'
                    );
                    if (active) {
                      await handleCancelRide(active.rideId);
                    } else if (activeRide?.rideId) {
                      await handleCancelRide(activeRide.rideId);
                    } else {
                      setActiveRide(null);
                      setStatusMessage({ text: 'Active ride state reset. Ready to book your ride!', isError: false });
                    }
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm transition-all"
                >
                  ✕ Cancel Active Trip & Unlock Booking
                </button>
              )}
              <button
                onClick={() => setStatusMessage({ text: '', isError: false })}
                className="text-base opacity-60 hover:opacity-100 p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN HOMEPAGE & PRODUCT SELECTION ROUTER */}
      <main className={`${currentScreen === 'home' && (!isLoggedIn || homeViewMode === 'motion') ? "w-full px-2 sm:px-4 py-2" : "max-w-[1440px] mx-auto px-4 sm:px-8 py-6 space-y-6"} ${selectedRideReceipt ? 'print:hidden' : ''}`}>

        {currentScreen === 'home' && (!isLoggedIn || homeViewMode === 'motion') ? (
          /* ========================================================
             1. CINEMATIC FULL-PAGE MOTION HERO (ANIMATION SCENE)
             ======================================================== */
          <div className="relative w-full min-h-[calc(100vh-100px)] rounded-3xl overflow-hidden border border-neutral-900 shadow-2xl isolate flex items-center bg-[#07090e]">
            {/* Full-Page Night Highway Vector Car Motion Scene */}
            <FullPageCarMotionScene />

            {/* Floating Request Card - Shifted further left with transparent glassmorphism */}
            <div className="relative z-20 w-full px-4 sm:px-6 lg:px-10 py-6 pointer-events-none flex items-center">
              <div className="w-full max-w-md lg:max-w-[450px] pointer-events-auto">
                {renderRequestCard(true)}
              </div>
            </div>

            {/* Optional switch to Live Map for logged-in riders */}
            {isLoggedIn && (
              <div className="absolute top-5 right-6 z-30 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setHomeViewMode('map')}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition-all shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>🗺️</span>
                  <span>Switch to Live Map</span>
                </button>
              </div>
            )}
          </div>
        ) : currentScreen === 'home' ? (
          /* ========================================================
             1. LOGGED-IN CITY HUB HOMEPAGE (MATCHING SCREENSHOT 1: uber.com/in/en/city-hub/)
             ======================================================== */
          <div className="space-y-6">
            
            {/* Page Heading & Cinematic Mode Switch */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
                Ride
              </h1>
              <button
                type="button"
                onClick={() => setHomeViewMode('motion')}
                className="px-4 py-2 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold border border-neutral-700 transition-all shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>🎬</span>
                <span>Cinematic View</span>
              </button>
            </div>

            {/* 2-COLUMN HERO: REQUEST CARD (LEFT) + LIVE INTERACTIVE MAP (RIGHT) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* LEFT: Request a ride Card */}
              {renderRequestCard(false)}

              {/* RIGHT: LIVE INTERACTIVE MAP */}
              <div className="lg:col-span-6 min-h-[460px] lg:min-h-[580px] h-full rounded-3xl overflow-hidden border border-neutral-200 shadow-sm relative isolate z-0 bg-neutral-100">
                <LiveRouteMap
                  pickupCoords={pickupCoords}
                  dropCoords={dropCoords}
                  pickupText={pickupText}
                  dropText={dropText}
                  liveDriverGps={liveDriverGps}
                  activeRide={activeRide}
                  vehicleType={currentTier?.backendType || 'CAR'}
                />
              </div>

            </div>

          </div>
        ) : (
          /* ========================================================
             2. DEDICATED PRODUCT SELECTION SCREEN (MATCHING SCREENSHOT 2: m.uber.com/go/product-selection)
             ======================================================== */
          <div className="space-y-6 animate-in fade-in">
            
            {/* Top Sub-Navigation Bar matching Screenshot 2 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleBackToHome}
                  className="flex items-center gap-2 text-xs font-bold text-neutral-700 hover:text-black py-2 px-3 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="Return to SafarX city view"
                >
                  <span>←</span>
                  <span>Back to SafarX homepage</span>
                </button>
              </div>

              {/* Center Product Tab: Ride Only */}
              <div className="flex items-center gap-2 text-sm font-extrabold text-black border-b-2 border-black pb-2.5">
                <span>🚗</span>
                <span>Ride</span>
              </div>

              {/* Right Activity Trigger */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowHistory(true);
                    fetchHistory();
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-black px-3 py-1.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <span>👥</span>
                  <span>Activity</span>
                </button>
              </div>
            </div>

            {/* SPLIT LAYOUT: 3-COLUMNS BEFORE BOOKING, 2-COLUMNS (DETAILS + EXPANDED MAP) WHEN RIDE ACTIVE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-20">
              
              {/* COLUMN 1 (3 Cols): "Get a ride" Summary Card - Only visible when selecting ride */}
              {!activeRide && (
                <div className="lg:col-span-3 bg-white rounded-2xl border border-neutral-200 p-4 space-y-4 shadow-sm">
                  <h3 className="text-lg font-black text-black">Get a ride</h3>

                  {/* Route Points */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 bg-[#f3f3f3] p-3 rounded-xl">
                      <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0" />
                      <span className="text-xs font-bold text-black truncate">{pickupText}</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#f3f3f3] p-3 rounded-xl">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 bg-black shrink-0" />
                        <span className="text-xs font-bold text-black truncate">{dropText}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleBackToHome}
                        className="text-neutral-500 hover:text-black font-bold text-base px-1 cursor-pointer"
                        title="Edit route"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Time & Passenger Pills */}
                  <div className="space-y-2">
                    <div className="bg-[#f3f3f3] p-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-black">
                      <div className="flex items-center gap-2">
                        <span>🕒</span>
                        <span>{pickupTime}</span>
                      </div>
                      <span className="text-neutral-500 text-xs">▾</span>
                    </div>
                    <div className="bg-[#f3f3f3] p-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-black">
                      <div className="flex items-center gap-2">
                        <span>👤</span>
                        <span>{passengerMode}</span>
                      </div>
                      <span className="text-neutral-500 text-xs">▾</span>
                    </div>
                  </div>

                  {/* Edit route link */}
                  <button
                    type="button"
                    onClick={handleBackToHome}
                    className="w-full py-2 text-xs font-bold text-neutral-600 hover:text-black underline text-center cursor-pointer"
                  >
                    Edit pickup or drop location
                  </button>
                </div>
              )}

              {/* COLUMN 2: Vehicle Selection (5 cols) OR Active Trip Details (4 cols = ~33% when active) */}
              <div className={activeRide ? "lg:col-span-4 space-y-4" : "lg:col-span-5 space-y-4"}>
                
                {!activeRide ? (
                  <>
                    {/* Header */}
                    <div className="space-y-1">
                      <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Choose a ride
                      </h2>
                      <p className="text-xs font-semibold text-neutral-800">
                        Rides we think you'll like
                      </p>
                    </div>

                    {/* Vehicle Selection Cards (Matching Screenshot 2) */}
                    <div className="space-y-3">
                      {VEHICLE_TIERS.map((tier) => {
                        const isSelected = selectedVehicle === tier.type;
                        const fare = tier.calculateFare(rawDistance);

                        return (
                          <div
                            key={tier.type}
                            onClick={() => setSelectedVehicle(tier.type)}
                            className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-between bg-white ${
                              isSelected
                                ? 'border-black shadow-md'
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <div className="w-16 h-14 rounded-xl bg-white flex items-center justify-center p-0.5 border border-neutral-100 shadow-sm shrink-0 overflow-hidden">
                                <img
                                  src={tier.image}
                                  alt={tier.name}
                                  className="w-full h-full object-contain mix-blend-multiply"
                                />
                              </div>

                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm text-black">{tier.name}</span>
                                  <span className="text-xs text-neutral-600 font-bold flex items-center gap-0.5">
                                    👤 {tier.capacity}
                                  </span>
                                  {tier.badge && (
                                    <span className="text-xs">{tier.badge}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-neutral-600 font-medium">
                                  <span>{tier.etaMins} mins away • {getEtaDropTime(tier.etaMins)}</span>
                                </div>
                                {tier.tag && (
                                  <span className="inline-block bg-blue-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                                    {tier.tag}
                                  </span>
                                )}
                                {tier.desc && !tier.tag && (
                                  <div className="text-[11px] text-neutral-500 leading-tight">
                                    {tier.desc}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0 pl-2">
                              <div className="text-base font-extrabold text-black">
                                ₹{fare.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* FLOATING ACTION BAR MATCHING SCREENSHOT 2 */}
                    <div className="sticky bottom-4 mt-6 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-neutral-200 shadow-2xl flex items-center gap-3 z-30">
                      {/* Payment Method Selector */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                          className="flex items-center gap-2 bg-[#f3f3f3] hover:bg-[#eaeaea] px-3.5 py-3 rounded-xl text-xs font-bold text-black transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <span>👤</span>
                          <span className="hidden sm:inline">Personal •</span>
                          <span>{paymentMethod}</span>
                          <span className="text-xs">▾</span>
                        </button>
                        {showPaymentDropdown && (
                          <div className="absolute bottom-14 left-0 bg-white border border-neutral-200 rounded-xl shadow-xl py-1 z-40 w-52 text-xs">
                            {['UPI Scan and Pay', 'Cash to Driver', 'Razorpay Online'].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setPaymentMethod(m);
                                  setShowPaymentDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-neutral-100 font-medium cursor-pointer"
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Primary CTA: Request Vehicle */}
                      <button
                        type="button"
                        onClick={handleBookRide}
                        disabled={isLoading}
                        className="flex-1 py-3.5 bg-black hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-extrabold rounded-xl text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isLoading ? (
                          <>
                            <span className="animate-spin text-base">⏳</span>
                            <span>Requesting {currentTier.name}...</span>
                          </>
                        ) : (
                          <span>Request {currentTier.name}</span>
                        )}
                      </button>
                    </div>
                  </>
                ) : activeRide.status === 'REQUESTED' ? (
                  /* UBER-STYLE SEARCHING FOR DRIVERS / CAPTAINS (Right at top, zero scroll) */
                  <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-7 shadow-lg space-y-6 animate-in zoom-in-95">
                    {/* Animated Pulsing Radar Waves */}
                    <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
                      <div className="relative flex items-center justify-center w-24 h-24">
                        <div className="w-24 h-24 rounded-full bg-black/5 animate-ping absolute" />
                        <div className="w-16 h-16 rounded-full bg-black/10 animate-pulse absolute" />
                        <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-2xl shadow-xl z-10">
                          {currentTier.icon || '🚗'}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-2xl font-black text-black tracking-tight">
                          Searching for drivers...
                        </h2>
                        <p className="text-xs text-neutral-500 font-medium max-w-xs">
                          Connecting with nearby {currentTier.name} drivers around your pickup location.
                        </p>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full max-w-xs bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-black h-full rounded-full animate-pulse" style={{ width: '70%' }} />
                      </div>
                    </div>

                    {/* Ride Details Summary */}
                    <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="font-extrabold text-sm text-black">{currentTier.name}</span>
                          <span className="text-xs text-neutral-500">• {displayDistance} km</span>
                        </div>
                        <span className="text-base font-extrabold text-black">
                          ₹{activeRide.fare ? Number(activeRide.fare).toFixed(2) : currentFare.toFixed(2)}
                        </span>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-neutral-200/80 text-xs">
                        <div className="flex items-center gap-2 text-neutral-700 truncate">
                          <span className="w-2 h-2 rounded-full bg-black shrink-0" />
                          <span className="truncate font-semibold">{pickupText}</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-700 truncate">
                          <span className="w-2 h-2 bg-black shrink-0" />
                          <span className="truncate font-semibold">{dropText}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cancel Request Button */}
                    <button
                      type="button"
                      onClick={handleCancelRide}
                      className="w-full py-3.5 bg-neutral-100 hover:bg-red-50 text-neutral-700 hover:text-red-700 font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-all border border-neutral-200 hover:border-red-300 shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <span>Cancel Ride</span>
                      <span>✕</span>
                    </button>
                  </div>
                ) : (
                  /* ACTIVE RIDE CARD: ACCEPTED, IN_PROGRESS OR COMPLETED */
                  <div className="bg-white text-black rounded-3xl p-6 shadow-xl space-y-5 animate-in fade-in border border-neutral-200">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            activeRide.status === 'COMPLETED'
                              ? 'bg-black'
                              : 'bg-black animate-pulse'
                          }`}
                        />
                        <span className="text-xs font-black uppercase tracking-wider text-black">
                          {activeRide.status === 'COMPLETED'
                            ? 'Ride Completed'
                            : activeRide.status === 'IN_PROGRESS'
                            ? 'Trip in progress'
                            : 'Driver on the way'}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500 font-mono">Ride #{activeRide.rideId}</span>
                    </div>

                    {activeRide.status === 'COMPLETED' ? (
                      <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95">
                        <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-neutral-500 uppercase font-bold tracking-wider">
                              Total Fare
                            </span>
                            <span className="text-3xl font-black text-black">
                              ₹{activeRide.fare ? Number(activeRide.fare).toFixed(2) : '0.00'}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-700 font-semibold flex items-center justify-between pt-1.5 border-t border-neutral-100">
                            <span>Settlement Status</span>
                            <span className="text-black font-bold">
                              {razorpaySuccessData ? (
                                <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                                  ✓ Paid via Razorpay
                                </span>
                              ) : (
                                <span className="text-amber-600 font-semibold">Payment Pending</span>
                              )}
                            </span>
                          </div>
                        </div>

                        {razorpaySuccessData ? (
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-neutral-800 space-y-2 animate-in zoom-in-95">
                            <div className="font-black text-emerald-800 flex items-center gap-1.5 text-sm">
                              <span>✓</span>
                              <span>Payment Verified via Razorpay!</span>
                            </div>
                            <div className="space-y-1 font-mono text-[11px] text-neutral-600 pt-1.5 border-t border-emerald-100">
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Payment ID:</span>
                                <span className="font-bold text-black">{razorpaySuccessData.paymentId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Order ID:</span>
                                <span className="text-neutral-700">{razorpaySuccessData.orderId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-neutral-500">Amount Paid:</span>
                                <span className="font-bold text-emerald-700">₹{razorpaySuccessData.amount}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveRide(null);
                                setLiveDriverGps(null);
                                setRazorpaySuccessData(null);
                                fetchHistory(true);
                                setStatusMessage({
                                  text: `✓ Ride #${activeRide.rideId} settled & paid! Full receipt saved in My Trips.`,
                                  isError: false,
                                });
                              }}
                              className="w-full mt-2 py-3.5 bg-black hover:bg-neutral-800 active:scale-95 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>Receipt Saved • Book Next Ride</span>
                              <span>→</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="p-3 bg-white rounded-xl border border-neutral-200 text-xs text-neutral-700 space-y-1">
                              <div className="font-bold text-black flex items-center gap-1.5">
                                <span>✓ Destination Safely Reached</span>
                              </div>
                              <p className="text-[11px] text-neutral-500 leading-relaxed">
                                Choose your payment method below to complete the settlement for Ride #{activeRide.rideId}.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handlePayOnlineWithRazorpay}
                              disabled={isPayingRazorpay}
                              className="w-full py-3.5 bg-black hover:bg-neutral-800 active:scale-95 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isPayingRazorpay ? (
                                <>
                                  <span className="animate-spin text-base">⏳</span>
                                  <span>Opening Razorpay Gateway...</span>
                                </>
                              ) : (
                                <>
                                  <span>💳</span>
                                  <span>Pay ₹{activeRide.fare ? activeRide.fare.toFixed(2) : '0.00'} Online (UPI / Card)</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveRide(null);
                                setLiveDriverGps(null);
                                setRazorpaySuccessData(null);
                                fetchHistory(true);
                                setStatusMessage({
                                  text: `✓ Ride #${activeRide.rideId} completed with Cash payment! Receipt saved in My Trips.`,
                                  isError: false,
                                });
                              }}
                              className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-xl text-[11px] uppercase tracking-wider transition-all border border-neutral-200 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span>💵</span>
                              <span>Pay with Cash directly to Driver</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      (() => {
                        const driverObj = activeRide?.driver || activeRide?.vehicle?.driver || {};
                        const driverInfo = getDriverDetails(activeRide);

                        const driverName =
                          activeRide?.driver?.name ||
                          activeRide?.driverName ||
                          activeRide?.driver?.driverName ||
                          driverObj.name ||
                          driverObj.driverName ||
                          driverObj.fullName ||
                          activeRide?.vehicle?.driverName ||
                          driverInfo?.name ||
                          (activeRide?.driverId ? `Driver #${activeRide.driverId}` : 'Driver Partner');

                        const driverPlate =
                          activeRide?.driver?.vehicleNumber ||
                          activeRide?.driver?.plateNumber ||
                          activeRide?.vehicleNumber ||
                          activeRide?.plateNumber ||
                          driverObj.vehicleNumber ||
                          driverObj.plateNumber ||
                          activeRide?.vehicle?.plateNumber ||
                          driverInfo?.plateNumber ||
                          '—';

                        const driverModel =
                          activeRide?.driver?.model ||
                          activeRide?.driver?.vehicleModel ||
                          activeRide?.vehicleModel ||
                          driverObj.model ||
                          driverObj.vehicleModel ||
                          activeRide?.vehicle?.carModel ||
                          driverInfo?.model ||
                          (activeRide?.vehicleType ? `SafarX ${activeRide.vehicleType}` : 'Comfort Cab');

                        const driverRating =
                          activeRide?.driver?.rating ||
                          driverObj.rating ||
                          activeRide?.driverRating ||
                          driverInfo?.rating ||
                          5.0;

                        const rawPhone =
                          activeRide?.driver?.phone ||
                          driverObj.phone ||
                          driverObj.phoneNumber ||
                          activeRide?.driverPhone ||
                          driverInfo?.phone ||
                          '';
                        const driverPhone = rawPhone && !rawPhone.includes('@') ? String(rawPhone).trim() : '';

                        return (
                          <div className="space-y-4">
                            {/* Driver & Vehicle Box */}
                            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-black text-white font-black text-lg flex items-center justify-center shadow">
                                  {driverName.charAt(0).toUpperCase()}
                                </div>
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-extrabold text-black">{driverName}</h4>
                                  <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-semibold">
                                    <span className="text-black font-bold">★ {Number(driverRating).toFixed(1)}</span>
                                    <span>•</span>
                                    <span>{driverModel}</span>
                                    {driverPhone && (
                                      <>
                                        <span>•</span>
                                        <a href={`tel:${driverPhone}`} className="text-emerald-600 hover:underline font-mono">
                                          📞 {driverPhone}
                                        </a>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="inline-block bg-white text-black font-mono font-bold text-xs px-3 py-1 rounded-lg border border-neutral-300 shadow-sm tracking-wider">
                                  {driverPlate}
                                </div>
                              </div>
                            </div>

                            {/* Estimated Arrival / Route Status */}
                            <div className="flex items-center justify-between py-2 border-b border-neutral-100 text-xs">
                              <span className="font-bold text-neutral-600">
                                {activeRide.status === 'IN_PROGRESS' ? 'Route status' : 'Estimated arrival'}
                              </span>
                              <span className="font-extrabold text-black">
                                {activeRide.status === 'IN_PROGRESS' ? 'En route to destination' : '~2-3 mins'}
                              </span>
                            </div>

                            {/* Trip Route Points */}
                            <div className="space-y-2 text-xs border-b border-neutral-100 pb-3">
                              <div className="flex items-center gap-2 text-neutral-800 truncate">
                                <span className="w-2 h-2 rounded-full bg-black shrink-0" />
                                <span className="truncate font-semibold">{pickupText}</span>
                              </div>
                              <div className="flex items-center gap-2 text-neutral-800 truncate">
                                <span className="w-2 h-2 bg-black shrink-0" />
                                <span className="truncate font-semibold">{dropText}</span>
                              </div>
                            </div>

                            {/* Share Trip Details with Family */}
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(
                                    `I am on SafarX Ride #${activeRide.rideId} with driver ${driverName} (${driverModel}, Plate: ${driverPlate}).`
                                  );
                                  setStatusMessage({
                                    text: 'Trip & driver details copied to clipboard!',
                                    isError: false,
                                  });
                                }}
                                className="w-full py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-neutral-200 cursor-pointer"
                              >
                                <span>Share Trip Details</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    )}

                    {activeRide.status !== 'COMPLETED' && (
                      <div className="flex justify-between items-center border-t border-neutral-100 pt-3 text-xs">
                        <span className="text-neutral-500 font-bold uppercase tracking-wider">Total Fare</span>
                        <span className="text-xl font-black text-black">
                          ₹{activeRide.fare ? Number(activeRide.fare).toFixed(2) : '50.07'}
                        </span>
                      </div>
                    )}

                    {(activeRide.status === 'ACCEPTED' || activeRide.rideStatus === 'ACCEPTED') && (
                      <button
                        type="button"
                        onClick={handleCancelRide}
                        className="w-full py-3.5 bg-neutral-100 hover:bg-red-50 text-neutral-800 hover:text-red-700 font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-all border border-neutral-200 hover:border-red-300 shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <span>Cancel Ride</span>
                        <span>✕</span>
                      </button>
                    )}

                    {(activeRide.status === 'IN_PROGRESS' || activeRide.rideStatus === 'IN_PROGRESS') && (
                      <div className="w-full py-3.5 bg-black text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Trip In Progress • Safe Journey</span>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* COLUMN 3: Full Height Route Map (Takes 4 cols during selection, expands to 8 cols ~67% when ride active) */}
              <div className={`${activeRide ? "lg:col-span-8" : "lg:col-span-4"} h-[600px] lg:h-[calc(100vh-140px)] sticky top-20 rounded-3xl overflow-hidden border border-neutral-200 shadow-sm relative isolate z-0 bg-neutral-100 transition-all duration-300`}>
                <LiveRouteMap
                  pickupCoords={pickupCoords}
                  dropCoords={dropCoords}
                  pickupText={pickupText}
                  dropText={dropText}
                  liveDriverGps={liveDriverGps}
                  activeRide={activeRide}
                  vehicleType={currentTier?.backendType || 'CAR'}
                />
              </div>

            </div>

          </div>
        )}

      </main>

      {/* 3. TRIP HISTORY DRAWER */}
      {showHistory && (
        <div className="print:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-xl font-bold text-black">Past Trips</h3>
                <p className="text-xs text-neutral-500">Rider #{riderId} Journey Records</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-neutral-500 hover:text-black text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-10 text-neutral-400 text-sm">Loading trips...</div>
            ) : rideHistory.length > 0 ? (
              <div className="space-y-3">
                {rideHistory.map((ride, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedRideReceipt(ride)}
                    className="p-4 rounded-2xl border border-neutral-200 bg-white hover:border-black hover:shadow-lg transition-all cursor-pointer group space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-black group-hover:text-blue-600 transition-colors">
                          Trip #{ride.rideId || ride.id}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-medium">
                          {formatDateTime(ride.startTime || ride.endTime)}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                          ride.rideStatus === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {ride.rideStatus || 'ACCEPTED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {ride.vehicle?.carModel ? '🚗' : ride.vehicle?.autoModel ? '🛺' : '🏍️'}
                        </span>
                        <span className="font-semibold text-neutral-800">
                          {getDriverDetails(ride, rideHistory).name}
                        </span>
                        <span className="text-neutral-300">•</span>
                        <span className="text-neutral-500 font-mono text-[11px]">
                          {getDriverDetails(ride, rideHistory).plateNumber}
                        </span>
                        <span className="text-neutral-300">•</span>
                        <span className="text-neutral-500 font-mono text-[11px]">
                          {ride.distanceKm ? `${Number(ride.distanceKm).toFixed(1)} km` : '—'}
                        </span>
                      </div>
                      <div className="font-extrabold text-black text-sm">
                        ₹{ride.fare ? Number(ride.fare).toFixed(2) : '0.00'}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 group-hover:text-black font-semibold">
                      <span>Click to view full receipt & route</span>
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400 text-xs">
                No past trips found for Rider #{riderId}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. UBER-STYLE TRIP RECEIPT & DETAILS MODAL */}
      {selectedRideReceipt && (
        <div className="receipt-modal-backdrop fixed inset-0 z-[70] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in print:p-0 print:m-0 print:bg-transparent print:static print:block print:overflow-visible">
          <div className="receipt-print-card bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 my-8 print:max-w-[620px] print:my-0 print:mx-auto print:border print:border-neutral-300 print:shadow-none print:rounded-2xl print:overflow-visible">
            
            {/* Modal Header */}
            <div className="receipt-header bg-neutral-900 text-white p-6 flex items-start justify-between print:p-4 print:rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-neutral-400">
                    SafarX Receipt
                  </span>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      selectedRideReceipt.rideStatus === 'COMPLETED'
                        ? 'bg-emerald-500 text-black'
                        : 'bg-amber-400 text-black'
                    }`}
                  >
                    {selectedRideReceipt.rideStatus || 'COMPLETED'}
                  </span>
                </div>
                <h3 className="text-2xl font-black mt-1">
                  Trip #{selectedRideReceipt.rideId || selectedRideReceipt.id}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {formatDateTime(selectedRideReceipt.startTime || selectedRideReceipt.endTime)}
                </p>
              </div>

              <button
                onClick={() => setSelectedRideReceipt(null)}
                className="print:hidden w-9 h-9 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center font-bold text-lg transition-all"
              >
                ✕
              </button>
            </div>

            <div className="receipt-scroll-body p-6 space-y-6 max-h-[75vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-4 print:space-y-3.5">
              
              {/* Vehicle & Driver Profile */}
              {(() => {
                const rDriver = getDriverDetails(selectedRideReceipt, rideHistory);
                const rDriverName = selectedRideReceipt?.driverName || rDriver.name;
                const rPlate = selectedRideReceipt?.plateNumber || rDriver.plateNumber;
                const rModel = rDriver.model || (selectedRideReceipt?.vehicleType ? `SafarX ${selectedRideReceipt.vehicleType}` : 'Comfort Cab');
                return (
                  <div className="receipt-avoid-break p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-between print:p-3 print:bg-neutral-50">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-12 rounded-xl bg-white border border-neutral-200 overflow-hidden flex items-center justify-center p-1 shadow-sm shrink-0">
                        <img
                          src={getVehicleImage(selectedRideReceipt.vehicle)}
                          alt="Vehicle"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-black text-sm">
                            {rDriverName}
                          </h4>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            ✓ Verified Partner
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 font-medium">
                          {rModel} • <strong className="font-mono text-black">{rPlate}</strong>
                        </div>
                        <div className="text-xs text-amber-500 font-bold flex items-center gap-1 mt-0.5">
                          <span>★ 5.0</span>
                          <span className="text-neutral-400 text-[10px] font-normal">• Top Rated Driver ({rDriver.tripsCompleted || 5} {rDriver.tripsCompleted === 1 ? 'ride' : 'rides'} completed)</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-neutral-400 uppercase font-bold">Fare Paid</div>
                      <div className="text-xl font-black text-black">
                        ₹{selectedRideReceipt.fare ? Number(selectedRideReceipt.fare).toFixed(2) : '0.00'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Journey Route & Location Breakdown */}
              <div className="receipt-avoid-break space-y-4 print:space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Route Details & GPS Telemetry
                </div>

                <div className="relative pl-6 space-y-5 border-l-2 border-dashed border-neutral-200 ml-2">
                  
                  {/* Pickup Point */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                        Pickup Location
                      </div>
                      <div className="font-bold text-black text-xs leading-snug mt-0.5">
                        {receiptPickupName || 'Pickup Coordinates Logged'}
                      </div>
                      {selectedRideReceipt.pickupLat && (
                        <div className="font-mono text-[10px] text-neutral-400 mt-0.5">
                          GPS: {Number(selectedRideReceipt.pickupLat).toFixed(4)}°, {Number(selectedRideReceipt.pickupLng).toFixed(4)}°
                        </div>
                      )}
                      {selectedRideReceipt.startTime && (
                        <div className="text-[10px] text-neutral-500 font-medium mt-0.5">
                          Departed: {formatDateTime(selectedRideReceipt.startTime)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route Distance Banner */}
                  <div className="py-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold border border-neutral-200">
                      <span>🛣️ Distance Traveled:</span>
                      <strong className="text-black">
                        {selectedRideReceipt.distanceKm ? `${Number(selectedRideReceipt.distanceKm).toFixed(2)} km` : '—'}
                      </strong>
                    </span>
                  </div>

                  {/* Dropoff Point */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 bg-black border-2 border-white shadow" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-neutral-700 tracking-wider">
                        Dropoff Destination
                      </div>
                      <div className="font-bold text-black text-xs leading-snug mt-0.5">
                        {receiptDropName || 'Destination Coordinates Logged'}
                      </div>
                      {selectedRideReceipt.dropLat && (
                        <div className="font-mono text-[10px] text-neutral-400 mt-0.5">
                          GPS: {Number(selectedRideReceipt.dropLat).toFixed(4)}°, {Number(selectedRideReceipt.dropLng).toFixed(4)}°
                        </div>
                      )}
                      {selectedRideReceipt.endTime && (
                        <div className="text-[10px] text-neutral-500 font-medium mt-0.5">
                          Arrived: {formatDateTime(selectedRideReceipt.endTime)}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Real-time Map Preview Embed */}
                {selectedRideReceipt.dropLat && selectedRideReceipt.dropLng && (
                  <div className="receipt-map-preview relative rounded-2xl overflow-hidden border border-neutral-200 h-36 bg-neutral-100 shadow-inner print:h-24 print:rounded-xl">
                    <iframe
                      title="Trip Route Map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(selectedRideReceipt.pickupLng || selectedRideReceipt.dropLng, selectedRideReceipt.dropLng) - 0.015}%2C${Math.min(selectedRideReceipt.pickupLat || selectedRideReceipt.dropLat, selectedRideReceipt.dropLat) - 0.015}%2C${Math.max(selectedRideReceipt.pickupLng || selectedRideReceipt.dropLng, selectedRideReceipt.dropLng) + 0.015}%2C${Math.max(selectedRideReceipt.pickupLat || selectedRideReceipt.dropLat, selectedRideReceipt.dropLat) + 0.015}&layer=mapnik&marker=${selectedRideReceipt.dropLat}%2C${selectedRideReceipt.dropLng}`}
                      className="w-full h-full opacity-90"
                    />
                    <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-neutral-800 shadow border border-neutral-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Recorded Journey Map
                    </div>
                  </div>
                )}
              </div>

              {/* Itemized Fare Receipt */}
              <div className="receipt-avoid-break p-4 rounded-2xl bg-[#f8f9fa] border border-neutral-200 space-y-2.5 print:p-3 print:space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 pb-1 border-b border-neutral-200">
                  Itemized Fare Receipt
                </div>

                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Driver Partner</span>
                  <span className="font-semibold text-black">{selectedRideReceipt?.driverName || getDriverDetails(selectedRideReceipt).name}</span>
                </div>

                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Vehicle Registration</span>
                  <span className="font-mono font-semibold text-black">{selectedRideReceipt?.plateNumber || getDriverDetails(selectedRideReceipt).plateNumber}</span>
                </div>

                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Base Pickup Fare</span>
                  <span className="font-mono font-semibold text-black">₹50.00</span>
                </div>

                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Distance Transit Charge ({selectedRideReceipt.distanceKm ? Number(selectedRideReceipt.distanceKm).toFixed(1) : 0} km)</span>
                  <span className="font-mono font-semibold text-black">
                    ₹{Math.max(0, (selectedRideReceipt.fare || 0) - 50).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-neutral-600">
                  <span>Taxes & Operational Tolls</span>
                  <span className="font-mono font-semibold text-emerald-600">₹0.00 (Included)</span>
                </div>

                <div className="pt-2 border-t border-neutral-200 flex justify-between items-center text-sm font-black text-black">
                  <span>Total Amount Paid</span>
                  <span className="text-base text-black">
                    ₹{selectedRideReceipt.fare ? Number(selectedRideReceipt.fare).toFixed(2) : '0.00'}
                  </span>
                </div>

                <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1">
                  <span>Payment Method</span>
                  <span className="font-semibold text-neutral-800">💳 Cash / UPI on Arrival</span>
                </div>
              </div>

              {/* Rider Identity Footer */}
              <div className="receipt-avoid-break flex items-center justify-between text-xs text-neutral-500 px-1 print:pt-1">
                <div>
                  Rider: <strong className="text-neutral-800">{selectedRideReceipt.rider?.name || `Rider #${riderId}`}</strong>
                </div>
                <div>
                  Email: <span className="font-mono text-neutral-600">{selectedRideReceipt.rider?.email || 'verified@safarx.in'}</span>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="print:hidden p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-800 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                🖨️ Print Receipt
              </button>
              <button
                onClick={() => setSelectedRideReceipt(null)}
                className="px-6 py-2 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
