/**
 * QrDesigner — reusable, company-scoped QR seal configurator for this vertical ERP.
 *
 * The platform-wide designer lives in the shell at
 * `openticket-shell/src/components/QrDesigner/`. This is a self-contained copy
 * so this standalone app owns its own admin/qr-designer route (the shell proxies
 * `/<vertical>/admin/*` here, so the route must NASCER inside this repo).
 *
 * The client adapter that resolves the active company lives next to the admin
 * route (it uses THIS app's auth/company hook, not the shell's provider).
 */
export { QrDesigner, type QrDesignerProps } from "./QrDesigner";
export {
  getVerticalQrContext,
  buildScopedPayload,
  qrBaseOrigin,
  VERTICAL_QR_CONTEXTS,
  type VerticalQrContext,
  type VerticalRouteSlug,
} from "./verticalContexts";
