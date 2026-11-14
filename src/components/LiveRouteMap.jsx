import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { getDriverDetails } from '../utils/driverDirectory';

export default function LiveRouteMap({
  pickupCoords,
  dropCoords,
  pickupText,
  dropText,
  liveDriverGps,
  activeRide,
  vehicleType = 'CAR',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const mainRouteLineRef = useRef(null);
  const driverRouteLineRef = useRef(null);

  const normalizedType = (vehicleType || '').toUpperCase();
  const vehicleImg =
    normalizedType === 'BIKE'
      ? '/vehicle_moto.jpg'
      : normalizedType === 'AUTO'
      ? '/vehicle_auto.jpg'
      : '/vehicle_car.jpg';

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [pickupCoords.lat || 17.385, pickupCoords.lng || 78.4867],
        zoom: 13,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapRef.current = map;

      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 150);
    }

    let resizeTimer;
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ pan: false });
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize({ pan: false });
          }
        }, 120);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        pickupMarkerRef.current = null;
        dropMarkerRef.current = null;
        driverMarkerRef.current = null;
        mainRouteLineRef.current = null;
        driverRouteLineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.invalidateSize();
    const t1 = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 100);
    const t2 = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        const points = [];
        if (liveDriverGps?.lat && liveDriverGps?.lng) {
          points.push([liveDriverGps.lat, liveDriverGps.lng]);
        }
        if (pickupCoords?.lat && pickupCoords?.lng) {
          points.push([pickupCoords.lat, pickupCoords.lng]);
        }
        if (dropCoords?.lat && dropCoords?.lng) {
          points.push([dropCoords.lat, dropCoords.lng]);
        }
        if (points.length >= 2) {
          mapRef.current.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 15 });
        }
      }
    }, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeRide, pickupCoords, dropCoords, liveDriverGps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickupCoords?.lat || !dropCoords?.lat) return;

    const pLat = pickupCoords.lat;
    const pLng = pickupCoords.lng;
    const dLat = dropCoords.lat;
    const dLng = dropCoords.lng;

    const pickupIcon = L.divIcon({
      className: 'safarx-pickup-pin',
      html: `
        <div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#000000;border:3px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.4);">
          <div style="width:6px;height:6px;border-radius:50%;background:#ffffff;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const pickupLabel = pickupText ? pickupText.split(',')[0].trim() : 'Pickup';
    const dropLabel = dropText ? dropText.split(',')[0].trim() : 'Destination';

    if (!pickupMarkerRef.current) {
      pickupMarkerRef.current = L.marker([pLat, pLng], { icon: pickupIcon }).addTo(map);
    } else {
      pickupMarkerRef.current.setLatLng([pLat, pLng]);
    }
    pickupMarkerRef.current.unbindTooltip();
    pickupMarkerRef.current.bindTooltip(
      `<div style="display:flex;align-items:center;gap:4px;font-weight:800;font-size:11px;white-space:nowrap;">
        <span>From ${pickupLabel}</span>
        <span style="font-size:12px;opacity:0.8;">›</span>
      </div>`,
      {
        direction: 'top',
        offset: [0, -12],
        className: 'safarx-map-tooltip',
        permanent: true,
      }
    );

    const dropIcon = L.divIcon({
      className: 'safarx-drop-pin',
      html: `
        <div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;background:#000000;border:3px solid #ffffff;box-shadow:0 3px 8px rgba(0,0,0,0.4);">
          <div style="width:6px;height:6px;background:#ffffff;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (!dropMarkerRef.current) {
      dropMarkerRef.current = L.marker([dLat, dLng], { icon: dropIcon }).addTo(map);
    } else {
      dropMarkerRef.current.setLatLng([dLat, dLng]);
    }
    dropMarkerRef.current.unbindTooltip();
    dropMarkerRef.current.bindTooltip(
      `<div style="display:flex;align-items:center;gap:4px;font-weight:800;font-size:11px;white-space:nowrap;">
        <span>To ${dropLabel}</span>
        <span style="font-size:12px;opacity:0.8;">›</span>
      </div>`,
      {
        direction: 'bottom',
        offset: [0, 12],
        className: 'safarx-map-tooltip',
        permanent: true,
      }
    );

    const routeCoords = [
      [pLat, pLng],
      [dLat, dLng],
    ];

    if (!mainRouteLineRef.current) {
      mainRouteLineRef.current = L.polyline(routeCoords, {
        color: '#000000',
        weight: 4,
        opacity: 0.65,
        dashArray: '6, 8',
      }).addTo(map);
    } else {
      mainRouteLineRef.current.setLatLngs(routeCoords);
    }

    if (!liveDriverGps) {
      const bounds = L.latLngBounds([
        [pLat, pLng],
        [dLat, dLng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [pickupCoords, dropCoords, pickupText, dropText, liveDriverGps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!liveDriverGps?.lat || !liveDriverGps?.lng) {
      if (driverMarkerRef.current) {
        map.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
      if (driverRouteLineRef.current) {
        map.removeLayer(driverRouteLineRef.current);
        driverRouteLineRef.current = null;
      }
      return;
    }

    const { lat, lng } = liveDriverGps;
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
      '';

    const driverBadgeText = driverPlate && driverPlate !== '—' ? `${driverName} • ${driverPlate}` : driverName;

    const effectiveType = (
      driverInfo?.vehicleType ||
      activeRide?.vehicleType ||
      vehicleType ||
      'CAR'
    ).toUpperCase();

    const currentVehicleImg =
      effectiveType === 'BIKE'
        ? '/vehicle_moto.jpg'
        : effectiveType === 'AUTO'
        ? '/vehicle_auto.jpg'
        : '/vehicle_car.jpg';

    const driverIcon = L.divIcon({
      className: 'safarx-live-driver-marker',
      html: `
        <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
          <!-- Glowing Pulsing Radar Wave -->
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(16,185,129,0.35);animation:safarx-ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <!-- Real 3D Vehicle Disc Badge -->
          <div style="position:relative;width:40px;height:40px;border-radius:50%;background:#ffffff;border:3px solid #10b981;box-shadow:0 6px 18px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:2px;z-index:10;">
            <img src="${currentVehicleImg}" alt="Driver" style="width:100%;height:100%;object-fit:contain;" />
          </div>
          <!-- Live Floating Badge -->
          <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:#000000;color:#ffffff;font-size:9px;font-weight:900;padding:2px 7px;border-radius:999px;white-space:nowrap;border:1px solid #10b981;letter-spacing:0.4px;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:20;">
            ${driverBadgeText}
          </div>
        </div>
      `,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
    });

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([lat, lng], {
        icon: driverIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      driverMarkerRef.current.setIcon(driverIcon);
      driverMarkerRef.current.setLatLng([lat, lng]);
    }

    const targetDropLat = dropCoords?.lat || pickupCoords?.lat;
    const targetDropLng = dropCoords?.lng || pickupCoords?.lng;

    if (targetDropLat && targetDropLng) {
      const driverPath = [
        [lat, lng],
        [targetDropLat, targetDropLng],
      ];
      if (!driverRouteLineRef.current) {
        driverRouteLineRef.current = L.polyline(driverPath, {
          color: '#10b981',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
        }).addTo(map);
      } else {
        driverRouteLineRef.current.setLatLngs(driverPath);
      }
    }

    const allPoints = [[lat, lng]];
    if (pickupCoords?.lat) allPoints.push([pickupCoords.lat, pickupCoords.lng]);
    if (dropCoords?.lat) allPoints.push([dropCoords.lat, dropCoords.lng]);

    const liveBounds = L.latLngBounds(allPoints);
    map.fitBounds(liveBounds, { padding: [70, 70], maxZoom: 16 });
  }, [liveDriverGps, dropCoords, pickupCoords, vehicleType, activeRide]);

  return (
    <div className="w-full h-full relative select-none isolate z-0">
      <style>{`
        @keyframes safarx-ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .safarx-map-tooltip {
          background: #000000 !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 8px !important;
          font-weight: 800 !important;
          font-size: 11px !important;
          padding: 3px 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .safarx-map-tooltip::before {
          border-top-color: #000000 !important;
        }
      `}</style>
      
      
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
