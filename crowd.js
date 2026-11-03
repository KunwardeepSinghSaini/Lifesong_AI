/* Eighty-four animated, instanced people. Six mesh draw calls keep Quest rendering light. */
AFRAME.registerComponent('crowd-builder', {
  init: function () {
    const THREE = AFRAME.THREE;
    const rows = [
      { radius: 5.35, count: 22, floor: -0.16 },
      { radius: 7.15, count: 28, floor: 0.12 },
      { radius: 9.10, count: 34, floor: 0.43 }
    ];
    const shirts = ['#fc718c', '#ffa95d', '#65d8db', '#af92fa', '#dedc82', '#7aa7f8'];
    const skin = ['#f2c6a8', '#b87a57', '#76503c', '#dc9e76', '#9c634d'];
    const pants = ['#212a40', '#31314e', '#344257', '#302a39'];
    this.people = [];
    rows.forEach((row, rowIndex) => {
      for (let i = 0; i < row.count; i++) {
        const angle = Math.PI * 2 * (i + (rowIndex % 2) * 0.5) / row.count;
        const jitter = Math.sin((i + 3) * 43.7 + rowIndex * 12.2) * 0.12;
        this.people.push({
          x: Math.sin(angle) * (row.radius + jitter),
          z: Math.cos(angle) * (row.radius + jitter),
          y: row.floor,
          yaw: angle,
          height: 0.90 + (i * 17 % 13) / 70,
          phase: i * 1.88 + rowIndex * 0.9,
          speed: 0.0013 + (i % 7) * 0.00009,
          shirt: new THREE.Color(shirts[(i + rowIndex * 3) % shirts.length]),
          skin: new THREE.Color(skin[(i * 3 + rowIndex) % skin.length]),
          pants: new THREE.Color(pants[(i + rowIndex) % pants.length])
        });
      }
    });

    const n = this.people.length;
    const sharedMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });
    const sphere = new THREE.SphereGeometry(1, 8, 6);
    const cylinder = new THREE.CylinderGeometry(1, 1, 1, 7);
    const makeMesh = (geometry, count) => {
      const mesh = new THREE.InstancedMesh(geometry, sharedMaterial, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    };
    this.group = new THREE.Group();
    this.el.object3D.add(this.group);
    this.meshes = {
      body: makeMesh(cylinder, n), head: makeMesh(sphere, n),
      arms: makeMesh(cylinder, n * 2), legs: makeMesh(cylinder, n * 2),
      eyes: makeMesh(sphere, n * 2), hair: makeMesh(sphere, n)
    };
    this.people.forEach((p, i) => {
      this.meshes.body.setColorAt(i, p.shirt);
      this.meshes.head.setColorAt(i, p.skin);
      this.meshes.hair.setColorAt(i, new THREE.Color(i % 4 ? '#231a25' : '#594337'));
      for (let side = 0; side < 2; side++) {
        this.meshes.arms.setColorAt(i * 2 + side, p.shirt);
        this.meshes.legs.setColorAt(i * 2 + side, p.pants);
        this.meshes.eyes.setColorAt(i * 2 + side, new THREE.Color('#17121b'));
      }
    });
    Object.values(this.meshes).forEach((mesh) => { if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; });
    this.dummy = new THREE.Object3D();
    this.yawQ = new THREE.Quaternion();
    this.swayQ = new THREE.Quaternion();
    this.axisY = new THREE.Vector3(0, 1, 0);
    this.axisZ = new THREE.Vector3(0, 0, 1);
    this.local = new THREE.Vector3();
    this.rotated = new THREE.Vector3();
    this.nameplates = [];
    const names = ['SunnySam', 'Luna', 'BeatBuddy', 'Maya', 'Rio', 'Nova'];
    [9, 11, 13, 24, 36, 44].forEach((personIndex, index) => {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#372343'; ctx.beginPath(); ctx.roundRect(10, 14, 492, 100, 40); ctx.fill();
      ctx.strokeStyle = '#ffd264'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#fff3d9'; ctx.font = '600 44px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(names[index], 256, 81);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
      plate.scale.set(1.05, .263, 1);
      this.group.add(plate); this.nameplates.push({ personIndex, plate });
    });
    this.updatePeople(0);
  },

  updatePeople: function (time) {
    const d = this.dummy;
    const put = (mesh, index, p, lx, ly, lz, sx, sy, sz, tilt = 0, sway = 0) => {
      this.local.set(lx, ly * p.height, lz);
      this.rotated.copy(this.local).applyQuaternion(this.yawQ);
      d.position.set(p.x + this.rotated.x + sway, p.y + this.rotated.y, p.z + this.rotated.z);
      d.quaternion.copy(this.yawQ);
      if (tilt) { this.swayQ.setFromAxisAngle(this.axisZ, tilt); d.quaternion.multiply(this.swayQ); }
      d.scale.set(sx, sy * p.height, sz);
      d.updateMatrix();
      mesh.setMatrixAt(index, d.matrix);
    };

    const song = document.getElementById('song');
    this.people.forEach((p, i) => {
      const beat = (song && !song.paused ? song.currentTime * 1000 : time) * p.speed + p.phase;
      const bob = Math.sin(beat * 2) * 0.075;
      const side = Math.sin(beat) * 0.055;
      const wave = Math.sin(beat * 1.5 + i * 0.3);
      this.yawQ.setFromAxisAngle(this.axisY, p.yaw + Math.sin(beat * 0.6) * 0.11);
      put(this.meshes.body, i, p, 0, 1.04 + bob, 0, 0.25, 0.59, 0.17, side, side);
      put(this.meshes.head, i, p, 0, 1.67 + bob, 0, 0.205, 0.23, 0.205, 0, side);
      put(this.meshes.hair, i, p, 0, 1.85 + bob, 0.017, 0.205, 0.085, 0.20, 0, side);
      for (let s = 0; s < 2; s++) {
        const sign = s ? 1 : -1;
        const bigCheer = performance.now() < (window.karaokeCheerUntil || 0) ? 0.8 : 0;
        const cheer = Math.min(1, Math.max(0, Math.sin(beat + s * 1.7)) + bigCheer);
        put(this.meshes.arms, i * 2 + s, p, sign * (0.34 + cheer * 0.10),
          1.07 + bob + cheer * 0.20, 0, 0.09, 0.42, 0.09, sign * (0.20 + wave * 0.45 + cheer * 0.32 + bigCheer), side);
        put(this.meshes.legs, i * 2 + s, p, sign * 0.13, 0.39 + bob * 0.2, 0,
          0.10, 0.72, 0.105, sign * wave * 0.045, side);
        // Local forward is -Z; eye dots make the audience face the stage.
        put(this.meshes.eyes, i * 2 + s, p, sign * 0.075, 1.69 + bob, -0.197,
          0.017, 0.023, 0.018, 0, side);
      }
    });
    Object.values(this.meshes).forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
    this.nameplates.forEach(({ personIndex, plate }) => {
      const p = this.people[personIndex];
      plate.position.set(p.x, p.y + 2.15 * p.height + Math.sin(time * p.speed + p.phase) * .025, p.z);
    });
  },

  tick: function (time) { this.updatePeople(time); },
  remove: function () {
    if (!this.group) return;
    this.el.object3D.remove(this.group);
    Object.values(this.meshes).forEach((mesh) => mesh.dispose());
    this.meshes.body.geometry.dispose();
    this.meshes.head.geometry.dispose();
    this.meshes.body.material.dispose();
    this.nameplates.forEach(({ plate }) => { plate.material.map.dispose(); plate.material.dispose(); });
  }
});
