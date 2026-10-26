/* AF3 ohne Netzwerk: Zustandsübergänge und messbare Rangwirkung. */
const assert = require('node:assert/strict');
const R = require('../../gemeinsam/rang');
let n = 0;
const pruefe = (name, fn) => { fn(); console.log(`OK ${++n} ${name}`); };
const start = { id: 'v', liked: false, disliked: false, likes: 8 };
pruefe('Negativ an, ohne öffentliche Zahl', () => assert.deepEqual(R.reaktion(start, 'dislike'), { ...start, disliked: true }));
pruefe('Negativ zurücknehmen', () => assert.deepEqual(R.reaktion(R.reaktion(start, 'dislike'), 'dislike'), start));
pruefe('Like verdrängt Negativ', () => assert.deepEqual(R.reaktion(R.reaktion(start, 'dislike'), 'like'), { ...start, liked: true, likes: 9 }));
pruefe('Negativ verdrängt Like', () => assert.deepEqual(R.reaktion(R.reaktion(start, 'like'), 'dislike'), { ...start, disliked: true }));
pruefe('Like zurücknehmen', () => assert.deepEqual(R.reaktion(R.reaktion(start, 'like'), 'like'), start));
pruefe('Eingabe bleibt unverändert', () => assert.equal(start.likes, 8));
for (const [name, flags, faktor] of [['eigen',[true,true,true],.02],['Autor',[false,true,true],.3],['Thema',[false,false,true],.5],['neutral',[false,false,false],1]]) {
  pruefe(`Rangfaktor ${name}`, () => assert.equal(R.negativFaktor(...flags), faktor));
}
pruefe('Abwertung 100 → 2, ähnlicher Autor 100 → 30, Thema 100 → 50', () => {
 const posts = ['eigen','autor','thema','neutral'].map(id => ({id,userId:id}));
 const punkte = new Map(posts.map((p,i) => [p.id,100 * R.negativFaktor(i===0,i===1,i===2)]));
 assert.deepEqual(R.ordnen(posts,punkte,{abstand:0}).map(p=>p.id),['neutral','thema','autor','eigen']);
});
console.log(`${n}/${n} Prüfungen bestanden`);
