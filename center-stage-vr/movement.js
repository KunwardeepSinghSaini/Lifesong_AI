/* Keyboard / XR thumbstick movement, clamped using the headset's actual world position. */
AFRAME.registerComponent('stage-movement', {
  schema: { radius: { default: 3.25 }, speed: { default: 1.4 } },
  init: function () {
    const THREE=AFRAME.THREE;
    this.keys=new Set(); this.camera=this.el.querySelector('[camera]');
    this.world=new THREE.Vector3(); this.forward=new THREE.Vector3(); this.right=new THREE.Vector3();
    this.rotation=new THREE.Quaternion(); this.up=new THREE.Vector3(0,1,0);
    this.onDown=e=>{
      if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('dialog[open]')) return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}
    };
    this.onUp=e=>this.keys.delete(e.code); this.onBlur=()=>this.keys.clear();
    window.addEventListener('keydown',this.onDown);window.addEventListener('keyup',this.onUp);window.addEventListener('blur',this.onBlur);
  },
  tick: function(_time,delta){
    if(!this.camera) this.camera=this.el.querySelector('[camera]');
    if(!this.camera) return;
    let x=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
    let z=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
    const xr=this.el.sceneEl.renderer && this.el.sceneEl.renderer.xr;
    const session=xr && xr.getSession();
    if(session)for(const input of session.inputSources){
      const pad=input.gamepad;
      if(!pad)continue;
      const px=pad.axes.length>=4?pad.axes[2]:pad.axes[0]||0;
      const pz=pad.axes.length>=4?pad.axes[3]:pad.axes[1]||0;
      if(Math.hypot(px,pz)>.18){x+=px;z+=pz;}
    }
    const length=Math.hypot(x,z);
    if(length>.08){
      x/=Math.max(1,length);z/=Math.max(1,length);
      this.camera.object3D.getWorldQuaternion(this.rotation);
      this.forward.set(0,0,-1).applyQuaternion(this.rotation);this.forward.y=0;
      if(this.forward.lengthSq()<.001)this.forward.set(0,0,-1);
      this.forward.normalize();this.right.crossVectors(this.forward,this.up).normalize();
      const step=this.data.speed*Math.min(delta||0,50)/1000;
      this.el.object3D.position.x+=(this.right.x*x-this.forward.x*z)*step;
      this.el.object3D.position.z+=(this.right.z*x-this.forward.z*z)*step;
    }
    const tracked=this.camera.getObject3D('camera')||this.camera.object3D;
    tracked.getWorldPosition(this.world);
    const distance=Math.hypot(this.world.x,this.world.z);
    if(distance>this.data.radius){
      const correction=(distance-this.data.radius)/distance;
      this.el.object3D.position.x-=this.world.x*correction;
      this.el.object3D.position.z-=this.world.z*correction;
    }
  },
  remove:function(){window.removeEventListener('keydown',this.onDown);window.removeEventListener('keyup',this.onUp);window.removeEventListener('blur',this.onBlur);}
});
