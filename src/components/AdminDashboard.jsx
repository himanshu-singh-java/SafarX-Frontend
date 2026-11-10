import React, { useState, useEffect, useMemo } from 'react';
import { getAuthHeaders, handleAuthResponse } from '../utils/auth';
import { getDriverDetails } from '../utils/driverDirectory';

export default function AdminDashboard({ token, userEmail, onOpenAuth }) {
  const [activeTab, setActiveTab] = useState('rides'); // 'rides' | 'vehicles'
  const [userId, setUserId] = useState('');
  const [rides, setRides] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState('CAR');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED'
  const [searchQuery, setSearchQuery] = useState('');

  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  // Selected ride for admin audit modal
  const [selectedAuditRide, setSelectedAuditRide] = useState(null);
  const [auditPickupName, setAuditPickupName] = useState('');
  const [auditDropName, setAuditDropName] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);

  // Reverse geocoding for admin audit modal
  useEffect(() => {
    if (!selectedAuditRide) {
      setAuditPickupName('');
      setAuditDropName('');
      setShowRawJson(false);
      return;
    }

    let isMounted = true;
    const pickupLat = selectedAuditRide.pickupLat || selectedAuditRide.pickupLatitude;
    const pickupLng = selectedAuditRide.pickupLng || selectedAuditRide.pickupLongitude;
    const dropLat = selectedAuditRide.dropLat || selectedAuditRide.dropLatitude;
    const dropLng = selectedAuditRide.dropLng || selectedAuditRide.dropLongitude;

    if (pickupLat && pickupLng) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pickupLat}&lon=${pickupLng}&zoom=16`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data?.display_name) {
            setAuditPickupName(data.display_name.split(',').slice(0, 3).join(', '));
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
            setAuditDropName(data.display_name.split(',').slice(0, 3).join(', '));
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [selectedAuditRide]);

  const formatDateTime = (val) => {
    if (!val) return 'Date not recorded';
    if (Array.isArray(val)) {
      const [year, month, day, hour = 0, minute = 0] = val;
      return new Date(year, month - 1, day, hour, minute).toLocaleString('en-IN', {
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

  // === RIDE APIs ===
  const fetchAllGlobalRides = async (silent = false) => {
    setIsLoading(true);
    setUserId('');
    try {
      const response = await fetch(`http://localhost:8080/api/rides/all`, {
        headers: getAuthHeaders(),
      });

      if (handleAuthResponse(response)) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setRides(Array.isArray(data) ? data : [data]);
        setIsBackendOnline(true);
        if (!silent) setStatusMessage({ text: 'All rides loaded from database.', isError: false });
      } else {
        if (!silent) setStatusMessage({ text: 'No rides found in database.', isError: true });
        setRides([]);
      }
    } catch (error) {
      setIsBackendOnline(false);
      if (!silent) setStatusMessage({ text: 'Backend unreachable. Verify Spring Boot on port 8080.', isError: true });
    }
    setIsLoading(false);
  };

  const fetchUserRides = async (silent = false) => {
    if (!userId) {
      setStatusMessage({ text: 'Please enter a valid Rider ID.', isError: true });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/rides/history/${userId}`, {
        headers: getAuthHeaders(),
      });

      if (handleAuthResponse(response)) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setRides(Array.isArray(data) ? data : [data]);
        setIsBackendOnline(true);
        if (!silent) setStatusMessage({ text: `Rides loaded for Rider #${userId}.`, isError: false });
      } else {
        if (!silent) setStatusMessage({ text: `No rides found for Rider #${userId}.`, isError: true });
        setRides([]);
      }
    } catch (error) {
      setIsBackendOnline(false);
      if (!silent) setStatusMessage({ text: 'Backend offline. Verify Spring Boot.', isError: true });
    }
    setIsLoading(false);
  };

  const handleCompleteRide = async (rideId) => {
    try {
      const response = await fetch(`http://localhost:8080/api/rides/complete/${rideId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });

      if (handleAuthResponse(response)) {
        return;
      }

      if (response.ok) {
        setStatusMessage({ text: `Ride #${rideId} marked as Completed. Vehicle is now Available.`, isError: false });
        userId ? fetchUserRides(true) : fetchAllGlobalRides(true);
      } else {
        const errorText = await response.text();
        setStatusMessage({ text: errorText || 'Failed to complete ride.', isError: true });
      }
    } catch (error) {
      setStatusMessage({ text: 'Network failure while completing ride.', isError: true });
    }
  };

  const handleDeleteRide = async (rideId) => {
    if (!window.confirm(`Are you sure you want to permanently delete Ride #${rideId}?`)) return;
    try {
      const response = await fetch(`http://localhost:8080/api/rides/delete/${rideId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (handleAuthResponse(response)) {
        return;
      }

      if (response.ok) {
        setStatusMessage({ text: `Ride #${rideId} deleted successfully.`, isError: false });
        setRides((prev) => prev.filter((r) => (r.id || r.rideId) !== rideId));
      } else {
        setStatusMessage({ text: 'Unable to delete ride record.', isError: true });
      }
    } catch (error) {
      setStatusMessage({ text: 'Transaction failed due to network disruption.', isError: true });
    }
  };

  // === VEHICLE APIs ===
  const fetchVehicles = async (type) => {
    setIsLoading(true);
    setSelectedVehicleType(type);
    setVehicles([]);
    try {
      const response = await fetch(`http://localhost:8080/api/vehicles/status/${type}`, {
        headers: getAuthHeaders(),
      });

      if (handleAuthResponse(response)) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setVehicles(Array.isArray(data) ? data : []);
        setIsBackendOnline(true);
        setStatusMessage({ text: `${type} fleet status loaded.`, isError: false });
      } else {
        setStatusMessage({ text: `Failed to load ${type} fleet status.`, isError: true });
      }
    } catch (error) {
      setIsBackendOnline(false);
      setStatusMessage({ text: 'Backend fleet service unreachable.', isError: true });
    }
    setIsLoading(false);
  };

  const handleCompleteFromFleet = async (vehicleId, vehicleType) => {
    try {
      const response = await fetch(`http://localhost:8080/api/vehicles/complete-ride/${vehicleId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });

      if (handleAuthResponse(response)) {
        return;
      }

      if (response.ok) {
        setStatusMessage({ text: `Vehicle #${vehicleId} has completed its ride and is now Available.`, isError: false });
        fetchVehicles(vehicleType);
      } else {
        const errorText = await response.text();
        setStatusMessage({ text: errorText || `Unable to complete ride for Vehicle #${vehicleId}.`, isError: true });
      }
    } catch (error) {
      setStatusMessage({ text: 'Network disruption.', isError: true });
    }
  };

  // Auto-load all rides on mount & periodic 3-second live background sync
  useEffect(() => {
    fetchAllGlobalRides(true);

    const autoSyncInterval = setInterval(() => {
      // Auto-sync global rides in background if not viewing a single rider's history
      if (!userId && activeTab === 'rides') {
        fetchAllGlobalRides(true);
      }
    }, 3000);

    return () => clearInterval(autoSyncInterval);
  }, [userId, activeTab]);

  // Filter rides based on search and status tabs
  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      const status = (ride.rideStatus || ride.status || '').toUpperCase();
      const isOngoing =
        status === 'ACCEPTED' ||
        status === 'ON_RIDE' ||
        status === 'REQUESTED' ||
        status === 'IN_PROGRESS';

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? isOngoing
          : status === 'COMPLETED';

      const q = searchQuery.toLowerCase();
      const idMatch = String(ride.id || ride.rideId || '').includes(q);
      const riderMatch = String(ride.rider?.riderID || ride.riderId || '').includes(q);
      const driver = getDriverDetails(ride, rides);
      const driverMatch =
        String(driver.name || '').toLowerCase().includes(q) ||
        String(driver.plateNumber || '').toLowerCase().includes(q);

      return matchesStatus && (idMatch || riderMatch || driverMatch);
    });
  }, [rides, statusFilter, searchQuery]);

  // KPI Stats
  const stats = useMemo(() => {
    const total = rides.length;
    const active = rides.filter((r) => {
      const s = (r.rideStatus || r.status || '').toUpperCase();
      return s === 'ON_RIDE' || s === 'ACCEPTED' || s === 'REQUESTED' || s === 'IN_PROGRESS';
    }).length;
    const completed = rides.filter((r) => (r.rideStatus || r.status || '').toUpperCase() === 'COMPLETED').length;
    const revenue = rides.reduce((acc, r) => acc + (parseFloat(r.fare) || 0), 0);

    return { total, active, completed, revenue };
  }, [rides]);

  return (
    <div className="min-h-screen bg-[#090b0e] text-[#e6edf3] font-sans antialiased selection:bg-[#38bdf8]/30 relative">
      
      {/* Background Tech Grid & Ambient Glows */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.1),rgba(255,255,255,0))] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#21262d]">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Safar<span className="text-[#38bdf8]">X</span>
                <span className="text-xs uppercase tracking-widest font-mono bg-[#161b22] text-[#8b949e] px-2.5 py-1 rounded-md border border-[#30363d]">
                  Admin Dashboard
                </span>
              </h1>
            </div>
            <p className="text-xs md:text-sm text-[#8b949e]">
              Manage live rides, view vehicle fleet status, and control operations.
            </p>
          </div>

          {/* Top Right Controls & Tabs */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Backend Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161b22] border border-[#30363d] text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isBackendOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                }`}
              />
              <span className="text-[#c9d1d9] font-mono text-[11px]">
                {isBackendOnline ? 'Spring Boot Online (:8080)' : 'Backend Offline'}
              </span>
            </div>

            {/* Clean Section Switcher Tabs */}
            <div className="flex items-center p-1 bg-[#161b22] rounded-xl border border-[#30363d] shadow-sm">
              <button
                onClick={() => {
                  setActiveTab('rides');
                  setStatusMessage({ text: '', isError: false });
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                  activeTab === 'rides'
                    ? 'bg-[#38bdf8] text-[#090b0e] shadow-md'
                    : 'text-[#8b949e] hover:text-white'
                }`}
              >
                <span>📋</span>
                <span>All Rides</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('vehicles');
                  setStatusMessage({ text: '', isError: false });
                  if (vehicles.length === 0) fetchVehicles('CAR');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                  activeTab === 'vehicles'
                    ? 'bg-[#38bdf8] text-[#090b0e] shadow-md'
                    : 'text-[#8b949e] hover:text-white'
                }`}
              >
                <span>🚗</span>
                <span>Vehicles & Drivers</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Toast Alert */}
        {statusMessage.text && (
          <div
            className={`p-4 rounded-xl text-xs md:text-sm font-semibold border backdrop-blur-md shadow-2xl flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2 ${
              statusMessage.isError
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full ${
                  statusMessage.isError ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage({ text: '', isError: false })}
              className="text-base opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}

        {/* TOP KPI SUMMARY CARDS (CLEAN & SIMPLE NAMES) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-[#161b22]/80 backdrop-blur-xl border border-[#30363d] p-5 rounded-2xl space-y-1.5 hover:border-[#38bdf8]/40 transition-colors shadow-lg">
            <div className="flex items-center justify-between text-xs text-[#8b949e] font-semibold uppercase tracking-wider">
              <span>Total Rides</span>
              <span className="text-base">📁</span>
            </div>
            <div className="text-3xl font-black text-white">{stats.total}</div>
            <div className="text-[11px] text-[#8b949e]">Total bookings recorded</div>
          </div>

          <div className="bg-[#161b22]/80 backdrop-blur-xl border border-[#30363d] p-5 rounded-2xl space-y-1.5 hover:border-amber-500/40 transition-colors shadow-lg">
            <div className="flex items-center justify-between text-xs text-amber-400 font-semibold uppercase tracking-wider">
              <span>Active Rides</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div className="text-3xl font-black text-amber-300">{stats.active}</div>
            <div className="text-[11px] text-[#8b949e]">Ongoing or Accepted trips</div>
          </div>

          <div className="bg-[#161b22]/80 backdrop-blur-xl border border-[#30363d] p-5 rounded-2xl space-y-1.5 hover:border-emerald-500/40 transition-colors shadow-lg">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold uppercase tracking-wider">
              <span>Completed Rides</span>
              <span className="text-emerald-400 font-bold">✓</span>
            </div>
            <div className="text-3xl font-black text-emerald-300">{stats.completed}</div>
            <div className="text-[11px] text-[#8b949e]">Successfully concluded</div>
          </div>

          <div className="bg-[#161b22]/80 backdrop-blur-xl border border-[#30363d] p-5 rounded-2xl space-y-1.5 hover:border-[#38bdf8]/40 transition-colors shadow-lg">
            <div className="flex items-center justify-between text-xs text-[#38bdf8] font-semibold uppercase tracking-wider">
              <span>Total Revenue</span>
              <span className="text-base">💳</span>
            </div>
            <div className="text-3xl font-black text-white">₹{stats.revenue.toFixed(2)}</div>
            <div className="text-[11px] text-[#8b949e]">Total booking amount</div>
          </div>

        </div>

        {/* ===================== VIEW 1: ALL RIDES TABLE ===================== */}
        {activeTab === 'rides' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Filter and Search Bar */}
            <div className="bg-[#161b22]/80 backdrop-blur-xl border border-[#30363d] p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
              
              {/* Left: Filter by Rider ID */}
              <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter Rider ID (e.g. 1)..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#8b949e] focus:border-[#38bdf8] outline-none"
                  />
                </div>
                <button
                  onClick={() => fetchUserRides(false)}
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Search Rider'}
                </button>
                <button
                  onClick={() => fetchAllGlobalRides(false)}
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-[#38bdf8] hover:bg-[#0284c7] text-[#090b0e] font-extrabold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
                >
                  View All Rides
                </button>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center p-1 bg-[#0d1117] rounded-xl border border-[#30363d] w-full md:w-auto overflow-x-auto">
                {[
                  { id: 'ALL', label: 'All Rides' },
                  { id: 'ACTIVE', label: 'Active' },
                  { id: 'COMPLETED', label: 'Completed' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setStatusFilter(tab.id);
                      fetchAllGlobalRides(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      statusFilter === tab.id
                        ? 'bg-[#21262d] text-white shadow-sm'
                        : 'text-[#8b949e] hover:text-[#c9d1d9]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rides Data Table */}
            <div className="bg-[#161b22]/80 backdrop-blur-xl border border-[#30363d] rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0d1117]/80 text-[11px] uppercase tracking-wider text-[#8b949e] border-b border-[#21262d]">
                      <th className="px-6 py-4 font-bold">Ride ID</th>
                      <th className="px-6 py-4 font-bold">Rider</th>
                      <th className="px-6 py-4 font-bold">Pickup & Drop Location</th>
                      <th className="px-6 py-4 font-bold">Vehicle & Driver</th>
                      <th className="px-6 py-4 font-bold">Fare</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d] text-xs">
                    {filteredRides.length > 0 ? (
                      filteredRides.map((ride, idx) => {
                        const rideId = ride.id || ride.rideId;
                        const status = (ride.rideStatus || ride.status || 'UNKNOWN').toUpperCase();
                        const isCompletable = status === 'ON_RIDE' || status === 'ACCEPTED';

                        // Pickup and Drop display text
                        const pickupDisplay =
                          ride.pickupLocation ||
                          (ride.pickupLat ? `${ride.pickupLat}, ${ride.pickupLng}` : '') ||
                          (ride.pickupLatitude ? `${ride.pickupLatitude}, ${ride.pickupLongitude}` : 'Pickup Location');

                        const dropDisplay =
                          ride.dropLocation ||
                          (ride.dropLat ? `${ride.dropLat}, ${ride.dropLng}` : '') ||
                          (ride.dropLatitude ? `${ride.dropLatitude}, ${ride.dropLongitude}` : 'Dropoff Location');

                        return (
                          <tr key={idx} className="hover:bg-[#1f242c] transition-colors group">
                            
                            {/* Ride ID */}
                            <td
                              onClick={() => setSelectedAuditRide(ride)}
                              className="px-6 py-4 font-mono font-bold text-white whitespace-nowrap cursor-pointer hover:text-blue-400 transition-colors"
                              title="Click to inspect ride details"
                            >
                              #{rideId} <span className="text-[10px] text-[#8b949e]">↗</span>
                            </td>

                            {/* Rider ID */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-semibold text-white">
                                Rider #{ride.rider?.riderID || ride.riderId || '1'}
                              </span>
                            </td>

                            {/* PICKUP & DROP LOCATION (CLEARLY VISIBLE WITH BADGES) */}
                            <td className="px-6 py-4 min-w-[260px] max-w-md">
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                    Pickup
                                  </span>
                                  <span className="text-white text-xs font-semibold leading-snug">
                                    {pickupDisplay}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                                    Dropoff
                                  </span>
                                  <span className="text-[#c9d1d9] text-xs font-medium leading-snug">
                                    {dropDisplay}
                                  </span>
                                </div>
                                {ride.distanceKm && (
                                  <div className="text-[10px] text-[#8b949e] font-mono pl-1">
                                    🛣️ Distance: <strong className="text-white">{Number(ride.distanceKm).toFixed(1)} km</strong>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Vehicle & Driver */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              {ride.vehicle ? (
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-white">
                                    {getDriverDetails(ride).name}
                                  </div>
                                  <div className="text-[11px] text-[#8b949e]">
                                    Unit #{ride.vehicle.vehicleId} • {ride.vehicle.bikeModel || ride.vehicle.autoModel || ride.vehicle.carModel || 'Standard'} ({getDriverDetails(ride).plateNumber})
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[#8b949e]">Unassigned</span>
                              )}
                            </td>

                            {/* Fare */}
                            <td className="px-6 py-4 font-bold text-white whitespace-nowrap text-sm">
                              ₹{ride.fare ? Number(ride.fare).toFixed(2) : '0.00'}
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                                  status === 'COMPLETED'
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                                    : isCompletable
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-800 animate-pulse'
                                    : 'bg-[#21262d] text-[#8b949e] border-[#30363d]'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    status === 'COMPLETED'
                                      ? 'bg-emerald-400'
                                      : isCompletable
                                      ? 'bg-amber-400'
                                      : 'bg-neutral-500'
                                  }`}
                                />
                                {status}
                              </span>
                            </td>

                            {/* ACTIONS (VIEW DETAILS, COMPLETE RIDE & DELETE RIDE) */}
                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedAuditRide(ride)}
                                className="px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-white border border-[#30363d] rounded-xl text-xs font-bold transition-all active:scale-95 inline-flex items-center gap-1 shadow-sm"
                                title="Inspect full ride details & telemetry"
                              >
                                👁️ Details
                              </button>
                              {isCompletable && (
                                <button
                                  onClick={() => handleCompleteRide(rideId)}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
                                  title="Mark this ride as completed"
                                >
                                  Complete Ride
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRide(rideId)}
                                className="px-3 py-1.5 bg-[#21262d] hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-800 border border-[#30363d] text-[#8b949e] rounded-xl text-xs font-bold transition-all active:scale-95"
                                title="Permanently delete this ride"
                              >
                                Delete Ride
                              </button>
                            </td>

                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-16 text-center text-sm text-[#8b949e]">
                          {isLoading ? 'Loading rides from database...' : 'No rides found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== VIEW 2: VEHICLES & DRIVERS (WITH 3D LOGOS) ===================== */}
        {activeTab === 'vehicles' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Division Selector Cards With Photorealistic 3D Renders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  type: 'CAR',
                  image: '/vehicle_car.jpg',
                  title: 'Executive Cars',
                  desc: 'Sedans & compact cabs',
                },
                {
                  type: 'AUTO',
                  image: '/vehicle_auto.jpg',
                  title: 'Auto Rickshaws',
                  desc: '3-wheeler city transit',
                },
                {
                  type: 'BIKE',
                  image: '/vehicle_moto.jpg',
                  title: 'Motorcycles / Bikes',
                  desc: 'Single-rider quick transit',
                },
              ].map((division) => {
                const isSelected = selectedVehicleType === division.type;

                return (
                  <button
                    key={division.type}
                    onClick={() => fetchVehicles(division.type)}
                    className={`p-6 rounded-3xl border text-left transition-all duration-300 shadow-xl relative overflow-hidden group ${
                      isSelected
                        ? 'bg-[#161b22] border-[#38bdf8] shadow-[#38bdf8]/15 ring-1 ring-[#38bdf8]'
                        : 'bg-[#161b22]/70 border-[#30363d] hover:border-[#8b949e]'
                    }`}
                  >
                    {/* 3D Photorealistic Vehicle Logo */}
                    <div className="w-20 h-14 rounded-2xl bg-white flex items-center justify-center p-1 shadow-md border border-white/20 mb-4 overflow-hidden group-hover:scale-105 transition-transform">
                      <img
                        src={division.image}
                        alt={division.title}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <h3 className="text-base font-extrabold text-white">{division.title}</h3>
                    <p className="text-xs text-[#8b949e] mt-1">{division.desc}</p>
                    
                    {isSelected && (
                      <span className="absolute top-4 right-4 text-[10px] uppercase font-bold tracking-wider text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-2.5 py-1 rounded-full">
                        Viewing
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Fleet Status Table */}
            <div className="bg-[#161b22]/80 backdrop-blur-xl border border-[#30363d] rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0d1117]/80 text-[11px] uppercase tracking-wider text-[#8b949e] border-b border-[#21262d]">
                      <th className="px-6 py-4 font-bold">Vehicle ID</th>
                      <th className="px-6 py-4 font-bold">Driver Name</th>
                      <th className="px-6 py-4 font-bold">Vehicle Model</th>
                      <th className="px-6 py-4 font-bold">Rating</th>
                      <th className="px-6 py-4 font-bold">Current GPS Location</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d] text-xs">
                    {vehicles.length > 0 ? (
                      vehicles.map((veh, idx) => {
                        const status = (veh.vehicleStatus || 'UNKNOWN').toUpperCase();
                        const isOnRide = status === 'ON_RIDE';

                        return (
                          <tr key={idx} className="hover:bg-[#1f242c] transition-colors">
                            
                            <td className="px-6 py-4 font-mono font-bold text-white whitespace-nowrap">
                              #{veh.vehicleId}
                            </td>

                            <td className="px-6 py-4 font-semibold text-white whitespace-nowrap">
                              {veh.driverName || 'Unassigned'}
                            </td>

                            <td className="px-6 py-4 text-[#c9d1d9] whitespace-nowrap">
                              <span className="font-semibold">{veh.model || veh.carModel || veh.autoModel || veh.bikeModel || 'Standard'}</span>
                              {veh.categoryOrSubType && (
                                <span className="ml-2 text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                                  {veh.categoryOrSubType}
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-amber-400 font-bold whitespace-nowrap">
                              ★ {veh.rating ? veh.rating.toFixed(1) : '5.0'}
                            </td>

                            <td className="px-6 py-4 font-mono text-[#8b949e] text-[11px] whitespace-nowrap">
                              {veh.currentLat ? `${veh.currentLat.toFixed(4)}, ${veh.currentLng.toFixed(4)}` : 'Stationary'}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                                  status === 'AVAILABLE'
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                                    : isOnRide
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-800 animate-pulse'
                                    : 'bg-rose-950/60 text-rose-300 border-rose-800'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    status === 'AVAILABLE'
                                      ? 'bg-emerald-400'
                                      : isOnRide
                                      ? 'bg-amber-400'
                                      : 'bg-rose-400'
                                  }`}
                                />
                                {status}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              {isOnRide ? (
                                <button
                                  onClick={() => handleCompleteFromFleet(veh.vehicleId, selectedVehicleType)}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
                                  title="Conclude trip and make driver available"
                                >
                                  Complete Ride
                                </button>
                              ) : (
                                <span className="text-[#8b949e] text-[11px]">Ready</span>
                              )}
                            </td>

                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-16 text-center text-sm text-[#8b949e]">
                          {isLoading ? 'Loading fleet status...' : 'Select a vehicle category above to view status.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      {/* RIDE AUDIT & DETAILS MODAL */}
      {selectedAuditRide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-[#161b22] border border-[#30363d] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-8 text-white">
            
            {/* Modal Header */}
            <div className="bg-[#0d1117] px-6 py-5 border-b border-[#30363d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">
                      Ride Audit #{selectedAuditRide.id || selectedAuditRide.rideId}
                    </h3>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        (selectedAuditRide.rideStatus || selectedAuditRide.status || '').toUpperCase() === 'COMPLETED'
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                          : 'bg-amber-950/60 text-amber-300 border-amber-800'
                      }`}
                    >
                      {selectedAuditRide.rideStatus || selectedAuditRide.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-[#8b949e] mt-0.5">
                    Start: {formatDateTime(selectedAuditRide.startTime)} • Concluded: {formatDateTime(selectedAuditRide.endTime)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                    showRawJson
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-[#21262d] text-[#8b949e] border-[#30363d] hover:text-white'
                  }`}
                  title="Toggle raw JSON payload from database"
                >
                  {'{ }'} JSON
                </button>
                <button
                  onClick={() => setSelectedAuditRide(null)}
                  className="w-8 h-8 rounded-full bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white flex items-center justify-center font-bold text-sm transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {showRawJson ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8b949e]">
                    <span>Raw Database Payload (Spring Boot Response)</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedAuditRide, null, 2))}
                      className="hover:text-white underline"
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="bg-[#0d1117] p-4 rounded-2xl border border-[#30363d] text-emerald-400 font-mono text-xs overflow-auto max-h-96">
                    {JSON.stringify(selectedAuditRide, null, 2)}
                  </pre>
                </div>
              ) : (
                <>
                  {/* Driver & Vehicle + Rider Specs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Vehicle & Driver Card */}
                    <div className="bg-[#0d1117] p-4 rounded-2xl border border-[#30363d] space-y-2">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e]">
                        Driver & Vehicle Assigned
                      </div>
                      {selectedAuditRide.vehicle ? (
                        (() => {
                          const auditDriver = getDriverDetails(selectedAuditRide, rides);
                          return (
                            <div>
                              <div className="text-base font-bold text-white flex items-center gap-1.5">
                                {auditDriver.name}
                                <span className="text-amber-400 text-xs">
                                  ★ {auditDriver.rating ? auditDriver.rating.toFixed(1) : '5.0'}
                                </span>
                                <span className="text-[#8b949e] text-[11px] font-normal">
                                  • {auditDriver.tripsCompleted} {auditDriver.tripsCompleted === 1 ? 'ride' : 'rides'}
                                </span>
                              </div>
                              <div className="text-xs text-[#8b949e] mt-0.5">
                                {auditDriver.model} • <strong className="font-mono text-white">{auditDriver.plateNumber}</strong>
                              </div>
                              <div className="text-[11px] text-[#8b949e] font-mono mt-1">
                                Status: <span className="text-emerald-400 font-bold">{selectedAuditRide.vehicle.vehicleStatus || 'READY'}</span>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-xs text-[#8b949e]">No vehicle unit assigned.</div>
                      )}
                    </div>

                    {/* Rider Card */}
                    <div className="bg-[#0d1117] p-4 rounded-2xl border border-[#30363d] space-y-2">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e]">
                        Customer / Rider Info
                      </div>
                      <div>
                        <div className="text-base font-bold text-white">
                          {selectedAuditRide.rider?.name || `Rider #${selectedAuditRide.rider?.riderID || selectedAuditRide.riderId || '1'}`}
                        </div>
                        <div className="text-xs text-[#8b949e] mt-0.5">
                          ID: #{selectedAuditRide.rider?.riderID || selectedAuditRide.riderId || '1'}
                        </div>
                        <div className="text-xs text-[#8b949e] font-mono mt-1">
                          Email: <span className="text-[#c9d1d9]">{selectedAuditRide.rider?.email || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Route & GPS Telemetry */}
                  <div className="space-y-4">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e]">
                      Route Breakdown & GPS Coordinates
                    </div>

                    <div className="relative pl-6 space-y-5 border-l-2 border-dashed border-[#30363d] ml-2">
                      {/* Pickup */}
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#161b22]" />
                        <div>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Pickup Point
                          </span>
                          <div className="text-xs font-bold text-white mt-1">
                            {auditPickupName || selectedAuditRide.pickupLocation || 'Pickup coordinates logged'}
                          </div>
                          {(selectedAuditRide.pickupLat || selectedAuditRide.pickupLatitude) && (
                            <div className="font-mono text-[10px] text-[#8b949e] mt-0.5">
                              GPS: {Number(selectedAuditRide.pickupLat || selectedAuditRide.pickupLatitude).toFixed(4)}°, {Number(selectedAuditRide.pickupLng || selectedAuditRide.pickupLongitude).toFixed(4)}°
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Distance */}
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d1117] text-[#c9d1d9] text-xs font-bold border border-[#30363d]">
                          <span>🛣️ Transit Distance:</span>
                          <strong className="text-white">
                            {selectedAuditRide.distanceKm ? `${Number(selectedAuditRide.distanceKm).toFixed(2)} km` : '—'}
                          </strong>
                        </span>
                      </div>

                      {/* Dropoff */}
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 bg-rose-400 border-2 border-[#161b22]" />
                        <div>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Dropoff Destination
                          </span>
                          <div className="text-xs font-bold text-white mt-1">
                            {auditDropName || selectedAuditRide.dropLocation || 'Destination coordinates logged'}
                          </div>
                          {(selectedAuditRide.dropLat || selectedAuditRide.dropLatitude) && (
                            <div className="font-mono text-[10px] text-[#8b949e] mt-0.5">
                              GPS: {Number(selectedAuditRide.dropLat || selectedAuditRide.dropLatitude).toFixed(4)}°, {Number(selectedAuditRide.dropLng || selectedAuditRide.dropLongitude).toFixed(4)}°
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* OpenStreetMap embed */}
                    {(selectedAuditRide.dropLat || selectedAuditRide.dropLatitude) && (
                      <div className="relative rounded-2xl overflow-hidden border border-[#30363d] h-40 bg-[#0d1117]">
                        <iframe
                          title="Audit Map"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min((selectedAuditRide.pickupLng || selectedAuditRide.pickupLongitude || 78.4), (selectedAuditRide.dropLng || selectedAuditRide.dropLongitude || 78.4)) - 0.015}%2C${Math.min((selectedAuditRide.pickupLat || selectedAuditRide.pickupLatitude || 17.4), (selectedAuditRide.dropLat || selectedAuditRide.dropLatitude || 17.4)) - 0.015}%2C${Math.max((selectedAuditRide.pickupLng || selectedAuditRide.pickupLongitude || 78.4), (selectedAuditRide.dropLng || selectedAuditRide.dropLongitude || 78.4)) + 0.015}%2C${Math.max((selectedAuditRide.pickupLat || selectedAuditRide.pickupLatitude || 17.4), (selectedAuditRide.dropLat || selectedAuditRide.dropLatitude || 17.4)) + 0.015}&layer=mapnik&marker=${selectedAuditRide.dropLat || selectedAuditRide.dropLatitude}%2C${selectedAuditRide.dropLng || selectedAuditRide.dropLongitude}`}
                          className="w-full h-full opacity-80"
                        />
                        <div className="absolute top-2 left-2 bg-[#161b22]/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold text-white border border-[#30363d] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Audit Map View
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Financial Settlement */}
                  <div className="bg-[#0d1117] p-4 rounded-2xl border border-[#30363d] space-y-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e]">
                      Financial Ledger & Settlement
                    </div>
                    <div className="flex justify-between items-center text-xs text-[#8b949e]">
                      <span>Base Flag-down</span>
                      <span className="text-white font-mono">₹50.00</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-[#8b949e]">
                      <span>Distance Charge</span>
                      <span className="text-white font-mono">
                        ₹{Math.max(0, (selectedAuditRide.fare || 0) - 50).toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[#21262d] flex justify-between items-center">
                      <span className="font-bold text-white text-sm">Settled Fare</span>
                      <span className="font-black text-emerald-400 text-lg">
                        ₹{Number(selectedAuditRide.fare || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* Modal Actions */}
            <div className="bg-[#0d1117] px-6 py-4 border-t border-[#30363d] flex items-center justify-between">
              <div className="space-x-2">
                {((selectedAuditRide.rideStatus || selectedAuditRide.status || '').toUpperCase() === 'ON_RIDE' ||
                  (selectedAuditRide.rideStatus || selectedAuditRide.status || '').toUpperCase() === 'ACCEPTED') && (
                  <button
                    onClick={async () => {
                      await handleCompleteRide(selectedAuditRide.id || selectedAuditRide.rideId);
                      setSelectedAuditRide(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
                  >
                    Complete Ride Now
                  </button>
                )}
                <button
                  onClick={async () => {
                    await handleDeleteRide(selectedAuditRide.id || selectedAuditRide.rideId);
                    setSelectedAuditRide(null);
                  }}
                  className="px-4 py-2 bg-[#21262d] hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-800 border border-[#30363d] text-[#8b949e] font-bold rounded-xl text-xs transition-all active:scale-95"
                >
                  Delete Ride
                </button>
              </div>

              <button
                onClick={() => setSelectedAuditRide(null)}
                className="px-6 py-2 bg-white hover:bg-neutral-200 text-black font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>
      )}

      </div>
    </div>
  );
}