// OAuth 2.0 setup script - Run this ONCE to get your refresh token
// Usage: node oauth-setup.js /path/to/downloaded-credentials.json

import { google } from 'googleapis'
import { createServer } from 'http'
import { parse } from 'url'

// Get the path to the downloaded OAuth credentials JSON
var credentialsPath = process.argv[2]

if (!credentialsPath) {
  console.error('❌ ERROR: Please provide path to OAuth credentials JSON file')
  console.error('')
  console.error('Usage: node oauth-setup.js /path/to/credentials.json')
  process.exit(1)
}

console.log('Reading OAuth credentials from:', credentialsPath)
console.log('')

// Read the credentials file
var credentials
try {
  var fs = await import('fs')
  var fileContent = fs.readFileSync(credentialsPath, 'utf8')
  credentials = JSON.parse(fileContent).installed || JSON.parse(fileContent).web

  if (!credentials) {
    throw new Error('Invalid credentials file format')
  }
} catch (error) {
  console.error('❌ ERROR reading credentials file:', error.message)
  process.exit(1)
}

// Create OAuth2 client
var oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  'http://localhost:3000/oauth2callback' // Redirect URI
)

// Scopes we need
var scopes = [
  'https://www.googleapis.com/auth/calendar.readonly'
]

// Generate authorization URL
var authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Get refresh token
  scope: scopes,
  prompt: 'consent' // Force consent screen to get refresh token
})

console.log('📋 STEP 1: Authorize this app')
console.log('')
console.log('🌐 Open this URL in your browser:')
console.log('')
console.log(authUrl)
console.log('')
console.log('⏳ Waiting for authorization...')
console.log('')

// Create local server to receive the authorization code
var server = createServer(async function (req, res) {
  try {
    var qs = parse(req.url, true).query

    if (qs.code) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('✅ Authorization successful! You can close this window and return to the terminal.')

      console.log('✅ Authorization code received!')
      console.log('')
      console.log('📋 STEP 2: Exchanging code for tokens...')
      console.log('')

      // Exchange authorization code for tokens
      var { tokens } = await oauth2Client.getToken(qs.code)

      console.log('✅ SUCCESS! Tokens received.')
      console.log('')
      console.log('🔑 Your refresh token (save this as environment variable):')
      console.log('')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(tokens.refresh_token)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('')
      console.log('📝 To use this in your Lambda:')
      console.log('')
      console.log('1. Store the refresh token as an environment variable:')
      console.log('   export GOOGLE_CAL_OAUTH_REFRESH_TOKEN="<paste-refresh-token-here>"')
      console.log('')
      console.log('2. Also store your client ID and secret:')
      console.log('   export GOOGLE_CAL_OAUTH_CLIENT_ID="' + credentials.client_id + '"')
      console.log('   export GOOGLE_CAL_OAUTH_CLIENT_SECRET="' + credentials.client_secret + '"')
      console.log('')
      console.log('✅ Setup complete!')

      server.close()
    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('❌ No authorization code received')
      server.close()
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('❌ Error: ' + error.message)
    server.close()
  }
})

server.listen(3000)
