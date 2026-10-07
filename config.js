// ── SWC Bus Booking – Frontend Config (LIVE ONLY) ──
// 1. Deploy Code.gs as Web App (Execute as: Me, Who has access: Anyone)
//    and paste the /exec URL below.
// 2. Create a Google OAuth Client ID (Web) and paste below for Google Login.
//    Authorised JavaScript origin: https://YOUR-USERNAME.github.io (+ http://localhost:8000 for testing)

window.SWC_CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyutnb908f8EgUVZAz6zXzp0WCac7mcsIjNO33zfAmRnBvysgCFnb_H2We0R1NgZXwO/exec", // e.g. "https://script.google.com/macros/s/AKfyc.../exec"
  GOOGLE_CLIENT_ID: "71909220285-647djv3jpier18p19htkd5ia6obp192n.apps.googleusercontent.com", // e.g. "123456789-abc.apps.googleusercontent.com"
  TOTAL_SEATS: 32,
  ALLOWED_DOMAIN: "@iisertvm.ac.in",
  ROUTE_FROM: "Thampanoor Bus Stand",
  ROUTE_TO: "IISER Thiruvananthapuram",
  DEPARTURE_TIME: "9:00 PM",
  // Booking windows (IST): open till departure 9 PM.
  //  Saturday bus → opens Friday 5:30 PM, closes Saturday 9:00 PM
  //  Sunday bus   → opens Saturday 5:30 PM, closes Sunday 9:00 PM
  // Event shuttles (SpecialServices sheet) open immediately when added.
};
