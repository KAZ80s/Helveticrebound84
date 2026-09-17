"use strict";
(() => {
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d",{alpha:false});
  const $=id=>document.getElementById(id),W=canvas.width,H=canvas.height;
  const storedLang=localStorage.getItem("helveticReboundLanguage");
  const state={level:1,score:0,lives:3,running:false,paused:false,left:false,right:false,pointerX:null,
    highscore:Number(localStorage.getItem("helveticReboundHighscore")||0),lang:storedLang==="en"?"en":"de",devMode:false,devStartLevel:1};
  const paddle={x:W/2-70,y:H-45,w:140,h:16,speed:620};
  let balls=[],bricks=[],last=performance.now();

  const T={
    de:{help:"ANLEITUNG",level:"LEVEL",score:"PUNKTE",lives:"LEBEN",highscore:"HIGHSCORE",pause:"PAUSE",footer:"Eigenständiges Retro-Arcadespiel · keine externen Bibliotheken · lokale Speicherung nur für Highscore und Sprache",keys:"← → / A D · Maus/Touch · P = Pause · R = Neustart",devInfo:"Testlevel auswählen. Punkte und Leben beginnen neu.",start:"SPIEL STARTEN",next:"WEITER",newGame:"NEUES SPIEL",again:"NOCHMAL",gameOver:"GAME OVER",ballLost:"BALL VERLOREN",phaseDone:"PHASE 2 GESCHAFFT",points:"Punkte",high:"Highscore",remaining:"Noch {n} Leben.",allDone:"Alle 25 Levels abgeschlossen. Punkte: {n}",levelLabel:"LEVEL {n}",devStart:"Development-Start bei Level {n}"},
    en:{help:"INSTRUCTIONS",level:"LEVEL",score:"SCORE",lives:"LIVES",highscore:"HIGH SCORE",pause:"PAUSE",footer:"Independent retro arcade game · no external libraries · local storage only for high score and language",keys:"← → / A D · Mouse/Touch · P = Pause · R = Restart",devInfo:"Select a test level. Score and lives start over.",start:"START GAME",next:"CONTINUE",newGame:"NEW GAME",again:"PLAY AGAIN",gameOver:"GAME OVER",ballLost:"BALL LOST",phaseDone:"PHASE 2 COMPLETE",points:"Score",high:"High score",remaining:"{n} lives remaining.",allDone:"All 25 levels completed. Score: {n}",levelLabel:"LEVEL {n}",devStart:"Development start at level {n}"}
  };

  const rawLevels=[
    ["Rot-Weiss","Red & White",4,10,1.00,"flag"],["Alpenlinie","Alpine Line",5,11,1.04,"mountain"],["Kreuz","Cross",6,11,1.08,"cross"],["Passstrasse","Pass Road",6,12,1.12,"zigzag"],["Chalet","Chalet",7,12,1.16,"chalet"],
    ["Gipfel","Summit",7,13,1.20,"peak"],["Gotthard","Gotthard",7,13,1.24,"tunnel"],["Eisfeld","Ice Field",8,13,1.28,"checker"],["Helvetia","Helvetia",8,14,1.32,"diamond"],["Finale I","Finale I",8,14,1.36,"finale"],
    ["Bergsee","Mountain Lake",6,12,1.38,"waves"],["Staumauer","Dam",7,13,1.40,"wall"],["Serpentine","Hairpins",7,13,1.42,"zigzag"],["Gletscher","Glacier",8,13,1.44,"checker"],["Doppelball","Twin Ball",8,14,1.46,"diamond"],
    ["Alpentunnel","Alpine Tunnel",8,14,1.48,"tunnel"],["Rhonebogen","Rhone Arc",8,14,1.50,"waves"],["Festung","Fortress",8,14,1.52,"wall"],["Schneestern","Snow Star",8,14,1.54,"cross"],["Finale II","Finale II",8,14,1.56,"finale"],
    ["Jurakette","Jura Range",8,14,1.58,"mountain"],["Roter Diamant","Red Diamond",8,14,1.60,"diamond"],["Nordwand","North Face",8,14,1.62,"peak"],["Helvetic Mix","Helvetic Mix",8,14,1.64,"mixed"],["Grand Finale","Grand Finale",8,14,1.66,"grand"]
  ];
  const LEVELS=rawLevels.map((x,i)=>({de:x[0],en:x[1],rows:x[2],cols:x[3],speed:x[4],pattern:x[5],number:i+1}));
  function tr(k){return T[state.lang][k]||k}
  function levelName(){const L=LEVELS[state.level-1];return L?L[state.lang]:""}
  function applyLanguage(){
    document.documentElement.lang=state.lang;
    document.querySelectorAll("[data-i18n]").forEach(el=>{const v=tr(el.dataset.i18n);if(v)el.textContent=v});
    document.querySelectorAll(".lang-copy").forEach(el=>el.classList.toggle("hidden",!el.classList.contains(`lang-${state.lang}`)));
    $("langBtn").textContent=state.lang==="de"?"EN":"DE";
    localStorage.setItem("helveticReboundLanguage",state.lang);
  }

  function visibleFor(pattern,r,c,rows,cols){
    const midR=(rows-1)/2,midC=(cols-1)/2;
    switch(pattern){
      case "flag":return !(r===0&&(c<2||c>cols-3)); case "mountain":return r>=Math.floor(Math.abs(c-midC)*.55);
      case "cross":return Math.abs(c-midC)<=1||Math.abs(r-midR)<=1; case "zigzag":return ((r+c)%3)!==0;
      case "chalet":return r>=Math.floor(Math.abs(c-midC)*.55)||(r>rows/2&&c>1&&c<cols-2);
      case "peak":return r>=Math.floor(Math.abs(c-midC)*.7); case "tunnel":return !(r>rows/2&&Math.abs(c-midC)<2);
      case "checker":return (r+c)%2===0||r===rows-1; case "diamond":return Math.abs(c-midC)+Math.abs(r-midR)<Math.min(cols,rows)*.75;
      case "finale":return !(r===1&&(c===1||c===cols-2)); case "waves":return r>=Math.floor(1.3+Math.sin(c*.9)*1.4);
      case "wall":return !(r>rows/2&&c%5===2); case "mixed":return ((r*c+r+c)%5)!==0;
      case "grand":return !(r===2&&(c===2||c===cols-3))&&!(r===5&&Math.abs(c-midC)<2); default:return true;
    }
  }

  function buildLevel(n){
    const L=LEVELS[n-1],gap=7,margin=42,top=75,bw=(W-margin*2-gap*(L.cols-1))/L.cols,bh=24;
    bricks=[];
    for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++){
      if(!visibleFor(L.pattern,r,c,L.rows,L.cols))continue;
      const hp=n>=7&&(r+c+n)%7===0?2:1;
      bricks.push({x:margin+c*(bw+gap),y:top+r*(bh+gap),w:bw,h:bh,hp,multi:false});
    }
    if(n>=15&&bricks.length){
      const targetX=W/2,targetY=top+bh*2;
      let special=bricks.filter(b=>b.y<=top+3*(bh+gap)).sort((a,b)=>Math.abs((a.x+a.w/2)-targetX)+Math.abs(a.y-targetY)-Math.abs((b.x+b.w/2)-targetX)-Math.abs(b.y-targetY))[0];
      if(!special)special=bricks[Math.floor(bricks.length/2)];special.multi=true;special.hp=Math.max(1,special.hp);
    }
    resetBalls(true);updateHUD();
  }

  function makeBall(direction=1){const s=LEVELS[state.level-1].speed;return{x:W/2,y:paddle.y-12,r:9,vx:direction*230*s,vy:-300*s,stuck:true}}
  function resetBalls(stuck=true){paddle.x=W/2-paddle.w/2;const b=makeBall(Math.random()<.5?-1:1);b.stuck=stuck;balls=[b]}
  function releaseSecondBall(source){const speed=Math.hypot(source.vx,source.vy);balls.push({x:source.x,y:source.y,r:source.r,vx:-source.vx||speed*.65,vy:-Math.abs(source.vy)||-speed*.75,stuck:false})}
  function updateHUD(){$("level").textContent=state.level;$("score").textContent=state.score;$("lives").textContent=state.lives;$("highscore").textContent=state.highscore;$("devBtn").classList.toggle("dev-active",state.devMode)}
  function setOverlay(title,text,button){$("overlayTitle").textContent=title;$("overlayText").textContent=text;$("startBtn").textContent=button||tr("next");$("overlay").classList.remove("hidden")}
  function hideOverlay(){$("overlay").classList.add("hidden")}
  function startOrContinue(){if(state.level>25||state.lives<=0){newGame(state.devMode?state.devStartLevel:1,state.devMode);return}hideOverlay();state.running=true;state.paused=false;balls.forEach(b=>b.stuck=false)}
  function newGame(startLevel=1,dev=false){const valid=[1,5,10,15,20,25].includes(startLevel)?startLevel:1;state.level=valid;state.score=0;state.lives=3;state.running=true;state.paused=false;state.devMode=dev;state.devStartLevel=valid;buildLevel(valid);hideOverlay();balls.forEach(b=>b.stuck=false);updateHUD()}
  function loseLife(){
    if(!state.running||state.lives<=0)return;state.lives=Math.max(0,state.lives-1);updateHUD();
    if(state.lives<=0){state.running=false;balls.forEach(b=>b.stuck=true);saveHighscore();setOverlay(tr("gameOver"),`${tr("points")}: ${state.score} · ${tr("high")}: ${state.highscore}`,tr("newGame"))}
    else{resetBalls(true);setOverlay(tr("ballLost"),tr("remaining").replace("{n}",state.lives),tr("next"))}
  }
  function saveHighscore(){if(!state.devMode&&state.score>state.highscore){state.highscore=state.score;localStorage.setItem("helveticReboundHighscore",String(state.highscore))}updateHUD()}
  function levelComplete(){
    state.score+=500*state.level;saveHighscore();
    if(state.level===25){state.running=false;state.level=26;setOverlay(tr("phaseDone"),tr("allDone").replace("{n}",state.score),tr("again"))}
    else{state.level++;state.running=false;buildLevel(state.level);setOverlay(tr("levelLabel").replace("{n}",state.level),levelName(),tr("start"))}
  }
  function circleRect(b,r){const cx=Math.max(r.x,Math.min(b.x,r.x+r.w)),cy=Math.max(r.y,Math.min(b.y,r.y+r.h)),dx=b.x-cx,dy=b.y-cy;return dx*dx+dy*dy<=b.r*b.r}

  function update(dt){
    if(!state.running||state.paused)return;
    if(state.left)paddle.x-=paddle.speed*dt;if(state.right)paddle.x+=paddle.speed*dt;
    if(state.pointerX!==null)paddle.x+=(state.pointerX-paddle.w/2-paddle.x)*Math.min(1,dt*14);
    paddle.x=Math.max(8,Math.min(W-paddle.w-8,paddle.x));
    for(const ball of [...balls]){
      if(ball.stuck){ball.x=paddle.x+paddle.w/2;ball.y=paddle.y-ball.r-3;continue}
      ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
      if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=Math.abs(ball.vx)}if(ball.x+ball.r>W){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx)}if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=Math.abs(ball.vy)}
      if(ball.vy>0&&circleRect(ball,paddle)){ball.y=paddle.y-ball.r-1;const rel=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2),speed=Math.min(660,Math.hypot(ball.vx,ball.vy)*1.012),angle=rel*1.05;ball.vx=speed*Math.sin(angle);ball.vy=-Math.abs(speed*Math.cos(angle))}
      for(const br of bricks){
        if(br.hp<=0||!circleRect(ball,br))continue;br.hp--;state.score+=br.hp===0?100:25;
        const cx=ball.x-(br.x+br.w/2),cy=ball.y-(br.y+br.h/2);if(Math.abs(cx/br.w)>Math.abs(cy/br.h))ball.vx*=-1;else ball.vy*=-1;
        if(br.hp===0&&br.multi){br.multi=false;releaseSecondBall(ball)}updateHUD();break;
      }
    }
    balls=balls.filter(b=>b.y-b.r<=H);
    if(!balls.length){loseLife();return}if(bricks.every(b=>b.hp<=0))levelComplete();
  }

  function drawBackground(){ctx.fillStyle="#080a0d";ctx.fillRect(0,0,W,H);ctx.fillStyle="#151922";ctx.beginPath();ctx.moveTo(0,390);for(const p of [[0,390],[100,320],[170,365],[280,250],[370,360],[475,285],[560,355],[690,230],[810,350],[900,300],[900,600],[0,600]])ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fill();ctx.fillStyle="#11141a";ctx.fillRect(0,430,W,170);ctx.globalAlpha=.08;ctx.fillStyle="#fff";ctx.fillRect(W-110,35,70,22);ctx.fillRect(W-86,11,22,70);ctx.globalAlpha=1}
  function draw(){
    drawBackground();for(const br of bricks){if(br.hp<=0)continue;ctx.fillStyle=br.multi?"#20c7e8":br.hp===2?"#f0f0f0":"#d71920";ctx.fillRect(br.x,br.y,br.w,br.h);ctx.strokeStyle=br.multi?"#fff":"#ffffff33";ctx.strokeRect(br.x+.5,br.y+.5,br.w-1,br.h-1);if(br.multi){ctx.fillStyle="#082b33";ctx.font="bold 16px Arial";ctx.textAlign="center";ctx.fillText("2×",br.x+br.w/2,br.y+18);ctx.textAlign="left"}}
    ctx.fillStyle="#f4f4f4";ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);ctx.fillStyle="#d71920";ctx.fillRect(paddle.x+paddle.w/2-10,paddle.y-4,20,paddle.h+8);
    for(const ball of balls){ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill()}
    if(state.level<=25){ctx.fillStyle="#ffffff88";ctx.font="16px Arial";ctx.fillText(levelName().toUpperCase(),22,30)}if(state.devMode){ctx.fillStyle="#20c7e8";ctx.font="bold 13px Arial";ctx.fillText("DEV",W-42,30)}
    if(state.paused){ctx.fillStyle="#000a";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.font="bold 42px Arial";ctx.textAlign="center";ctx.fillText(tr("pause"),W/2,H/2);ctx.textAlign="left"}
  }
  function loop(t){const dt=Math.min(.025,(t-last)/1000);last=t;update(dt);draw();requestAnimationFrame(loop)}
  function pointer(clientX){const r=canvas.getBoundingClientRect();state.pointerX=(clientX-r.left)*W/r.width}
  function openModal(id){$(id).classList.remove("hidden")}function closeModal(id){$(id).classList.add("hidden")}
  addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight","Space","KeyA","KeyD","KeyP","KeyR","Escape"].includes(e.code))e.preventDefault();if(e.code==="ArrowLeft"||e.code==="KeyA")state.left=true;if(e.code==="ArrowRight"||e.code==="KeyD")state.right=true;if(e.code==="KeyP"&&state.running)state.paused=!state.paused;if(e.code==="KeyR")newGame(state.devMode?state.devStartLevel:1,state.devMode);if(e.code==="Space"&&!state.running)startOrContinue();if(e.code==="Escape")document.querySelectorAll(".modal").forEach(m=>m.classList.add("hidden"))});
  addEventListener("keyup",e=>{if(e.code==="ArrowLeft"||e.code==="KeyA")state.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")state.right=false});
  canvas.addEventListener("pointermove",e=>pointer(e.clientX));canvas.addEventListener("pointerdown",e=>{pointer(e.clientX);if(!state.running)startOrContinue()});
  [["leftBtn","left"],["rightBtn","right"]].forEach(([id,dir])=>{const el=$(id);el.addEventListener("pointerdown",e=>{e.preventDefault();state[dir]=true});["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,()=>state[dir]=false))});
  $("pauseBtn").addEventListener("click",()=>{if(state.running)state.paused=!state.paused});$("startBtn").addEventListener("click",startOrContinue);
  $("langBtn").addEventListener("click",()=>{state.lang=state.lang==="de"?"en":"de";applyLanguage()});$("helpBtn").addEventListener("click",()=>openModal("helpModal"));$("devBtn").addEventListener("click",()=>openModal("devModal"));
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  document.querySelectorAll("[data-dev-level]").forEach(b=>b.addEventListener("click",()=>{const n=Number(b.dataset.devLevel);closeModal("devModal");newGame(n,true);setOverlay(tr("levelLabel").replace("{n}",n),tr("devStart").replace("{n}",n),tr("start"))}));
  applyLanguage();updateHUD();buildLevel(1);setOverlay("HELVETICREBOUND",state.lang==="de"?"Zerstöre alle Zielblöcke. Bewege den Schläger und halte den Ball im Spiel.":"Destroy all target blocks. Move the paddle and keep the ball in play.",tr("start"));requestAnimationFrame(loop);
})();
