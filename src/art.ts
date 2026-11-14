// @ts-nocheck — pixel-art rig ported 1:1 from the approved visual draft (david-mockup.html).
// ponytail: untyped drawing code; verified visually, not by tsc. Type it if it grows beyond the draft.
const rd=Math.round;
const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const ctx2=c=>{const g=c.getContext('2d');g.imageSmoothingEnabled=false;return g};

/* ---------- palette ---------- */
const C={
  out:'#1c1226',eye:'#1c1226',mouth:'#7a2a2a',mouthC:'#9a4a3a',
  skin:'#eab07c',skinD:'#bf7a52',skinL:'#f7d3a6',skinP:'#d99a6a',skinPD:'#a8683f',old:'#e0aa84',oldD:'#b07a58',
  red:'#b04a2a',redL:'#dc7a3e',dark:'#3a2620',gray:'#b0aaa2',grayD:'#7e786f',white:'#f3ecd9',whiteD:'#c4b89e',
  oat:'#dcc48e',oatD:'#ac8c5c',oatL:'#efe0b4',green:'#5e8c3e',
  indigo:'#40508e',indigoD:'#2b3566',indigoL:'#6474b4',purple:'#7c2e5c',purpleD:'#561f40',purpleL:'#a64c80',
  gold:'#f2c14e',goldD:'#c0882a',bronze:'#c97a3a',bronzeD:'#8c4e26',bronzeL:'#eaa760',iron:'#9aa4ae',ironL:'#dfe3e8',
  wood:'#7c4c2c',woodD:'#55331d',kilt:'#b53c3c',kiltD:'#7e2626',kiltL:'#d86060',olive:'#6a7a3a',oliveD:'#4a5a2a',oliveL:'#8a9a52',
  brown:'#8a5a3a',brownD:'#64402a',brownL:'#aa7a52',blue:'#56789a',blueD:'#3d5872',blueL:'#7898b8',
  beard:'#5e3a28',beardD:'#3e2418',
  teal:'#2e7d86',tealD:'#1d5560',tealL:'#56adb0',cream:'#efe5c9',creamD:'#c4b28c',creamL:'#fff6de',leather:'#7a4a2e',leatherD:'#55331d',
  hRed:'#b0442a',hRedL:'#e8823e',hRedD:'#7a2c1e',stone:'#c8bfae',stoneD:'#958a78',wool:'#f1ead8',woolD:'#c9bea4',armorG:'#5a4636',armorGD:'#3e2f24',armorGL:'#7a6048'
};

/* ---------- pixel primitives ---------- */
function R(g,x,y,w,h,c){w=rd(w);h=rd(h);if(w<=0||h<=0)return;g.fillStyle=c;g.fillRect(rd(x),rd(y),w,h)}
function L(g,x0,y0,x1,y1,t,c){g.fillStyle=c;const n=Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0)))),o=Math.floor(t/2);
  for(let i=0;i<=n;i++)g.fillRect(rd(x0+(x1-x0)*i/n)-o,rd(y0+(y1-y0)*i/n)-o,t,t)}
function poly(g,pts,c){g.fillStyle=c;let y0=1e9,y1=-1e9;pts.forEach(p=>{y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])});
  for(let y=Math.floor(y0);y<=Math.ceil(y1);y++){const yy=y+.5,xs=[];
    for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if((a[1]<=yy&&b[1]>yy)||(b[1]<=yy&&a[1]>yy))xs.push(a[0]+(yy-a[1])/(b[1]-a[1])*(b[0]-a[0]))}
    xs.sort((p,q)=>p-q);for(let i=0;i+1<xs.length;i+=2){const x0=rd(xs[i]),x1=rd(xs[i+1]);if(x1>=x0)g.fillRect(x0,y,x1-x0+1,1)}}}
function D(g,cx,cy,r,c){g.fillStyle=c;cx=rd(cx);cy=rd(cy);r=rd(r);for(let y=-r;y<=r;y++){const h=rd(Math.sqrt(r*r-y*y));g.fillRect(cx-h,cy+y,h*2+1,1)}}
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
function outline(c,col=C.out){const g=c.getContext('2d'),W=c.width,H=c.height,d=g.getImageData(0,0,W,H),a=d.data,m=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)m[i]=a[i*4+3]>0?1:0;const [r,gg,b]=rgb(col);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(m[i])continue;
    if((x>0&&m[i-1])||(x<W-1&&m[i+1])||(y>0&&m[i-W])||(y<H-1&&m[i+W])){a[i*4]=r;a[i*4+1]=gg;a[i*4+2]=b;a[i*4+3]=255}}
  g.putImageData(d,0,0)}

/* ---------- character drawer: one rig, many costumes ---------- */
function human(S,P,k,wu){
  k*=S.tall||1;
  if(S.gsword&&P.item==='staff')P={...P,item:'gsword'};
  const W=Math.ceil(wu*k)+4,H=Math.ceil(62*k)+6,c=mk(W,H),g=ctx2(c);
  const ox=rd(W/2),oy=H-3,X=u=>ox+u*k,Y=u=>oy+u*k;
  const b=P.bob||0,ln=P.lean||0,t3=Math.max(2,rd(3*k)),t4=Math.max(3,rd(4*k)),u1=Math.max(1,rd(k));
  const hipB=[-2,-13+b],hipF=[2,-13+b],shB=[-3+ln,-25+b],shF=[2+ln,-25+b];
  const fB=P.fB||[-3,0],fF=P.fF||[3,0],hB=P.hB||[-5+ln,-15+b],hF=P.hF||[5+ln,-15+b];
  const hc=[1+ln+(P.hx||0),-35+b+(P.hy||0)],r=rd(8*k);
  const post=[];
  function hand(h,col){const s=Math.max(2,rd(3*k));R(g,X(h[0])-Math.floor(s/2),Y(h[1])-Math.floor(s/2),s,s,col)}
  function arm(s,h,skin,sleeve,br){const sx=X(s[0]),sy=Y(s[1]),hx=X(h[0]),hy=Y(h[1]);
    L(g,sx,sy,hx,hy,t3,skin);if(br)L(g,sx+(hx-sx)*.6,sy+(hy-sy)*.6,hx,hy,t3,br);
    L(g,sx,sy,sx+(hx-sx)*.4,sy+(hy-sy)*.4,t3+1,sleeve);hand(h,skin)}
  function leg(h,f,col,kn,gr){const ft=Math.max(2,rd(2*k)),fx=X(f[0]),fy=Y(f[1])-ft;
    if(kn){L(g,X(h[0]),Y(h[1]),X(kn[0]),Y(kn[1]),t4,col);L(g,X(kn[0]),Y(kn[1]),fx,fy,t4,gr||col)}
    else{L(g,X(h[0]),Y(h[1]),fx,fy,t4,col);if(gr)L(g,X((h[0]+f[0])/2),Y((h[1]+f[1])/2),fx,fy,t4,gr)}
    R(g,fx-rd(2*k),fy,rd(6*k),ft+1,S.shoe)}
  function staffAt(px,py,a,b0,f0){const dx=Math.cos(a),dy=Math.sin(a),t2=Math.max(1,rd(2*k));
    L(g,px-dx*b0*k,py-dy*b0*k,px+dx*f0*k,py+dy*f0*k,t2,C.wood);const ex=px+dx*f0*k,ey=py+dy*f0*k,nx=dy,ny=-dx;
    const p1=[ex+dx*2*k+nx*1.5*k,ey+dy*2*k+ny*1.5*k],p2=[ex+dx*k+nx*4*k,ey+dy*k+ny*4*k],p3=[ex-dx*1.5*k+nx*4.5*k,ey-dy*1.5*k+ny*4.5*k];
    L(g,ex,ey,p1[0],p1[1],t2,C.wood);L(g,p1[0],p1[1],p2[0],p2[1],t2,C.wood);L(g,p2[0],p2[1],p3[0],p3[1],t2,C.wood)}
  function cape(){const fl=P.flow??.3,w=P.wave||0,lp=(a,c)=>a+(c-a)*fl;
    const pts=[[2+ln,-27+b],[-4+ln,-27+b],[lp(-7,-12)+ln,lp(-18,-24)+b+w*.5],[lp(-9,-21),lp(-6,-17)+b+w*1.5],[lp(-5,-13),lp(-8,-13)+b+w],[lp(-2,-7),lp(-5,-11)+b]].map(p=>[X(p[0]),Y(p[1])]);
    poly(g,pts,S.cape);L(g,X(-3+ln),Y(-24+b),X(lp(-6,-14)),Y(lp(-8,-15)+b+w),u1,S.capeD);
    L(g,pts[1][0],pts[1][1],pts[2][0],pts[2][1],u1,S.capeL)}
  function torso(){
    const y0=rd(Y(-26+b)),y1=rd(Y(S.robe?-2:-9+b)),hwT=S.broad?6.5:5,hwB=S.robe?9:8,sashY=rd(Y(-14+b)),sashH=Math.max(2,rd(2*k)),chestY=rd(Y(-16+b));
    for(let py=y0;py<=y1;py++){
      const f=(py-y0)/Math.max(1,y1-y0),hw=rd((hwT+(hwB-hwT)*f)*k),xc=rd(X(ln*(1-f)));
      R(g,xc-hw,py,hw*2+1,1,S.tunic);
      if(S.armor==='bands'&&py<chestY)R(g,xc-hw+1,py,hw*2-1,1,((py-y0)%Math.max(2,rd(3*k)))<Math.max(1,rd(2*k))?S.armorC:S.armorD);
      if(S.armor==='scale'&&py<y1-rd(2*k)){const row=Math.floor((py-y0)/Math.max(2,rd(2*k)));for(let px=xc-hw;px<=xc+hw;px++)R(g,px,py,1,1,((px+row*2)%4===0)?S.armorD:S.armorC)}
      if(S.robe&&py>sashY+sashH)R(g,xc-rd(k),py,1,1,S.tunicD);
      if(S.trim&&py>y1-rd(2*k))R(g,xc-hw,py,hw*2+1,1,S.trim);
      if(S.fringe&&py>=y1-u1+1)for(let px=xc-hw;px<=xc+hw;px+=2)R(g,px,py,1,1,S.tunicD);
      R(g,xc-hw,py,Math.max(1,rd(2*k)),1,S.tunicD);R(g,xc+hw,py,1,1,S.tunicL||S.tunic);
      if(py>=sashY&&py<sashY+sashH)R(g,xc-hw,py,hw*2+1,1,S.sash);
    }
    if(S.sashTail)R(g,X(ln*.5)+rd(4*k),sashY+sashH,Math.max(1,rd(1.5*k)),rd(4*k),S.sash);
    if(S.strap)L(g,X(2+ln),Y(-25+b),X(-4+ln*.3),Y(-14+b),Math.max(2,rd(1.4*k)),S.strap);
    if(S.pouch){const px=X(ln*.4)+rd(2.5*k),py=sashY+sashH;R(g,px,py,rd(4*k),rd(3.5*k),S.pouch);R(g,px,py,rd(4*k),u1,C.leatherD)}
    if(S.buckle)R(g,X(ln*.4)-rd(.5*k),sashY,Math.max(2,rd(1.6*k)),sashH,S.buckle);
  }
  function shield(){const sx=X(shB[0]+5),sy=Y(-18+b),rr=rd(6.5*k);
    D(g,sx,sy,rr,C.bronzeD);D(g,sx,sy,rr-u1,C.bronze);D(g,sx,sy,Math.max(1,rr-rd(3*k)),C.bronzeD);D(g,sx,sy,Math.max(1,rd(1.5*k)),C.bronzeL);
    R(g,sx-rr+u1+1,sy-rd(2*k),u1,rd(3*k),C.bronzeL)}
  function beard(cx,cy){const n=rd((S.beardLen||5)*k),long=(S.beardLen||5)>6;
    for(let i=0;i<=n;i++){const y=cy+rd(2*k)+i,xl=cx-rd(2*k)+rd(i*.25),xr=cx+rd(8*k)-rd(i*(long?.55:.9));if(xr>xl)R(g,xl,y,xr-xl,1,(i%3===2)?(S.beardD||S.beard):S.beard)}
    R(g,cx+rd(3*k),cy+rd(3*k),rd(5*k),u1,S.beard)}
  function head(){
    const cx=rd(X(hc[0])),cy=rd(Y(hc[1])),st=S.hairStyle;
    for(let dy=-r;dy<=r;dy++){
      const h=rd(Math.sqrt(r*r-dy*dy)),x0=cx-h,w=h*2+1,y=cy+dy;
      const full=col=>R(g,x0,y,w,1,col),back=(fr,col=S.hair)=>R(g,x0,y,rd(w*fr),1,col);
      R(g,x0,y,w,1,S.skin);R(g,x0,y,Math.max(1,rd(1.5*k)),1,S.skinD);
      if(st==='curly'){if(dy<-2*k)full(S.hair);else if(dy<4*k)back(.42)}
      else if(st==='hero'){if(dy<-3*k)full(S.hair);else if(dy<3*k)back(.46)}
      else if(st==='king'){if(dy<-3*k)full(S.hair);else if(dy<3*k)back(.4)}
      else if(st==='feather'){if(dy<-3*k)full(S.hair);else if(dy<2*k)back(.35);if(dy>=-4*k&&dy<-2*k)full(C.bronze)}
      else if(st==='helmet'){if(dy<-1*k){full(C.bronze);R(g,x0,y,Math.max(1,rd(2*k)),1,C.bronzeD)}else if(dy<5*k)back(.5,C.bronze);if(dy>=-2*k&&dy<-1*k)full(C.bronzeD)}
      else if(st==='hood'){if(dy<-1*k)full(S.hood);else back(.38,S.hood);if(dy>=-1*k&&dy<0)R(g,x0+rd(w*.38),y,rd(w*.3),1,S.hair)}
      else if(st==='bald'){if(dy<-5*k)R(g,x0+rd(w*.3),y,rd(w*.4),1,S.skinL||S.skin);if(dy>-4*k&&dy<3*k)back(.32)}
    }
    if(st==='curly'){const cr=Math.max(1,rd(1.7*k));for(let a=.55;a<=3.7;a+=.42)D(g,cx+Math.cos(a)*r*.95,cy-Math.sin(a)*r*.95,cr,S.hair);
      R(g,cx+rd(2*k),cy-rd(3.5*k),rd(4*k),Math.max(1,rd(1.5*k)),S.hair);
      [[-.5],[.3],[1.1]].forEach(([a])=>R(g,cx+Math.cos(1.6+a)*r*.72,cy-Math.sin(1.6+a)*r*.72,u1,u1,S.hairL))}
    if(st==='hero'){const dg=Math.PI/180,pp=(a,rr)=>[cx+Math.cos(a*dg)*rr,cy-Math.sin(a*dg)*rr];
      const spike=(a0,a1,at,ext)=>poly(g,[pp(a0,r*.8),pp(at,r+ext*k),pp(a1,r*.8)],S.hair);
      spike(108,72,90,5);spike(150,100,128,7.5);spike(190,138,166,8);spike(228,182,206,5.5);
      poly(g,[[cx+rd(k),cy-rd(7.5*k)],[cx+rd(9*k),cy-rd(5*k)],[cx+rd(6.5*k),cy-rd(1.5*k)],[cx+rd(4*k),cy-rd(4*k)]],S.hair);
      L(g,cx+rd(2*k),cy-rd(7*k),cx+rd(6.5*k),cy-rd(5.5*k),u1,S.hairL);L(g,cx-rd(k),cy-rd(8.5*k),cx-rd(4*k),cy-rd(12*k),u1,S.hairL);
      L(g,cx-rd(5*k),cy-rd(2*k),cx-rd(9*k),cy-rd(8*k),u1,S.hairD);
      if(S.band){const by=cy-rd(4.5*k),hh=rd(Math.sqrt(Math.max(0,r*r-(4.5*k)**2))),bx=cx-hh,bh=Math.max(1,rd(1.3*k));
        R(g,bx,by,hh+rd(3*k),bh,S.band);
        const fl=P.flow??.3,w=P.wave||0,lp=(a,c)=>a+(c-a)*fl,tt=Math.max(1,rd(1.4*k)),kx=bx-u1,ky=by;
        R(g,kx-u1,ky-u1,rd(2.5*k),rd(2.5*k),S.band);
        L(g,kx,ky,kx-lp(3,11)*k,ky+(lp(6,-1)+w)*k,tt,S.band);L(g,kx,ky+u1,kx-lp(1,8)*k,ky+(lp(8,3)-w)*k,tt,S.capeD||S.band)}}
    const big=S.bigEye,ex=cx+rd(4*k),ey=cy-rd(1*k),ew=big?Math.max(2,rd(1.3*k)):Math.max(1,rd(.9*k)),eh=big?Math.max(2,rd(2.2*k)):Math.max(2,rd(1.8*k));
    if(k>=1.6)R(g,ex-u1,ey,ew+u1,eh,'#ffffff');
    R(g,ex,ey,ew,eh,C.eye);
    if(big){R(g,ex+ew-1,ey,1,1,'#ffffff');R(g,ex-u1,ey-rd(2.6*k),rd(1.6*k)+1,u1,S.hairD);R(g,ex+rd(.6*k),ey-rd(1.9*k),rd(2.2*k),u1,S.hairD)}
    else R(g,ex-u1,ey-rd(1.8*k),rd(3*k),u1,S.browC||S.hair);
    R(g,cx+r,cy+rd(.5*k),u1,Math.max(1,rd(1.5*k)),S.skin);
    if(st!=='hood'&&st!=='helmet')R(g,cx-rd(1.5*k),cy,rd(2*k),rd(3*k),S.skinD);
    if(S.blush)R(g,cx+rd(1.5*k),cy+rd(2.5*k),rd(2*k),u1,S.blush);
    if(S.beard)beard(cx,cy);
    R(g,cx+rd(4.5*k),cy+rd(4*k),rd(2.5*k),P.mouth?Math.max(2,rd(2*k)):u1,P.mouth?C.mouth:(S.beard?(S.beardD||C.out):C.mouthC));
    if(S.crown){const by=cy-r+u1;R(g,cx-rd(5*k),by-rd(2*k),rd(10*k)+1,rd(2*k),C.gold);R(g,cx-rd(5*k),by-u1,rd(10*k)+1,u1,C.goldD);
      for(const dx of[-4,0,4])R(g,cx+rd(dx*k),by-rd(4*k),Math.max(1,rd(1.4*k)),rd(2*k),C.gold);R(g,cx,by-rd(1.5*k),u1,u1,'#d33a3a')}
    if(st==='feather'){const fw=Math.max(1,rd(1.3*k));let i=0;
      for(let x=cx-rd(6*k);x<=cx+rd(6*k);x+=Math.max(2,rd(2*k)),i++){const base=cy-rd(4*k),top=base-rd((7+Math.sin(i*1.3)*1.2)*k);R(g,x,top,fw,base-top,i%2?C.white:C.whiteD);R(g,x,top,fw,u1,C.kiltD)}}
    if(st==='helmet'){R(g,cx-u1,cy-r-rd(2*k),rd(3*k),rd(2*k)+1,C.bronzeL);R(g,cx+rd(2*k),cy-rd(6*k),rd(3*k),u1,C.bronzeL)}
  }
  function item(){if(!P.item||P.item==='bow')return;const a=P.ia||0,dx=Math.cos(a),dy=Math.sin(a),hx=X(hF[0]),hy=Y(hF[1]),t2=Math.max(1,rd(2*k));
    const seg=(b0,f0,t,col)=>L(g,hx-dx*b0*k,hy-dy*b0*k,hx+dx*f0*k,hy+dy*f0*k,t,col);
    if(P.item==='staff')staffAt(hx,hy,a,12,22);
    else if(P.item==='gsword'){seg(1,21,t2+1,C.ironL);seg(-12,21,1,C.iron);seg(-20,23,Math.max(1,t2-1),C.ironL);L(g,hx+dy*3.5*k,hy-dx*3.5*k,hx-dy*3.5*k,hy+dx*3.5*k,t2+1,C.bronze);seg(4,0,t2+1,C.woodD);D(g,hx-dx*4.5*k,hy-dy*4.5*k,Math.max(1,rd(1.3*k)),C.bronze)}
    else if(P.item==='sword'){seg(1,13,t2,C.ironL);seg(-9,13,u1,C.iron);L(g,hx+dy*2.5*k,hy-dx*2.5*k,hx-dy*2.5*k,hy+dx*2.5*k,t2,C.bronze);seg(3,0,t2,C.woodD)}
    else if(P.item==='spear'){const n=S.spearLen||24;seg(14,n,Math.max(2,rd(2.4*k)),C.wood);seg(-(n-1),n+6,Math.max(2,rd(3*k)),C.iron);seg(-(n+5),n+8,u1,C.ironL)}
    else if(P.item==='club'){seg(2,12,t2+1,C.woodD);D(g,hx+dx*12*k,hy+dy*12*k,Math.max(1,rd(1.8*k)),C.wood)}
    else if(P.item==='horn'){seg(1,4,t2+1,C.white);seg(-3,7,t2,C.whiteD);seg(-1,2,t2+1,C.goldD)}
  }
  // sling: whirl = big tilted loop with a smear arc; wind = cocked behind; release = arm smear + flash + whipping cord; follow = cord dangling
  function sling(){const hx=X(hF[0]),hy=Y(hF[1]),s=P.sling,sr=Math.max(2,rd(1.7*k));
    if(s.mode==='whirl'){const cx2=hx-3*k,cy2=hy-9*k,rx=15*k,ry=5*k,tl=-.15;
      const pt=a=>{const x=Math.cos(a)*rx,y=Math.sin(a)*ry;return[cx2+x*Math.cos(tl)-y*Math.sin(tl),cy2+x*Math.sin(tl)+y*Math.cos(tl)]};
      const[sx,sy]=pt(s.a);
      // far half of the loop (upper part) goes behind the head, near half in front
      for(let i=1;i<=22;i++){const aa=s.a-i*.13,p=pt(aa);post.push([p[0],p[1],i<10?'#ffc94a':i<16?'rgba(255,201,74,.65)':'rgba(255,201,74,.3)',i<12?3:2,Math.sin(aa)<0])}
      for(let i=1;i<=10;i++){const aa=s.a-i*.13,p=pt(aa);post.push([p[0],p[1],'#fffbe8',i<6?2:1,Math.sin(aa)<0])}
      D(g,sx,sy,sr,C.stone);post.cord=[[hx,hy],[sx,sy]]}
    else if(s.mode==='wind'){const sx=hx-6*k,sy=hy+6*k;D(g,sx,sy,sr,C.stone);post.cord=[[hx,hy],[hx-3*k,hy+4*k],[sx,sy]]}
    else if(s.mode==='release'){
      // the stone travels at arm + cord length, so the swoosh arcs high over the head and ends at the release flash
      const sx0=X(shF[0]),sy0=Y(shF[1]),rr=Math.hypot(hx-sx0,hy-sy0)+12*k,a1=Math.atan2(hy-sy0,hx-sx0),at=a=>[sx0+Math.cos(a)*rr,sy0+Math.sin(a)*rr];
      const tip=at(a1);post.cord=[[hx,hy],tip,[tip[0]+3*k,tip[1]+3*k]];post.flash=tip;
      for(let i=1;i<=18;i++){const p=at(a1-i*.12);post.push([p[0],p[1],i<8?'#ffc94a':i<13?'rgba(255,201,74,.6)':'rgba(255,201,74,.3)',i<6?5:i<11?4:2])}
      for(let i=1;i<=9;i++){const aa=a1-i*.12;post.push([sx0+Math.cos(aa)*(rr-k),sy0+Math.sin(aa)*(rr-k),'#fffbe8',i<5?2:1])}
      for(const[yy,l]of[[-31,9],[-22,12],[-13,8]])for(let i=0;i<l;i++)post.push([X(-15-i),Y(yy+b),'rgba(255,255,255,.7)',1,1])}
    else post.cord=[[hx,hy],[hx+2*k,hy+4*k],[hx+k,hy+7*k]]}

  if(S.cape)cape();
  if(P.staffBack)staffAt(X(6),Y(-3+b),-2.0,0,40);
  if(S.hood)R(g,X(hc[0]-8),Y(hc[1]-1),rd(7*k),rd(13*k),S.hood);
  arm(shB,hB,S.skinD,S.tunicD,S.bracerD||S.bracer);
  leg(hipB,fB,S.legD,P.kB,S.greaveD||S.greave);leg(hipF,fF,S.leg,P.kF,S.greave);
  torso();
  if(P.shield)shield();
  head();
  item();
  if(P.harp){const hx=X(4+ln),hy=Y(-16+b),t2=Math.max(1,rd(2*k));
    R(g,hx-rd(3.5*k),hy,rd(8*k),rd(4*k),C.wood);R(g,hx-rd(3.5*k),hy,rd(8*k),Math.max(1,rd(k)),C.brownL);
    L(g,hx-3*k,hy,hx-4.5*k,hy-12*k,t2,C.wood);L(g,hx+4*k,hy,hx+6*k,hy-13*k,t2,C.wood);L(g,hx-5*k,hy-12*k,hx+6.5*k,hy-13.5*k,t2,C.woodD);
    for(let i=0;i<4;i++){const sx=hx-2*k+i*1.8*k;L(g,sx,hy,sx+.3*k*i,hy-11.5*k-i*.3*k,1,C.oatL)}}
  if(P.item==='bow'){const hx=X(hF[0]),hy=Y(hF[1]),t2=Math.max(1,rd(1.6*k)),top=[hx-k,hy-9*k],bot=[hx-k,hy+9*k];
    const pts=[top,[hx+2.5*k,hy-6*k],[hx+4*k,hy],[hx+2.5*k,hy+6*k],bot];for(let i=1;i<pts.length;i++)L(g,pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],t2,C.wood);
    const nock=P.draw?[X(hB[0]),Y(hB[1])]:[hx-k,hy];L(g,top[0],top[1],nock[0],nock[1],1,C.whiteD);L(g,nock[0],nock[1],bot[0],bot[1],1,C.whiteD);
    if(P.draw){L(g,nock[0],nock[1],hx+6*k,hy,1,C.wood);R(g,hx+6*k,hy-k/2,Math.max(2,rd(2*k)),Math.max(1,rd(k)),C.iron)}}
  arm(shF,hF,S.skin,S.tunic,S.bracer);
  if(P.sling)sling();
  outline(c);
  if(post.cord){const q=post.cord;for(let i=1;i<q.length;i++)L(g,q[i-1][0],q[i-1][1],q[i][0],q[i][1],1,'#4a2c1a')}
  const dot=p=>{const s=p[3]||1;R(g,p[0]-Math.floor(s/2),p[1]-Math.floor(s/2),s,s,p[2])};
  post.filter(p=>!p[4]).forEach(dot);
  g.globalCompositeOperation='destination-over';post.filter(p=>p[4]).reverse().forEach(dot);g.globalCompositeOperation='source-over';
  if(post.flash){const[fx,fy]=post.flash.map(rd),n=rd(4*k);R(g,fx-n,fy,n*2+1,1,'#fff');R(g,fx,fy-n,1,n*2+1,'#fff');
    for(let i=1;i<n-1;i++){R(g,fx+i,fy-i,1,1,'#ffe27a');R(g,fx-i,fy+i,1,1,'#ffe27a');R(g,fx+i,fy+i,1,1,'#ffe27a');R(g,fx-i,fy-i,1,1,'#ffe27a')}R(g,fx-1,fy-1,3,3,'#fff')}
  return{c,ox,oy,k};
}

/* ---------- poses ---------- */
const WALK=[[6,0,-5,0,0,2],[2,-2,-1,0,-1,0],[-4,0,5,0,0,-2],[0,0,1,-2,-1,0]];
const W=f=>{const p=WALK[f%4];return{fF:[p[0],p[1]],fB:[p[2],p[3]],bob:p[4],sw:p[5]}};
const POSE={
  david(a,f){const b=f%2,wv=[0,1,0,-1][f%4];switch(a){
    case 'walk':{const w=W(f);return{...w,hF:[6+w.sw,-14+w.bob],hB:[-4-w.sw,-15+w.bob],item:'staff',ia:-1.3,flow:.65,wave:wv}}
    case 'run':{const w=W(f);return{...w,fF:[w.fF[0]*1.5,w.fF[1]*1.5],fB:[w.fB[0]*1.5,w.fB[1]*1.5],lean:3,hF:[10,-17+w.bob],hB:[-9,-17+w.bob],item:'staff',ia:-.35,flow:1,wave:wv}}
    case 'atk1':return{lean:2,fF:[8,0],fB:[-6,0],hF:[13,-18],hB:[8,-17],item:'staff',ia:.02,mouth:1,flow:.85,wave:1};
    case 'atk2a':return{lean:-1,fF:[5,0],fB:[-5,0],hF:[0,-31],hB:[-2,-29],item:'staff',ia:-2.3,flow:.45};
    case 'atk2':return{lean:3,fF:[9,0],fB:[-6,0],hF:[11,-15],hB:[8,-16],item:'staff',ia:.75,mouth:1,flow:.95,wave:-1};
    case 'atk3':return{bob:-2,fF:[6,-3],fB:[-4,0],hF:[9,-28],hB:[5,-26],item:'staff',ia:-1.0,mouth:1,flow:1,wave:1};
    case 'sling':return{lean:-1,bob:b,fF:[7,0],fB:[-6,0],hF:[10,-35+b],hB:[5,-19+b],sling:{mode:'whirl',a:f*Math.PI/2},staffBack:1,flow:.7,wave:wv};
    case 'wind':return{lean:-3,bob:2,kF:[7,-8],fF:[9,0],fB:[-8,0],hF:[-11,-22],hB:[6,-18],sling:{mode:'wind'},staffBack:1,flow:.35,hy:1};
    case 'release':return{lean:5,bob:2,kF:[10,-7],fF:[12,0],fB:[-10,0],hF:[17,-27],hB:[-11,-19],sling:{mode:'release'},staffBack:1,mouth:1,flow:1,wave:-1};
    case 'follow':return{lean:4,bob:1,kF:[9,-7],fF:[11,0],fB:[-8,-2],hF:[11,-11],hB:[-9,-21],sling:{mode:'follow'},staffBack:1,flow:.9,wave:1};
    case 'hurt':return{lean:-3,hy:-1,fF:[2,0],fB:[-7,0],hF:[-2,-22],hB:[-8,-20],item:'staff',ia:-2.0,mouth:1,flow:.1};
    case 'jump':return{bob:-2,fF:[5,-5],fB:[-3,-4],hF:[8,-24],hB:[-6,-22],item:'staff',ia:-.6,flow:1,wave:-1};
    case 'harp':return{bob:b,hF:[6+b*1.5,-24+b],hB:[3,-15],harp:1,flow:.3+b*.1,wave:b};
    case 'kneel':return{bob:6,kF:[8,-7],fF:[8,0],kB:[0,-1],fB:[-7,-1],hF:[6,-9],hB:[4,-8],hy:1,hx:1,flow:0};
    default:return{bob:b,fF:[5,0],fB:[-5,0],hF:[7,-14+b],hB:[-5,-14+b],item:'staff',ia:-1.2,flow:.25+b*.08,wave:b}}},
  soldier(a,f,S){if(S.weapon==='bow'&&(a==='atkA'||a==='atk'))return a==='atkA'?{lean:-1,fF:[5,0],fB:[-5,0],hF:[12,-21],hB:[1,-21],item:'bow',draw:1}:{lean:1,fF:[5,0],fB:[-5,0],hF:[12,-21],hB:[-4,-19],item:'bow',mouth:1};
    const b=f%2,sp=S.weapon==='spear',it=S.weapon,sh=!!S.shield,ia0=sp?-1.3:-1.0;switch(a){
    case 'walk':{const w=W(f);return{...w,hF:[7+w.sw,-16+w.bob],hB:[-3-w.sw,-16+w.bob],item:it,ia:ia0+.1,shield:sh}}
    case 'atkA':return sp?{lean:-2,fF:[4,0],fB:[-5,0],hF:[-3,-20],hB:[-6,-18],item:it,ia:-.08,shield:sh}:{lean:-1,fF:[4,0],fB:[-4,0],hF:[-1,-30],hB:[-5,-17],item:it,ia:-2.4,shield:sh};
    case 'atk':return sp?{lean:3,fF:[8,0],fB:[-5,0],hF:[15,-19],hB:[6,-19],item:it,ia:-.02,shield:sh,mouth:1}:{lean:3,fF:[8,0],fB:[-5,0],hF:[11,-17],hB:[-3,-17],item:it,ia:.35,shield:sh,mouth:1};
    case 'hurt':return{lean:-4,hy:-1,fF:[2,0],fB:[-7,0],hF:[-3,-23],hB:[-8,-21],item:it,ia:-2.0,shield:sh,mouth:1};
    case 'throw':return{lean:-2,fF:[5,0],fB:[-5,0],hF:[-4,-33],hB:[3,-20],item:it,ia:-.25,mouth:1};
    case 'sweep':return{lean:3,fF:[9,0],fB:[-6,0],hF:[14,-20],hB:[6,-19],item:it,ia:.15,shield:sh,mouth:1};
    case 'stuck':return{lean:5,bob:2,hy:2,fF:[8,0],fB:[-7,0],hF:[13,-10],hB:[8,-11],item:it,ia:.85,mouth:1};
    case 'laugh':return{lean:-3,hy:-2,bob:f%2,fF:[4,0],fB:[-4,0],hF:[8,-17+f%2],hB:[-2,-12],item:it,ia:-1.35,mouth:1};
    default:return{bob:b,hF:[7,-16+b],hB:[-3,-16+b],item:it,ia:ia0,shield:sh}}},
  samuel(a,f){const b=f%2;if(a==='anoint')return{lean:1,hF:[9,-43],hB:[-3,-15],item:'horn',ia:.8};return{bob:b,hF:[6,-17+b],hB:[-4,-14+b],item:'horn',ia:-.7}},
  jesse(a,f){const b=f%2;return{bob:b,hF:[6,-14+b],hB:[-4,-14+b],item:'staff',ia:-1.5}},
  bro(a,f){const b=f%2;return{bob:b,hF:[4,-15+b],hB:[-4,-15+b]}}
};

/* ---------- cast ---------- */
const CAST={
  david:{skin:C.skin,skinD:C.skinD,hair:C.hRed,hairL:C.hRedL,hairD:C.hRedD,hairStyle:'hero',tunic:C.cream,tunicD:C.creamD,tunicL:C.creamL,sash:C.leather,buckle:C.bronzeL,pouch:C.leather,strap:C.leather,
    cape:C.teal,capeD:C.tealD,capeL:C.tealL,band:C.teal,bracer:C.leather,bracerD:C.leatherD,greave:C.leather,greaveD:C.leatherD,broad:1,bigEye:1,leg:C.skin,legD:C.skinD,shoe:C.leatherD,blush:'#e3806a',pose:'david',wu:100},
  samuel:{skin:C.old,skinD:C.oldD,hair:C.white,hairStyle:'hood',hood:C.indigoD,tunic:C.indigo,tunicD:C.indigoD,tunicL:C.indigoL,sash:C.gold,robe:1,beard:C.white,beardD:C.whiteD,beardLen:12,browC:C.white,leg:C.oldD,legD:C.oldD,shoe:C.woodD,pose:'samuel',wu:70},
  saul:{skin:C.skin,skinD:C.skinD,hair:C.dark,hairStyle:'king',tunic:C.purple,tunicD:C.purpleD,tunicL:C.purpleL,sash:C.gold,trim:C.gold,robe:1,beard:C.beard,beardD:C.beardD,beardLen:5,crown:1,tall:1.12,leg:C.skin,legD:C.skinD,shoe:C.woodD,pose:'soldier',weapon:'spear',spearLen:22,wu:96},
  jesse:{skin:C.old,skinD:C.oldD,skinL:'#f0c8a4',hair:C.gray,hairStyle:'bald',tunic:C.brown,tunicD:C.brownD,tunicL:C.brownL,sash:C.oatD,robe:1,beard:C.gray,beardD:C.grayD,beardLen:9,browC:C.gray,leg:C.oldD,legD:C.oldD,shoe:C.woodD,pose:'jesse',wu:84},
  philA:{skin:C.skinP,skinD:C.skinPD,hair:C.dark,hairStyle:'feather',tunic:C.kilt,tunicD:C.kiltD,tunicL:C.kiltL,sash:C.bronzeD,armor:'bands',armorC:C.bronze,armorD:C.bronzeD,fringe:1,leg:C.skinP,legD:C.skinPD,shoe:C.woodD,pose:'soldier',weapon:'sword',wu:72},
  goliath:{skin:C.skinP,skinD:C.skinPD,hair:C.dark,hairStyle:'helmet',tunic:C.armorG,tunicD:C.armorGD,tunicL:C.armorGL,sash:C.bronzeD,armor:'scale',armorC:C.bronze,armorD:C.bronzeD,beard:C.beard,beardD:C.beardD,beardLen:6,browC:C.out,greave:C.bronze,bracer:C.bronze,leg:C.skinP,legD:C.skinPD,shoe:C.woodD,pose:'soldier',weapon:'spear',spearLen:30,wu:100}
};
CAST.philB={...CAST.philA,tunic:C.olive,tunicD:C.oliveD,tunicL:C.oliveL,weapon:'spear',spearLen:20,wu:96};
CAST.philC={...CAST.philA,shield:1};
const broBase={skin:C.skin,skinD:C.skinD,hair:C.dark,hairStyle:'king',leg:C.skin,legD:C.skinD,shoe:C.wood,pose:'bro',wu:40};
CAST.bro1={...broBase,tunic:C.olive,tunicD:C.oliveD,tunicL:C.oliveL,sash:C.brownD,beard:C.beard,beardD:C.beardD,beardLen:4,tall:1.14};
CAST.bro2={...broBase,tunic:C.blue,tunicD:C.blueD,tunicL:C.blueL,sash:C.oatD,tall:1.06};
CAST.bro3={...broBase,tunic:C.brown,tunicD:C.brownD,tunicL:C.brownL,sash:C.green,beard:C.beard,beardD:C.beardD,beardLen:3,tall:1.1};
CAST.bro4={...broBase,tunic:C.oatD,tunicD:C.brownD,tunicL:C.oat,sash:C.kiltD};
CAST.philD={...CAST.philA,tunic:C.brown,tunicD:C.brownD,tunicL:C.brownL,armor:null,weapon:'bow',wu:80};
CAST.michal={skin:C.skin,skinD:C.skinD,hair:C.dark,hairStyle:'hood',hood:'#b04a6a',tunic:'#e0a8b4',tunicD:'#b47a88',tunicL:'#f4c8d0',sash:C.gold,robe:1,blush:'#e3806a',leg:C.skin,legD:C.skinD,shoe:C.wood,pose:'bro',wu:40};
CAST.davidS={...CAST.david,gsword:1};
CAST.priest={skin:C.old,skinD:C.oldD,hair:C.white,hairStyle:'hood',hood:'#e8e0cc',tunic:'#f2eee2',tunicD:'#c8c0aa',tunicL:'#ffffff',sash:C.indigo,robe:1,beard:C.gray,beardD:C.grayD,beardLen:8,browC:C.gray,leg:C.oldD,legD:C.oldD,shoe:C.woodD,pose:'bro',wu:40};
CAST.achish={skin:C.skinP,skinD:C.skinPD,hair:C.dark,hairStyle:'king',tunic:C.kilt,tunicD:C.kiltD,tunicL:C.kiltL,sash:C.gold,trim:C.gold,robe:1,crown:1,beard:C.beard,beardD:C.beardD,beardLen:4,leg:C.skinP,legD:C.skinPD,shoe:C.woodD,pose:'bro',wu:40,tall:1.05};
const allyBase={skin:C.skin,skinD:C.skinD,leg:C.skin,legD:C.skinD,shoe:C.woodD,pose:'soldier',wu:80};
CAST.ally1={...allyBase,hair:C.dark,hairStyle:'king',beard:C.beard,beardD:C.beardD,beardLen:4,tunic:C.brown,tunicD:C.brownD,tunicL:C.brownL,sash:C.teal,weapon:'club'};
CAST.ally2={...allyBase,hair:C.red,hairL:C.redL,hairStyle:'curly',tunic:C.olive,tunicD:C.oliveD,tunicL:C.oliveL,sash:C.leather,weapon:'spear',spearLen:18,wu:92};
CAST.ally3={...allyBase,hair:C.dark,hairStyle:'hood',hood:'#6a6a7a',beard:C.beard,beardD:C.beardD,beardLen:5,tunic:'#7a7a88',tunicD:'#55556a',tunicL:'#9a9aa8',sash:C.oatD,weapon:'club'};
CAST.captain={...CAST.philA,armor:'scale',armorC:C.bronze,armorD:C.bronzeD,sash:C.gold,trim:C.gold,shield:1,tunic:C.kiltD,tunicD:'#5a1a1a',tunicL:C.kilt};
CAST.jonathan={skin:C.skin,skinD:C.skinD,hair:C.dark,hairStyle:'king',tunic:C.blue,tunicD:C.blueD,tunicL:C.blueL,sash:C.gold,trim:C.gold,leg:C.skin,legD:C.skinD,shoe:C.wood,pose:'bro',wu:40,tall:1.06};
CAST.thief={skin:C.skinP,skinD:C.skinPD,hair:C.dark,hairStyle:'hood',hood:'#7a5a3c',tunic:'#5c4433',tunicD:'#3e2c20',tunicL:'#7a5c44',sash:C.oatD,fringe:1,beard:C.beard,beardD:C.beardD,beardLen:3,leg:C.skinP,legD:C.skinPD,shoe:C.woodD,pose:'soldier',weapon:'club',wu:80};
// four-legged cast: units at size 1, facing right, feet on y=0
CAST.jackal={beast:1,size:.95,wu:44,hu:30,body:[0,-13,12,5],head:[14,-17,4.5],snout:5,ear:'point',tail:'bushy',col:'#c08850',colD:'#8a5a32',colL:'#e0b070',belly:'#ead2a2'};
CAST.bear={beast:1,size:1.55,wu:52,hu:40,body:[-1,-15,14,9],head:[14,-17,6],snout:3,ear:'round',tail:'stub',col:'#5e3c2a',colD:'#3a2418',colL:'#80563a',belly:'#4a2e20',brow:1};
CAST.lion={beast:1,size:1.5,wu:52,hu:38,body:[0,-15,13,6.5],head:[14,-19,5.5],snout:3.5,ear:'round',tail:'tuft',mane:'#8a4a22',maneL:'#b8642a',col:'#d8a050',colD:'#a8703a',colL:'#f0c878',belly:'#ecd2a0',brow:1};

function shadow(g,x,y,w){g.fillStyle='rgba(40,22,30,.32)';for(let dy=-2;dy<=2;dy++){const h=rd(w*Math.sqrt(1-(dy/3)**2));g.fillRect(rd(x)-h,rd(y)+dy,h*2,1)}}
function star(g,x,y,s,c){R(g,x-s,y-1,s*2+1,3,c);R(g,x-1,y-s,3,s*2+1,c);const n=rd(s*.6);for(let i=1;i<=n;i++){R(g,x+i,y+i,2,2,c);R(g,x-i-1,y-i-1,2,2,c);R(g,x+i,y-i-1,2,2,c);R(g,x-i-1,y+i,2,2,c)}}
function spark(g,x,y,s){x=rd(x);y=rd(y);star(g,x,y,s+2,'#f08a3a');star(g,x,y,s,'#ffe27a');R(g,x-rd(s*.5),y,rd(s)+1,1,'#fff');R(g,x,y-rd(s*.5),1,rd(s)+1,'#fff');D(g,x,y,2,'#fff')}
function frame(g,x,y,w,h,fill='#1a1428'){R(g,x,y,w,h,'#0d0a14');R(g,x+1,y+1,w-2,h-2,C.gold);R(g,x+2,y+2,w-4,h-4,'#7a4a22');R(g,x+3,y+3,w-6,h-6,fill);
  [[x+1,y+1],[x+w-3,y+1],[x+1,y+h-3],[x+w-3,y+h-3]].forEach(([a,b])=>R(g,a,b,2,2,'#fff2b0'))}
function bar(g,x,y,w,h,f,col,hi){R(g,x-1,y-1,w+2,h+2,'#0d0a14');R(g,x,y,w,h,'#3a2c4a');const fw=rd(w*Math.max(0,Math.min(1,f)));R(g,x,y,fw,h,col);R(g,x,y,fw,1,hi);
  for(let i=8;i<w;i+=8)R(g,x+i,y,1,h,'rgba(13,10,20,.45)')}

function sky(g,cols,y0,y1,SW=480){const bh=(y1-y0)/cols.length;for(let y=y0;y<y1;y++){const bi=Math.min(cols.length-1,Math.floor((y-y0)/bh)),w=(y-y0)-bi*bh;R(g,0,y,SW,1,cols[bi]);
  if(bi<cols.length-1&&w>bh-5){const step=w>bh-2.5?2:4,nx=cols[bi+1];for(let x=y%2;x<SW;x+=step)R(g,x,y,1,1,nx)}}}
function cloud(g,x,y,s){const c='#f4f7f2';D(g,x,y,rd(6*s),c);D(g,x+rd(8*s),y+2,rd(5*s),c);D(g,x-rd(8*s),y+3,rd(4*s),c);R(g,x-rd(12*s),y+rd(4*s),rd(26*s),rd(3*s),c);R(g,x-rd(11*s),y+rd(7*s),rd(24*s),1,'#d3e0e3')}
function tent(g,x,y,col,stripe){for(let i=0;i<6;i++){R(g,x-i,y+i,2*i+1,1,stripe&&i%2?stripe:col)}R(g,x,y+3,1,3,'#4a3828')}
function tree(g,x,y){L(g,x,y,x,y-9,2,C.woodD);D(g,x,y-13,6,'#4d6a35');D(g,x-6,y-10,4,'#4d6a35');D(g,x+6,y-10,4,'#4d6a35');D(g,x+1,y-15,3,'#6c8a44');R(g,x-6,y-12,2,1,'#6c8a44')}
function seeded(s){return()=>(s=s*16807%2147483647)/2147483647}

/* ---------- game-facing API ---------- */
export const KB=1.35; // battle scale from the draft
const cache=new Map();
// One frame = canvas + feet anchor (ox, oy) in canvas pixels.
export function frameOf(id,anim,f=0,k=KB){const key=id+'|'+anim+'|'+f+'|'+k;let s=cache.get(key);
  if(!s){const S=CAST[id];s=S.beast?beast(S,BPOSE(anim,f,id),k):human(S,POSE[S.pose](anim,f,S),k,S.wu);cache.set(key,s)}return s}
// Knocked-down frame: people fall on their back, animals roll over legs-up.
export function downOf(id,anim,f=0,k=KB){const s=frameOf(id,anim,f,k);return CAST[id].beast?upsideOf(s,CAST[id]):lyingOf(s)}
export const isBeast=id=>!!CAST[id].beast;

/* ---------- four-legged rig ---------- */
// legs = swing of [front near, front far, back near, back far]; rear lifts the front around the hind feet (radians, negative = up).
function BPOSE(a,f,id){const b=f%2,big=id!=='jackal';
  const walk=[[4,-4,-4,4],[0,0,0,0],[-4,4,4,-4],[0,0,0,0]][f%4],lift=f%2?2:0;
  switch(a){
    case 'walk':return{legs:walk,lift,bob:f%2?-.5:0,tw:f%2?1:-1};
    case 'atkA':return id==='bear'?{rear:-.75,legs:[3,1,0,0],mouth:1,head:[0,-1]}:{bob:2,head:[-1,2],legs:[-2,-2,2,2],tw:1};
    case 'atk':return id==='bear'?{rear:-.45,legs:[9,4,-1,1],mouth:1,head:[2,1]}:{legs:[7,6,-6,-5],head:[3,1],mouth:1,rear:-.08,tw:-1};
    case 'leap':return{rear:-.3,legs:[9,8,-9,-8],mouth:1,head:[2,0],tw:-1};
    case 'hurt':return{rear:-.15,head:[-2,-2],mouth:1,hurt:1,legs:[2,1,-2,-1]};
    default:return{bob:b*(big?.5:1)*.5,tw:b?1:-1,legs:[0,0,0,0]}}}
function beast(S,P,k){
  const z=S.size*k,W=Math.ceil(S.wu*z)+8,H=Math.ceil(S.hu*z)+8,c=mk(W,H),g=ctx2(c),ox=rd(W/2),oy=H-3;
  const rr=P.rear||0,cs=Math.cos(rr),sn=Math.sin(rr),pv=-10,bob=P.bob||0;
  const T=(x,y)=>{const dx=x-pv;return[ox+(pv+dx*cs-y*sn)*z,oy+(dx*sn+y*cs)*z]};
  const[bx,by0,brx,bry]=S.body,by=by0+bob,[hx0,hy0,hr]=S.head,hd=P.head||[0,0],hx=hx0+hd[0],hy=hy0+hd[1]+bob;
  const t=Math.max(2,rd(3.2*z/1.5)),legs=P.legs||[0,0,0,0],lift=P.lift||0;
  const ell=(cx,cy,rx,ry,col)=>{const pts=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2;pts.push(T(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry))}poly(g,pts,col)};
  const leg=(x,sw,col,up)=>{const[h0,h1]=T(x,by+bry*.3),[f0,f1]=T(x+sw,-up);L(g,h0,h1,f0,f1-t/2,t,col);R(g,f0-t/2-1,f1-t/2-1,t+2,Math.max(2,rd(t*.6)),S.colD)};
  const fx=bx+brx*.62,rx=bx-brx*.62;
  // far side first
  leg(fx+2,legs[1],S.colD,legs[1]>0?lift:0);leg(rx+2,legs[3],S.colD,legs[3]<0?lift:0);
  const tw=P.tw||0,[ta,tb]=T(bx-brx+1,by-1);
  if(S.tail==='bushy'){const[e0,e1]=T(bx-brx-8,by+3+tw*2);L(g,ta,tb,e0,e1,Math.max(3,rd(3.5*z)),S.col);D(g,e0,e1,Math.max(1,rd(1.5*z)),S.colL)}
  else if(S.tail==='tuft'){const[m0,m1]=T(bx-brx-5,by-4+tw),[e0,e1]=T(bx-brx-8,by-9+tw);L(g,ta,tb,m0,m1,Math.max(2,rd(1.5*z)),S.col);L(g,m0,m1,e0,e1,Math.max(2,rd(1.5*z)),S.col);D(g,e0,e1,Math.max(2,rd(2*z)),S.mane)}
  else D(g,ta,tb,Math.max(2,rd(2.5*z)),S.col);
  ell(bx,by,brx,bry,S.col);ell(bx,by+bry*.45,brx*.78,bry*.45,S.belly);ell(bx+1,by-bry*.55,brx*.7,bry*.28,S.colL);
  leg(fx,legs[0],S.col,legs[0]>0?lift:0);leg(rx,legs[2],S.col,legs[2]<0?lift:0);
  if(S.mane){const[m0,m1]=T(hx-1.5,hy+1),mr=hr*1.75*z;for(let i=0;i<12;i++){const a=i/12*Math.PI*2;D(g,m0+Math.cos(a)*mr*.85,m1+Math.sin(a)*mr*.85,Math.max(2,rd(mr*.32)),S.mane)}D(g,m0,m1,rd(mr*.85),S.mane);D(g,m0+z,m1-z,rd(mr*.6),S.maneL)}
  const[h0,h1]=T(hx,hy),R0=rd(hr*z);
  if(S.ear==='point'){poly(g,[T(hx-2,hy-hr*.6),T(hx+1.5,hy-hr*.75),T(hx-1,hy-hr-4.5)],S.colD)}
  else if(!S.mane){const[e0,e1]=T(hx-1.5,hy-hr*.85);D(g,e0,e1,Math.max(2,rd(1.8*z)),S.colD)}
  D(g,h0,h1,R0,S.col);D(g,h0+rd(.8*z),h1-rd(1*z),Math.max(1,rd(R0*.55)),S.colL);
  const sn0=S.snout;poly(g,[T(hx+hr*.5,hy-1.6),T(hx+hr+sn0,hy-.6),T(hx+hr+sn0,hy+1.8),T(hx+hr*.4,hy+2.4)],S.belly);
  const[n0,n1]=T(hx+hr+sn0-.4,hy-.4);R(g,n0-z,n1-z/2,Math.max(2,rd(1.4*z)),Math.max(2,rd(1.2*z)),'#2a1a16');
  if(P.mouth){poly(g,[T(hx+hr*.5,hy+1.6),T(hx+hr+sn0,hy+1.8),T(hx+hr+sn0-1.2,hy+5)],'#8a2a2a');const[w0,w1]=T(hx+hr+sn0-.6,hy+2);R(g,w0,w1,1,Math.max(1,rd(z)),'#fff')}
  const[e0,e1]=T(hx+hr*.35,hy-hr*.3),es=Math.max(1,rd(z*.9));
  if(P.hurt){R(g,e0-es,e1-es,1,1,C.out);R(g,e0+es,e1-es,1,1,C.out);R(g,e0,e1,1,1,C.out);R(g,e0-es,e1+es,1,1,C.out);R(g,e0+es,e1+es,1,1,C.out)}
  else{R(g,e0,e1,es+1,es+1,C.out);if(S.brow)L(g,e0-2*z,e1-2.2*z,e0+es+1,e1-1.2*z,Math.max(1,rd(z*.8)),S.colD)}
  outline(c);return{c,ox,oy,k}}
// legs in the air: mirror vertically and rest the animal's back on the ground
function upsideOf(s,S){const c=mk(s.c.width,s.c.height),g=ctx2(c);g.translate(0,c.height);g.scale(1,-1);g.drawImage(s.c,0,0);
  const z=S.size*s.k,back=s.oy+rd((S.body[1]-S.body[3])*z);return{c,ox:s.ox,oy:c.height-1-back,k:s.k}}

// Sheep (scales with k so it matches battle-size characters). Anchor = feet.
export function sheepFrame(f,k=KB){const key='sheep|'+f+'|'+k;let s=cache.get(key);if(s)return s;
  const W=rd(30*k)+4,H=rd(22*k)+4,c=mk(W,H),g=ctx2(c),u=v=>rd(v*k)+2,b=f%2,lw=Math.max(2,rd(2*k));
  [[7,0],[11,1],[17,0],[21,1]].forEach(([x,o])=>R(g,u(x),u(14),lw,rd((6-(o===b?1:0))*k),C.dark));
  D(g,u(15),u(11),rd(6*k),C.wool);D(g,u(9),u(10),rd(4*k),C.wool);D(g,u(20),u(10),rd(4*k),C.wool);D(g,u(12),u(7),rd(4*k),C.wool);D(g,u(18),u(7),rd(4*k),C.wool);R(g,u(8),u(14),rd(14*k),rd(2*k),C.woolD);
  D(g,u(24),u(9),rd(3*k),'#3a2e2a');R(g,u(21),u(6),rd(3*k),rd(2*k),'#3a2e2a');R(g,u(25),u(8),1,1,C.white);
  outline(c);s={c,ox:u(15),oy:u(20),k};cache.set(key,s);return s}

// Dialogue portrait, 50x50, mouth open or closed.
export function portraitOf(id,open){const key='P|'+id+'|'+open;let c=cache.get(key);if(c)return c;
  const S=CAST[id],k=2.6,K=k*(S.tall||1),s=human(S,{...POSE[S.pose]('idle',0,S),mouth:open?1:0,item:null},k,40);
  c=mk(50,50);ctx2(c).drawImage(s.c,s.ox+rd(K)-25,s.oy-rd(35*K)-22,50,50,0,0,50,50);cache.set(key,c);return c}

// Knocked-down body: the frame turned 90° onto its back, anchor kept at the feet-side of the body.
export function lyingOf(s){const c=mk(s.c.height,s.c.width),g=ctx2(c);g.translate(0,c.height);g.rotate(-Math.PI/2);g.drawImage(s.c,0,0);
  return{c,ox:s.oy-rd(20*s.k),oy:c.height-s.ox+rd(9*s.k),k:s.k}}
export function shadowCanvas(w){const c=mk(w*2+2,6),g=ctx2(c);shadow(g,w+1,3,w);return c}
export function sparkCanvas(s){const n=s*2+8,c=mk(n,n),g=ctx2(c);spark(g,n/2,n/2,s);return c}
export function bgElah(SW){const c=mk(SW,270),g=ctx2(c),rnd=seeded(11);
  sky(g,['#6aa6cf','#84b8d9','#a3cbe1','#c3dce4','#e2e9dc'],0,125,SW);
  for(let x=60;x<SW;x+=200+rd(rnd()*160))cloud(g,x,18+rnd()*34,.8+rnd()*.6);
  const far=x=>108-16*Math.sin(x*.006+1)-10*Math.sin(x*.017)-3*Math.sin(x*.09);
  for(let x=0;x<SW;x++){const h=rd(far(x));R(g,x,h,1,150-h,'#a597a8');R(g,x,h,1,1,'#bcaebb')}
  [40,56,74,98,116].forEach(x=>tent(g,x,rd(far(x))-5,'#ece0c4'));
  [-160,-140,-118,-96,-76].forEach(dx=>tent(g,SW+dx,rd(far(SW+dx))-5,'#e2c49a',C.kilt));
  const mid=x=>136-10*Math.sin(x*.011+2)-2*Math.sin(x*.05+1)-1.5*Math.sin(x*.17);
  for(let x=0;x<SW;x++){const h=rd(mid(x));R(g,x,h,1,150-h,'#b4895a');R(g,x,h,1,1,'#c99e6a')}
  for(let x=30;x<SW;x+=90+rd(rnd()*120))tree(g,x,rd(mid(x))+2);
  for(let y=148;y<270;y++)R(g,0,y,SW,1,y<149?'#a8804e':y<162?'#bf9862':y<205?'#c7a26a':'#cfab72');
  const n=SW/480;
  for(let i=0;i<700*n;i++){const x=rnd()*SW,y=150+rnd()*100;R(g,x,y,1+rd(rnd()),1,rnd()<.5?'#ad8752':'#dcbd88')}
  for(let i=0;i<22*n;i++){const x=rnd()*SW,y=156+rnd()*92,r=1+rd(rnd()*1.5);D(g,x,y,r+1,'#8a7258');D(g,x,y-1,r,'#bdb09a')}
  for(let i=0;i<34*n;i++){const x=rd(rnd()*SW),y=rd(154+rnd()*94);R(g,x,y-3,1,3,'#7d8a3c');R(g,x-1,y-2,1,2,'#7d8a3c');R(g,x+1,y-2,1,2,'#93a04a')}
  for(let x=0;x<SW;x++){const t=251+rd(Math.sin(x*.05)*1.5);R(g,x,t-2,1,2,'#8a6a42');R(g,x,t,1,270-t,'#4f8fb4');R(g,x,266,1,4,'#3f7aa0')}
  for(let i=0;i<46*n;i++)R(g,rnd()*SW,255+rnd()*13,3+rnd()*6,1,'#8cc5dd');
  for(let x=20;x<SW;x+=40+rnd()*30){const y=258+rnd()*8,r=2+rd(rnd());D(g,x,y,r+1,'#5a6a72');D(g,x,y,r,C.stone);R(g,x-1,y-r+1,2,1,'#fff')}
  return c}
// Solid white copy of a frame, for the 1-2 frame hit flash.
export function whiteOf(s){const c=mk(s.c.width,s.c.height),g=ctx2(c);g.drawImage(s.c,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);return{...s,c}}
// Sling stone in flight, facing right: comet trail + speed lines (same look as the draft). Anchor = stone centre.
export function stoneCanvas(){const c=mk(40,15),g=ctx2(c),x=34,y=7;
  for(let i=3;i<=26;i++){const w=i<9?4:i<16?3:i<22?2:1,a=i<9?.85:i<16?.55:.3;R(g,x-i-w/2,y-w/2,w,w,`rgba(255,${i<9?250:232},${i<9?235:170},${a})`)}
  for(const s of[-6,6])for(let i=10;i<=24;i++)R(g,x-i,y+s,1,1,'rgba(255,255,255,.5)');
  D(g,x,y,4,C.out);D(g,x,y,3,C.stone);R(g,x,y-2,2,1,'#fff');R(g,x-2,y+1,2,1,C.stoneD);return c}
// Stone lying on the ground, ready to pick up. Anchor = bottom centre.
export function pickupCanvas(){const c=mk(11,8),g=ctx2(c);D(g,5,4,3,C.stone);R(g,2,6,7,1,C.stoneD);R(g,4,2,2,1,'#fff');outline(c);return c}
export function bgBeth(){const c=mk(480,270),g=ctx2(c),rnd=seeded(5);
  sky(g,['#2e2450','#56305e','#94416a','#d06a62','#f09a62'],0,135);
  D(g,392,124,15,'#ffc070');D(g,392,124,13,'#ffe2a0');
  const far=x=>122-18*Math.exp(-(((x-300)/160)**2))-6*Math.sin(x*.04);
  for(let x=0;x<480;x++){const h=rd(far(x));R(g,x,h,1,160-h,'#4a2f52')}
  const mid=x=>140-8*Math.sin(x*.03+2)-10*Math.exp(-(((x-420)/80)**2));
  for(let x=0;x<480;x++){const h=rd(mid(x));R(g,x,h,1,160-h,'#6a3a4c');R(g,x,h,1,1,'#8a4a5a')}
  for(let y=150;y<270;y++)R(g,0,y,480,1,y<151?'#5e3a3a':y<168?'#7e5446':y<200?'#8c5e4a':'#966650');
  for(let i=0;i<600;i++){const x=rnd()*480,y=152+rnd()*110;R(g,x,y,1,1,rnd()<.5?'#6e4a3e':'#a8785a')}
  for(const y of[142,149])for(let x=272;x<486;x+=9){const xx=x+((y===149)?4:0);D(g,xx,y,4,'#5e4640');D(g,xx,y-1,3,'#8a7266');R(g,xx-1,y-3,2,1,'#a8907e')}
  R(g,24,64,152,88,'#c49670');R(g,140,64,36,88,'#b48660');
  for(let y=70;y<152;y+=6){R(g,24,y,152,1,'#a87c5a');for(let x=24+((y/6)%2?6:0);x<176;x+=12)R(g,x,y-6,1,6,'#a87c5a')}
  R(g,18,58,164,7,'#7a4e34');R(g,18,58,164,1,'#9a6a48');for(let x=26;x<176;x+=14)R(g,x,65,3,2,'#5a3a26');
  D(g,82,112,12,'#2e1e2a');R(g,70,112,25,40,'#2e1e2a');R(g,68,100,2,52,'#8a5a3a');R(g,95,100,2,52,'#8a5a3a');
  R(g,124,84,20,15,'#ffcf7a');R(g,133,84,1,15,'#7a4e34');R(g,124,91,20,1,'#7a4e34');R(g,122,99,24,2,'#8a5a3a');
  for(let i=0;i<10;i++)R(g,176,152-(i+1)*9,20-i*2,9,i%2?'#a87c5a':'#b48660');
  L(g,440,172,436,140,5,'#4a3028');L(g,436,142,447,118,4,'#4a3028');L(g,438,132,426,120,3,'#4a3028');
  [[440,104,13],[424,112,9],[456,112,10],[432,96,8],[452,98,8]].forEach(([x,y,r])=>D(g,x,y,r,'#5f6a48'));
  [[444,98,5],[428,106,4],[456,106,4]].forEach(([x,y,r])=>D(g,x,y,r,'#7f8a5e'));
  return c}


// Bethlehem fields, morning: the village on the far hill, olive terraces, sheepfold walls.
export function bgField(SW){const c=mk(SW,270),g=ctx2(c),rnd=seeded(23);
  sky(g,['#7cb6dc','#98c6e0','#b6d6e2','#d2e4de','#ecead0'],0,125,SW);
  for(let x=40;x<SW;x+=180+rd(rnd()*170))cloud(g,x,16+rnd()*36,.7+rnd()*.7);
  const far=x=>110-12*Math.sin(x*.007)-8*Math.sin(x*.019+1)-2*Math.sin(x*.08);
  for(let x=0;x<SW;x++){const h=rd(far(x));R(g,x,h,1,150-h,'#9fae98');R(g,x,h,1,1,'#b6c2ac')}
  for(let i=0;i<9;i++){const x=200+i*15+rd(rnd()*6),y=rd(far(x))-4-rd(rnd()*4),w=8+rd(rnd()*5);R(g,x,y,w,6,'#dccdb0');R(g,x,y,w,1,'#b8a888');R(g,x+2,y+3,1,2,'#6a5a48')}
  const mid=x=>134-9*Math.sin(x*.012+2)-2*Math.sin(x*.05+1)-1.5*Math.sin(x*.15);
  for(let x=0;x<SW;x++){const h=rd(mid(x));R(g,x,h,1,150-h,'#8f9a52');R(g,x,h,1,1,'#a8b062');for(let y=h+5;y<150;y+=6)R(g,x,y,1,1,'#7d8846')}
  for(let x=20;x<SW;x+=70+rd(rnd()*110)){const y=rd(mid(x))+3;L(g,x,y,x-1,y-7,2,'#4a3a2c');D(g,x,y-10,5,'#6f7a52');D(g,x-4,y-8,3,'#6f7a52');D(g,x+4,y-8,3,'#6f7a52');D(g,x+1,y-12,2,'#8f9a6a')}
  for(let y=148;y<270;y++)R(g,0,y,SW,1,y<149?'#7d8846':y<162?'#a4a05a':y<205?'#ada862':'#b6b06c');
  const n=SW/480;
  for(let i=0;i<800*n;i++){const x=rnd()*SW,y=150+rnd()*108;R(g,x,y,1,1+rd(rnd()),rnd()<.5?'#8f9446':'#c8c27e')}
  for(let i=0;i<40*n;i++){const x=rd(rnd()*SW),y=rd(156+rnd()*96);R(g,x,y-3,1,3,'#6f7a3a');R(g,x-1,y-2,1,2,'#6f7a3a');R(g,x+1,y-2,1,2,'#8a9a4a')}
  for(let i=0;i<26*n;i++){const x=rnd()*SW,y=158+rnd()*92;R(g,x,y,2,2,rnd()<.6?'#d84a3a':'#f4eedc');R(g,x,y+2,1,2,'#6f7a3a')}
  for(let i=0;i<14*n;i++){const x=rnd()*SW,y=160+rnd()*86,r=1+rd(rnd()*1.5);D(g,x,y,r+1,'#7a7262');D(g,x,y-1,r,'#b8b09a')}
  for(let x=60;x<SW;x+=420+rd(rnd()*160))for(let i=0;i<9;i++){const xx=x+i*9;D(g,xx,152,4,'#6a6052');D(g,xx,151,3,'#a09482');R(g,xx-1,148,2,1,'#c0b4a0')}
  for(let x=0;x<SW;x+=2){const h=4+rd(rnd()*7);R(g,x,270-h,1,h,'#7d8846');if(rnd()<.3)R(g,x,270-h-2,1,2,'#93a04a')}
  return c}
// Arrow and Saul's thrown spear, flying right. Anchor = tip.
export function arrowCanvas(){const c=mk(24,7),g=ctx2(c);L(g,3,3,19,3,1,C.wood);R(g,19,2,3,3,C.iron);R(g,2,1,3,1,C.white);R(g,2,5,3,1,C.white);outline(c);return c}
export function spearCanvas(){const c=mk(76,9),g=ctx2(c);L(g,3,4,62,4,2,C.wood);for(let i=0;i<6;i++)R(g,62+i,4-((6-i)>>1),1,((6-i)>>1)*2+1,C.iron);R(g,63,3,4,1,C.ironL);outline(c);
  for(let i=0;i<5;i++)R(g,-2+i*4,4,2,1,'rgba(255,255,255,.5)');return c}
// Gibeah at dusk: the road past the town walls, then Saul's palace court (the last screen).
export function bgGibeah(SW){const c=mk(SW,270),g=ctx2(c),rnd=seeded(31),court=SW-480;
  sky(g,['#3a3060','#6a4070','#b05a68','#e48a60','#f4b878'],0,130,SW);
  D(g,SW*.3,118,14,'#ffc070');D(g,SW*.3,118,12,'#ffe2a0');
  const far=x=>116-14*Math.sin(x*.006+2)-6*Math.sin(x*.02);
  for(let x=0;x<SW;x++){const h=rd(far(x));R(g,x,h,1,160-h,'#5a3e5a')}
  const mid=x=>132-6*Math.sin(x*.01+1)-2*Math.sin(x*.07);
  for(let x=0;x<SW;x++){const h=rd(mid(x));R(g,x,h,1,160-h,'#7a5058');R(g,x,h,1,1,'#9a6468')}
  for(let x=80;x<court;x+=150+rd(rnd()*90)){const base=rd(mid(x))+2,w=40+rd(rnd()*40);R(g,x,base-12,w,12,'#a88a6a');for(let i=0;i<w;i+=6)R(g,x+i,base-15,3,3,'#a88a6a');R(g,x,base-12,w,1,'#c4a684');
    if(rnd()<.6){R(g,x+w-10,base-24,10,24,'#9a7c5e');R(g,x+w-11,base-26,12,2,'#c4a684');R(g,x+w-6,base-18,2,3,'#ffcf7a')}}
  for(let y=148;y<270;y++)R(g,0,y,court,1,y<149?'#6a4a3e':y<170?'#8a6650':y<210?'#94705a':'#9c7860');
  const n=SW/480;for(let i=0;i<600*n;i++){const x=rnd()*court,y=150+rnd()*110;R(g,x,y,1,1,rnd()<.5?'#7a5a48':'#b08a6a')}
  for(let i=0;i<18*n;i++){const x=rnd()*court,y=158+rnd()*90,r=1+rd(rnd());D(g,x,y,r+1,'#6a5048');D(g,x,y-1,r,'#a08878')}
  // palace court: back wall with columns and torches, flagstone floor, the throne on its dais
  R(g,court,52,480,100,'#b8a888');R(g,court,52,480,6,'#8a7a62');R(g,court,146,480,6,'#8a7a62');
  for(let x=court+20;x<SW;x+=64){R(g,x,58,14,88,'#d8ccb0');R(g,x+10,58,4,88,'#a8987c');R(g,x-3,58,20,5,'#e8dcc0');R(g,x-3,141,20,5,'#e8dcc0');
    if(((x-court-20)/64)%2){R(g,x+30,92,3,10,'#5a3a26');D(g,x+31,88,3,'#f08a3a');D(g,x+31,87,2,'#ffe27a')}}
  for(let y=152;y<270;y++)R(g,court,y,480,1,y<153?'#6a5a48':'#9a8a76');
  for(let y=164;y<270;y+=14)R(g,court,y,480,1,'#7a6a58');
  for(let y=152,r=0;y<270;y+=14,r++)for(let x=court+(r%2?0:20);x<SW;x+=40)R(g,x,y,1,14,'#7a6a58');
  R(g,SW-70,120,70,36,'#6a3a5a');R(g,SW-70,120,70,3,C.gold);R(g,SW-46,82,26,40,C.purple);R(g,SW-48,78,30,6,C.gold);R(g,SW-46,96,26,3,C.goldD);
  return c}
// Judean wilderness: pale cliffs with cave mouths, acacias, dry wadi floor.
export function bgWild(SW){const c=mk(SW,270),g=ctx2(c),rnd=seeded(41);
  sky(g,['#8cbcd8','#a8cce0','#c4dce2','#e2e6d6','#f0e2c0'],0,120,SW);
  for(let x=60;x<SW;x+=240+rd(rnd()*200))cloud(g,x,20+rnd()*30,.7+rnd()*.5);
  const far=x=>104-14*Math.sin(x*.008+1)-9*Math.sin(x*.023)-3*Math.sin(x*.1);
  for(let x=0;x<SW;x++){const h=rd(far(x));R(g,x,h,1,150-h,'#c8b494');R(g,x,h,1,1,'#dccaa8')}
  const mid=x=>128-12*Math.sin(x*.013+3)-4*Math.sin(x*.06);
  for(let x=0;x<SW;x++){const h=rd(mid(x));R(g,x,h,1,150-h,'#b09068');R(g,x,h,1,1,'#c8a880');for(let y=h+4;y<150;y+=5)if((x+y)%7===0)R(g,x,y,1,1,'#9a7c58')}
  for(let x=90;x<SW;x+=260+rd(rnd()*160)){const y=rd(mid(x))+10;D(g,x,y+6,9,'#3a2a24');R(g,x-9,y+6,19,8,'#3a2a24');R(g,x-10,y-3,21,2,'#c8a880')}
  for(let x=40;x<SW;x+=120+rd(rnd()*140)){const y=rd(mid(x))+2;L(g,x,y,x,y-8,2,'#5a3a26');R(g,x-8,y-12,17,3,'#6f7a3a');R(g,x-5,y-14,11,2,'#8a9a4a')}
  for(let y=148;y<270;y++)R(g,0,y,SW,1,y<149?'#9a7c58':y<168?'#c4a674':y<210?'#ccae7c':'#d4b684');
  const n=SW/480;
  for(let i=0;i<650*n;i++){const x=rnd()*SW,y=150+rnd()*110;R(g,x,y,1,1,rnd()<.5?'#b0925e':'#e2c898')}
  for(let i=0;i<30*n;i++){const x=rnd()*SW,y=156+rnd()*96,r=1+rd(rnd()*2);D(g,x,y,r+1,'#8a7258');D(g,x,y-1,r,'#c0b49c')}
  for(let i=0;i<20*n;i++){const x=rd(rnd()*SW),y=rd(158+rnd()*90);R(g,x,y-3,1,3,'#8a8a3a');R(g,x-1,y-2,1,2,'#8a8a3a')}
  return c}
// Keilah: grain fields and stone threshing floors heaped with sheaves, the town wall at the far end.
export function bgKeilah(SW){const c=mk(SW,270),g=ctx2(c),rnd=seeded(53);
  sky(g,['#7cb0d4','#98c2dc','#b8d6e0','#d8e4d8','#f2e8c4'],0,125,SW);
  for(let x=50;x<SW;x+=210+rd(rnd()*170))cloud(g,x,18+rnd()*32,.8+rnd()*.5);
  const far=x=>110-12*Math.sin(x*.007+2)-6*Math.sin(x*.02);
  for(let x=0;x<SW;x++){const h=rd(far(x));R(g,x,h,1,150-h,'#a8a088')}
  const mid=x=>134-8*Math.sin(x*.011)-2*Math.sin(x*.05);
  for(let x=0;x<SW;x++){const h=rd(mid(x));R(g,x,h,1,150-h,'#c8a85a');R(g,x,h,1,1,'#e0c070');for(let y=h+3;y<150;y+=3)if((x*3+y)%5===0)R(g,x,y,1,2,'#b8984a')}
  const wallX=SW-300;R(g,wallX,96,300,54,'#b89a74');for(let x=wallX;x<SW;x+=8)R(g,x,92,5,4,'#b89a74');for(let y=104;y<150;y+=8)R(g,wallX,y,300,1,'#9a7c58');
  R(g,wallX+120,112,26,38,'#4a3428');D(g,wallX+133,112,13,'#4a3428');R(g,wallX,96,300,1,'#d4b890');
  for(let y=148;y<270;y++)R(g,0,y,SW,1,y<149?'#9a7c4a':y<170?'#bca06a':y<210?'#c6a872':'#cfb07a');
  const n=SW/480;
  for(let i=0;i<650*n;i++){const x=rnd()*SW,y=150+rnd()*110;R(g,x,y,1,1,rnd()<.5?'#a88a56':'#e0c890')}
  for(let x=140;x<SW-200;x+=330+rd(rnd()*120)){const y=176+rd(rnd()*40);for(let dy=-7;dy<=7;dy++){const h=rd(46*Math.sqrt(1-(dy/7.5)**2));R(g,x-h,y+dy,h*2,1,dy===-7?'#d8cab0':'#b8a890')}
    for(const [ox,oy] of[[-14,-3],[8,-4],[-2,2]]){D(g,x+ox,y+oy-4,6,'#e2c060');D(g,x+ox,y+oy-6,4,'#f0d880');R(g,x+ox-1,y+oy-4,2,4,'#c09a40')}}
  for(let i=0;i<24*n;i++){const x=rd(rnd()*SW),y=rd(158+rnd()*94);R(g,x,y-4,1,4,'#d8b850');R(g,x+1,y-3,1,3,'#c8a840')}
  return c}
export{C,mk,ctx2,R,D,L,frame,bar};
