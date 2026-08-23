// Internet Archive fallback.
//
// When a page cannot be reached, the Wayback Machine usually still has it.
// This module holds the parts that are pure: what counts as unreachable, how
// to ask archive.org, and how to read the answer. The fetching lives in
// src/main/archive.js.
//
// Nothing here redirects anything. Ember offers the archived copy; the dead
// page stays put until someone chooses otherwise.

const AVAILABILITY = 'https://archive.org/wayback/available'
const WAYBACK_PREFIX = 'https://web.archive.org/web/'

/** Statuses where the server answered but the page is gone for good. */
const DEAD_STATUSES = new Set([404, 410])

/**
 * Chromium net errors worth offering an archive for. Anything the user caused
 * (an aborted load) or that a reload would obviously fix is left alone.
 * Names follow net_error_list.h, which is BSD-licensed and public.
 */
const NETWORK_ERRORS = new Map([
  [-2, 'Something went wrong loading this page.'],
  [-6, 'That file could not be found.'],
  [-7, 'The site took too long to answer.'],
  [-21, 'Your network connection changed while the page was loading.'],
  [-100, 'The connection was closed before the page arrived.'],
  [-101, 'The connection was reset.'],
  [-102, 'The site refused the connection.'],
  [-104, 'Ember could not connect to the site.'],
  [-105, 'That address could not be found.'],
  [-106, 'You appear to be offline.'],
  [-109, 'The site is unreachable from here.'],
  [-118, 'The site took too long to connect.'],
  [-137, 'That address could not be looked up.'],
  [-200, 'The site sent a certificate Ember does not trust.'],
  [-324, 'The site closed the connection without sending anything.'],
])

// -3 is ERR_ABORTED, which is what a cancelled or superseded load looks like.
const ABORTED = -3

function isDeadStatus(status) {
  return DEAD_STATUSES.has(Number(status))
}

/** True for a main-frame load failure worth replacing with Ember's own page. */
function isNetworkFailure(errorCode) {
  const code = Number(errorCode)
  return Number.isFinite(code) && code < 0 && code !== ABORTED
}

/** Plain-English reason for the error page. */
function describeFailure(errorCode, fallback = '') {
  return NETWORK_ERRORS.get(Number(errorCode)) || fallback || 'This page could not be reached.'
}

/** Only real web pages have archived copies; ember:// and file:// do not. */
function isArchivable(url) {
  try {
    const parsed = new URL(String(url))
    if (!/^https?:$/.test(parsed.protocol)) return false
    // Nothing on a private host was ever crawled.
    return !/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i.test(parsed.hostname)
      && !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)
      && parsed.hostname.includes('.')
  } catch {
    return false
  }
}

/** The availability endpoint, optionally asking for a snapshot near a date. */
function availabilityUrl(url, timestamp = '') {
  const query = new URLSearchParams({ url: String(url) })
  if (timestamp) query.set('timestamp', String(timestamp))
  return `${AVAILABILITY}?${query}`
}

/**
 * Read the availability response. Returns the snapshot URL, or null when the
 * archive has never seen the page.
 *
 * @param {object} body  parsed JSON from the availability endpoint
 */
function pickSnapshot(body) {
  const closest = body?.archived_snapshots?.closest
  if (!closest?.available || !closest.url) return null
  const status = Number(closest.status)
  // The archive records failed captures too; those are no use to anyone.
  if (Number.isFinite(status) && status >= 400) return null
  // archive.org still answers http:// for some snapshots.
  const url = String(closest.url).replace(/^http:\/\/web\.archive\.org\//, 'https://web.archive.org/')
  if (!url.startsWith(WAYBACK_PREFIX)) return null
  return { url, timestamp: String(closest.timestamp || '') }
}

/** "20260821143000" -> "21 August 2026", for the button's tooltip. */
function describeTimestamp(timestamp) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(String(timestamp || ''))
  if (!match) return ''
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

module.exports = {
  AVAILABILITY,
  WAYBACK_PREFIX,
  DEAD_STATUSES,
  NETWORK_ERRORS,
  ABORTED,
  isDeadStatus,
  isNetworkFailure,
  describeFailure,
  isArchivable,
  availabilityUrl,
  pickSnapshot,
  describeTimestamp,
}
