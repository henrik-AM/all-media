const {getDefaultConfig}=require('expo/metro-config');
const path=require('path'),fs=require('fs');
const app=path.resolve(__dirname,'../../app');
const config=getDefaultConfig(__dirname);
config.watchFolders=[app,path.resolve(app,'../gemeinsam'),fs.realpathSync(path.join(app,'node_modules'))];
config.resolver.nodeModulesPaths=[path.join(app,'node_modules')];
config.resolver.resolveRequest=(context,name,platform)=>{
  // Nur dieser gesonderte Prüfstand: normale Metro-Konfiguration unverändert.
  if(/contexts\/(DatenContext|SupabaseContext|ProfilContext|EinstellungenContext)$/.test(name))
    return {type:'sourceFile',filePath:path.join(app,'test/paket6-native/kontexte.ts')};
  return context.resolveRequest(context,name,platform);
};
module.exports=config;
