// Eigener Prozessname: Hauptprojekt-Startskripte pkill -f web-app.js dürfen ihn nicht treffen.
process.env.PORT='3300';
require('../../app/web-app');
