import { useEffect, useId, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet.markercluster";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import type { EventRecord } from "../../../services/eventsService";

interface EventsMapProps {
  events: EventRecord[];
  onSelect: (event: EventRecord) => void;
}

const RAUCH_CENTER: L.LatLngTuple = [-36.77526, -59.0862];

function markerColor(status: string): string {
  switch (status) {
    case "abierto":
      return "#b77900";
    case "cerrado":
      return "#16804a";
    case "anulado":
      return "#b91c1c";
    default:
      return "#64748b";
  }
}

export default function EventsMap({ events, onSelect }: EventsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  const [tilesError, setTilesError] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapId = useId();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      dragging: true,
      keyboard: true,
    }).setView(RAUCH_CENTER, 14);

    const container = containerRef.current;

    function handleWheel(event: WheelEvent) {
      // Deja que Leaflet gestione el zoom con Ctrl o Cmd.
      // Algunos mousepads también envían Ctrl al hacer el gesto de pinza.
      if (event.ctrlKey || event.metaKey) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      // Normaliza dispositivos que expresan el movimiento en líneas o páginas.
      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? container.clientHeight
            : 1;

      map.panBy([event.deltaX * multiplier, event.deltaY * multiplier], {
        animate: false,
      });
    }

    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    );

    tiles.on("tileerror", () => {
      setTilesError(true);
    });

    tiles.addTo(map);

    const clusters = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 45,
    });

    clusters.addTo(map);

    mapRef.current = map;
    clusterRef.current = clusters;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    observer.observe(containerRef.current);

    return () => {
      container.removeEventListener('wheel', handleWheel, true);
      
      observer.disconnect();
      map.remove();

      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const clusters = clusterRef.current;

    if (!map || !clusters) return;

    clusters.clearLayers();

    for (const event of events) {
      const color = markerColor(event.estado);

      const icon = L.divIcon({
        className: "events-map-marker",
        html: `<span style="background:${color}"></span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([event.latitud, event.longitud], {
        icon,
        keyboard: true,
        title: `Evento N.º ${event.numero_evento}`,
        alt: `Evento N.º ${event.numero_evento}`,
      });

      // textContent evita interpretar datos del evento como HTML.
      const tooltip = document.createElement("span");

      tooltip.textContent =
        `Evento N.º ${event.numero_evento} · ` +
        event.tipo_evento.replace(/_/g, " ");

      marker.bindTooltip(tooltip);

      marker.on("click", () => {
        onSelect(event);
      });

      clusters.addLayer(marker);
    }

    if (events.length > 0) {
      map.fitBounds(clusters.getBounds(), {
        padding: [40, 40],
        maxZoom: 16,
      });
    } else {
      map.setView(RAUCH_CENTER, 14);
    }
  }, [events, onSelect]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);

      requestAnimationFrame(() => {
        mapRef.current?.invalidateSize();
      });
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    const wrapper = wrapperRef.current;

    if (!wrapper) return;

    setFullscreenError(null);

    try {
      if (document.fullscreenElement === wrapper) {
        await document.exitFullscreen();
      } else if (document.fullscreenEnabled) {
        await wrapper.requestFullscreen();
      } else {
        setFullscreenError(
          "Tu navegador no permite ampliar el mapa a pantalla completa.",
        );
      }
    } catch {
      setFullscreenError("No pudimos ampliar el mapa. Intentá nuevamente.");
    }
  }

  return (
    <div ref={wrapperRef} className="events-map">
      <div className="events-map__toolbar">
        <p>
          Arrastrá o deslizá dos dedos sobre el mousepad para desplazarte. Usá la rueda del mouse o el gesto de
          desplazamiento del mousepad para acercar y alejar.
        </p>

        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-controls={mapId}
          aria-label={
            isFullscreen
              ? "Salir del mapa en pantalla completa"
              : "Abrir mapa en pantalla completa"
          }
        >
          {isFullscreen ? "Salir de pantalla completa" : "Ampliar mapa"}
        </button>
      </div>

      {fullscreenError && (
        <p className="map-page__notice" role="alert">
          {fullscreenError}
        </p>
      )}

      {tilesError && (
        <p className="map-page__notice" role="status">
          No pudimos cargar parte del mapa base. Revisá tu conexión.
        </p>
      )}

      <div
        id={mapId}
        ref={containerRef}
        className="events-map__canvas"
        role="region"
        aria-label="Mapa de eventos del Centro de Monitoreo"
      />
    </div>
  );
}
