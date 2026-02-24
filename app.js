/* app.js - MiniCity (top-down web prototype)
- Jouable dans le navigateur
- Voitures de luxe embarquées en base64 (mini sprites)
- PWA-friendly, sauvegarde via localStorage
*/

/* =========================
UTIL & CONST
========================= */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const rand = (a,b) => Math.random()*(b-a)+a;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* =========================
Embedded mini-sprites (base64 PNG placeholders)
- small colored rectangles encoded as data URIs
- you can replace these with real sprites in /assets/
========================= */
const SPRITES = {
'aurora-x': makeColorSprite('#1f8fff'),
'valence-gt': makeColorSprite('#ff5a8a'),
'zephyr-s': makeColorSprite('#ffd24d'),
'novum-elite': makeColorSprite('#8b5cff'),
'phantom-r': makeColorSprite('#2d2d2d'),
};

function makeColorSprite(hex){
// create tiny canvas and export dataURL
const c = document.createElement('canvas');
c.width = 200; c.height = 100;
const g = c.getContext('2d');
g.fillStyle = hex; g.fillRect(0,0,c.width,c.height);
// roof window
g.fillStyle = 'rgba(255,255,255,0.18)';
g.fillRect(50,18,100,36);
// highlight
g.fillStyle = 'rgba(255,255,255,0.06)';
g.fillRect(0,0,c.width,c.height/2);
return c.toDataURL('image/png');
}

/* =========================
GAME STATE
========================= */
let game = {
money: 20000,
score: 0,
time: 0,
inVehicle: null,
player: null,
vehicles: [], // all vehicles (parked + NPC)
keys: {},
mission: null,
debug: false
};

/* =========================
Data: Voitures de luxe (fictives)
========================= */
const LUX_CARS = [
{ id:'aurora-x', name:'Aurora X', color:'#1f8fff', price:12000, topSpeed:260, accel:320, handling:0.9 },
{ id:'valence-gt', name:'Valence GT', color:'#ff5a8a', price:15500, topSpeed:300, accel:420, handling:0.85 },
{ id:'zephyr-s', name:'Zephyr S', color:'#ffd24d', price:20000, topSpeed:330, accel:520, handling:0.82 },
{ id:'novum-elite', name:'Novum Elite', color:'#8b5cff', price:32000, topSpeed:360, accel:660, handling:0.95 },
{ id:'phantom-r', name:'Phantom R', color:'#2d2d2d', price:45000, topSpeed:400, accel:820, handling:0.78 }
];

/* =========================
ENTITIES: Player & Vehicle
========================= */
class Player {
constructor(x,y){
this.pos = {x,y};
this.speed = 160;
this.size = 20;
this.color = '#00d1ff';
this.heading = 0;
}
update(dt){
let dx=0, dy=0;
if (game.keys['ArrowUp']||game.keys['w']) dy -= 1;
if (game.keys['ArrowDown']||game.keys['s']) dy += 1;
if (game.keys['ArrowLeft']||game.keys['a']) dx -= 1;
if (game.keys['ArrowRight']||game.keys['d']) dx += 1;
if (dx!==0||dy!==0){
const len = Math.hypot(dx,dy);
dx/=len; dy/=len;
this.pos.x += dx * this.speed * dt;
this.pos.y += dy * this.speed * dt;
this.heading = Math.atan2(dy,dx);
}
this.pos.x = clamp(this.pos.x, 0, W);
this.pos.y = clamp(this.pos.y, 0, H);
}
draw(ctx){
ctx.save();
ctx.translate(this.pos.x, this.pos.y);
ctx.rotate(this.heading);
ctx.fillStyle = this.color;
ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
ctx.restore();
}
}

class Vehicle {
constructor(spec, x,y, isNPC=false){
this.spec = spec;
this.pos = {x,y};
this.vel = {x:0,y:0};
this.angle = 0;
this.width = 56; this.height = 32;
this.topSpeed = spec.topSpeed / 2.5; // scale to px/s
this.accel = spec.accel / 2.5;
this.handling = spec.handling;
this.color = spec.color;
this.owned = false;
this.price = spec.price;
this.id = spec.id + '-' + Math.floor(rand(1000,9999));
this.isNPC = isNPC;
this.health = 100;
this.sprite = new Image();
this.sprite.src = SPRITES[spec.id] || '';
}

update(dt){
if (this.isNPC){
this.pos.x += Math.cos(this.angle) * (this.topSpeed * 0.45) * dt;
this.pos.y += Math.sin(this.angle) * (this.topSpeed * 0.45) * dt;
if (Math.random() < 0.008) this.angle += rand(-0.7,0.7);
if (this.pos.x < 0 || this.pos.x > W) this.angle = Math.PI - this.angle;
if (this.pos.y < 0 || this.pos.y > H) this.angle = -this.angle;
}
}

draw(ctx){
ctx.save();
ctx.translate(this.pos.x, this.pos.y);
ctx.rotate(this.angle);
// draw sprite if loaded; fallback to rounded rect
if (this.sprite && this.sprite.complete){
const sw = this.width*1.6, sh = this.height*1.6;
ctx.drawImage(this.sprite, -sw/2, -sh/2, sw, sh);
} else {
roundRect(ctx, -this.width/2, -this.height/2, this.width, this.height, 6, true, false, this.color);
}
// wheels
ctx.fillStyle = '#0b0b0b';
ctx.fillRect(-this.width/2 + 6, this.height/2 - 6, 10, 4);
ctx.fillRect(this.width/2 - 16, this.height/2 - 6, 10, 4);
ctx.restore();
}
}

/* =========================
HELPERS: drawing
========================= */
function roundRect(ctx, x, y, w, h, r, fill=true, stroke=false, color='#fff'){
ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.arcTo(x + w, y, x + w, y + h, r);
ctx.arcTo(x + w, y + h, x, y + h, r);
ctx.arcTo(x, y + h, x, y, r);
ctx.arcTo(x, y, x + w, y, r);
ctx.closePath();
if (fill){ ctx.fillStyle = color; ctx.fill(); }
if (stroke){ ctx.stroke(); }
}

/* =========================
UI: build garage
========================= */
function buildGarageUI(){
const el = document.getElementById('car-list');
el.innerHTML = '';
LUX_CARS.forEach(spec => {
const item = document.createElement('div'); item.className='car-item';
const thumb = document.createElement('div'); thumb.className='car-thumb';
thumb.style.background = spec.color;
thumb.innerText = spec.name.split(' ')[0].slice(0,3).toUpperCase();
const meta = document.createElement('div'); meta.className='car-meta';
meta.innerHTML = `<div class="title">${spec.name}</div>
<div class="desc">Vmax: ${spec.topSpeed} km/h • Acc: ${spec.accel}</div>
<div class="buy"><button data-id="${spec.id}">Acheter $${spec.price}</button></div>`;
item.appendChild(thumb); item.appendChild(meta);
el.appendChild(item);
});

el.querySelectorAll('button').forEach(btn => {
btn.addEventListener('click', (e) => {
const id = e.target.dataset.id;
const spec = LUX_CARS.find(c => c.id === id);
if (!spec) return;
if (game.money >= spec.price){
game.money -= spec.price;
const car = new Vehicle(spec, rand(140, W-140), rand(140, H-140), false);
car.owned = true;
game.vehicles.push(car);
updateHUD();
alert(`Tu as acheté la ${spec.name} !`);
} else {
alert("Pas assez d'argent.");
}
});
});
}

/* =========================
INIT: spawn player & vehicles
========================= */
function init(){
game.player = new Player(W/2, H/2 + 120);
// spawn showroom cars
LUX_CARS.slice(0,3).forEach((spec, i) => {
const x = 120 + i*220;
const y = H/2 - 160 + rand(-40,40);
const car = new Vehicle(spec, x, y, false);
car.owned = false;
game.vehicles.push(car);
});
// spawn NPC cars
for (let i=0;i<9;i++){
const spec = LUX_CARS[Math.floor(rand(0,LUX_CARS.length))];
const c = new Vehicle(spec, rand(60,W-60), rand(60,H-60), true);
c.angle = rand(0,Math.PI*2);
game.vehicles.push(c);
}
buildGarageUI();
updateHUD();
}

/* =========================
INPUT
========================= */
window.addEventListener('keydown', e => {
game.keys[e.key] = true;
if (e.key === 'e' || e.key === 'E') handleEnterExit();
if (e.key === 'F3') game.debug = !game.debug;
});
window.addEventListener('keyup', e => {
delete game.keys[e.key];
});

/* =========================
ENTER / EXIT vehicle
========================= */
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

function handleEnterExit(){
if (game.inVehicle){
const veh = game.inVehicle;
game.player.pos.x = veh.pos.x + Math.cos(veh.angle)*(veh.width + 18);
game.player.pos.y = veh.pos.y + Math.sin(veh.angle)*(veh.height + 18);
game.inVehicle = null;
return;
}
let best=null,bd=9999;
for (const v of game.vehicles){
const d = dist(v.pos, game.player.pos);
if (d < 58 && d < bd && !v.isNPC){
bd = d; best = v;
}
}
if (best){
game.inVehicle = best;
game.player.pos.x = best.pos.x;
game.player.pos.y = best.pos.y;
}
}

/* =========================
Driving physics (simple)
========================= */
function driveVehicle(veh, dt){
let forward = 0;
if (game.keys['ArrowUp'] || game.keys['w']) forward = 1;
if (game.keys['ArrowDown'] || game.keys['s']) forward = -0.6;
const braking = game.keys[' '];
let speed = Math.hypot(veh.vel.x, veh.vel.y);
if (forward !== 0){
speed += forward * veh.accel * dt;
} else {
speed *= 0.985;
}
if (braking) speed *= 0.82;
speed = clamp(speed, -veh.topSpeed*0.6, veh.topSpeed);

let turn = 0;
if (game.keys['ArrowLeft']||game.keys['a']) turn = -1;
if (game.keys['ArrowRight']||game.keys['d']) turn = 1;
veh.angle += turn * veh.handling * (0.0028 * (1 + speed/veh.topSpeed)) * 60 * dt;

veh.vel.x = Math.cos(veh.angle) * speed;
veh.vel.y = Math.sin(veh.angle) * speed;

veh.pos.x += veh.vel.x * dt;
veh.pos.y += veh.vel.y * dt;

veh.pos.x = clamp(veh.pos.x, 0, W);
veh.pos.y = clamp(veh.pos.y, 0, H);
}

/* =========================
UPDATE & RENDER loop
========================= */
let last = performance.now();
function loop(now){
const dt = Math.min(0.05, (now - last)/1000);
last = now;
game.time += dt;

if (!game.inVehicle) game.player.update(dt);

game.vehicles.forEach(v => {
if (game.inVehicle === v){
driveVehicle(v, dt);
game.player.pos.x = v.pos.x;
game.player.pos.y = v.pos.y;
} else {
v.update(dt);
}

// collision separation between vehicles
for (const o of game.vehicles){
if (o === v) continue;
const d = dist(v.pos, o.pos);
const minD = (v.width + o.width)/2;
if (d > 0 && d < minD){
const nx = (v.pos.x - o.pos.x)/d;
const ny = (v.pos.y - o.pos.y)/d;
const overlap = (minD - d) * 0.45;
v.pos.x += nx * overlap;
v.pos.y += ny * overlap;
o.pos.x -= nx * overlap;
o.pos.y -= ny * overlap;
}
}
});

// mission logic
if (game.mission && game.mission.active){
const m = game.mission;
if (dist({x:m.target.x,y:m.target.y}, game.player.pos) < 34){
game.money += m.reward;
game.score += m.points;
document.getElementById('mission-box').innerText = "Mission terminée ! Récompense: $" + m.reward;
game.mission.active = false;
updateHUD();
}
}

render();
requestAnimationFrame(loop);
}

/* =========================
RENDER
========================= */
function render(){
ctx.clearRect(0,0,W,H);
drawCityBackground(ctx);

// draw vehicles
for (const v of game.vehicles){
v.draw(ctx);
}
// draw player on top if on foot
if (!game.inVehicle) game.player.draw(ctx);

drawHUD(ctx);

if (game.debug){
ctx.fillStyle = '#fff';
ctx.fillText(`Vehicles: ${game.vehicles.length}`, 10, H-10);
}
}

function drawCityBackground(ctx){
ctx.fillStyle = '#0f1f10';
ctx.fillRect(0,0,W,H);
// roads
ctx.fillStyle = '#2f2f2f';
ctx.fillRect(0, H/3 - 68, W, 136);
ctx.fillRect(W/3 - 90, 0, 180, H);
// center plaza
ctx.fillStyle = '#0b0b0b';
ctx.fillRect(W/2 - 160, H/2 - 120, 320, 240);
// parking stripes
for (let i=0;i<10;i++){
ctx.fillStyle = 'rgba(255,255,255,0.04)';
ctx.fillRect(90 + i*95, H/2 + 140, 72, 40);
}
}

/* HUD & Minimap */
function drawHUD(ctx){
const mw = 180, mh = 110;
const mx = 8, my = H - mh - 8;
ctx.save();
ctx.translate(mx,my);
roundRect(ctx, 0, 0, mw, mh, 8, true, false, 'rgba(0,0,0,0.6)');
for (const v of game.vehicles){
const rx = (v.pos.x / W) * (mw-12) + 6;
const ry = (v.pos.y / H) * (mh-12) + 6;
ctx.fillStyle = v.isNPC ? '#ff6b6b' : v.owned ? '#ffd24d' : '#8be1ff';
ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI*2); ctx.fill();
}
const prx = (game.player.pos.x / W) * (mw-12) + 6;
const pry = (game.player.pos.y / H) * (mh-12) + 6;
ctx.fillStyle = '#00ffea'; ctx.beginPath(); ctx.arc(prx, pry, 4, 0, Math.PI*2); ctx.fill();
ctx.restore();

// mission indicator on world
if (game.mission && game.mission.active){
ctx.fillStyle = '#ffea4d';
ctx.beginPath(); ctx.arc(game.mission.target.x, game.mission.target.y, 10, 0, Math.PI*2); ctx.fill();
ctx.fillStyle = '#111'; ctx.font = "12px Inter"; ctx.fillText("Mission", game.mission.target.x - 18, game.mission.target.y - 16);
}
}

/* =========================
HUD DOM updates
========================= */
function updateHUD(){
document.getElementById('money-value').innerText = Math.floor(game.money);
document.getElementById('score-value').innerText = Math.floor(game.score);
}

/* =========================
Save / Load using localStorage
========================= */
document.getElementById('save-btn').addEventListener('click', ()=>{
const data = {
money: game.money,
score: game.score,
vehicles: game.vehicles.filter(v=>v.owned).map(v => ({specId: v.spec.id, x:v.pos.x, y:v.pos.y, id:v.id}))
};
localStorage.setItem('minicity_save_v1', JSON.stringify(data));
alert('Partie sauvegardée.');
});
document.getElementById('load-btn').addEventListener('click', ()=>{
const raw = localStorage.getItem('minicity_save_v1');
if (!raw) { alert('Aucune sauvegarde.'); return; }
try {
const data = JSON.parse(raw);
game.money = data.money || game.money;
game.score = data.score || game.score;
data.vehicles = data.vehicles || [];
data.vehicles.forEach(vd => {
const spec = LUX_CARS.find(s => s.id === vd.specId);
if (spec){
const car = new Vehicle(spec, vd.x||rand(100,W-100), vd.y||rand(100,H-100), false);
car.owned = true; car.id = vd.id || car.id;
game.vehicles.push(car);
}
});
updateHUD(); buildGarageUI();
alert('Partie chargée.');
} catch (err) {
alert('Erreur lors du chargement.');
}
});

/* =========================
Missions
========================= */
document.getElementById('start-mission').addEventListener('click', ()=>{
if (game.mission && game.mission.active){ alert('Mission en cours'); return; }
const target = { x: rand(80, W-80), y: rand(80, H-80) };
game.mission = { active: true, target, reward: Math.floor(rand(600,2400)), points: Math.floor(rand(40,220)) };
document.getElementById('mission-box').innerText = `Livrez-vous à la position indiquée. Récompense: $${game.mission.reward}`;
});

/* =========================
Misc dev helpers
========================= */
canvas.addEventListener('dblclick', (e)=> {
const r = canvas.getBoundingClientRect();
const x = e.clientX - r.left, y = e.clientY - r.top;
game.player.pos.x = x; game.player.pos.y = y;
});

/* =========================
START
========================= */
init();
updateHUD();
requestAnimationFrame(loop);
