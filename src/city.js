export const CITY_SIZE = 3300;
export const roads=[],roadNodes=[],roadEdges=[],buildings=[],trees=[],parkedCars=[];
export const plazas=[{x:1600,y:1600,r:116,name:'NEON JUNCTION'},{x:700,y:950,r:76,name:'OLD TOWN'},{x:2520,y:2150,r:88,name:'DOCKSIDE'}];
export const parks=[{points:[[830,1750],[1110,1800],[1360,1700],[1460,1930],[1210,2170],[930,2110]],name:'MIDNIGHT GARDEN'},{points:[[1640,650],[1820,590],[1950,810],[1880,1080],[1710,1170]],name:'CANOPY PARK'},{points:[[420,1550],[560,1530],[690,1600],[580,1720],[410,1780]],name:'LANTERN GREEN'}];
let state=78249;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const range=(a,b)=>a+random()*(b-a),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function makeRoad(name,width,pairs,curved=true){
  const input=pairs.map(([x,y])=>({x,y})),points=[];
  for(let i=0;i<input.length-1;i++){
    const p0=input[Math.max(0,i-1)],p1=input[i],p2=input[i+1],p3=input[Math.min(input.length-1,i+2)],count=curved?Math.ceil(distance(p1,p2)/48):1;
    for(let j=0;j<count;j++){const t=j/count,t2=t*t,t3=t2*t;points.push(curved?{x:.5*(2*p1.x+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),y:.5*(2*p1.y+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)}:{...p1});}
  }
  points.push({...input.at(-1)});const segments=[];let length=0;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=distance(a,b);segments.push({a,b,length:len,offset:length});length+=len;}
  roads.push({name,width,points,segments,length});
}
makeRoad('NEON BOULEVARD',146,[[90,1920],[600,1800],[1100,1640],[1600,1600],[2050,1430],[2500,1200],[3200,1120]]);
makeRoad('CENTRAL AVENUE',140,[[1400,120],[1430,610],[1550,1120],[1600,1600],[1820,2150],[1750,2700],[1920,3220]]);
makeRoad('NIGHT LOOP',118,[[520,650],[1100,390],[1990,420],[2790,780],[2940,1660],[2650,2540],[1900,2920],[1020,2820],[420,2230],[270,1430],[520,650]]);
makeRoad('LANTERN STREET',88,[[520,650],[700,950],[1040,1000],[1260,1250],[1550,1120]]);
makeRoad('OLD MARKET',82,[[270,1430],[650,1280],[850,1410],[1100,1640]]);
makeRoad('KITE LANE',78,[[700,950],[1050,680],[1430,610]]);
makeRoad('GARDEN DRIVE',104,[[600,1800],[750,2180],[1100,2300],[1370,2200],[1820,2150]]);
makeRoad('HILLSIDE',86,[[420,2230],[700,2520],[1020,2820]]);
makeRoad('SOUTH TERRACE',82,[[1100,2300],[1160,2670],[1400,2830]]);
makeRoad('SKYLINE ROAD',108,[[1990,420],[2100,820],[2050,1430]]);
makeRoad('EAST ARCADE',84,[[2100,820],[2460,650],[2790,780]]);
makeRoad('WAREHOUSE LINK',106,[[2050,1430],[2430,1640],[2940,1660]]);
makeRoad('HARBOR SPUR',100,[[2500,1200],[2840,1320],[3150,1560]]);
makeRoad('DOCKSIDE',112,[[1820,2150],[2180,1980],[2520,2150],[2650,2540]]);
makeRoad('FOUNDRY ROAD',94,[[2180,1980],[2430,1640]],false);
makeRoad('FREIGHT YARD',96,[[2520,2150],[2960,2280],[3160,2620]],false);
makeRoad('SOUTH CONNECTOR',92,[[1750,2700],[2110,2510],[2650,2540]]);
makeRoad('ARCADE ALLEY',70,[[1040,1000],[1070,1200],[850,1410]]);
makeRoad('STATION APPROACH',78,[[1370,2200],[1440,2460],[1750,2700]]);
// Matching exits connect each repeated district to its four neighbours.
makeRoad('WEST GATE',130,[[0,1920],[90,1920]],false);
makeRoad('EAST GATE',130,[[3200,1120],[3160,1550],[3160,1840],[3220,1920],[3300,1920]]);
makeRoad('NORTH GATE',126,[[1920,0],[1920,90],[1780,170],[1560,190],[1400,120]]);
makeRoad('SOUTH GATE',126,[[1920,3220],[1920,3300]],false);
// Outlying neighbourhoods continue all the way to the repeated district seams.
makeRoad('OUTER BOULEVARD',108,[[180,900],[450,350],[1150,210],[1920,180],[2720,260],[3090,720],[3120,1470],[3100,2200],[2930,2890],[2350,3090],[1550,3110],[720,3040],[210,2680],[165,1920],[180,900]]);
makeRoad('WEST ARCADE EXIT',94,[[0,850],[70,850],[180,900]]);
makeRoad('EAST ARCADE EXIT',94,[[3090,720],[3180,850],[3300,850]]);
makeRoad('WEST FREIGHT EXIT',102,[[0,2650],[80,2650],[210,2680]]);
makeRoad('EAST FREIGHT EXIT',102,[[2930,2890],[3170,2650],[3300,2650]]);
makeRoad('NORTH MARKET EXIT',92,[[700,0],[700,90],[1150,210]]);
makeRoad('SOUTH MARKET EXIT',92,[[720,3040],[700,3210],[700,3300]]);
makeRoad('NORTH DOCK EXIT',100,[[2700,0],[2700,90],[2720,260]]);
makeRoad('SOUTH DOCK EXIT',100,[[2350,3090],[2700,3200],[2700,3300]]);
makeRoad('NORTHWEST LINK',88,[[520,650],[450,350]]);
makeRoad('NORTHEAST LINK',96,[[2790,780],[3090,720]]);
makeRoad('NORTHWEST QUARTER',86,[[180,900],[120,310],[180,130],[700,90]]);
makeRoad('NORTHEAST QUARTER',88,[[2720,260],[3070,160],[3190,330],[3090,720]]);
makeRoad('SOUTHWEST QUARTER',86,[[210,2680],[110,3100],[340,3190],[720,3040]]);
makeRoad('SOUTHEAST QUARTER',100,[[2930,2890],[3180,3150],[2700,3200]]);
function project(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den));return{x:a.x+dx*t,y:a.y+dy*t,t};}
export function sampleRoad(road,position){const d=Math.max(0,Math.min(road.length,position)),s=road.segments.find(s=>s.offset+s.length>=d)||road.segments.at(-1),t=(d-s.offset)/s.length;return{x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t,angle:Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)};}
export function distanceToRoad(p){p={x:wrapCity(p.x),y:wrapCity(p.y)};let best=Infinity;for(const r of roads)for(const s of r.segments)best=Math.min(best,distance(p,project(p,s.a,s.b))-r.width/2);return best;}
// Every geometric crossing becomes a real intersection in the pursuit graph.
const raw=roads.flatMap((r,ri)=>r.segments.map(s=>({...s,ri,cuts:[0,1]}))),cross=(ax,ay,bx,by)=>ax*by-ay*bx;
for(let i=0;i<raw.length;i++)for(let j=i+1;j<raw.length;j++){
  const a=raw[i],b=raw[j];if(Math.max(a.a.x,a.b.x)+.01<Math.min(b.a.x,b.b.x)||Math.max(b.a.x,b.b.x)+.01<Math.min(a.a.x,a.b.x)||Math.max(a.a.y,a.b.y)+.01<Math.min(b.a.y,b.b.y)||Math.max(b.a.y,b.b.y)+.01<Math.min(a.a.y,a.b.y))continue;
  const ax=a.b.x-a.a.x,ay=a.b.y-a.a.y,bx=b.b.x-b.a.x,by=b.b.y-b.a.y,det=cross(ax,ay,bx,by);if(Math.abs(det)<.0001)continue;
  const dx=b.a.x-a.a.x,dy=b.a.y-a.a.y,t=cross(dx,dy,bx,by)/det,u=cross(dx,dy,ax,ay)/det;
  if(t>=-.00001&&t<=1.00001&&u>=-.00001&&u<=1.00001){a.cuts.push(Math.max(0,Math.min(1,t)));b.cuts.push(Math.max(0,Math.min(1,u)));}
}
const nodeKeys=new Map();
function graphNode(p){const key=`${p.x.toFixed(2)},${p.y.toFixed(2)}`;if(nodeKeys.has(key))return nodeKeys.get(key);const id=roadNodes.length;roadNodes.push({...p,id,links:[]});nodeKeys.set(key,id);return id;}
for(const s of raw){const cuts=[...new Set(s.cuts.map(v=>Number(v.toFixed(7))))].sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){
  const point=t=>({x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t}),a=graphNode(point(cuts[i-1])),b=graphNode(point(cuts[i]));if(a===b)continue;const length=distance(roadNodes[a],roadNodes[b]);if(length<.02)continue;
  const edge={id:roadEdges.length,a,b,length,road:s.ri};roadEdges.push(edge);roadNodes[a].links.push({to:b,length,edge:edge.id});roadNodes[b].links.push({to:a,length,edge:edge.id});
}}
export const wrapCity = value => ((value % CITY_SIZE) + CITY_SIZE) % CITY_SIZE;
export function nearestRoadNode(p){const tx=Math.floor(p.x/CITY_SIZE),ty=Math.floor(p.y/CITY_SIZE),local={x:wrapCity(p.x),y:wrapCity(p.y)};let best=roadNodes[0],d=Infinity;for(const n of roadNodes){const next=distance(n,local);if(next<d){d=next;best=n;}}return{...best,x:best.x+tx*CITY_SIZE,y:best.y+ty*CITY_SIZE,key:`${tx},${ty},${best.id}`};}
function nearestEdge(p){let best=null,d=Infinity;for(const edge of roadEdges){const q=project(p,roadNodes[edge.a],roadNodes[edge.b]),next=distance(p,q);if(next<d){d=next;best={...q,edge};}}return best;}
function districtRoute(from,to){
  const start=nearestEdge(from),end=nearestEdge(to);if(!start||!end)return[];if(start.edge.id===end.edge.id)return[{x:start.x,y:start.y},{x:end.x,y:end.y}];
  const costs=new Map(),parents=new Map(),open=new Set();for(const n of[start.edge.a,start.edge.b]){costs.set(n,distance(start,roadNodes[n]));parents.set(n,null);open.add(n);}
  while(open.size){let u=null,best=Infinity;for(const n of open){const c=costs.get(n);if(c<best){best=c;u=n;}}open.delete(u);for(const link of roadNodes[u].links){const next=best+link.length;if(next<(costs.get(link.to)??Infinity)){costs.set(link.to,next);parents.set(link.to,u);open.add(link.to);}}}
  let last=[end.edge.a,end.edge.b].sort((a,b)=>(costs.get(a)??Infinity)+distance(roadNodes[a],end)-(costs.get(b)??Infinity)-distance(roadNodes[b],end))[0];if(!costs.has(last))return[];
  const path=[{x:end.x,y:end.y}];while(last!==null){path.unshift({x:roadNodes[last].x,y:roadNodes[last].y});last=parents.get(last);}path.unshift({x:start.x,y:start.y});return path;
}
const portals=new Map();
for(const n of roadNodes){const links=[];for(const [coordinate,boundary,axis,dx,dy]of[[n.x,0,'y',-1,0],[n.x,CITY_SIZE,'y',1,0],[n.y,0,'x',0,-1],[n.y,CITY_SIZE,'x',0,1]]){
  if(Math.abs(coordinate-boundary)>.01)continue;
  const opposite=roadNodes.find(q=>Math.abs(q[axis]-n[axis])<.01&&Math.abs(q[axis==='y'?'x':'y']-(boundary===0?CITY_SIZE:0))<.01);
  if(opposite)links.push({to:opposite.id,dx,dy});
}if(links.length)portals.set(n.id,links);}
export function roadRoute(from,to){
  const sx=Math.floor(from.x/CITY_SIZE),sy=Math.floor(from.y/CITY_SIZE),ex=Math.floor(to.x/CITY_SIZE),ey=Math.floor(to.y/CITY_SIZE);
  const a={x:wrapCity(from.x),y:wrapCity(from.y)},b={x:wrapCity(to.x),y:wrapCity(to.y)};
  if(sx===ex&&sy===ey)return districtRoute(a,b).map(p=>({x:p.x+sx*CITY_SIZE,y:p.y+sy*CITY_SIZE}));
  const start=nearestEdge(a),end=nearestEdge(b),goal={x:end.x+ex*CITY_SIZE,y:end.y+ey*CITY_SIZE};
  const key=(x,y,id)=>`${x},${y},${id}`,open=new Map(),costs=new Map(),parents=new Map(),states=new Map();
  const position=s=>({x:roadNodes[s.id].x+s.x*CITY_SIZE,y:roadNodes[s.id].y+s.y*CITY_SIZE});
  const add=(s,cost,parent)=>{const k=key(s.x,s.y,s.id);if(cost>=(costs.get(k)??Infinity))return;costs.set(k,cost);parents.set(k,parent);states.set(k,s);open.set(k,cost+distance(position(s),goal));};
  for(const id of[start.edge.a,start.edge.b])add({x:sx,y:sy,id},distance(start,roadNodes[id]),null);
  const minX=Math.min(sx,ex)-1,maxX=Math.max(sx,ex)+1,minY=Math.min(sy,ey)-1,maxY=Math.max(sy,ey)+1;
  while(open.size){let k=null,best=Infinity;for(const [candidate,score]of open)if(score<best){best=score;k=candidate;}open.delete(k);const s=states.get(k),cost=costs.get(k);
    if(s.x===ex&&s.y===ey&&(s.id===end.edge.a||s.id===end.edge.b)){const path=[goal];while(k!==null){path.unshift(position(states.get(k)));k=parents.get(k);}path.unshift({x:start.x+sx*CITY_SIZE,y:start.y+sy*CITY_SIZE});return path;}
    for(const link of roadNodes[s.id].links)add({...s,id:link.to},cost+link.length,k);
    for(const portal of portals.get(s.id)||[]){const x=s.x+portal.dx,y=s.y+portal.dy;if(x>=minX&&x<=maxX&&y>=minY&&y<=maxY)add({x,y,id:portal.to},cost+.001,k);}
  }
  return[];
}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>p.y)!==(yj>p.y)&&p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi)yes=!yes;}return yes;}
function corners(b,m=0){const c=Math.cos(b.angle),s=Math.sin(b.angle),cx=b.x+b.w/2,cy=b.y+b.h/2;return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>({x:cx+u*(b.w/2+m)*c-v*(b.h/2+m)*s,y:cy+u*(b.w/2+m)*s+v*(b.h/2+m)*c}));}
function overlap(a,b){const aa=corners(a,5),bb=corners(b,5);for(const angle of[a.angle,a.angle+Math.PI/2,b.angle,b.angle+Math.PI/2]){const c=Math.cos(angle),s=Math.sin(angle),u=aa.map(p=>p.x*c+p.y*s),v=bb.map(p=>p.x*c+p.y*s);if(Math.max(...u)<Math.min(...v)||Math.max(...v)<Math.min(...u))return false;}return true;}
function addBuilding(cx,cy,w,h,angle,kind,district){
  const b={x:cx-w/2,y:cy-h/2,w,h,angle,kind,district,seed:Math.floor(random()*10000),floors:kind==='tower'?12:3},cc=corners(b,8),samples=[...cc,{x:cx,y:cy}];
  for(let i=0;i<4;i++)for(let j=1;j<4;j++)samples.push({x:cc[i].x+(cc[(i+1)%4].x-cc[i].x)*j/4,y:cc[i].y+(cc[(i+1)%4].y-cc[i].y)*j/4});
  if(samples.some(p=>p.x<14||p.x>CITY_SIZE-14||p.y<14||p.y>CITY_SIZE-14||distanceToRoad(p)<8||plazas.some(q=>distance(p,q)<q.r+12)||parks.some(park=>inside(p,park.points))))return;
  if(buildings.some(a=>Math.abs(a.x-b.x)<260&&Math.abs(a.y-b.y)<260&&overlap(a,b)))return;buildings.push(b);
}
for(const road of roads)for(let d=range(35,100);d<road.length;d+=range(83,145)){
  const p=sampleRoad(road,d),district=p.x>2250&&p.y>1700?3:p.x>1900?1:p.y>2100?2:0;
  for(const side of[-1,1]){const industrial=district===3,w=industrial?range(95,165):range(46,108),h=industrial?range(70,120):range(45,98),offset=road.width/2+18+h/2+range(0,17),kind=industrial?'warehouse':random()<.19?'tower':random()<.45?'apartment':'shop';
    addBuilding(p.x-Math.sin(p.angle)*offset*side,p.y+Math.cos(p.angle)*offset*side,w,h,p.angle,kind,district);
    if(random()<.42){const extra=offset+h/2+range(60,105);addBuilding(p.x-Math.sin(p.angle)*extra*side,p.y+Math.cos(p.angle)*extra*side,range(45,95),range(45,90),p.angle+(random()-.5)*.16,'apartment',district);}
  }
}
// Smaller lots fill the outward-facing side of the perimeter roads as well.
for(let side=0;side<4;side++)for(let along=60;along<CITY_SIZE-50;along+=range(65,95))for(const depth of[55,145,245]){
  const inset=depth+range(-16,16),p=side===0?{x:inset,y:along}:side===1?{x:CITY_SIZE-inset,y:along}:side===2?{x:along,y:inset}:{x:along,y:CITY_SIZE-inset};
  if(distanceToRoad(p)>210)continue;
  const n=nearestRoadNode(p),next=roadNodes[n.links[0]?.to??n.id],angle=Math.atan2(next.y-wrapCity(n.y),next.x-wrapCity(n.x));
  addBuilding(p.x,p.y,range(40,72),range(35,62),angle,random()<.45?'shop':'apartment',side);
}
for(let side=0;side<4;side++)for(let along=65;along<CITY_SIZE-55;along+=range(60,78)){
  const inset=range(38,44),x=side===0?inset:side===1?CITY_SIZE-inset:along,y=side===2?inset:side===3?CITY_SIZE-inset:along;
  addBuilding(x,y,range(38,55),range(24,30),side<2?Math.PI/2:0,'shop',side);
}
for(const park of parks){const xs=park.points.map(p=>p[0]),ys=park.points.map(p=>p[1]);for(let i=0;i<100;i++){const p={x:range(Math.min(...xs),Math.max(...xs)),y:range(Math.min(...ys),Math.max(...ys))};if(inside(p,park.points)&&distanceToRoad(p)>25)trees.push({...p,r:range(9,15),seed:random()});}}
for(const road of roads)for(let d=110;d<road.length;d+=185){const p=sampleRoad(road,d),side=random()<.5?-1:1,o=road.width/2+10,q={x:p.x-Math.sin(p.angle)*o*side,y:p.y+Math.cos(p.angle)*o*side};if(distanceToRoad(q)>3&&!buildings.some(b=>Math.hypot(q.x-b.x-b.w/2,q.y-b.y-b.h/2)<Math.max(b.w,b.h)*.7))trees.push({...q,r:7,seed:random()});}
export const obstacles=[...buildings];
