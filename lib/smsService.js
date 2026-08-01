/**
 * SMS Service Integration Stub
 * 
 * Future integration point for Twilio or AWS SNS.
 * For now, this logs the SMS request and simulates a successful delivery.
 */

async function sendSms(toPhoneNumber, messageBody) {
    if (!toPhoneNumber || !messageBody) {
        throw new Error('Missing phone number or message body');
    }

    // In the future, instantiate Twilio client here
    // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({ body: messageBody, from: process.env.TWILIO_PHONE_NUMBER, to: toPhoneNumber });

    console.log('\n=========================================');
    console.log(`[SMS MOCK] Sending SMS to: ${toPhoneNumber}`);
    console.log(`[SMS MOCK] Message: ${messageBody}`);
    console.log('=========================================\n');

    return {
        success: true,
        messageId: `mock_${Date.now()}`
    };
}

module.exports = { sendSms };
