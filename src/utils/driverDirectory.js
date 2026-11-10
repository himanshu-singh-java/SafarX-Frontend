/**
 * SafarX Driver Directory & Resolution Engine
 * Maps vehicle ID, registration plate number, or driver ID to the driver's real identity,
 * ratings, vehicle details, and dynamic trip counts calculated from the database.
 */

const DEFAULT_DRIVERS = {
  1: {
    driverId: 1,
    name: 'Vishal Singh',
    rating: 5.0,
    tripsCompleted: 5,
    model: 'Mahindra Scorpio N (Black)',
    plateNumber: 'BR-08-2882',
    category: 'SUV',
    vehicleType: 'CAR',
    avatar: '👨‍✈️',
    isVerified: true,
  },
  2: {
    driverId: 2,
    name: 'Kalu Singh',
    rating: 5.0,
    tripsCompleted: 4,
    model: 'Honda Activa (Scooter)',
    plateNumber: 'TS-09-KL-2026',
    category: 'MOTO',
    vehicleType: 'BIKE',
    avatar: '🏍️',
    isVerified: true,
  },
  3: {
    driverId: 3,
    name: 'Ghoda kumar',
    rating: 5.0,
    tripsCompleted: 5,
    model: 'Hero Splendor Plus',
    plateNumber: 'TS-09-GK-2026',
    category: 'MOTO',
    vehicleType: 'BIKE',
    avatar: '🏍️',
    isVerified: true,
  },
  5: {
    driverId: 5,
    name: 'Sheru',
    rating: 5.0,
    tripsCompleted: 6,
    model: 'BMW',
    plateNumber: 'BMW-TS-2026',
    category: 'SEDAN',
    vehicleType: 'CAR',
    avatar: '🏎️',
    isVerified: true,
  },
  11: {
    driverId: 11,
    name: 'Rajesh Khanna',
    rating: 4.9,
    tripsCompleted: 3,
    model: 'Maruti Suzuki Dzire',
    plateNumber: 'DL-8C-CC-3001',
    category: 'SEDAN',
    vehicleType: 'CAR',
    avatar: '👨‍✈️',
    isVerified: true,
  },
  6: {
    driverId: 6,
    name: 'Sunil Verma',
    rating: 4.8,
    tripsCompleted: 2,
    model: 'Hero Splendor Plus',
    plateNumber: 'DL-3S-BB-2001',
    category: 'MOTO',
    vehicleType: 'BIKE',
    avatar: '🏍️',
    isVerified: true,
  },
  16: {
    driverId: 16,
    name: 'Himanshu Singh',
    rating: 5.0,
    tripsCompleted: 6,
    model: 'SafarX Prime Cab',
    plateNumber: 'TS-09-UB-8888',
    category: 'PRIME',
    vehicleType: 'CAR',
    avatar: '👨‍✈️',
    isVerified: true,
  },
  21: {
    driverId: 21,
    name: 'Ramesh Auto',
    rating: 4.85,
    tripsCompleted: 4,
    model: 'Bajaj RE Compact',
    plateNumber: 'DL-1R-AA-1001',
    category: 'AUTO',
    vehicleType: 'AUTO',
    avatar: '🛺',
    isVerified: true,
  },
};

export function registerDriverProfile(driverData) {
  if (!driverData) return;
  try {
    const raw = localStorage.getItem('safarx_drivers_registry');
    const registry = raw ? JSON.parse(raw) : {};
    const key = String(driverData.driverId || driverData.id || driverData.plateNumber);
    registry[key] = {
      ...driverData,
      driverId: driverData.driverId || driverData.id,
      name: driverData.name || driverData.driverName || 'Driver Partner',
      rating: driverData.rating || 5.0,
      tripsCompleted: driverData.tripsCompleted || 5,
      model: driverData.model || driverData.carModel || driverData.bikeModel || driverData.autoModel || 'Comfort Cab',
      plateNumber: (driverData.plateNumber || '').toUpperCase().trim(),
      vehicleType: driverData.vehicleType || 'CAR',
      isVerified: true,
    };
    localStorage.setItem('safarx_drivers_registry', JSON.stringify(registry));
  } catch (e) {
    console.warn('Error saving to driver registry:', e);
  }
}

export function getDriverDetails(rideOrVehicle, ridesList = []) {
  const v = rideOrVehicle?.vehicle || rideOrVehicle || {};
  const plate = (v.plateNumber || rideOrVehicle?.plateNumber || '').toUpperCase().trim();
  const vId = Number(v.vehicleId || rideOrVehicle?.vehicleId || rideOrVehicle?.driverId || 0);
  const modelName = v.carModel || v.autoModel || v.bikeModel || rideOrVehicle?.model || '';

  // Calculate dynamic trips count from real database rides if passed
  let dynamicTrips = 0;
  if (Array.isArray(ridesList) && ridesList.length > 0) {
    dynamicTrips = ridesList.filter((r) => {
      const isCompleted = (r.rideStatus || r.status || '').toUpperCase() === 'COMPLETED';
      const matchVehicle =
        (r.vehicle?.vehicleId && vId && r.vehicle.vehicleId === vId) ||
        (r.vehicle?.plateNumber && plate && r.vehicle.plateNumber.toUpperCase().trim() === plate);
      return isCompleted && matchVehicle;
    }).length;
  }

  // 1. Check dynamic local storage registry
  try {
    const raw = localStorage.getItem('safarx_drivers_registry');
    if (raw) {
      const reg = JSON.parse(raw);
      let match = null;
      if (vId && reg[vId]) match = reg[vId];
      else if (plate) {
        match = Object.values(reg).find((d) => d.plateNumber && d.plateNumber.toUpperCase().trim() === plate);
      }
      if (match) {
        return {
          ...match,
          tripsCompleted: dynamicTrips > 0 ? dynamicTrips : (match.tripsCompleted || 5),
        };
      }
    }
  } catch (e) {}

  let base = null;
  // 2. Direct match by vehicleId or known DB seeds
  if (vId === 1 || plate.includes('BR-08') || plate.includes('2882') || modelName.toLowerCase().includes('scorpio')) {
    base = { ...DEFAULT_DRIVERS[1] };
  } else if (vId === 2 || plate.includes('TS-09-KL') || modelName.toLowerCase().includes('activa') || (rideOrVehicle?.name && rideOrVehicle.name.toLowerCase().includes('kalu'))) {
    base = { ...DEFAULT_DRIVERS[2] };
  } else if (vId === 3 || plate.includes('TS-09-GK') || (rideOrVehicle?.name && (rideOrVehicle.name.toLowerCase().includes('ghoda') || rideOrVehicle.name.toLowerCase().includes('harsh')))) {
    base = { ...DEFAULT_DRIVERS[3] };
  } else if (vId === 11 || plate.includes('DL-8C') || plate.includes('3001') || modelName.toLowerCase().includes('dzire')) {
    base = { ...DEFAULT_DRIVERS[11] };
  } else if (vId === 6 || plate.includes('DL-3S') || plate.includes('2001') || modelName.toLowerCase().includes('splendor')) {
    base = { ...DEFAULT_DRIVERS[6] };
  } else if (vId === 16 || plate.includes('TS-09') || plate.includes('8888')) {
    base = { ...DEFAULT_DRIVERS[16] };
  } else if (vId === 21 || plate.includes('DL-1R') || plate.includes('1001') || modelName.toLowerCase().includes('auto')) {
    base = { ...DEFAULT_DRIVERS[21] };
  } else {
    base = {
      driverId: vId || 1,
      name: v.driverName || rideOrVehicle?.driverName || 'Vishal Singh',
      rating: v.rating || 5.0,
      model: modelName || (v.carCategory ? `SafarX ${v.carCategory}` : 'Mahindra Scorpio N'),
      plateNumber: plate || 'BR-08-2882',
      category: v.carCategory || 'SUV',
      vehicleType: v.carModel ? 'CAR' : v.autoModel ? 'AUTO' : v.bikeModel ? 'BIKE' : 'CAR',
      avatar: '👨‍✈️',
      isVerified: true,
    };
  }

  // Set real trip count from DB
  base.tripsCompleted = dynamicTrips > 0 ? dynamicTrips : 5;
  return base;
}

export default {
  getDriverDetails,
  registerDriverProfile,
};
