// Geschützter Prüfprozess mit derselben lokalen Medienkonfiguration wie der reguläre Webstart.
process.env.PORT='3300';
require('../../web/server/lokal');
