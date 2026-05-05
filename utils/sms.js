const twilio = require('twilio');

const sendSMS = async (to, body) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
      console.warn("Twilio credentials not found in environment variables. SMS not sent.");
      return;
    }

    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      body: body,
      from: fromPhone,
      to: to
    });

    console.log(`SMS sent successfully to ${to}. Message SID: ${message.sid}`);
    return message;
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error.message);
  }
};

module.exports = { sendSMS };
