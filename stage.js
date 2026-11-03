/* Procedural stage, elevated sun and clouds. */
AFRAME.registerComponent('stage-builder', {
  init: function () {
    const entity = (tag, attrs, parent = this.el) => {
      const el = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      parent.appendChild(el); return el;
    };
    this.rim = entity('a-torus', { radius: 3.67, 'radius-tubular': .055, rotation: '90 0 0', position: '0 .47 0', 'segments-radial': 8, 'segments-tubular': 80, material: 'color: #ffd264; emissive: #ffb944; emissiveIntensity: 1.15' });
    entity('a-cylinder', { radius: 14, height: .18, color: '#765a81', position: '0 -.30 0', 'segments-radial': 80 });
    [{inner:4.55,outer:6.25,y:-.16,color:'#a384a0'},{inner:6.25,outer:8.1,y:.12,color:'#ba92ac'},{inner:8.1,outer:10.3,y:.43,color:'#c4a1b4'}].forEach(t => {
      entity('a-ring', {'radius-inner':t.inner,'radius-outer':t.outer,rotation:'-90 0 0',position:`0 ${t.y} 0`,material:`color: ${t.color}; side: double`,'segments-theta':80});
      entity('a-torus', {radius:t.outer,'radius-tubular':.025,rotation:'90 0 0',position:`0 ${t.y+.02} 0`,material:'color: #f2cda9; emissive: #a56860; emissiveIntensity: .3','segments-radial':6,'segments-tubular':80});
    });
    entity('a-cylinder',{radius:3.75,height:.48,position:'0 .21 0',material:'color: #634361; roughness: .8','segments-radial':80});
    entity('a-cylinder',{radius:3.58,height:.018,position:'0 .46 0',color:'#996c88','segments-radial':80});
    entity('a-torus',{radius:3.35,'radius-tubular':.017,rotation:'90 0 0',position:'0 .476 0',material:'color: #ffe5af; emissive: #f7ce87; emissiveIntensity: .5','segments-radial':6,'segments-tubular':80});
    const sun=entity('a-entity',{id:'stage-sun',position:'0 12.5 -18'});
    entity('a-circle',{radius:3.0,material:'shader: flat; color: #ffd16c; side: double'},sun);
    entity('a-circle',{radius:2.6,position:'0 0 .02',material:'shader: flat; color: #ffdc8f; side: double'},sun);
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8;
      entity('a-box',{position:`${Math.sin(a)*3.55} ${Math.cos(a)*3.55} 0`,rotation:`0 0 ${-a*180/Math.PI}`,width:.14,height:.58,depth:.08,material:'shader: flat; color: #ffd16c'},sun);
    }
    for(const [x,y,z] of [[-9,6,-14],[9,7,-15],[-14,7,3],[13,6,5],[1,6,15]]){
      const cloud=entity('a-entity',{position:`${x} ${y} ${z}`});
      for(let i=0;i<3;i++) entity('a-sphere',{position:`${(i-1)*.65} ${i===1?.2:0} 0`,scale:'1.1 .6 .5',radius:.85,'segments-width':10,'segments-height':8,material:'shader: flat; color: #f6dfdf'},cloud);
    }
  },
  tick: function () {
    const mesh=this.rim && this.rim.getObject3D('mesh');
    if(mesh) mesh.material.emissiveIntensity=1.1+(window.karaokeEnergy||0)*1.5;
  }
});
