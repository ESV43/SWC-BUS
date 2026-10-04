// ── SWC Bus Booking – Frontend Config ──
// 1. Deploy Code.gs as Web App (Anyone) and paste the /exec URL below.
// 2. Create a Google OAuth Client ID (Web) and paste below for Google Login.
// Leave APPS_SCRIPT_URL empty to run in beautiful DEMO mode (localStorage).

window.SWC_CONFIG = {
  APPS_SCRIPT_URL: "", // e.g. "https://script.google.com/macros/s/AKfyc.../exec"
  GOOGLE_CLIENT_ID: "", // e.g. "123456789-abc.apps.googleusercontent.com"
  TOTAL_SEATS: 32,
  ALLOWED_DOMAIN: "@iisertvm.ac.in",
  ROUTE_FROM: "Thampanoor Bus Stand",
  ROUTE_TO: "IISER Thiruvananthapuram",
  DEPARTURE_TIME: "9:00 PM",
  // Booking windows (IST): open till departure 9 PM.
  //  Saturday bus → opens Friday 5:30 PM, closes Saturday 9:00 PM
  //  Sunday bus   → opens Saturday 5:30 PM, closes Sunday 9:00 PM
};
