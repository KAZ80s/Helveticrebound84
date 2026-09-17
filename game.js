
"use strict";
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const $ = id => document.getElementById(id);

  const W = canvas.width, H = canvas.height;
  const state = {
    level: 1, score: 0, lives: 3, running: false, paused: false,
    left: false, right: false, pointerX: null,
    highscore: Number(localStorage.getItem("helveticReboundHighscore") || 0)
  };

  const paddle = { x: W/2-70, y:H-45, w:140, h:16, speed:620 };
  const ball = { x:W/2, y:H-72, r:9, vx:230, vy:-300, stuck:true };
  let bricks = [], last = performance.now();

  const LEVELS = [
    {name:"Rot-Weiss", rows:4, cols:10, speed:1.00, pattern:"flag"},
    {name:"Alpenlinie", rows:5, cols:11, speed:1.04, pattern:"mountain"},
    {name:"Kreuz", rows:6, cols:11, speed:1.08, pattern:"cross"},
    {name:"Passstrasse", rows:6, cols:12, speed:1.12, pattern:"zigzag"},
    {name:"Chalet", rows:7, cols:12, speed:1.16, pattern:"chalet"},
    {name:"Gipfel", rows:7, cols:13, speed:1.20, pattern:"peak"},
    {name:"Gotthard", rows:7, cols:13, speed:1.24, pattern:"tunnel"},
    {name:"Eisfeld", rows:8, cols:13, speed:1.28, pattern:"checker"},
    {name:"Helvetia", rows:8, cols:14, speed:1.32, pattern:"diamond"},
    {name:"Finale", rows:8, cols:14, speed:1.38, pattern:"finale"}
  ];

  function visibleFor(pattern,r,c,rows,cols){
    const midR=(rows-1)/2, midC=(cols-1)/2;
    switch(pattern){
      case "flag": return !(r===0 && (c<2 || c>cols-3));
      case "mountain": return r >= Math.floor(Math.abs(c-midC)*0.55);
      case "cross": return Math.abs(c-midC)<=1 || Math.abs(r-midR)<=1;
      case "zigzag": return ((r+c)%3)!==0;
      case "chalet": return r>=Math.floor(Math.abs(c-midC)*0.55) || (r>rows/2 && c>1 && c<cols-2);
      case "peak": return r>=Math.floor(Math.abs(c-midC)*0.7);
      case "tunnel": return !(r>rows/2 && Math.abs(c-midC)<2);
      case "checker": return (r+c)%2===0 || r===rows-1;
      case "diamond": return Math.abs(c-midC)+Math.abs(r-midR) < Math.min(cols,rows)*0.75;
      case "finale": return !(r===1 && (c===1 || c===cols-2));
      default:return true;
    }
  }

  function buildLevel(n){
    const L=LEVELS[n-1], gap=7, margin=42, top=75;
    const bw=(W-margin*2-gap*(L.cols-1))/L.cols, bh=24;
    bricks=[];
    for(let r=0;r<L.rows;r++){
      for(let c=0;c<L.cols;c++){
        if(!visibleFor(L.pattern,r,c,L.rows,L.cols)) continue;
        let hp = n>=7 && (r+c)%7===0 ? 2 : 1;
        bricks.push({x:margin+c*(bw+gap),y:top+r*(bh+gap),w:bw,h:bh,hp});
      }
    }
    resetBall(true);
    updateHUD();
  }

  function resetBall(stuck=true){
    paddle.x=W/2-paddle.w/2;
    ball.x=W/2; ball.y=paddle.y-ball.r-3; ball.stuck=stuck;
    const s=LEVELS[state.level-1].speed;
    ball.vx=(Math.random()<.5?-1:1)*230*s; ball.vy=-300*s;
  }

  function updateHUD(){
    $("level").textContent=state.level;
    $("score").textContent=state.score;
    $("lives").textContent=state.lives;
    $("highscore").textContent=state.highscore;
  }

  function setOverlay(title,text,button="WEITER"){
    $("overlayTitle").textContent=title; $("overlayText").textContent=text;
    $("startBtn").textContent=button; $("overlay").classList.remove("hidden");
  }
  function hideOverlay(){ $("overlay").classList.add("hidden"); }

  function startOrContinue(){
    if(state.level>10){ newGame(); return; }
    hideOverlay(); state.running=true; state.paused=false; ball.stuck=false;
  }
  function newGame(){
    state.level=1; state.score=0; state.lives=3; state.running=true; state.paused=false;
    buildLevel(1); hideOverlay(); ball.stuck=false;
  }

  function loseLife(){
    state.lives--; updateHUD();
    if(state.lives<=0){
      state.running=false; saveHighscore();
      setOverlay("GAME OVER",`Punkte: ${state.score} · Highscore: ${state.highscore}`,"NEUES SPIEL");
    } else {
      resetBall(true);
      setOverlay("BALL VERLOREN",`Noch ${state.lives} Leben.`,"WEITER");
    }
  }

  function saveHighscore(){
    if(state.score>state.highscore){
      state.highscore=state.score;
      localStorage.setItem("helveticReboundHighscore", String(state.highscore));
    }
    updateHUD();
  }

  function levelComplete(){
    state.score += 500*state.level; saveHighscore();
    if(state.level===10){
      state.running=false; state.level=11;
      setOverlay("PHASE 1 GESCHAFFT",`Alle 10 Levels abgeschlossen. Punkte: ${state.score}`,"NOCHMAL");
    }else{
      state.level++; state.running=false; buildLevel(state.level);
      setOverlay(`LEVEL ${state.level}`,LEVELS[state.level-1].name,"START");
    }
  }

  function circleRect(b, r){
    const cx=Math.max(r.x,Math.min(b.x,r.x+r.w));
    const cy=Math.max(r.y,Math.min(b.y,r.y+r.h));
    const dx=b.x-cx,dy=b.y-cy;
    return dx*dx+dy*dy <= b.r*b.r;
  }

  function update(dt){
    if(!state.running || state.paused) return;
    if(state.left) paddle.x-=paddle.speed*dt;
    if(state.right) paddle.x+=paddle.speed*dt;
    if(state.pointerX!==null) paddle.x += (state.pointerX-paddle.w/2-paddle.x)*Math.min(1,dt*14);
    paddle.x=Math.max(8,Math.min(W-paddle.w-8,paddle.x));

    if(ball.stuck){ball.x=paddle.x+paddle.w/2;ball.y=paddle.y-ball.r-3;return;}
    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;

    if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=Math.abs(ball.vx)}
    if(ball.x+ball.r>W){ball.x=W-ball.r;ball.vx=-Math.abs(ball.vx)}
    if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=Math.abs(ball.vy)}
    if(ball.y-ball.r>H){loseLife();return}

    if(ball.vy>0 && circleRect(ball,paddle)){
      ball.y=paddle.y-ball.r-1;
      const rel=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);
      const speed=Math.min(620,Math.hypot(ball.vx,ball.vy)*1.015);
      const angle=rel*1.05;
      ball.vx=speed*Math.sin(angle);
      ball.vy=-Math.abs(speed*Math.cos(angle));
    }

    for(const br of bricks){
      if(br.hp<=0 || !circleRect(ball,br)) continue;
      br.hp--;
      state.score += br.hp===0 ? 100 : 25;
      const cx=ball.x-(br.x+br.w/2), cy=ball.y-(br.y+br.h/2);
      if(Math.abs(cx/br.w)>Math.abs(cy/br.h)) ball.vx*=-1; else ball.vy*=-1;
      updateHUD(); break;
    }
    if(bricks.every(b=>b.hp<=0)) levelComplete();
  }

  function drawBackground(){
    ctx.fillStyle="#080a0d";ctx.fillRect(0,0,W,H);
    // stylized Swiss alpine skyline
    ctx.fillStyle="#151922";
    ctx.beginPath();ctx.moveTo(0,390);
    const pts=[[0,390],[100,320],[170,365],[280,250],[370,360],[475,285],[560,355],[690,230],[810,350],[900,300],[900,600],[0,600]];
    for(const p of pts)ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fill();
    ctx.fillStyle="#11141a";ctx.fillRect(0,430,W,170);
    // subtle cross marker
    ctx.globalAlpha=.08;ctx.fillStyle="#fff";ctx.fillRect(W-110,35,70,22);ctx.fillRect(W-86,11,22,70);ctx.globalAlpha=1;
  }

  function draw(){
    drawBackground();
    // bricks
    for(const br of bricks){
      if(br.hp<=0) continue;
      ctx.fillStyle=br.hp===2?"#f0f0f0":"#d71920";
      ctx.fillRect(br.x,br.y,br.w,br.h);
      ctx.strokeStyle="#ffffff33";ctx.strokeRect(br.x+.5,br.y+.5,br.w-1,br.h-1);
    }
    // paddle
    ctx.fillStyle="#f4f4f4";ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
    ctx.fillStyle="#d71920";ctx.fillRect(paddle.x+paddle.w/2-10,paddle.y-4,20,paddle.h+8);
    // ball
    ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();
    // level name
    if(state.level<=10){ctx.fillStyle="#ffffff88";ctx.font="16px Arial";ctx.fillText(LEVELS[state.level-1].name.toUpperCase(),22,30)}
    if(state.paused){ctx.fillStyle="#000a";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.font="bold 42px Arial";ctx.textAlign="center";ctx.fillText("PAUSE",W/2,H/2);ctx.textAlign="left"}
  }

  function loop(t){
    const dt=Math.min(.025,(t-last)/1000);last=t;update(dt);draw();requestAnimationFrame(loop);
  }

  function pointer(clientX){
    const r=canvas.getBoundingClientRect();
    state.pointerX=(clientX-r.left)*W/r.width;
  }

  addEventListener("keydown",e=>{
    if(["ArrowLeft","ArrowRight"," ","KeyA","KeyD","KeyP","KeyR"].includes(e.code)) e.preventDefault();
    if(e.code==="ArrowLeft"||e.code==="KeyA")state.left=true;
    if(e.code==="ArrowRight"||e.code==="KeyD")state.right=true;
    if(e.code==="KeyP")state.paused=!state.paused;
    if(e.code==="KeyR")newGame();
    if(e.code==="Space" && !state.running)startOrContinue();
  });
  addEventListener("keyup",e=>{
    if(e.code==="ArrowLeft"||e.code==="KeyA")state.left=false;
    if(e.code==="ArrowRight"||e.code==="KeyD")state.right=false;
  });
  canvas.addEventListener("pointermove",e=>pointer(e.clientX));
  canvas.addEventListener("pointerdown",e=>{pointer(e.clientX); if(!state.running)startOrContinue()});
  ["leftBtn","rightBtn"].forEach(id=>{
    const dir=id==="leftBtn"?"left":"right",el=$(id);
    el.addEventListener("pointerdown",e=>{e.preventDefault();state[dir]=true});
    el.addEventListener("pointerup",()=>state[dir]=false);
    el.addEventListener("pointercancel",()=>state[dir]=false);
  });
  $("pauseBtn").addEventListener("click",()=>state.paused=!state.paused);
  $("startBtn").addEventListener("click",startOrContinue);

  updateHUD();buildLevel(1);requestAnimationFrame(loop);
})();
