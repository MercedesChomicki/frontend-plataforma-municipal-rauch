import { useEffect, useId, useRef, useState } from "react";
import * as L from "leaflet";

import "leaflet/dist/leaflet.css";
import "./LocationPicker.scss";

export interface LocationValue {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  address: string;
  onAddressChange: (address: string) => void;
  latitude: string;
  longitude: string;
  disabled?: boolean;
  onChange: (location: LocationValue) => void;
}

const RAUCH_CENTER: L.LatLngTuple = [-36.77526, -59.0862];

function parseLocation(
  latitude: string,
  longitude: string,
): LocationValue | null {
  if (!latitude.trim() || !longitude.trim()) return null;

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }

  return { latitude: lat, longitude: lng };
}

export default function LocationPicker({
  address,
  onAddressChange,
  latitude,
  longitude,
  disabled = false,
  onChange,
}: LocationPickerProps) {
  const helpId = useId();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const hasCenteredRef = useRef(false);

  const [tilesError, setTilesError] = useState(false);

  const location = parseLocation(latitude, longitude);
  const selectedLatitude = location?.latitude ?? null;
  const selectedLongitude = location?.longitude ?? null;

  useEffect(() => {
    onChangeRef.current = onChange;
    disabledRef.current = disabled;

    if (disabled) {
      markerRef.current?.dragging?.disable();
    } else {
      markerRef.current?.dragging?.enable();
    }
  }, [onChange, disabled]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const map = L.map(container, {
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: false,
      dragging: true,
      keyboard: true,
      worldCopyJump: true,
    }).setView(RAUCH_CENTER, 14);

    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    );

    tiles.on("tileerror", () => setTilesError(true));
    tiles.addTo(map);

    function selectLocation(event: L.LeafletMouseEvent) {
      if (disabledRef.current) return;

      const position = event.latlng.wrap();

      if (position.lat < -90 || position.lat > 90) return;

      onChangeRef.current({
        latitude: Number(position.lat.toFixed(6)),
        longitude: Number(position.lng.toFixed(6)),
      });
    }

    function handleWheel(event: WheelEvent) {
      // Ctrl o Cmd permite que Leaflet gestione el zoom.
      if (event.ctrlKey || event.metaKey) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? map.getSize().y
            : 1;

      map.panBy([event.deltaX * multiplier, event.deltaY * multiplier], {
        animate: false,
      });
    }

    map.on("click", selectLocation);

    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    observer.observe(container);
    mapRef.current = map;

    return () => {
      observer.disconnect();
      container.removeEventListener("wheel", handleWheel, true);

      map.remove();

      mapRef.current = null;
      markerRef.current = null;
      hasCenteredRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    if (selectedLatitude === null || selectedLongitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const position: L.LatLngTuple = [selectedLatitude, selectedLongitude];

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "location-picker__marker",
        html: "<span></span>",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(position, {
        icon,
        draggable: !disabledRef.current,
        keyboard: true,
        title: "Ubicación seleccionada",
        alt: "Ubicación seleccionada del evento",
      }).addTo(map);

      marker.on("dragend", () => {
        if (disabledRef.current) return;

        const nextPosition = marker.getLatLng().wrap();

        // Impide conservar una ubicación fuera del rango admitido.
        if (nextPosition.lat < -90 || nextPosition.lat > 90) {
          marker.setLatLng(position);
          return;
        }

        onChangeRef.current({
          latitude: Number(nextPosition.lat.toFixed(6)),
          longitude: Number(nextPosition.lng.toFixed(6)),
        });
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(position);
    }

    if (!hasCenteredRef.current) {
      map.setView(position, 16, { animate: false });
      hasCenteredRef.current = true;
    } else if (!map.getBounds().contains(position)) {
      map.panTo(position, { animate: false });
    }
  }, [selectedLatitude, selectedLongitude]);

  return (
    <div className="location-picker" aria-disabled={disabled}>
      <label>
        Dirección o referencia de ubicación *
        <input
          type="text"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          disabled={disabled}
          required
        />
      </label>
      <p id={helpId} className="location-picker__help">
        Hacé clic para seleccionar la ubicación o arrastrá el marcador para
        ajustarla. Deslizá dos dedos para desplazarte y mantené Ctrl para
        acercar o alejar.
      </p>

      <div
        ref={containerRef}
        className="location-picker__map"
        role="region"
        aria-label="Seleccionar ubicación del evento"
        aria-describedby={helpId}
      />

      <p className="location-picker__status" role="status">
        {location
          ? `Ubicación seleccionada: ${location.latitude}, ${location.longitude}.`
          : "Seleccioná una ubicación en el mapa o completá las coordenadas."}
      </p>

      <p className="location-picker__note">
        La dirección se completa manualmente. Mover el marcador no modifica ese
        campo.
      </p>

      {tilesError && (
        <p className="location-picker__error" role="status">
          No pudimos cargar parte del mapa. Podés completar las coordenadas
          manualmente.
        </p>
      )}
    </div>
  );
}
