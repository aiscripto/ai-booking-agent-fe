import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_TILE_URL } from '../../config/env';

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * A map where a click sets the business location. With no location yet it shows the whole world and
 * no pin (nothing is guessed). The map pictures come from OpenStreetMap.
 */
export const MapPicker: React.FC<MapPickerProps> = ({ latitude, longitude, onPick }) => {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Make the map once.
  useEffect(() => {
    if (!box.current) return;
    const created = L.map(box.current, { worldCopyJump: true }).setView([20, 0], 2);
    L.tileLayer(MAP_TILE_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(created);
    created.on('click', (e: L.LeafletMouseEvent) => {
      const wrapped = e.latlng.wrap();
      onPickRef.current(round(wrapped.lat), round(wrapped.lng));
    });
    map.current = created;
    return () => {
      created.remove();
      map.current = null;
      pin.current = null;
    };
  }, []);

  // Keep the pin in step with the fields.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (latitude === null || longitude === null) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    const point = L.latLng(latitude, longitude);
    if (pin.current) {
      pin.current.setLatLng(point);
    } else {
      pin.current = L.circleMarker(point, { radius: 9, color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 0.9, weight: 3 }).addTo(m);
      m.setView(point, Math.max(m.getZoom(), 14));
    }
  }, [latitude, longitude]);

  return <div ref={box} role="application" aria-label="Map: click to set the business location" className="h-full min-h-[18rem] w-full rounded-xl border border-slate-700 overflow-hidden z-0" />;
};
