const path=require('path'),fs=require('fs');
const app=path.resolve(__dirname,'../../../app');const {getDefaultConfig}=require(path.join(app,'node_modules/expo/metro-config'));
const c=getDefaultConfig(__dirname);c.watchFolders=[path.resolve(app,'..'),fs.realpathSync(path.join(app,'node_modules'))];c.resolver.nodeModulesPaths=[path.join(app,'node_modules')];
c.resolver.resolveRequest=(ctx,n,p)=>{
 if(/contexts\/(DatenContext|SupabaseContext|EinstellungenContext)$/.test(n))return {type:'sourceFile',filePath:path.join(__dirname,'kontexte.ts')};
 return ctx.resolveRequest(ctx,n,p);
};module.exports=c;
