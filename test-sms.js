require('dotenv').config();
const { sendSMS } = require('./utils/sms');

const phone = process.argv[2];

if (!phone) {
  console.error("❌ Error: Please provide a phone number.");
  console.log("Usage: node test-sms.js +919876543210");
  process.exit(1);
}

console.log(`Sending test SMS to ${phone}...`);

sendSMS(phone, "CampusFind: This is a test message from your app!")
  .then(() => console.log("✅ Done! Check your phone."))
  .catch(err => {
    console.error("❌ Twilio Error:");
    console.error(err);
  });
