import { useCallback, useEffect, useId, useRef, useState } from "react";
import * as L from "leaflet";
import {
  GeocodingError,
  searchAddress,
  reverseGeocode,
} from "../../../services/geocodingService";

import type { GeocodedLocation } from "../../../services/geocodingService";

import "leaflet/dist/leaflet.css";
import "./LocationPicker.scss";

export interface LocationValue {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  accessToken: string;
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

function normalizeStreet(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/^(avenida|avda|av|calle)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function requestedAddress(
  query: string,
): { street: string; number: string } | null {
  const addressPart = query.split(",")[0].trim();
  const match = addressPart.match(/^(.+?)\s+(\d{1,5})$/);

  if (!match) return null;

  return {
    street: match[1],
    number: match[2],
  };
}

function unverifiedNumberMessage(
  query: string,
  results: GeocodedLocation[],
): string | null {
  const requested = requestedAddress(query);

  if (!requested) return null;

  const sameStreet = results.filter(
    (result) =>
      result.calle &&
      normalizeStreet(result.calle) === normalizeStreet(requested.street),
  );

  if (sameStreet.length === 0) return null;

  const hasVerifiedNumber = sameStreet.some(
    (result) =>
      result.verificacion === "verificada" &&
      result.altura?.trim() === requested.number,
  );

  if (hasVerifiedNumber) return null;

  return (
    `Se encontró ${sameStreet[0].calle}, pero no se pudo ` +
    `verificar el número ${requested.number}. ` +
    "Las opciones permiten ubicar un punto aproximado sobre la calle."
  );
}

export default function LocationPicker({
  accessToken,
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

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodedLocation[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState("");

  const searchControllerRef = useRef<AbortController | null>(null);

  const reverseControllerRef = useRef<AbortController | null>(null);
  const onAddressChangeRef = useRef(onAddressChange);

  const currentLocationRef = useRef({
    latitude,
    longitude,
  });

  const location = parseLocation(latitude, longitude);
  const selectedLatitude = location?.latitude ?? null;
  const selectedLongitude = location?.longitude ?? null;

  useEffect(() => {
    onChangeRef.current = onChange;
    onAddressChangeRef.current = onAddressChange;
    disabledRef.current = disabled;

    currentLocationRef.current = {
      latitude,
      longitude,
    };

    if (disabled) {
      markerRef.current?.dragging?.disable();
    } else {
      markerRef.current?.dragging?.enable();
    }
  }, [onChange, onAddressChange, disabled, latitude, longitude]);

  const selectPointAndFindAddress = useCallback(
    async (point: LocationValue) => {
      if (disabledRef.current) return;

      // Una nueva selección reemplaza cualquier búsqueda anterior.
      searchControllerRef.current?.abort();
      reverseControllerRef.current?.abort();

      setIsSearching(false);
      setSearchResults([]);
      setSearchedQuery("");

      // Las coordenadas se actualizan inmediatamente.
      onChangeRef.current(point);

      const controller = new AbortController();
      reverseControllerRef.current = controller;

      setSearchMessage("Buscando una dirección cercana al punto…");

      try {
        const result = await reverseGeocode(
          accessToken,
          point.latitude,
          point.longitude,
          controller.signal,
        );

        if (controller.signal.aborted || disabledRef.current) return;

        // Si se modificaron o quitaron las coordenadas mientras
        // esperábamos, no aplicamos la respuesta anterior.
        const current = parseLocation(
          currentLocationRef.current.latitude,
          currentLocationRef.current.longitude,
        );

        if (
          !current ||
          current.latitude !== point.latitude ||
          current.longitude !== point.longitude
        ) {
          setSearchMessage(
            "La ubicación cambió. No se aplicó la dirección de la consulta anterior.",
          );
          return;
        }

        if (!result.encontrada || !result.ubicacion) {
          setSearchMessage(
            "No encontramos una dirección para ese punto dentro de Rauch. Se conservaron las coordenadas y la dirección escrita.",
          );
          return;
        }

        onAddressChangeRef.current(result.ubicacion.direccion);

        setSearchMessage(
          "Se completó una dirección sugerida cercana al punto. Revisala: no verifica el domicilio exacto. Las coordenadas elegidas se conservaron.",
        );
      } catch (err: unknown) {
        if (controller.signal.aborted || disabledRef.current) return;

        setSearchMessage(
          err instanceof GeocodingError
            ? err.message
            : "No pudimos consultar la dirección. Se conservaron el punto seleccionado y la dirección escrita.",
        );
      }
    },
    [accessToken],
  );

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

      void selectPointAndFindAddress({
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
  }, [selectPointAndFindAddress]);

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

        void selectPointAndFindAddress({
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
  }, [selectedLatitude, selectedLongitude, selectPointAndFindAddress]);

  useEffect(() => {
    return () => {
      searchControllerRef.current?.abort();
      reverseControllerRef.current?.abort();
    };
  }, [accessToken, disabled]);

  function changeAddress(value: string) {
    searchControllerRef.current?.abort();
    reverseControllerRef.current?.abort();
    setIsSearching(false);
    setSearchResults([]);
    setSearchMessage(null);
    setSearchedQuery("");
    onAddressChange(value);
  }

  async function handleSearch() {
    const query = address.trim();

    if (disabled || isSearching || query.length < 3) return;

    searchControllerRef.current?.abort();
    reverseControllerRef.current?.abort();

    const controller = new AbortController();
    searchControllerRef.current = controller;

    setIsSearching(true);
    setSearchResults([]);
    setSearchMessage(null);
    setSearchedQuery(query);

    try {
      const results = await searchAddress(
        accessToken,
        query,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      setSearchResults(results);

      const numberMessage = unverifiedNumberMessage(query, results);

      setSearchMessage(
        results.length === 0
          ? "No encontramos coincidencias. No se pudo verificar la dirección con el servicio de búsqueda."
          : (numberMessage ??
              "Elegí una coincidencia. Los resultados aproximados no verifican la calle y altura solicitadas."),
      );
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      setSearchMessage(
        err instanceof GeocodingError
          ? err.message
          : "No pudimos conectar con la búsqueda. Podés completar la ubicación manualmente.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }

  function chooseLocation(result: GeocodedLocation) {
    if (disabled) return;

    reverseControllerRef.current?.abort();

    const verified = result.verificacion === "verificada";

    // Solo reemplazamos la dirección si el resultado está verificado.
    // Si es aproximado, conservamos el texto y la altura ingresados.
    if (verified) {
      onAddressChange(result.direccion);
    }

    onChange({
      latitude: result.latitud,
      longitude: result.longitud,
    });

    mapRef.current?.setView([result.latitud, result.longitud], 16, {
      animate: false,
    });

    setSearchResults([]);

    setSearchMessage(
      verified
        ? "La calle y la altura coinciden con los datos del proveedor. Revisá el punto seleccionado."
        : (unverifiedNumberMessage(searchedQuery, [result]) ??
            "Seleccionaste una ubicación aproximada. Se conservó la dirección escrita; ese punto no verifica el domicilio."),
    );
  }

  return (
    <div className="location-picker" aria-disabled={disabled}>
      <div className="location-picker__search">
        <label>
          Dirección o referencia de ubicación *
          <input
            type="text"
            value={address}
            onChange={(event) => changeAddress(event.target.value)}
            disabled={disabled}
            required
          />
        </label>

        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={
            disabled ||
            isSearching ||
            address.trim().length < 3 ||
            address.trim().length > 200
          }
        >
          {isSearching ? "Buscando…" : "Buscar dirección"}
        </button>
      </div>

      {searchMessage && (
        <p className="location-picker__note" role="status">
          {searchMessage}
        </p>
      )}

      {searchResults.length > 0 && (
        <ul
          className="location-picker__results"
          aria-label="Direcciones encontradas"
        >
          {searchResults.map((result) => (
            <li
              key={`${result.direccion}-${result.latitud}-${result.longitud}`}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => chooseLocation(result)}
              >
                <span>{result.direccion}</span>

                {result.barrio && <small>Barrio o zona: {result.barrio}</small>}

                {result.nombre && <small>Referencia: {result.nombre}</small>}

                <small>
                  {result.verificacion === "verificada"
                    ? "Calle y altura coinciden con el proveedor"
                    : "Ubicación aproximada · altura no verificada"}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
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
        Buscá una dirección o seleccioná un punto en el mapa. Al hacer clic o
        terminar de arrastrar el marcador, se intentará completar una dirección
        cercana. Revisá la sugerencia: no garantiza el domicilio exacto.
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
