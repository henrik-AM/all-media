/** Eigener Prüfserver; Zugangsdaten erst nach exklusiv bestätigter Belegung. */
require('./_ki_belegung').pruefeBelegung('testbestand');
for(const datei of [process.env.AM_ENV_DATEI,process.env.AM_WEB_ENV_DATEI])if(datei)process.loadEnvFile(datei);
process.env.SUPABASE_URL ||= process.env.EXPO_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_ANON_KEY ||= process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const app=require('../../web/server/app');
app.listen(3300,'127.0.0.1',()=>console.log('Paket-6-Prüfserver auf 127.0.0.1:3300, PID '+process.pid));
