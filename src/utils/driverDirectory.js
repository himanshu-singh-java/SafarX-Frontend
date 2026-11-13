/**
 * Driver directory and profile resolution utilities.
 */

try {
  const raw = localStorage.getItem('safarx_drivers_registry');
  if (raw && (raw.includes('Vishal') || raw.includes('vishal'))) {
    const reg = JSON.parse(raw);
    let changed = false;
    for (const key of Object.keys(reg)) {
      if (reg[key]?.name && reg[key].name.toLowerCase().includes('vishal')) {
        delete reg[key];
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem('safarx_drivers_registry', JSON.stringify(reg));
    }
  }
} catch (e) {}

export function registerDriverProfile(driverData) {
  if (!driverData) return;
  try {
    const raw = localStorage.getItem('safarx_drivers_registry');
    const registry = raw ? JSON.parse(raw) : {};
    const key = String(driverData.driverId || driverData.id || driverData.plateNumber);
    if (!key || key === 'undefined' || key === 'null') return;

    registry[key] = {
      ...driverData,
      driverId: driverData.driverId || driverData.id,
      name: (driverData.name || driverData.driverName || '').trim(),
      rating: driverData.rating || 5.0,
      tripsCompleted: driverData.tripsCompleted || 5,
      model: driverData.model || driverData.carModel || driverData.bikeModel || driverData.autoModel || 'Comfort Cab',
      plateNumber: (driverData.plateNumber || '').toUpperCase().trim(),
      vehicleType: (driverData.vehicleType || 'CAR').toUpperCase(),
      phone: driverData.phone || driverData.phoneNumber || '',
      isVerified: true,
    };
    localStorage.setItem('safarx_drivers_registry', JSON.stringify(registry));
  } catch (e) {
    console.warn('Error saving to driver registry:', e);
  }
}

export function getDriverDetails(rideOrVehicle, ridesList = []) {
  const d = rideOrVehicle?.driver || rideOrVehicle?.vehicle?.driver || {};
  const v = rideOrVehicle?.vehicle || rideOrVehicle || {};

  const driverId = Number(d.id || d.driverId || rideOrVehicle?.driverId || v.driverId || 0);
  const plate = (d.vehicleNumber || d.plateNumber || rideOrVehicle?.vehicleNumber || rideOrVehicle?.plateNumber || v.plateNumber || '').toUpperCase().trim();
  let rawName = (d.name || d.driverName || d.fullName || rideOrVehicle?.driverName || rideOrVehicle?.driver?.name || v.driverName || '').trim();
  const modelName = d.model || d.vehicleModel || rideOrVehicle?.vehicleModel || rideOrVehicle?.model || v.carModel || v.autoModel || v.bikeModel || '';
  const vehicleType = (d.vehicleType || rideOrVehicle?.vehicleType || v.vehicleType || (v.carModel ? 'CAR' : v.autoModel ? 'AUTO' : v.bikeModel ? 'BIKE' : 'CAR')).toUpperCase();
  const phone = d.phone || d.phoneNumber || rideOrVehicle?.driverPhone || rideOrVehicle?.driver?.phone || '';
  const rating = Number(d.rating || rideOrVehicle?.driverRating || rideOrVehicle?.driver?.rating || v.rating || 5.0) || 5.0;

  let dynamicTrips = 0;
  if (Array.isArray(ridesList) && ridesList.length > 0) {
    dynamicTrips = ridesList.filter((r) => {
      const isCompleted = (r.rideStatus || r.status || '').toUpperCase() === 'COMPLETED';
      const matchVehicle =
        (r.vehicle?.vehicleId && driverId && r.vehicle.vehicleId === driverId) ||
        (r.vehicle?.plateNumber && plate && r.vehicle.plateNumber.toUpperCase().trim() === plate);
      return isCompleted && matchVehicle;
    }).length;
  }

  const resolvedName = rawName || (driverId > 0 ? `Driver #${driverId}` : 'Driver Partner');
  const resolvedModel = modelName || (vehicleType === 'BIKE' ? 'Hero Splendor Plus' : vehicleType === 'AUTO' ? 'Bajaj RE Compact' : 'Maruti Suzuki Dzire');

  return {
    driverId: driverId || 1,
    name: resolvedName,
    rating: rating,
    tripsCompleted: dynamicTrips > 0 ? dynamicTrips : 5,
    model: resolvedModel,
    plateNumber: plate || '—',
    vehicleType: vehicleType,
    phone: phone,
    avatar: vehicleType === 'BIKE' ? '🏍️' : vehicleType === 'AUTO' ? '🛺' : '🚗',
    isVerified: true,
  };
}

export default {
  getDriverDetails,
  registerDriverProfile,
};
