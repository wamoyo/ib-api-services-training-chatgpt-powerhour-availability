
/*
 * Testing our availability lambda function
 */

import { handler } from './index.js'

// Test: Get availability (no body needed, it's a GET request)
console.log('Testing availability Lambda...\n')

handler({ httpMethod: 'GET' })
  .then(function (result) {
    console.log('\n=== LAMBDA RESPONSE ===')
    console.log('Status Code:', result.statusCode)
    console.log('\n=== RESPONSE BODY ===')
    var body = JSON.parse(result.body)
    console.log(JSON.stringify(body, null, 2))

    if (body.available) {
      console.log('\n=== AVAILABLE SLOTS ===')
      console.log('Total available slots:', body.available.length)
      console.log('\nFirst 10 slots:')
      body.available.slice(0, 10).forEach(function (slot, index) {
        var date = new Date(slot)
        console.log(`  ${index + 1}. ${date.toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short'
        })}`)
      })
    }
  })
  .catch(function (error) {
    console.error('\n=== ERROR ===')
    console.error(error)
  })
