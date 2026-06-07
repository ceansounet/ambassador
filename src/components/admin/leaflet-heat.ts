// leaflet-global pins `window.L` before the plugin evaluates; it must be a
// separate module imported first (see the note there). Keep both as side-effect
// imports so tsc never resolves the untyped plugin .js for a binding (TS7016) —
// the `L.heatLayer` typing comes from src/types/leaflet-heat.d.ts instead.
import "./leaflet-global";
import "leaflet.heat";
