import L from "leaflet";

// leaflet.heat is a UMD plugin that reads the global `L` when its module body
// runs. Pin it on `window` here so the plugin — imported *after* this module via
// leaflet-heat.ts — can find it. Keep this in its own module: a bundler evaluates
// a module's imports in source order before its own body, so an assignment in the
// same file as the plugin import would be hoisted past and crash with
// "Can't find variable: L".
if (typeof window !== "undefined") {
  (window as unknown as { L?: typeof L }).L = L;
}
