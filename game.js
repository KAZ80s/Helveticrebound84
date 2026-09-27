"use strict";
(() => {
  const canvas=document.getElementById("game"),ctx=canvas.getContext("2d",{alpha:false});
  const $=id=>document.getElementById(id),W=canvas.width,H=canvas.height;
  const storage={getItem(k){try{return localStorage.getItem(k)}catch{return null}},setItem(k,v){try{localStorage.setItem(k,v)}catch{}}};
  const storedLang=storage.getItem("helveticReboundLanguage");
  const state={level:1,score:0,lives:3,running:false,paused:false,left:false,right:false,pointerX:null,
    highscore:Number(storage.getItem("helveticReboundHighscore")||0),lang:storedLang==="en"?"en":"de",devMode:false,devStartLevel:1};
  const paddle={x:W/2-70,y:H-45,w:140,h:16,speed:620};
  let balls=[],bricks=[],last=performance.now();
  const milestones=[5,10,15,20,25];
  const developmentLevels=[3,6,9,12,15,18,21,24];
  let progress={};
  try{const raw=JSON.parse(storage.getItem("helveticReboundProgress")||"{}");for(const n of milestones)progress[n]=Number.isInteger(raw?.[n])?Math.max(0,Math.min(10,raw[n])):0}catch{progress={}}
  if(!Number.isSafeInteger(state.highscore)||state.highscore<0)state.highscore=0;
  let bonus=false,bonusTime=0,wideTime=0,modalOpen=null,screen="intro",newUnlock=0;
  let shield=false,motionTime=0;
  const say=(de,en)=>state.lang==="de"?de:en;
  function resetWidth(){wideTime=0;paddle.w=140;paddle.x=Math.min(paddle.x,W-paddle.w-8)}
  function widen(){const center=paddle.x+paddle.w/2;paddle.w=210;paddle.x=Math.max(8,Math.min(W-218,center-105));wideTime=15}
  function refreshScreens(){
    $("devTitle").textContent=say("DEVELOPMENT-MODUS","DEVELOPMENT MODE");
    $("selectTitle").textContent=say("STARTLEVEL WÄHLEN","SELECT START LEVEL");
    $("selectBtn").textContent=say("STARTLEVEL","START LEVEL");
    document.querySelectorAll("[data-normal-level]").forEach(b=>{const n=Number(b.dataset.normalLevel),count=progress[n]||0;b.disabled=n!==1&&count<10;b.textContent=`Level ${n}`+(n===1?"":` · ${count}/10`)});
    if(screen==="playing")return;
    const titles={intro:"HELVETICREBOUND",lost:tr("ballLost"),over:tr("gameOver"),level:tr("levelLabel").replace("{n}",state.level),bonus:say("SCHWEIZER BONUSRUNDE","SWISS BONUS ROUND"),done:tr("phaseDone")};
    const texts={intro:say("Zerstöre alle Blöcke. Wähle ein freigeschaltetes Startlevel oder starte bei Level 1.","Destroy all blocks. Select an unlocked starting level or begin at level 1."),lost:tr("remaining").replace("{n}",state.lives),over:`${tr("points")}: ${state.score}`,level:levelName(),bonus:say("30 Sekunden · Keine Lebensverluste · Jeder Treffer zählt!","30 seconds · No lives lost · Every hit counts!"),done:tr("allDone").replace("{n}",state.score)};
    if(screen==="bonus"&&newUnlock)texts.bonus+=say(` Level ${newUnlock} ist jetzt als Startlevel freigeschaltet!`, ` Level ${newUnlock} is now unlocked as a starting level!`);
    setOverlay(titles[screen],texts[screen],screen==="over"?tr("newGame"):screen==="done"?tr("again"):screen==="lost"?tr("next"):tr("start"));
  }
  function startBonus(){shield=false;motionTime=0;bonus=true;bonusTime=30;shield=false;motionTime=0;resetWidth();bricks=[];for(let r=0;r<7;r++)for(let c=0;c<11;c++)if(Math.abs(c-5)<=1||Math.abs(r-3)<=1)bricks.push({x:100+c*64,y:80+r*30,w:57,h:24,hp:1,multi:false,wide:false});resetBalls(true);state.running=false;screen="bonus";refreshScreens()}
  function finishBonus(){bonus=false;resetWidth();saveHighscore();advanceLevel()}
  function advanceLevel(){state.running=false;if(state.level===25){state.level=26;screen="done"}else{state.level++;buildLevel(state.level);screen="level"}refreshScreens()}


  const T={
    de:{help:"ANLEITUNG",level:"LEVEL",score:"PUNKTE",lives:"LEBEN",highscore:"HIGHSCORE",pause:"PAUSE",footer:"Eigenständiges Retro-Arcadespiel · keine externen Bibliotheken · lokale Speicherung: Highscore, Sprache und Freischaltungen",keys:"← → / A D · Maus/Touch · P = Pause · R = Neustart",devInfo:"Testlevel auswählen. Punkte und Leben beginnen neu.",start:"SPIEL STARTEN",next:"WEITER",newGame:"NEUES SPIEL",again:"NOCHMAL",gameOver:"GAME OVER",ballLost:"BALL VERLOREN",phaseDone:"ALLE LEVELS GESCHAFFT",points:"Punkte",high:"Highscore",remaining:"Noch {n} Leben.",allDone:"Alle 25 Levels abgeschlossen. Punkte: {n}",levelLabel:"LEVEL {n}",devStart:"Development-Start bei Level {n}"},
    en:{help:"INSTRUCTIONS",level:"LEVEL",score:"SCORE",lives:"LIVES",highscore:"HIGH SCORE",pause:"PAUSE",footer:"Independent retro arcade game · no external libraries · local storage: high score, language and unlock progress",keys:"← → / A D · Mouse/Touch · P = Pause · R = Restart",devInfo:"Select a test level. Score and lives start over.",start:"START GAME",next:"CONTINUE",newGame:"NEW GAME",again:"PLAY AGAIN",gameOver:"GAME OVER",ballLost:"BALL LOST",phaseDone:"ALL LEVELS COMPLETE",points:"Score",high:"High score",remaining:"{n} lives remaining.",allDone:"All 25 levels completed. Score: {n}",levelLabel:"LEVEL {n}",devStart:"Development start at level {n}"}
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
    $("helpModal").setAttribute("aria-label",say("Anleitung","Instructions"));
    $("leftBtn").setAttribute("aria-label",say("Nach links","Move left"));$("rightBtn").setAttribute("aria-label",say("Nach rechts","Move right"));
    document.querySelectorAll("[data-close]").forEach(b=>b.setAttribute("aria-label",say("Schliessen","Close")));
    $("langBtn").textContent=state.lang==="de"?"EN":"DE";
    storage.setItem("helveticReboundLanguage",state.lang);refreshScreens();
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
    shield=false;motionTime=0;resetWidth();bricks=[];
    for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++){
      if(!visibleFor(L.pattern,r,c,L.rows,L.cols))continue;
      const hp=n>=7&&(r+c+n)%7===0?2:1;
      bricks.push({x:margin+c*(bw+gap),y:top+r*(bh+gap),w:bw,h:bh,hp,multi:false,baseX:margin+c*(bw+gap),moving:n>=11&&(r===1||(n>=20&&r===3)),row:r});
    }
    if(n>=15&&bricks.length){
      const targetX=W/2,targetY=top+bh*2;
      let special=bricks.filter(b=>b.y<=top+3*(bh+gap)).sort((a,b)=>Math.abs((a.x+a.w/2)-targetX)+Math.abs(a.y-targetY)-Math.abs((b.x+b.w/2)-targetX)-Math.abs(b.y-targetY))[0];
      if(!special)special=bricks[Math.floor(bricks.length/2)];special.multi=true;special.hp=1;
    }
    const wideBlock=bricks.find(b=>!b.multi);if(wideBlock){wideBlock.wide=true;wideBlock.hp=1}
    if(n>=5){const block=[...bricks].reverse().find(b=>!b.multi&&!b.wide);if(block){block.shield=true;block.hp=1}}
    resetBalls(true);updateHUD();
  }

  function makeBall(direction=1){const s=LEVELS[state.level-1].speed;return{x:W/2,y:paddle.y-12,r:9,vx:direction*230*s,vy:-300*s,stuck:true}}
  function resetBalls(stuck=true){paddle.x=W/2-paddle.w/2;const b=makeBall(Math.random()<.5?-1:1);b.stuck=stuck;balls=[b]}
  function releaseSecondBall(source){const speed=Math.hypot(source.vx,source.vy);balls.push({x:source.x,y:source.y,r:source.r,vx:-source.vx||speed*.65,vy:-Math.abs(source.vy)||-speed*.75,stuck:false})}
  function updateHUD(){$("level").textContent=state.level;$("score").textContent=state.score;$("lives").textContent=state.lives;$("highscore").textContent=state.highscore;$("devBtn").classList.toggle("dev-active",state.devMode)}
  function setOverlay(title,text,button){$("overlayTitle").textContent=title;$("overlayText").textContent=text;$("startBtn").textContent=button||tr("next");$("overlay").classList.remove("hidden")}
  function hideOverlay(){$("overlay").classList.add("hidden")}
  function startOrContinue(){screen="playing";if(state.level>25||state.lives<=0){newGame(state.devStartLevel,state.devMode);return}hideOverlay();state.running=true;state.paused=false;balls.forEach(b=>b.stuck=false)}
  function newGame(startLevel=1,dev=false){const valid=dev?(developmentLevels.includes(startLevel)?startLevel:3):(startLevel===1||(milestones.includes(startLevel)&&progress[startLevel]>=10)?startLevel:1);bonus=false;bonusTime=0;resetWidth();screen="playing";state.pointerX=null;state.left=false;state.right=false;state.level=valid;state.score=0;state.lives=3;state.running=true;state.paused=false;state.devMode=dev;state.devStartLevel=valid;buildLevel(valid);hideOverlay();balls.forEach(b=>b.stuck=false);updateHUD()}
  function loseLife(){
    if(!state.running||state.lives<=0)return;if(bonus){resetBalls(false);return}shield=false;resetWidth();state.running=false;state.lives=Math.max(0,state.lives-1);updateHUD();
    if(state.lives<=0){state.running=false;balls.forEach(b=>b.stuck=true);saveHighscore();screen="over";setOverlay(tr("gameOver"),`${tr("points")}: ${state.score} · ${tr("high")}: ${state.highscore}`,tr("newGame"))}
    else{screen="lost";resetBalls(true);setOverlay(tr("ballLost"),tr("remaining").replace("{n}",state.lives),tr("next"))}
  }
  function saveHighscore(){if(!state.devMode&&state.score>state.highscore){state.highscore=state.score;storage.setItem("helveticReboundHighscore",String(state.highscore))}updateHUD()}
  function levelComplete(){
    if(bonus){finishBonus();return}
    newUnlock=0;state.score+=500*state.level;
    if(!state.devMode&&milestones.includes(state.level)){if((progress[state.level]||0)===9)newUnlock=state.level;progress[state.level]=Math.min(10,(progress[state.level]||0)+1);storage.setItem("helveticReboundProgress",JSON.stringify(progress))}
    saveHighscore();if(milestones.includes(state.level))startBonus();else advanceLevel();
  }
  function circleRect(b,r){const cx=Math.max(r.x,Math.min(b.x,r.x+r.w)),cy=Math.max(r.y,Math.min(b.y,r.y+r.h)),dx=b.x-cx,dy=b.y-cy;return dx*dx+dy*dy<=b.r*b.r}

  // Small physics steps prevent fast balls crossing thin or moving blocks.
  function update(dt){
    if(!state.running||state.paused||modalOpen||!Number.isFinite(dt)||dt<0)return;
    const count=Math.max(1,Math.ceil(dt*Math.max(660,...balls.map(b=>Math.hypot(b.vx,b.vy)))/4));
    for(let i=0;i<count;i++){step(dt/count);if(!state.running)break}
  }
  function reflectBlock(ball,br){
    const nearX=Math.max(br.x,Math.min(ball.x,br.x+br.w)),nearY=Math.max(br.y,Math.min(ball.y,br.y+br.h));
    let nx=ball.x-nearX,ny=ball.y-nearY,d=Math.hypot(nx,ny);
    if(d>0){nx/=d;ny/=d;ball.x=nearX+nx*(ball.r+.02);ball.y=nearY+ny*(ball.r+.02)}
    else{
      const edges=[{d:ball.x-br.x,nx:-1,ny:0,x:br.x-ball.r-.02,y:ball.y},{d:br.x+br.w-ball.x,nx:1,ny:0,x:br.x+br.w+ball.r+.02,y:ball.y},{d:ball.y-br.y,nx:0,ny:-1,x:ball.x,y:br.y-ball.r-.02},{d:br.y+br.h-ball.y,nx:0,ny:1,x:ball.x,y:br.y+br.h+ball.r+.02}];
      const edge=edges.reduce((a,b)=>a.d<b.d?a:b);nx=edge.nx;ny=edge.ny;ball.x=edge.x;ball.y=edge.y;
    }
    const dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=2*dot*nx;ball.vy-=2*dot*ny}
  }
  function step(dt){
    if(!state.running||state.paused||modalOpen)return;
    motionTime+=dt;for(const br of bricks)if(br.moving)br.x=br.baseX+12*Math.sin(motionTime*.65+(br.row===3?Math.PI:0));
    if(bonus){bonusTime=Math.max(0,bonusTime-dt);if(bonusTime<=0){finishBonus();return}}
    if(wideTime>0){wideTime=Math.max(0,wideTime-dt);if(wideTime===0)resetWidth()}
    if(state.left)paddle.x-=paddle.speed*dt;if(state.right)paddle.x+=paddle.speed*dt;
    if(state.pointerX!==null)paddle.x+=(state.pointerX-paddle.w/2-paddle.x)*Math.min(1,dt*14);
    paddle.x=Math.max(8,Math.min(W-paddle.w-8,paddle.x));
    for(const ball of [...balls]){
      if(ball.stuck){ball.x=paddle.x+paddle.w/2;ball.y=paddle.y-ball.r-3;continue}
      const previousY=ball.y;
      ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
      if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=Math.abs(ball.vx)}if(ball.x+ball.r>W){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx)}if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=Math.abs(ball.vy)}
      if(ball.vy>0&&circleRect(ball,paddle)){ball.y=paddle.y-ball.r-1;const rel=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2),speed=Math.min(660,Math.hypot(ball.vx,ball.vy)*1.012),angle=rel*1.05;ball.vx=speed*Math.sin(angle);ball.vy=-Math.abs(speed*Math.cos(angle))}
      if(shield&&ball.vy>0&&previousY+ball.r<=H-18&&ball.y+ball.r>=H-18){shield=false;ball.y=H-18-ball.r-.01;ball.vy=-Math.abs(ball.vy)}
      for(const br of bricks){
        if(br.hp<=0||!circleRect(ball,br))continue;br.hp--;state.score+=br.hp===0?100:25;
        reflectBlock(ball,br);
        if(br.hp===0&&br.shield){br.shield=false;shield=true}
        if(br.hp===0&&br.wide){br.wide=false;widen()}
        if(br.hp===0&&br.multi){br.multi=false;releaseSecondBall(ball)}updateHUD();break;
      }
    }
    balls=balls.filter(b=>b.y-b.r<=H);
    if(!balls.length){loseLife();return}if(bricks.every(b=>b.hp<=0))levelComplete();
  }

  function drawBackground(){ctx.fillStyle="#080a0d";ctx.fillRect(0,0,W,H);ctx.fillStyle="#151922";ctx.beginPath();ctx.moveTo(0,390);for(const p of [[0,390],[100,320],[170,365],[280,250],[370,360],[475,285],[560,355],[690,230],[810,350],[900,300],[900,600],[0,600]])ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fill();ctx.fillStyle="#11141a";ctx.fillRect(0,430,W,170);ctx.globalAlpha=.08;ctx.fillStyle="#fff";ctx.fillRect(W-110,35,70,22);ctx.fillRect(W-86,11,22,70);ctx.globalAlpha=1}
  function draw(){
    drawBackground();if(bonus){ctx.fillStyle="#401018";ctx.fillRect(0,40,W,370)}
    for(const br of bricks){if(br.hp<=0)continue;ctx.fillStyle=br.shield?"#ffcf57":br.wide?"#35db83":br.multi?"#20c7e8":br.hp===2?"#f0f0f0":"#d71920";ctx.fillRect(br.x,br.y,br.w,br.h);ctx.strokeStyle=br.moving?"#ca9fff":br.multi?"#fff":"#ffffff33";ctx.strokeRect(br.x+.5,br.y+.5,br.w-1,br.h-1);if(br.multi||br.wide||br.shield){ctx.fillStyle="#082b33";ctx.font="bold 16px Arial";ctx.textAlign="center";ctx.fillText(br.shield?"S":br.wide?"↔":"2×",br.x+br.w/2,br.y+18);ctx.textAlign="left"}}
    if(shield){ctx.fillStyle="#ffcf57";ctx.fillRect(0,H-20,W,4);ctx.font="bold 14px Arial";ctx.fillText(say("SCHUTZ AKTIV · 1 BALL","SHIELD READY · 1 BALL"),W-245,H-30)}
    ctx.fillStyle="#f4f4f4";ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);ctx.fillStyle="#d71920";ctx.fillRect(paddle.x+paddle.w/2-10,paddle.y-4,20,paddle.h+8);
    for(const ball of balls){ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill()}
    if(state.level<=25){ctx.fillStyle="#ffffff88";ctx.font="16px Arial";ctx.fillText(levelName().toUpperCase(),22,30)}if(state.devMode){ctx.fillStyle="#20c7e8";ctx.font="bold 13px Arial";ctx.fillText("DEV",W-42,30)}
    ctx.fillStyle="#35db83";ctx.font="bold 16px Arial";if(wideTime>0)ctx.fillText(say("BREITER SCHLÄGER ","WIDE PADDLE ")+Math.ceil(wideTime)+"s",22,H-12);
    if(bonus){ctx.fillStyle="#fff";ctx.fillText(say("SCHWEIZER BONUS · ","SWISS BONUS · ")+Math.ceil(bonusTime)+"s",300,30)}
    if(state.paused){ctx.fillStyle="#000a";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.font="bold 42px Arial";ctx.textAlign="center";ctx.fillText(tr("pause"),W/2,H/2);ctx.textAlign="left"}
  }
  function loop(t){const dt=Math.min(.025,(t-last)/1000);last=t;update(dt);draw();requestAnimationFrame(loop)}
  function pointer(clientX){const r=canvas.getBoundingClientRect();state.pointerX=(clientX-r.left)*W/r.width}
  let returnFocus=null;
  function openModal(id){if(modalOpen)closeModal(modalOpen);returnFocus=document.activeElement;modalOpen=id;state.left=false;state.right=false;refreshScreens();$(id).classList.remove("hidden");$(id).querySelector("button")?.focus()}function closeModal(id){$(id).classList.add("hidden");modalOpen=null;returnFocus?.focus()}
  addEventListener("keydown",e=>{if(modalOpen){if(e.code==="Escape"){e.preventDefault();closeModal(modalOpen)}else if(e.code==="Tab"){const buttons=[...$(modalOpen).querySelectorAll("button:not(:disabled)")];const first=buttons[0],end=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus()}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus()}}return}if(e.repeat&&(e.code==="Space"||e.code==="KeyP"||e.code==="KeyR"))return;if(["ArrowLeft","ArrowRight","Space","KeyA","KeyD","KeyP","KeyR","Escape"].includes(e.code))e.preventDefault();if(e.code==="ArrowLeft"||e.code==="KeyA"){state.left=true;state.pointerX=null;}if(e.code==="ArrowRight"||e.code==="KeyD"){state.right=true;state.pointerX=null;}if(e.code==="KeyP"&&state.running)state.paused=!state.paused;if(e.code==="KeyR")newGame(state.devStartLevel,state.devMode);if(e.code==="Space"&&!state.running)startOrContinue();if(e.code==="Escape")document.querySelectorAll(".modal").forEach(m=>m.classList.add("hidden"))});
  addEventListener("keyup",e=>{if(e.code==="ArrowLeft"||e.code==="KeyA")state.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")state.right=false});
  canvas.addEventListener("pointermove",e=>pointer(e.clientX));canvas.addEventListener("pointerdown",e=>{pointer(e.clientX);if(!state.running)startOrContinue()});
  [["leftBtn","left"],["rightBtn","right"]].forEach(([id,dir])=>{const el=$(id);el.addEventListener("pointerdown",e=>{e.preventDefault();state.pointerX=null;state[dir]=true});["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,()=>state[dir]=false))});
  $("pauseBtn").addEventListener("click",()=>{if(state.running)state.paused=!state.paused});$("startBtn").addEventListener("click",startOrContinue);
  $("langBtn").addEventListener("click",()=>{state.lang=state.lang==="de"?"en":"de";applyLanguage()});$("helpBtn").addEventListener("click",()=>openModal("helpModal"));$("devBtn").addEventListener("click",()=>openModal("devModal"));
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  document.querySelectorAll("[data-dev-level]").forEach(b=>b.addEventListener("click",()=>{const n=Number(b.dataset.devLevel);closeModal("devModal");newGame(n,true);state.running=false;balls.forEach(b=>b.stuck=true);screen="level";setOverlay(tr("levelLabel").replace("{n}",n),tr("devStart").replace("{n}",n),tr("start"))}));
  $("selectBtn").addEventListener("click",()=>openModal("selectModal"));
  document.querySelectorAll("[data-normal-level]").forEach(b=>b.addEventListener("click",()=>{const n=Number(b.dataset.normalLevel);if(n!==1&&(progress[n]||0)<10)return;closeModal("selectModal");newGame(n,false)}));
  addEventListener("blur",()=>{state.left=false;state.right=false;if(state.running)state.paused=true});
  applyLanguage();updateHUD();buildLevel(1);setOverlay("HELVETICREBOUND",state.lang==="de"?"Zerstöre alle Zielblöcke. Bewege den Schläger und halte den Ball im Spiel.":"Destroy all target blocks. Move the paddle and keep the ball in play.",tr("start"));requestAnimationFrame(loop);
})();
