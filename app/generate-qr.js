const QRCode = require('qrcode-terminal');

// Expo app URL (wird generiert, wenn Metro fertig ist)
const expoPid = process.argv[2] || '8081';
const expoUrl = `exp://localhost:${expoPid}`;

QRCode.generate(expoUrl, { small: true }, function(qrcode) {
  console.log('\n📱 EXPO GO QR-CODE:\n');
  console.log(qrcode);
  console.log(`URL: ${expoUrl}\n`);
});
