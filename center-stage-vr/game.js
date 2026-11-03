/* Karaoke UI, real audio clock, word matching and an in-world VR interface. */
(function(){
  'use strict';
  if(window.AFRAME) AFRAME.registerComponent('karaoke-driver',{tick:function(){if(window.karaokeApp)window.karaokeApp.tick();}});
  document.addEventListener('DOMContentLoaded',function(){
    const $=id=>document.getElementById(id);
    const error=$('load-error');
    if(window.sceneScriptError||!window.AFRAME||!window.SUNNY_SONG||!window.KaraokeCore){
      error.hidden=false;error.textContent='A scene file did not load. Extract the whole ZIP, keep its folders intact, then serve the folder over HTTP or HTTPS. Missing: '+(window.sceneScriptError||'required script');return;
    }
    const song=window.SUNNY_SONG, core=window.KaraokeCore, score=new core.Score(song);
    const audio=$('song'),scene=$('scene');
    let offset=Number(song.offset)||0, playerName='You', cue=core.cueAt(song,0), lastIndex=-2;
    let choiceWords=[],feedbackUntil=0,feedbackText='',lastFrame=0,lastLeaderboard=-1;
    let wantedMic=false,micRunning=false,recognition=null,audioContext=null,analyser=null,frequency=null;
    let vrReady=false,vrCanvas,vrContext,vrTexture,vrChoiceLabels=[],vrChoicePlanes=[],vrPlayLabel,vrMicLabel;
    let lastPaint=0,lastWord=-2,lastReveal=null;
    try{playerName=localStorage.getItem('sunny-performer')||'You';}catch(_e){}
    $('name-input').value=playerName;
    function setPlayerName(){
      $('player-label').replaceChildren(document.createTextNode(playerName));
      const small=document.createElement('small');small.textContent='ON THE MIC';$('player-label').append(small);
    }
    setPlayerName();audio.volume=.75;
    const fmt=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
    const status=text=>$('status').textContent=text;
    function notify(text,good=true){
      feedbackText=text;feedbackUntil=performance.now()+1800;
      $('feedback').textContent=text;$('feedback').className='feedback show '+(good?'good':'miss');
    }
    function leaderboard(){
      const fraction=Math.min(1,audio.currentTime/(audio.duration||song.duration));
      const rows=[{name:playerName,points:score.points,you:true,color:'#ffd264'},
        {name:'SunnySam',points:Math.floor(fraction*7500/50)*50,color:'#d3a266'},
        {name:'Luna',points:Math.floor(fraction*6400/50)*50,color:'#9776c9'},
        {name:'BeatBuddy',points:Math.floor(fraction*5500/50)*50,color:'#65a6aa'}].sort((a,b)=>b.points-a.points);
      $('leaderboard').replaceChildren();
      rows.forEach((row,index)=>{
        const el=document.createElement('div');el.className='leader-row'+(row.you?' you':'');
        const rank=document.createElement('span');rank.className='rank';rank.textContent=index+1;
        const avatar=document.createElement('span');avatar.className='avatar';avatar.style.background=row.color;avatar.textContent=row.you?'☀':row.name[0];
        const name=document.createElement('span');name.textContent=row.name;
        const points=document.createElement('span');points.className='leader-points';points.textContent=row.points.toLocaleString();
        el.append(rank,avatar,name,points);$('leaderboard').append(el);
      });
    }
    function updateScore(){
      $('score').textContent=score.points.toLocaleString();$('combo').textContent=score.combo;
      $('multiplier').textContent='×'+Math.min(4,1+Math.floor(score.combo/4));
      $('streak-meter').style.width=Math.min(100,score.combo/12*100)+'%';leaderboard();
    }
    function reset(){
      score.reset();lastIndex=-2;lastWord=-2;lastReveal=null;choiceWords=[];feedbackUntil=0;
      $('feedback').className='feedback';updateScore();
    }
    function initAudioGraph(){
      if(audioContext)return;
      try{
        const AudioCtx=window.AudioContext||window.webkitAudioContext;
        if(!AudioCtx)return;
        audioContext=new AudioCtx();analyser=audioContext.createAnalyser();analyser.fftSize=128;
        const source=audioContext.createMediaElementSource(audio);source.connect(analyser);analyser.connect(audioContext.destination);
        frequency=new Uint8Array(analyser.frequencyBinCount);
      }catch(_e){analyser=null;}
    }
    async function play(){
      if(audio.ended){audio.currentTime=0;reset();}
      initAudioGraph();
      if(audioContext){try{await audioContext.resume();}catch(_e){}}
      try{await audio.play();}catch(_e){status('Playback needs a tap. Press play again, and check that the audio file was uploaded.');notify('Tap play to begin',false);}
    }
    function togglePlay(){if(audio.paused)play();else audio.pause();}
    function restart(){audio.pause();audio.currentTime=0;reset();$('welcome').classList.remove('dismissed');status('Fresh score. Press play to take the stage.');tick(true);}
    function options(index){
      const target=core.clean(song.lines[index].text.split(/\s+/)[song.lines[index].targetIndex]);
      const pool=['glow','rain','night','cloud','heart','beat','sun','light','dance','sky','cup','smile','stars','fear','joy','way','face','place','band','tricks','sand','start'];
      const choices=[target];
      let n=index*5;
      while(choices.length<3){const word=pool[(n++)%pool.length];if(!choices.includes(word))choices.push(word);}
      // A deterministic shuffle keeps the answer from always occupying the first slot.
      for(let i=2;i>0;i--){const j=((index+3)*17+i*11)%(i+1);[choices[i],choices[j]]=[choices[j],choices[i]];}
      return choices;
    }
    function submit(word,index=cue.index){
      if(audio.paused||audio.ended)return;
      const result=score.attempt(index,word,audio.currentTime,offset);
      if(!result)return;
      notify(result.correct?`${result.grade} +${result.points}`:result.grade,result.correct);
      if(result.correct)window.karaokeCheerUntil=performance.now()+1500;
      if(result.correct)status('Keep singing. Your next lyric is coming up.');
      else status('One try per line. Catch the next word to start a new streak.');
      updateScore();lastReveal=null;renderWords();updateChoices();paintVR();
    }
    function updateChoices(){
      const answered=cue.index<0||score.attempted.has(cue.index)||audio.paused;
      [...$('choices').children].forEach((button,index)=>{
        button.disabled=answered;
        button.className='';
        if(cue.index>=0&&score.attempted.has(cue.index)){
          const target=core.clean(cue.line.text.split(/\s+/)[cue.line.targetIndex]);
          if(button.textContent===target)button.className=score.attempted.get(cue.index)?'correct':'wrong';
        }
        if(vrChoicePlanes[index]){
          vrChoicePlanes[index].classList.toggle('vr-click',!answered);
          vrChoicePlanes[index].setAttribute('material','color',answered?'#674968':'#573857');
        }
      });
      refreshRays();
    }
    function refreshRays(){
      if(!vrReady)return;
      for(const el of scene.querySelectorAll('[raycaster]'))if(el.components.raycaster)el.components.raycaster.refreshObjects();
    }
    function renderWords(){
      if(!cue.line)return;
      const reveal=score.attempted.has(cue.index);
      if(lastWord===cue.word&&lastReveal===reveal)return;
      lastWord=cue.word;lastReveal=reveal;
      const container=$('current-line');container.replaceChildren();container.dataset.cue=cue.index;
      cue.line.text.split(/\s+/).forEach((word,index)=>{
        const span=document.createElement('span');span.className='word';
        if(index<cue.word)span.classList.add('past');else if(index===cue.word)span.classList.add('active');
        if(index===cue.line.targetIndex&&!reveal){span.classList.add('missing');span.textContent='_____';}
        else span.textContent=word;
        container.append(span,document.createTextNode(' '));
      });
    }
    function changeCue(){
      lastWord=-2;lastReveal=null;
      $('lyrics-scroll').classList.remove('advance');void $('lyrics-scroll').offsetWidth;$('lyrics-scroll').classList.add('advance');
      const t=audio.currentTime-offset;
      if(cue.line){
        $('section-label').textContent=cue.line.section.toUpperCase();$('line-counter').textContent=`${cue.index+1} / ${song.lines.length}`;
        $('previous-line').textContent=song.lines[cue.index-1]?.text||'Here comes the sunshine…';
        $('next-line').textContent=song.lines[cue.index+1]?.text||'Let that last note shine.';
        choiceWords=options(cue.index);$('choices').replaceChildren();
        const activeIndex=cue.index;
        choiceWords.forEach(word=>{const button=document.createElement('button');button.textContent=word;button.addEventListener('click',()=>submit(word,activeIndex));$('choices').append(button);});
        renderWords();
      }else{
        const next=song.lines.find(line=>line.start>t);
        $('section-label').textContent=audio.ended?'SET COMPLETE':t<song.lines[0].start?'THE INTRO':'INSTRUMENTAL BREAK';
        $('line-counter').textContent=`${score.hits} matched lyrics`;
        $('previous-line').textContent='';
        $('current-line').textContent=audio.ended?'You brought the sunshine.':audio.currentTime===0?'A little sunshine goes a long way.':next?'Stay in the groove…':'Let the good mood glow.';
        $('next-line').textContent=next?next.text:'Sunny side up!';
        choiceWords=[];$('choices').replaceChildren();
        ['☀','GOOD VIBES','☀'].forEach(word=>{const b=document.createElement('button');b.textContent=word;b.disabled=true;$('choices').append(b);});
      }
      if(vrReady)vrChoiceLabels.forEach((label,index)=>label.setAttribute('value',choiceWords[index]||'—'));
      updateChoices();
    }
    function tick(force=false){
      const now=performance.now();if(!force&&now-lastFrame<80)return;lastFrame=now;
      const nextCue=core.cueAt(song,audio.currentTime,offset);
      if(nextCue.index!==lastIndex){
        if(lastIndex>=0&&audio.currentTime-offset>=song.lines[lastIndex].end){score.miss(lastIndex);updateScore();}
        cue=nextCue;lastIndex=cue.index;changeCue();
      }else{cue=nextCue;renderWords();}
      $('elapsed').textContent=fmt(audio.currentTime);
      $('progress-fill').style.width=Math.min(100,audio.currentTime/(audio.duration||song.duration)*100)+'%';
      $('track-progress').setAttribute('aria-valuenow',Math.floor(audio.currentTime));
      if(now>feedbackUntil)$('feedback').classList.remove('show');
      if(Math.floor(audio.currentTime)!==lastLeaderboard){lastLeaderboard=Math.floor(audio.currentTime);leaderboard();}
      if(analyser&&!audio.paused){analyser.getByteFrequencyData(frequency);window.karaokeEnergy=frequency.slice(1,10).reduce((a,b)=>a+b,0)/(9*255);}
      else window.karaokeEnergy=0;
      if(scene.is('vr-mode')&&now-lastPaint>110){paintVR();lastPaint=now;}
    }
    function startMic(){
      if(!recognition||!wantedMic||micRunning||audio.paused)return;
      try{recognition.start();}catch(_e){}
    }
    function stopMic(){if(recognition){try{recognition.abort();}catch(_e){}}micRunning=false;}
    const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(Speech){
      recognition=new Speech();recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;
      recognition.onstart=()=>{micRunning=true;$('mic-button').textContent='Mic on';if(vrMicLabel)vrMicLabel.setAttribute('value','MIC ON');};
      recognition.onresult=event=>{
        if(audio.paused||!cue.line||score.attempted.has(cue.index))return;
        for(let i=event.resultIndex;i<event.results.length;i++){
          const heard=event.results[i][0].transcript.split(/\s+/).map(core.clean);
          const expected=cue.line.text.split(/\s+/).map(core.clean);
          const target=expected[cue.line.targetIndex];
          const context=expected.filter((word,index)=>index!==cue.line.targetIndex&&heard.includes(word));
          if(heard.includes(target)&&new Set(context).size>=2){submit(target);break;}
        }
      };
      recognition.onerror=event=>{
        if(event.error==='aborted'||event.error==='no-speech')return;
        wantedMic=false;stopMic();$('mic-button').textContent='Mic off';
        status('Mic matching is unavailable right now. Keep playing with the word buttons.');notify('Use tap matching',false);
        if(vrMicLabel)vrMicLabel.setAttribute('value','MIC OFF');
      };
      recognition.onend=()=>{micRunning=false;if(wantedMic&&!audio.paused)setTimeout(startMic,350);};
    }else{$('mic-button').textContent='Mic unavailable';$('mic-button').title='Use word buttons on this browser.';}
    function toggleMic(){
      if(!recognition){status('This browser has no speech recognition. Match words with taps, keys or a VR controller.');notify('Tap matching is ready');return;}
      wantedMic=!wantedMic;
      if(wantedMic){status('Mic matches words, not pitch. Use headphones to keep the song out of the microphone.');$('mic-button').textContent=audio.paused?'Mic ready':'Starting mic…';startMic();}
      else{stopMic();$('mic-button').textContent='Mic off';status('Tap matching is active. Catch the missing lyric.');}
      if(vrMicLabel)vrMicLabel.setAttribute('value',wantedMic?'MIC ON':'MIC OFF');
    }
    audio.addEventListener('play',()=>{
      $('welcome').classList.add('dismissed');$('play-icon').textContent='Ⅱ';$('play-button').setAttribute('aria-label','Pause song');$('play-state').textContent='NOW PLAYING';
      if(vrPlayLabel)vrPlayLabel.setAttribute('value','PAUSE');updateChoices();startMic();
    });
    audio.addEventListener('pause',()=>{
      $('play-icon').textContent='▶';$('play-button').setAttribute('aria-label','Play song');$('play-state').textContent=audio.ended?'SET COMPLETE':'PAUSED';
      if(vrPlayLabel)vrPlayLabel.setAttribute('value',audio.ended?'REPLAY':'PLAY');stopMic();updateChoices();
      if(wantedMic)$('mic-button').textContent='Mic ready';
    });
    audio.addEventListener('ended',()=>{
      for(let i=0;i<song.lines.length;i++)score.miss(i);
      updateScore();$('final-score').textContent=score.points.toLocaleString();
      $('final-stats').textContent=`${score.hits} / ${song.lines.length} lyrics matched · ${score.perfect} perfects · best streak ${score.bestCombo}`;
      if(!scene.is('vr-mode'))$('results-dialog').showModal();
      notify('Sunny-side set complete!');tick(true);
    });
    audio.addEventListener('error',()=>{error.hidden=false;error.textContent='The song could not load. Make sure assets/sunny-side-up.mp3 is present and your server can serve MP3 files.';});
    audio.addEventListener('seeking',()=>{if(audio.currentTime+0.5<(song.lines[lastIndex]?.start||0)+offset)reset();});
    $('play-button').addEventListener('click',togglePlay);$('restart-button').addEventListener('click',restart);
    $('volume').addEventListener('input',()=>audio.volume=Number($('volume').value));$('mic-button').addEventListener('click',toggleMic);
    $('settings-button').addEventListener('click',()=>{audio.pause();$('settings-dialog').showModal();});
    $('help-button').addEventListener('click',()=>{audio.pause();$('help-dialog').showModal();});
    $('name-input').addEventListener('input',()=>{playerName=$('name-input').value.trim().slice(0,18)||'You';setPlayerName();leaderboard();try{localStorage.setItem('sunny-performer',playerName);}catch(_e){}});
    $('timing-offset').value=offset;$('offset-value').textContent=offset.toFixed(1)+'s';
    $('timing-offset').addEventListener('input',()=>{offset=Number($('timing-offset').value);$('offset-value').textContent=offset.toFixed(1)+'s';reset();tick(true);});
    $('export-cues').addEventListener('click',()=>{
      const data={...song,offset};const text='window.SUNNY_SONG = '+JSON.stringify(data,null,2)+';\n';
      const url=URL.createObjectURL(new Blob([text],{type:'application/javascript'}));
      const link=document.createElement('a');link.href=url;link.download='song.js';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    $('replay-button').addEventListener('click',()=>{$('results-dialog').close();restart();play();});
    document.addEventListener('keydown',event=>{
      if(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||document.querySelector('dialog[open]'))return;
      const n=Number(event.key)-1;if(n>=0&&n<3&&choiceWords[n]){event.preventDefault();submit(choiceWords[n]);}
      if(event.code==='Space'&&!event.repeat){event.preventDefault();togglePlay();}
    });
    $('vr-button').addEventListener('click',async()=>{
      try{if(!navigator.xr||!await navigator.xr.isSessionSupported('immersive-vr')){notify('VR needs a supported headset',false);return;}await scene.enterVR();}
      catch(_e){status('VR requires HTTPS and a supported WebXR headset browser. Desktop and touch gameplay remain available.');}
    });
    scene.addEventListener('enter-vr',()=>{document.body.classList.add('vr-active');$('vr-interface').setAttribute('visible',true);updateChoices();paintVR();});
    scene.addEventListener('exit-vr',()=>{document.body.classList.remove('vr-active');$('vr-interface').setAttribute('visible',false);});
    function refreshGaze(){
      const session=scene.renderer?.xr.getSession();
      const hasControllers=session&&[...session.inputSources].some(source=>source.targetRayMode==='tracked-pointer');
      $('gaze').setAttribute('visible',scene.is('vr-mode')&&!hasControllers);
      $('gaze').setAttribute('raycaster','enabled',scene.is('vr-mode')&&!hasControllers);
    }
    scene.addEventListener('enter-vr',()=>{
      refreshGaze();const session=scene.renderer.xr.getSession();if(session)session.addEventListener('inputsourceschange',refreshGaze);
    });scene.addEventListener('exit-vr',refreshGaze);
    function createVR(){
      if(vrReady)return;vrReady=true;
      const THREE=AFRAME.THREE,root=$('vr-interface');
      const add=(tag,attrs,parent=root)=>{const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;};
      vrCanvas=document.createElement('canvas');vrCanvas.width=1400;vrCanvas.height=650;vrContext=vrCanvas.getContext('2d');
      vrTexture=new THREE.CanvasTexture(vrCanvas);vrTexture.colorSpace=THREE.SRGBColorSpace;
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(3.5,1.625),new THREE.MeshBasicMaterial({map:vrTexture,transparent:true}));panel.position.set(0,2.28,-3.08);root.object3D.add(panel);
      const textAttrs={align:'center',color:'#fff3d5',font:'vendor/Roboto-msdf.json',fontImage:'vendor/Roboto-msdf.png',width:2.2};
      for(let i=0;i<3;i++){
        const plane=add('a-plane',{position:`${(i-1)*1.09} 1.22 -2.96`,width:1.0,height:.3,material:'shader: flat; color: #573857; side: double'});
        const label=add('a-text',{...textAttrs,value:'—',position:'0 0 .012'},plane);
        plane.addEventListener('click',()=>{if(choiceWords[i])submit(choiceWords[i]);});
        plane.addEventListener('mouseenter',()=>{if(plane.classList.contains('vr-click'))plane.setAttribute('material','color','#926546');});
        plane.addEventListener('mouseleave',()=>plane.setAttribute('material','color','#573857'));
        vrChoicePlanes.push(plane);vrChoiceLabels.push(label);
      }
      const makeControl=(x,label,fn)=>{const plane=add('a-plane',{class:'vr-click',position:`${x} .79 -2.96`,width:.97,height:.28,material:'shader: flat; color: #46304d; side: double'});const text=add('a-text',{...textAttrs,value:label,position:'0 0 .015',width:1.7},plane);plane.addEventListener('click',fn);return text;};
      vrPlayLabel=makeControl(-1.09,'PLAY',togglePlay);makeControl(0,'RESTART',restart);vrMicLabel=makeControl(1.09,'MIC OFF',toggleMic);
      updateChoices();paintVR();
    }
    function paintVR(){
      if(!vrContext)return;
      const ctx=vrContext,w=vrCanvas.width,h=vrCanvas.height;
      ctx.clearRect(0,0,w,h);ctx.fillStyle='#2b1b37';ctx.beginPath();ctx.roundRect(0,0,w,h,48);ctx.fill();
      ctx.strokeStyle='#d8a65b';ctx.lineWidth=4;ctx.stroke();
      ctx.fillStyle='#ffd264';ctx.font='700 27px system-ui';ctx.fillText('CENTER STAGE / SUNNY SIDE UP',55,63);
      ctx.fillStyle='#fff1dd';ctx.textAlign='right';ctx.font='600 35px system-ui';ctx.fillText(`${score.points.toLocaleString()} PTS  ·  ${score.combo} STREAK`,w-55,67);ctx.textAlign='left';
      ctx.fillStyle='#bb9bc7';ctx.font='24px system-ui';ctx.fillText(cue.line?cue.line.section.toUpperCase():audio.ended?'SET COMPLETE':'GET READY TO SHINE',55,116);
      let text=cue.line?cue.line.text:audio.ended?`Great show, ${playerName}!`:'Press PLAY to start your sunny-side set.';
      ctx.font='600 57px system-ui';ctx.textAlign='center';
      const words=text.split(' ').map((word,index)=>({text:cue.line&&index===cue.line.targetIndex&&!score.attempted.has(cue.index)?'_____':word,index}));
      const rows=[];let row=[],rowWidth=0;const space=ctx.measureText(' ').width;
      for(const word of words){const width=ctx.measureText(word.text).width;if(rowWidth+width+space>w-140&&row.length){rows.push(row);row=[];rowWidth=0;}row.push(word);rowWidth+=width+space;}if(row.length)rows.push(row);
      ctx.textAlign='left';rows.forEach((line,i)=>{
        const width=line.reduce((sum,word)=>sum+ctx.measureText(word.text).width+space,0)-space;let x=(w-width)/2;
        line.forEach(word=>{ctx.fillStyle=cue.line&&word.index<=cue.word?'#ffd264':'#fff2da';ctx.fillText(word.text,x,235+i*78);x+=ctx.measureText(word.text).width+space;});
      });ctx.textAlign='center';
      ctx.font='26px system-ui';ctx.fillStyle='#bda3c7';ctx.fillText(cue.line?(song.lines[cue.index+1]?.text||'Let the last note shine.'):'Point + trigger, or gaze at a button to select.',w/2,425);
      ctx.fillStyle='#ffd264';ctx.font='600 36px system-ui';ctx.fillText(performance.now()<feedbackUntil?feedbackText:audio.ended?`${score.hits} of ${song.lines.length} lyrics matched`:'CATCH THE MISSING WORD BELOW',w/2,494);
      ctx.textAlign='left';ctx.font='24px system-ui';ctx.fillStyle='#d5bddb';ctx.fillText(`${fmt(audio.currentTime)} / ${fmt(audio.duration||song.duration)}`,55,579);
      ctx.fillStyle='#584065';ctx.fillRect(55,603,w-110,5);ctx.fillStyle='#ffd264';ctx.fillRect(55,603,(w-110)*Math.min(1,audio.currentTime/(audio.duration||song.duration)),5);
      // The sung-word progress uses the same audio clock as the desktop lyric highlight.
      if(cue.line){ctx.fillStyle='#ffd264';ctx.fillRect(55,142,(w-110)*cue.progress,4);}
      vrTexture.needsUpdate=true;
    }
    window.karaokeApp={tick};scene.setAttribute('karaoke-driver','');
    if(scene.hasLoaded)createVR();else scene.addEventListener('loaded',createVR,{once:true});
    updateScore();tick(true);
  });
})();
