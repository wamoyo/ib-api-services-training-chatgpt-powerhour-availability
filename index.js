
/*
 * Route: api.innovationbound.com/services/training/chatgpt/powerhour/availability
 * Check Costa's availability via Google Calendar OAuth 2.0
 * Returns array of available 1-hour time slots for next 14 days
 */

import { google } from 'googleapis'

// Costa's calendars to check (1 primary Google + 3 imported Proton calendars)
var calendarIds = [
  'costa@innovationbound.com',
  'akt089rchsj5ac6cosplsrgr8u6atk3n@import.calendar.google.com',  // CarbonNanotubes.org
  'd3mlc29pl22cudsoek10r8vv6mc6itvj@import.calendar.google.com',  // SpaceElevatorCompany.com
  'lj5e3vj57tbngl38um6g50u8t7sa2jp6@import.calendar.google.com'   // TrollHair.com
]

export async function handler (event) {
  console.log('EVENT:', JSON.stringify(event))
  if (event.httpMethod === 'OPTIONS') return respond(204) // For OPTIONS preflight

  try {
    console.log('Fetching availability from Google Calendar...')

    // Get OAuth credentials from environment variables
    var refreshToken = process.env.GOOGLE_CAL_OAUTH_REFRESH_TOKEN
    var clientId = process.env.GOOGLE_CAL_OAUTH_CLIENT_ID
    var clientSecret = process.env.GOOGLE_CAL_OAUTH_CLIENT_SECRET

    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error('Missing OAuth environment variables')
    }

    // Create OAuth2 client
    var oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    var calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Calculate time range (next 60 days)
    var now = new Date()
    var timeMin = now.toISOString()
    var timeMax = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)).toISOString()

    console.log(`Querying FreeBusy from ${timeMin} to ${timeMax}`)

    // Query FreeBusy for all calendars
    var freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin,
        timeMax: timeMax,
        items: calendarIds.map(function (id) { return { id: id } })
      }
    })

    console.log('FreeBusy response:', JSON.stringify(freeBusyResponse.data, null, 2))

    // Merge all busy times from all calendars
    var allBusyTimes = []
    Object.keys(freeBusyResponse.data.calendars).forEach(function (calId) {
      var calendarData = freeBusyResponse.data.calendars[calId]
      if (calendarData.busy) {
        allBusyTimes = allBusyTimes.concat(calendarData.busy)
      }
    })

    console.log(`Found ${allBusyTimes.length} busy blocks across all calendars`)

    // Calculate available slots
    var availableSlots = calculateAvailableSlots(now, 60, allBusyTimes)

    console.log(`Calculated ${availableSlots.length} available slots`)

    return respond(200, { available: availableSlots })

  } catch (error) {
    console.error('Error fetching availability:', error)
    return respond(500, { error: 'Failed to fetch availability' })
  }
}

// Pure: Calculate available 1-hour slots
// Rules:
// - 9am-4pm ET (business hours, last slot starts at 4pm and ends at 5pm)
// - Weekdays only (Mon-Fri)
// - Top of hour only (9:00, 10:00, 11:00, etc.)
// - At least 4 hours from now
// - 30-minute buffer before/after existing bookings
function calculateAvailableSlots (startDate, daysToCheck, busyTimes) {
  var availableSlots = []
  var minimumAdvanceMs = 4 * 60 * 60 * 1000 // 4 hours
  var bufferMs = 30 * 60 * 1000 // 30 minutes
  var sessionMs = 60 * 60 * 1000 // 1 hour

  // Convert busy times to Date objects with buffers
  var busyRanges = busyTimes.map(function (busy) {
    return {
      start: new Date(new Date(busy.start).getTime() - bufferMs),
      end: new Date(new Date(busy.end).getTime() + bufferMs)
    }
  })

  // Check each day
  for (var day = 0; day < daysToCheck; day++) {
    // Get the date for this day
    var checkDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + day)

    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (checkDate.getDay() === 0 || checkDate.getDay() === 6) continue

    // Determine UTC offset for Eastern Time on this date
    // EST = UTC-5, EDT = UTC-4
    var isDST = isEDT(checkDate)
    var utcOffsetHours = isDST ? 4 : 5

    // Check each hour from 9am to 4pm EASTERN TIME
    // (last slot starts at 4pm ET and ends at 5pm ET)
    for (var etHour = 9; etHour <= 16; etHour++) {
      // Create UTC timestamp for this ET hour
      // To convert ET to UTC: add the offset
      // Example: 9am EST (UTC-5) = 9 + 5 = 14:00 UTC
      var slotStart = new Date(Date.UTC(
        checkDate.getFullYear(),
        checkDate.getMonth(),
        checkDate.getDate(),
        etHour + utcOffsetHours,  // Convert ET hour to UTC hour
        0, 0, 0
      ))

      var slotEnd = new Date(slotStart.getTime() + sessionMs)

      // Skip if less than minimum advance time
      if (slotStart.getTime() < (startDate.getTime() + minimumAdvanceMs)) continue

      // Check if slot conflicts with any busy time (including buffer)
      var isAvailable = true
      for (var i = 0; i < busyRanges.length; i++) {
        var busy = busyRanges[i]
        // Check for overlap: slot starts before busy ends AND slot ends after busy starts
        if (slotStart < busy.end && slotEnd > busy.start) {
          isAvailable = false
          break
        }
      }

      if (isAvailable) {
        availableSlots.push(slotStart.toISOString())
      }
    }
  }

  return availableSlots
}

// Pure: Check if date is in Eastern Daylight Time (EDT) vs Eastern Standard Time (EST)
// EDT: Second Sunday in March to first Sunday in November
function isEDT (date) {
  var year = date.getFullYear()

  // Find second Sunday in March
  var march = new Date(year, 2, 1) // March 1
  var marchDay = march.getDay()
  var secondSundayMarch = new Date(year, 2, (14 - marchDay) % 7 + 8, 2, 0, 0) // 2am

  // Find first Sunday in November
  var november = new Date(year, 10, 1) // November 1
  var novemberDay = november.getDay()
  var firstSundayNovember = new Date(year, 10, (7 - novemberDay) % 7 + 1, 2, 0, 0) // 2am

  return date >= secondSundayMarch && date < firstSundayNovember
}

function respond (code, message) {
  return {
    body: code === 204 ? '' : JSON.stringify(message),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin' : 'https://www.innovationbound.com',
      'Access-Control-Allow-Methods' : 'GET,OPTIONS',
      'Access-Control-Allow-Headers' : 'Accept, Content-Type, Authorization',
      'Access-Control-Allow-Credentials' : true
    },
    isBase64Encoded: false,
    statusCode: code
  }
}
