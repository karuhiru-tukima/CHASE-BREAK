import { roads, roadNodes, plazas, parks, buildings, trees, sampleRoad, CITY_SIZE } from './city.js';
const TAU = Math.PI * 2;
const neonColors = ['#f66aaf', '#35dce1', '#eebc5c', '#a88dff'];
function glow(ctx,x,y,radius,color){const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color);g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);}
function roadPath(ctx,road){ctx.beginPath();road.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));}
export function drawCity(ctx,cam,view,t){
  // Draw every visible district, including negative coordinates and map seams.
  for(let ty=Math.floor((cam.y-view)/CITY_SIZE);ty<=Math.floor((cam.y+view)/CITY_SIZE);ty++)for(let tx=Math.floor((cam.x-view)/CITY_SIZE);tx<=Math.floor((cam.x+view)/CITY_SIZE);tx++){
    ctx.save();ctx.translate(tx*CITY_SIZE,ty*CITY_SIZE);ctx.beginPath();ctx.rect(0,0,CITY_SIZE,CITY_SIZE);ctx.clip();
    drawDistrict(ctx,{x:cam.x-tx*CITY_SIZE,y:cam.y-ty*CITY_SIZE},view,t);ctx.restore();
  }
}
function drawDistrict(ctx,cam,view,t){
  const visible=o=>Math.abs(o.x-cam.x)<view&&Math.abs(o.y-cam.y)<view;
  // Irregular parks and city land fill the spaces between curved streets.
  ctx.fillStyle='#1b2425';ctx.fillRect(0,0,3300,3300);
  for(const park of parks){ctx.beginPath();park.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle='#20372c';ctx.fill();ctx.strokeStyle='#40634c66';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#a9b7a252';ctx.font='10px monospace';ctx.fillText(park.name,park.points[0][0]+25,park.points[0][1]+55);}
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const road of roads){roadPath(ctx,road);ctx.strokeStyle='#3c4243';ctx.lineWidth=road.width+24;ctx.stroke();roadPath(ctx,road);ctx.strokeStyle='#737c7140';ctx.lineWidth=road.width+26;ctx.stroke();roadPath(ctx,road);ctx.strokeStyle='#1b222a';ctx.lineWidth=road.width;ctx.stroke();}
  for(const road of roads){
    roadPath(ctx,road);ctx.strokeStyle=road.width>=135?'#d0af6c66':'#c0c7c139';ctx.lineWidth=road.width>=135?4:1.5;ctx.setLineDash(road.width>=135?[]:[16,22]);ctx.stroke();
    if(road.width>=135){ctx.lineWidth=1.5;ctx.strokeStyle='#1b222a';ctx.stroke();}ctx.setLineDash([]);
    for(let d=130;d<road.length;d+=180){const p=sampleRoad(road,d);if(!visible(p))continue;const side=(Math.floor(d/180)%2)?-1:1,o=road.width/2+9,lx=p.x-Math.sin(p.angle)*o*side,ly=p.y+Math.cos(p.angle)*o*side;glow(ctx,lx,ly,62,side>0?'#47c7d51a':'#ffdb9d1b');ctx.fillStyle=side>0?'#9de9e5':'#efdab7';ctx.fillRect(lx-1.5,ly-1.5,3,3);}
    for(let d=290;d<road.length;d+=510){const p=sampleRoad(road,d);if(!visible(p))continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='#b4c3b23b';ctx.font='9px monospace';ctx.fillText(road.name,-38,road.width/2-12);ctx.restore();}
  }
  // Only real junctions get crossings and signals; curved samples remain invisible.
  for(const n of roadNodes){if(n.links.length<3||!visible(n)||plazas.some(p=>Math.hypot(p.x-n.x,p.y-n.y)<p.r+25))continue;
    for(const link of n.links){const q=roadNodes[link.to],angle=Math.atan2(q.y-n.y,q.x-n.x);ctx.save();ctx.translate(n.x,n.y);ctx.rotate(angle);ctx.fillStyle='#d9e0d150';for(let j=-3;j<=3;j++)ctx.fillRect(61,j*11,16,5);ctx.fillStyle=(Math.floor(t/9)+n.id)%2?'#ff6c80':'#75e3b5';ctx.fillRect(70,-48,4,4);ctx.restore();}
  }
  for(const p of plazas){if(!visible(p))continue;ctx.fillStyle='#343b3f';ctx.beginPath();ctx.arc(p.x,p.y,p.r+12,0,TAU);ctx.fill();ctx.fillStyle='#202930';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();ctx.strokeStyle='#62c9cc45';ctx.lineWidth=2;ctx.setLineDash([10,13]);ctx.beginPath();ctx.arc(p.x,p.y,p.r-14,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#a4d5cc65';ctx.font='10px monospace';ctx.fillText(p.name,p.x-p.r*.5,p.y+p.r*.62);}
  ctx.lineCap='butt';
  for (const b of buildings) {
    if (!visible(b)) continue;
    const { w, h, seed, kind } = b, x = -w / 2, y = -h / 2, tall = kind === 'tower', industrial = kind === 'warehouse' || kind === 'container', roof = industrial ? '#374046' : tall ? '#25313c' : kind === 'apartment' ? '#3b3d41' : '#363638';
    ctx.save(); ctx.translate(b.x + w / 2, b.y + h / 2); ctx.rotate(b.angle || 0);
    const depth = tall ? 23 : industrial ? 5 : 9;
    ctx.fillStyle = '#03070a70'; ctx.fillRect(x + depth, y + depth * 1.5, w + depth * .3, h);
    ctx.fillStyle = '#141e27'; ctx.fillRect(x, y + 6, w, h + depth); ctx.fillStyle = roof; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#a4b3b238'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#111b214d'; ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
    if (kind === 'container') {
      ctx.strokeStyle = '#a2b8be38'; for (let i = 5; i < w; i += 6) { ctx.beginPath(); ctx.moveTo(x + i, y + 3); ctx.lineTo(x + i, y + h - 3); ctx.stroke(); }
    } else if (kind === 'canopy') {
      ctx.fillStyle = '#a3aca8'; ctx.fillRect(x + 5, y + 5, w - 10, h - 10); ctx.fillStyle = '#2cd5c5'; ctx.fillRect(x + 1, y + h - 6, w - 2, 4); glow(ctx, x + w / 2, y + h + 3, w * .6, '#2cd5c52a');
    } else {
      const ventCount = Math.max(1, Math.min(6, Math.floor(w * h / 5200)));
      for (let i = 0; i < ventCount; i++) {
        const vx = x + 12 + ((seed * 13 + i * 43) % Math.max(1, Math.floor(w - 40))), vy = y + 12 + ((seed * 7 + i * 61) % Math.max(1, Math.floor(h - 39)));
        ctx.fillStyle = '#09121970'; ctx.fillRect(vx + 4, vy + 4, 22, 18); ctx.fillStyle = '#526066'; ctx.fillRect(vx, vy, 20, 16); ctx.fillStyle = '#28373e'; ctx.beginPath(); ctx.arc(vx + 8, vy + 8, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a3b5ae45'; ctx.lineWidth = 1; ctx.strokeRect(vx + 1, vy + 1, 18, 14);
      }
      if (tall) { ctx.fillStyle = '#1b2734'; ctx.fillRect(x + w * .28, y + h * .25, w * .44, h * .44); ctx.strokeStyle = '#68b0c060'; ctx.strokeRect(x + w * .28, y + h * .25, w * .44, h * .44); ctx.fillStyle = '#e7879550'; ctx.fillRect(x + w * .5, y + h * .4, 2, 19); }
      else if (seed % 3 === 0 && w > 55 && h > 50) { ctx.fillStyle = '#152936'; ctx.fillRect(x + w - 40, y + h - 31, 25, 17); ctx.strokeStyle = '#51768e60'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + w - 40 + i * 8, y + h - 31); ctx.lineTo(x + w - 40 + i * 8, y + h - 14); ctx.stroke(); } }
      // Unevenly lit windows along the visible facade.
      for (let i = 9; i < w - 7; i += 13) { ctx.fillStyle = (i + seed) % 4 === 0 ? '#78dadd7a' : (i + seed) % 3 ? '#e9bf7660' : '#17252e'; ctx.fillRect(x + i, y + h + 2, 6, Math.max(3, depth - 3)); }
      const neon = neonColors[(seed + b.district) % neonColors.length];
      if (kind === 'shop' || kind === 'garage' || kind === 'kiosk' || (tall && seed % 2 === 0)) {
        const signWidth = Math.min(w - 10, tall ? 100 : 72), sx = x + 5, sy = y + h - 14;
        glow(ctx, sx + signWidth / 2, sy + 12, signWidth * .9, `${neon}24`);
        ctx.fillStyle = '#0a141bea'; ctx.fillRect(sx, sy - 2, signWidth, 17); ctx.strokeStyle = neon; ctx.lineWidth = 1; ctx.strokeRect(sx, sy - 2, signWidth, 17);
        ctx.fillStyle = neon; ctx.font = `bold ${signWidth < 45 ? 6 : 8}px monospace`;
        ctx.fillText(['RAMEN 24', 'NEON BAR', 'ARCADE', 'HOTEL 88', 'AUTO LAB', 'NIGHT MART'][seed % 6], sx + 3, sy + 9, signWidth - 6);
      }
      if (kind === 'apartment' && seed % 2 === 0) { ctx.fillStyle = '#ff70acb0'; ctx.fillRect(x + w - 3, y + 10, 3, Math.min(45, h - 20)); glow(ctx, x + w + 1, y + 25, 35, '#ff70ac18'); }
    }
    ctx.restore();
  }
  for (const tree of trees) {
    if (!visible(tree)) continue;
    ctx.fillStyle = '#00000048'; ctx.beginPath(); ctx.ellipse(tree.x + 5, tree.y + 7, tree.r, tree.r * .8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = tree.seed > .5 ? '#284a3b' : '#233f33'; ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#42634b70'; ctx.beginPath(); ctx.arc(tree.x - 3, tree.y - 3, tree.r * .55, 0, TAU); ctx.fill();
  }
}
