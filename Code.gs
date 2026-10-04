/****************************************************
 * SWC IISER TVM – Weekend Night Bus Booking Backend
 * Thampanoor (9:00 PM) → IISER Thiruvananthapuram
 * Sat & Sun weekly | 32 seats | Waitlist + Cancellation
 * Sender name for all mails: SWC.IISER.TVM
 *
 * SHEETS REQUIRED (names must match exactly):
 *
 * 1) "Bookings"
 * | Booking ID | Service Date | Day | Name | Email | Phone | Status | Seat No | Waitlist Position | Created At | Updated At | Cancelled At | Notes |
 *   Status = CONFIRMED | WAITLIST | CANCELLED
 *
 * 2) "ServiceControl"  (ADMIN DISABLE SWITCH)
 * | Service Date | Day | Disabled | Disable Reason | Total Seats | Booking Opens At | Booking Closes At | Notes |
 *   Service Date format: YYYY-MM-DD (e.g. 2026-10-10)
 *   Disabled = TRUE / FALSE  (tick TRUE to disable that day's bus)
 *   If a date has no row → treated as ENABLED with 32 seats.
 *
 * 3) "SpecialServices"  (ADMIN: EVENT / EXTRA BUSES — any date, any seats)
 * | Service ID | Service Date | Service Name | From | To | Departure Time | Total Seats | Disabled | Disable Reason | Booking Opens At | Booking Closes At | Notes |
 *   Service Date format: YYYY-MM-DD. Service Name: e.g. "Onam Fest Shuttle".
 *   From/To default to Thampanoor Bus Stand / IISER TVM if left blank.
 *   Departure Time: HH:MM 24h (e.g. 14:30) or h:mm AM/PM (e.g. 2:30 PM). Blank = 21:00.
 *   Total Seats: blank = 32.
 *   Service ID: leave blank to auto-generate (EVT-<date>-<name>). Tip: fill a stable
 *     ID yourself (e.g. ONAM-1) and never rename it once bookings exist.
 *   Booking Opens At: blank = OPEN IMMEDIATELY (right after you add the row).
 *     Format: YYYY-MM-DD HH:MM (e.g. 2026-10-08 10:00).
 *   Booking Closes At: blank = closes at departure. Same format.
 *   Disabled = TRUE / FALSE — tick TRUE to take that special off the site.
 *   Just add a row → it appears on the website instantly. No timing rules.
 *
 * Bookings sheet also carries trailing columns (auto-added, don't reorder):
 *   ... | Notes | Service ID | Service Name |
 *   Weekend rows: Service ID = WEEKEND-YYYY-MM-DD. Special rows: EVT-… id.
 *
 * DEPLOY:
 *  1. Create Google Sheet → add the 3 tabs + header rows above (or just run setupSheets()).
 *  2. Extensions → Apps Script → paste this file → Save.
 *  3. Deploy → New deployment → Web app → Execute as: Me,
 *     Who has access: Anyone. Copy the /exec URL into config.js
 *  4. Run setupSheets() once from the editor to create headers.
 ****************************************************/

const SHEET_BOOKINGS = 'Bookings';
const SHEET_CONTROL  = 'ServiceControl';
const SHEET_SPECIALS = 'SpecialServices';
const TOTAL_SEATS_DEFAULT = 32;
const ALLOWED_DOMAIN = '@iisertvm.ac.in';
const SENDER_NAME = 'SWC.IISER.TVM';
const TIMEZONE = 'Asia/Kolkata';
const DEFAULT_FROM = 'Thampanoor Bus Stand';
const DEFAULT_TO = 'IISER Thiruvananthapuram';

/* ---------- one-time setup ---------- */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let b = ss.getSheetByName(SHEET_BOOKINGS);
  if (!b) b = ss.insertSheet(SHEET_BOOKINGS);
  let c = ss.getSheetByName(SHEET_CONTROL);
  if (!c) c = ss.insertSheet(SHEET_CONTROL);

  const bookingHeaders = ['Booking ID','Service Date','Day','Name','Email','Phone','Status','Seat No','Waitlist Position','Created At','Updated At','Cancelled At','Notes','Service ID','Service Name'];
  const controlHeaders = ['Service Date','Day','Disabled','Disable Reason','Total Seats','Booking Opens At','Booking Closes At','Notes'];
  const specialHeaders = ['Service ID','Service Date','Service Name','From','To','Departure Time','Total Seats','Disabled','Disable Reason','Booking Opens At','Booking Closes At','Notes'];

  if (b.getLastRow() === 0) {
    b.getRange(1,1,1,bookingHeaders.length).setValues([bookingHeaders]);
  } else {
    // migrate older sheets: append Service ID / Service Name if missing
    const h = b.getRange(1,1,1,b.getLastColumn()).getValues()[0].map(String);
    if (h.indexOf('Service ID') < 0) b.getRange(1, h.length + 1).setValue('Service ID');
    if (b.getRange(1,1,1,b.getLastColumn()).getValues()[0].map(String).indexOf('Service Name') < 0)
      b.getRange(1, b.getLastColumn() + 1).setValue('Service Name');
  }
  if (c.getLastRow() === 0) {
    c.getRange(1,1,1,controlHeaders.length).setValues([controlHeaders]);
    // Example rows (admin can edit/delete):
    c.getRange(2,1,1,8).setValues([['2026-10-10','Saturday', false, '', 32, '2026-10-09 17:30', '2026-10-10 21:00', 'Example – edit me']]);
  }
  let s = ss.getSheetByName(SHEET_SPECIALS);
  if (!s) s = ss.insertSheet(SHEET_SPECIALS);
  if (s.getLastRow() === 0) {
    s.getRange(1,1,1,specialHeaders.length).setValues([specialHeaders]);
    s.getRange(2,1,1,12).setValues([['','2026-10-14','Onam Fest Shuttle (example – edit or delete me)','Thampanoor Bus Stand','IISER Thiruvananthapuram','14:30',20,false,'','','','Blank open/close = bookable immediately till departure']]);
  }
  // Formatting
  b.setFrozenRows(1); c.setFrozenRows(1); s.setFrozenRows(1);
  try {
    const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    c.getRange(2, 3, 200, 1).setDataValidation(rule);
    s.getRange(2, 8, 200, 1).setDataValidation(rule);
  } catch(e) {}
}

/* ---------- HTTP entry points ---------- */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = (params.action || 'services').toLowerCase();
  try {
    if (action === 'services') return jsonOut({ ok: true, services: getNextServices() });
    if (action === 'status') {
      const key = params.serviceId || params.serviceDate;
      if (!key) throw new Error('serviceId (or serviceDate YYYY-MM-DD) required');
      return jsonOut({ ok: true, status: getServiceStatus(key) });
    }
    if (action === 'mybookings') {
      if (!params.email) throw new Error('email required');
      return jsonOut({ ok: true, bookings: getMyBookings(params.email) });
    }
    throw new Error('Unknown action: ' + action);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return jsonOut({ ok: false, error: 'Invalid JSON body' }); }
  const action = String(body.action || '').toLowerCase();
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (action === 'book') return jsonOut(bookSeat(body));
    if (action === 'cancel') return jsonOut(cancelBooking(body));
    if (action === 'mybookings') return jsonOut({ ok: true, bookings: getMyBookings(body.email) });
    if (action === 'status') return jsonOut({ ok: true, status: getServiceStatus(body.serviceId || body.serviceDate) });
    if (action === 'services') return jsonOut({ ok: true, services: getNextServices() });
    return jsonOut({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function doOptions() { return jsonOut({ ok: true }); }

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- core logic ---------- */

// Next Saturday + Sunday 9PM services PLUS any upcoming special/event buses.
// Specials appear the moment the admin adds the row (no timing rules).
function getNextServices() {
  const out = [];
  const today = new Date();
  // weekend: look ahead 14 days, pick Sat(6) & Sun(0), nearest 2 not-yet-departed
  const candidates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dow = d.getDay();
    if (dow === 6 || dow === 0) {
      const iso = toISODate(d);
      const dep = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21, 0, 0);
      if (dep.getTime() > Date.now()) candidates.push(iso);
    }
  }
  candidates.slice(0, 2).forEach(function(iso){ out.push(getServiceStatus('WEEKEND-' + iso)); });
  // specials: every row whose departure is still in the future (kept till 1h after)
  getSpecialRows().forEach(function(sp){
    if (sp.depart.getTime() > Date.now() - 1000*60*60) {
      try { out.push(getServiceStatus(sp.serviceId)); } catch(e) {}
    }
  });
  out.sort(function(a,b){ return new Date(a.departISO) - new Date(b.departISO); });
  return out.slice(0, 10);
}

// key = 'WEEKEND-YYYY-MM-DD' | 'EVT-…' service ID | plain 'YYYY-MM-DD' (weekend, legacy)
function getServiceStatus(key) {
  const svc = resolveService(key);
  const counts = countSeatsById(svc.serviceId);
  const now = new Date();
  const bookingOpen = !svc.disabled && now >= svc.opens && now <= svc.closes;
  let windowLabel = '';
  if (svc.disabled) windowLabel = 'disabled';
  else if (now < svc.opens) windowLabel = 'upcoming';
  else if (now > svc.closes) windowLabel = 'closed';
  else windowLabel = 'open';
  return {
    serviceId: svc.serviceId,
    kind: svc.kind,
    serviceName: svc.serviceName,
    serviceDate: svc.serviceDate,
    day: svc.dayName,
    departure: svc.serviceDate + ' ' + svc.departTime,
    from: svc.from,
    to: svc.to,
    route: svc.from + ' → ' + svc.to,
    totalSeats: svc.totalSeats,
    confirmedCount: counts.confirmed,
    available: Math.max(0, svc.totalSeats - counts.confirmed),
    waitlistCount: counts.waitlist,
    disabled: svc.disabled,
    disableReason: svc.reason,
    bookingOpen: bookingOpen,
    window: windowLabel,
    opensAt: fmtDT(svc.opens),
    closesAt: fmtDT(svc.closes),
    opensISO: isoOut(svc.opens),
    closesISO: isoOut(svc.closes),
    departISO: isoOut(svc.depart)
  };
}

// Resolve any key into a full normalized service descriptor. Throws on unknown.
function resolveService(key) {
  key = String(key || '').trim();
  // 1) special by exact service ID
  const specials = getSpecialRows();
  for (let i = 0; i < specials.length; i++) {
    if (specials[i].serviceId === key) return specials[i];
  }
  // 2) weekend by 'WEEKEND-YYYY-MM-DD' or plain date
  let iso = null;
  if (/^WEEKEND-\d{4}-\d{2}-\d{2}$/.test(key)) iso = key.slice(8);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(key)) iso = key;
  if (iso) {
    const parsed = parseServiceDate(iso);
    const control = getControlRow(iso);
    const totalSeats = control && control.totalSeats ? control.totalSeats : TOTAL_SEATS_DEFAULT;
    const window = bookingWindowFor(parsed.date);
    return {
      kind: 'weekend',
      serviceId: 'WEEKEND-' + iso,
      serviceName: 'Weekend Night Bus',
      serviceDate: iso,
      dayName: parsed.dayName,
      from: DEFAULT_FROM,
      to: DEFAULT_TO,
      departTime: '21:00',
      depart: new Date(parsed.date.getFullYear(), parsed.date.getMonth(), parsed.date.getDate(), 21, 0, 0),
      totalSeats: totalSeats,
      disabled: control ? !!control.disabled : false,
      reason: control ? (control.reason || '') : '',
      opens: window.opens,
      closes: window.closes
    };
  }
  throw new Error('Unknown service: ' + key);
}

// Read + normalize every SpecialServices row (skips rows without date/name).
function getSpecialRows() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SPECIALS);
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getDataRange().getValues();
  const out = [];
  for (let r = 1; r < vals.length; r++) {
    let sid = String(vals[r][0] || '').trim();
    const rawDate = vals[r][1];
    const iso = (rawDate instanceof Date) ? toISODate(rawDate) : String(rawDate || '').slice(0, 10);
    const name = String(vals[r][2] || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !name) continue;
    if (!sid) sid = 'EVT-' + iso + '-' + name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
    const parsed = parseServiceDate(iso);
    const depart = combineDateTime(parsed.date, vals[r][5], 21, 0);
    const opensRaw = parseSheetDateTime(vals[r][9]);
    const closesRaw = parseSheetDateTime(vals[r][10]);
    out.push({
      kind: 'special',
      serviceId: sid,
      serviceName: name,
      serviceDate: iso,
      dayName: parsed.dayName,
      from: String(vals[r][3] || '').trim() || DEFAULT_FROM,
      to: String(vals[r][4] || '').trim() || DEFAULT_TO,
      departTime: fmtTime(depart),
      depart: depart,
      totalSeats: parseInt(vals[r][6], 10) || TOTAL_SEATS_DEFAULT,
      disabled: vals[r][7] === true || String(vals[r][7]).toUpperCase() === 'TRUE',
      reason: String(vals[r][8] || ''),
      // blank opens = open immediately; blank closes = closes at departure
      opens: opensRaw || new Date(2000, 0, 1),
      closes: closesRaw || depart
    });
  }
  return out;
}

// Combine a date with a time cell (Date | "14:30" | "2:30 PM" | blank→defH:defM)
function combineDateTime(dateObj, timeCell, defH, defM) {
  let h = defH, m = defM;
  if (timeCell instanceof Date) { h = timeCell.getHours(); m = timeCell.getMinutes(); }
  else if (timeCell !== '' && timeCell !== null && timeCell !== undefined) {
    const t = String(timeCell).trim();
    let mm = t.match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?$/);
    if (mm) {
      h = parseInt(mm[1], 10) % 12; m = parseInt(mm[2], 10);
      if (/p/i.test(mm[3])) h += 12;
    } else {
      mm = t.match(/^(\d{1,2}):(\d{2})$/);
      if (mm) { h = parseInt(mm[1], 10); m = parseInt(mm[2], 10); }
    }
  }
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), h, m, 0);
}

// Parse optional sheet datetime ("YYYY-MM-DD HH:MM" | Date | blank→null)
function parseSheetDateTime(cell) {
  if (!cell) return null;
  if (cell instanceof Date) return isNaN(cell.getTime()) ? null : cell;
  const m = String(cell).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10), parseInt(m[4]||'0',10), parseInt(m[5]||'0',10), 0);
}

function fmtTime(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function pad2(n) { return String(n).padStart(2, '0'); }
function isoOut(d) {
  try { return Utilities.formatDate(new Date(d), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"); }
  catch(e) { return ''; }
}

function bookSeat(p) {
  const key = String(p.serviceId || p.serviceDate || '').trim();
  const name  = String(p.name || '').trim();
  const email = String(p.email || '').trim().toLowerCase();
  const phone = String(p.phone || '').trim();

  if (!key) throw new Error('Please choose a bus service.');
  if (!name || name.length < 2) throw new Error('Please enter your full name.');
  if (!email || email.indexOf('@') < 0) throw new Error('Valid email required.');
  if (email.slice(-ALLOWED_DOMAIN.length) !== ALLOWED_DOMAIN)
    throw new Error('Booking is only available for ' + ALLOWED_DOMAIN + ' mail IDs. Please login with your IISER email.');
  if (!phone || !/^[0-9+\-\s]{8,15}$/.test(phone)) throw new Error('Please enter a valid phone number.');

  const st = getServiceStatus(key);
  const svc = resolveService(key);
  if (svc.kind === 'weekend' && svc.dayName !== 'Saturday' && svc.dayName !== 'Sunday')
    throw new Error('Weekend bus runs only on Saturdays & Sundays.');

  const label = svc.serviceName + ' (' + svc.serviceDate + ' ' + svc.departTime + ')';
  if (st.disabled) throw new Error('Sorry, "' + svc.serviceName + '" is NOT operating on ' + svc.serviceDate + (st.disableReason ? ' (' + st.disableReason + ')' : '') + '.');
  if (!st.bookingOpen) {
    if (st.window === 'upcoming') throw new Error('Booking for "' + svc.serviceName + '" opens at ' + st.opensAt + '. Please come back then.');
    throw new Error('Booking for "' + svc.serviceName + '" is closed (window: ' + st.opensAt + ' → ' + st.closesAt + ').');
  }

  // one active booking per email per service
  const existing = findActiveBooking(svc.serviceId, email);
  if (existing) throw new Error('You already have a ' + existing.status + ' booking for ' + label + ' (ID: ' + existing.bookingId + '). Check "My bookings" to manage it.');

  const counts = countSeatsById(svc.serviceId);
  const isConfirmed = counts.confirmed < st.totalSeats;

  const bookingId = (svc.kind === 'special' ? 'EVT-' : 'SWC-') + svc.serviceDate.replace(/-/g,'') + '-' + Utilities.getUuid().slice(0,6).toUpperCase();
  const now = new Date();
  let seatNo = '';
  let waitPos = '';
  let status = '';
  if (isConfirmed) {
    status = 'CONFIRMED';
    seatNo = String(counts.confirmed + 1); // count-based, no seat choice shown to user
  } else {
    status = 'WAITLIST';
    waitPos = String(counts.waitlist + 1);
  }

  appendBookingRow({
    bookingId: bookingId, serviceDate: svc.serviceDate, day: svc.dayName,
    name: name, email: email, phone: phone,
    status: status, seatNo: seatNo, waitPos: waitPos,
    createdAt: now, updatedAt: now, cancelledAt: '', notes: '',
    serviceId: svc.serviceId, serviceName: svc.serviceName
  });

  // emails (real-time)
  try {
    if (status === 'CONFIRMED') {
      sendMail(email,
        'Bus Booking CONFIRMED – ' + label + ' | SWC.IISER.TVM',
        confirmedHtml(name, bookingId, svc.serviceDate, svc.dayName, seatNo, st));
    } else {
      sendMail(email,
        'You are on the WAITLIST #' + waitPos + ' – ' + label + ' | SWC.IISER.TVM',
        waitlistHtml(name, bookingId, svc.serviceDate, svc.dayName, waitPos, st));
    }
  } catch(e) {}

  return {
    ok: true,
    status: status,
    bookingId: bookingId,
    seatNo: seatNo,
    waitlistPosition: waitPos,
    message: status === 'CONFIRMED'
      ? 'Booking confirmed! Details mailed to ' + email
      : 'We are sorry, all ' + st.totalSeats + ' seats are filled up. You have been placed on waitlist #' + waitPos + '. We will auto-confirm & email you if someone cancels.'
  };
}

function cancelBooking(p) {
  const bookingId = String(p.bookingId || '').trim();
  const email = String(p.email || '').trim().toLowerCase();
  if (!bookingId) throw new Error('bookingId required.');
  if (!email) throw new Error('email required for verification.');

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BOOKINGS);
  const vals = sh.getDataRange().getValues();
  let rowIdx = -1, row = null;
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][0]).trim() === bookingId) { rowIdx = r + 1; row = vals[r]; break; }
  }
  if (rowIdx < 0) throw new Error('Booking ID not found. Check "My bookings".');
  const rowEmail = String(row[4]).trim().toLowerCase();
  if (rowEmail !== email) throw new Error('Email does not match this booking. Cancellation denied.');
  const curStatus = String(row[6]);
  if (curStatus === 'CANCELLED') throw new Error('This booking is already cancelled.');
  const serviceDate = String(row[1]);
  const serviceId = rowServiceId(row, serviceDate);

  const now = new Date();
  sh.getRange(rowIdx, 7).setValue('CANCELLED');   // Status
  sh.getRange(rowIdx, 11).setValue(now);          // Updated At
  sh.getRange(rowIdx, 12).setValue(now);          // Cancelled At

  // mail the canceller
  let svcLabel = serviceDate;
  try { const rs = resolveService(serviceId); svcLabel = rs.serviceName + ' (' + rs.serviceDate + ' ' + rs.departTime + ')'; } catch(e) {}
  try {
    sendMail(email,
      'Booking CANCELLED – ' + svcLabel + ' | SWC.IISER.TVM',
      cancelledHtml(String(row[3]), bookingId, serviceDate, svcLabel));
  } catch(e) {}

  // promote first WAITLIST of the SAME service (FIFO by Created At)
  const promoted = promoteNextWaitlist(serviceId);
  return {
    ok: true,
    cancelled: bookingId,
    promoted: promoted ? promoted.bookingId : null,
    message: promoted
      ? 'Booking cancelled. Waitlist #' + promoted.oldPosition + ' (' + promoted.email + ') has been auto-confirmed & emailed.'
      : 'Booking cancelled successfully. A confirmation mail has been sent.'
  };
}

function promoteNextWaitlist(serviceId) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BOOKINGS);
  const vals = sh.getDataRange().getValues();
  // collect WAITLIST rows for this service, earliest first
  const cands = [];
  for (let r = 1; r < vals.length; r++) {
    if (rowServiceId(vals[r], String(vals[r][1])) === serviceId && String(vals[r][6]) === 'WAITLIST')
      cands.push({ row: r + 1, created: vals[r][9], vals: vals[r] });
  }
  if (!cands.length) return null;
  cands.sort(function(a,b){ return new Date(a.created) - new Date(b.created); });
  const first = cands[0];
  const st = getServiceStatus(serviceId);
  const counts = countSeatsById(serviceId);
  // new seat number = confirmed count (after cancellation) + 1
  const newSeat = String(counts.confirmed + 1);
  const oldPos = String(first.vals[8] || '1');
  const now = new Date();
  sh.getRange(first.row, 7).setValue('CONFIRMED');
  sh.getRange(first.row, 8).setValue(newSeat);
  sh.getRange(first.row, 9).setValue('');
  sh.getRange(first.row, 11).setValue(now);
  sh.getRange(first.row, 13).setValue('Auto-promoted from waitlist #' + oldPos + ' on ' + fmtDT(now));

  // re-number remaining waitlist positions 1..n
  renumberWaitlist(serviceId);

  const pEmail = String(first.vals[4]);
  const pName = String(first.vals[3]);
  const pId = String(first.vals[0]);
  const svcDate = String(first.vals[1]);
  try {
    sendMail(pEmail,
      'Good news! Your waitlist booking is now CONFIRMED – ' + svcDate + ' | SWC.IISER.TVM',
      promotedHtml(pName, pId, svcDate, newSeat, st));
  } catch(e) {}
  return { bookingId: pId, email: pEmail, oldPosition: oldPos, newSeat: newSeat };
}

function renumberWaitlist(serviceId) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BOOKINGS);
  const vals = sh.getDataRange().getValues();
  const cands = [];
  for (let r = 1; r < vals.length; r++) {
    if (rowServiceId(vals[r], String(vals[r][1])) === serviceId && String(vals[r][6]) === 'WAITLIST')
      cands.push({ row: r + 1, created: vals[r][9] });
  }
  cands.sort(function(a,b){ return new Date(a.created) - new Date(b.created); });
  cands.forEach(function(c, i){ sh.getRange(c.row, 9).setValue(i + 1); sh.getRange(c.row, 11).setValue(new Date()); });
}

// Service ID of a Bookings row: col N (Service ID) if present, else legacy WEEKEND-<date>
function rowServiceId(rowArr, serviceDate) {
  const sid = String(rowArr[13] || '').trim();
  if (sid) return sid;
  return 'WEEKEND-' + String(serviceDate || '').slice(0, 10);
}

function getMyBookings(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) throw new Error('email required');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BOOKINGS);
  if (!sh) return [];
  const vals = sh.getDataRange().getValues();
  const out = [];
  for (let r = vals.length - 1; r >= 1; r--) {
    if (String(vals[r][4]).trim().toLowerCase() === email) {
      const sid = rowServiceId(vals[r], String(vals[r][1]));
      let sName = String(vals[r][14] || '');
      let depart = '';
      try { const rs = resolveService(sid); if (!sName) sName = rs.serviceName; depart = rs.serviceDate + ' ' + rs.departTime; } catch(e) {}
      out.push({
        bookingId: String(vals[r][0]), serviceDate: String(vals[r][1]),
        day: String(vals[r][2]), name: String(vals[r][3]), email: String(vals[r][4]),
        phone: String(vals[r][5]), status: String(vals[r][6]),
        seatNo: String(vals[r][7] || ''), waitlistPosition: String(vals[r][8] || ''),
        createdAt: fmtDT(vals[r][9]),
        serviceId: sid, serviceName: sName, departure: depart
      });
    }
  }
  return out;
}

/* ---------- helpers ---------- */
function findActiveBooking(serviceId, email) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BOOKINGS);
  if (!sh || sh.getLastRow() < 2) return null;
  const vals = sh.getDataRange().getValues();
  for (let r = 1; r < vals.length; r++) {
    if (rowServiceId(vals[r], String(vals[r][1])) === serviceId &&
        String(vals[r][4]).trim().toLowerCase() === email &&
        (String(vals[r][6]) === 'CONFIRMED' || String(vals[r][6]) === 'WAITLIST'))
      return { bookingId: String(vals[r][0]), status: String(vals[r][6]) };
  }
  return null;
}

function countSeatsById(serviceId) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BOOKINGS);
  if (!sh || sh.getLastRow() < 2) return { confirmed: 0, waitlist: 0 };
  const vals = sh.getDataRange().getValues();
  let c = 0, w = 0;
  for (let r = 1; r < vals.length; r++) {
    if (rowServiceId(vals[r], String(vals[r][1])) === serviceId) {
      if (String(vals[r][6]) === 'CONFIRMED') c++;
      if (String(vals[r][6]) === 'WAITLIST') w++;
    }
  }
  return { confirmed: c, waitlist: w };
}

function getControlRow(serviceDate) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONTROL);
  if (!sh || sh.getLastRow() < 2) return null;
  const vals = sh.getDataRange().getValues();
  for (let r = 1; r < vals.length; r++) {
    const d = vals[r][0];
    const iso = (d instanceof Date) ? toISODate(d) : String(d).slice(0,10);
    if (iso === serviceDate) {
      return {
        disabled: vals[r][2] === true || String(vals[r][2]).toUpperCase() === 'TRUE',
        reason: String(vals[r][3] || ''),
        totalSeats: parseInt(vals[r][4], 10) || TOTAL_SEATS_DEFAULT
      };
    }
  }
  return null;
}

function parseServiceDate(s) {
  const parts = s.split('-').map(Number);
  const d = new Date(parts[0], parts[1]-1, parts[2]);
  const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return { date: d, dayName: names[d.getDay()] };
}

// Booking windows (IST) — form stays open till departure 9 PM:
//  Saturday bus → opens Friday 17:30, closes Saturday 21:00
//  Sunday bus   → opens Saturday 17:30, closes Sunday 21:00
function bookingWindowFor(serviceDateObj) {
  const dow = serviceDateObj.getDay(); // 6 Sat, 0 Sun
  let opens, closes;
  if (dow === 6) {
    opens = new Date(serviceDateObj.getFullYear(), serviceDateObj.getMonth(), serviceDateObj.getDate() - 1, 17, 30, 0);
    closes = new Date(serviceDateObj.getFullYear(), serviceDateObj.getMonth(), serviceDateObj.getDate(), 21, 0, 0);
  } else {
    opens = new Date(serviceDateObj.getFullYear(), serviceDateObj.getMonth(), serviceDateObj.getDate() - 1, 17, 30, 0);
    closes = new Date(serviceDateObj.getFullYear(), serviceDateObj.getMonth(), serviceDateObj.getDate(), 21, 0, 0);
  }
  return { opens: opens, closes: closes };
}

function appendBookingRow(o) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BOOKINGS);
  sh.appendRow([o.bookingId, o.serviceDate, o.day, o.name, o.email, o.phone, o.status, o.seatNo, o.waitPos, o.createdAt, o.updatedAt, o.cancelledAt, o.notes, o.serviceId || '', o.serviceName || '']);
}

function toISODate(d) {
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}
function fmtDT(d) {
  try {
    if (!d) return '';
    return Utilities.formatDate(new Date(d), TIMEZONE, 'dd MMM yyyy, hh:mm a');
  } catch(e) { return String(d); }
}

/* ---------- mail ---------- */
function sendMail(to, subject, html) {
  GmailApp.sendEmail(to, subject, stripTags(html), {
    name: SENDER_NAME,
    htmlBody: htmlWrapper(subject, html),
    replyTo: Session.getActiveUser().getEmail()
  });
}
function stripTags(h){ return String(h).replace(/<[^>]*>/g, ' '); }
function htmlWrapper(subject, inner) {
  return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">'
    + '<div style="background:#0f172a;color:#fff;padding:18px 22px"><b>SWC.IISER.TVM</b> · Student Welfare Council<br><span style="font-size:13px;opacity:.8">Campus Bus Booking</span></div>'
    + '<div style="padding:22px">' + inner + '</div>'
    + '<div style="padding:14px 22px;background:#f8fafc;font-size:12px;color:#64748b">This is an automated mail from SWC.IISER.TVM. Do not reply directly – contact SWC helpdesk for assistance. Board with college ID.</div></div>';
}
function svcLine(st) {
  try { return esc(st.serviceName) + ' · ' + esc(st.serviceDate) + ' ' + esc(st.departure.split(' ').pop()) + ' · ' + esc(st.route); }
  catch(e) { return ''; }
}
function confirmedHtml(name, id, date, day, seat, st) {
  return '<h2>Booking confirmed 🎉</h2><p>Hi <b>' + esc(name) + '</b>, your seat for <b>' + svcLine(st) + '</b> is confirmed.</p>'
    + kv('Booking ID', id) + kv('Service', st.serviceName + ' (' + day + ')') + kv('Departure', st.departure + ' · ' + st.route) + kv('Boarding', 'Be ready 15 min early')
    + kv('Seat count reference', seat + ' / ' + st.totalSeats + ' (no seat choice – first-come basis)')
    + '<p>Show this mail + college ID while boarding. To cancel, use the website → My bookings.</p>';
}
function waitlistHtml(name, id, date, day, pos, st) {
  return '<h2>You are on the waitlist</h2><p>Hi <b>' + esc(name) + '</b>, all <b>' + st.totalSeats + ' seats</b> for <b>' + svcLine(st) + '</b> are filled up.</p>'
    + kv('Booking ID', id) + kv('Waitlist position', '#' + pos)
    + '<p>If someone cancels, you will be <b>auto-promoted & emailed instantly</b>. You can also cancel your waitlist entry anytime from the website.</p>';
}
function cancelledHtml(name, id, date, label) {
  return '<h2>Booking cancelled</h2><p>Hi <b>' + esc(name) + '</b>, your booking <b>' + esc(id) + '</b> for <b>' + esc(label || date) + '</b> has been cancelled. Your seat (if confirmed) is now released to the waitlist.</p><p>We hope to see you on the next bus!</p>';
}
function promotedHtml(name, id, date, seat, st) {
  return '<h2>Good news – seat confirmed! 🎉</h2><p>Hi <b>' + esc(name) + '</b>, a seat opened up and your waitlist booking for <b>' + svcLine(st) + '</b> is now <b>CONFIRMED</b>.</p>'
    + kv('Booking ID', id) + kv('Departure', st.departure + ' · ' + st.route)
    + '<p>Please board on time with college ID.</p>';
}
function kv(k,v){ return '<p style="margin:6px 0"><span style="color:#64748b">' + k + ':</span> <b>' + esc(String(v)) + '</b></p>'; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
