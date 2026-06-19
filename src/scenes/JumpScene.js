/**
 * JumpScene.js
 * Stage 2 — Blue Jump Challenge
 * Platform jumping with respawn. Blue GI lighting from the Soul Gem.
 */
import * as THREE from 'three';

// Platform definitions: { cx, topY, cz, hw, hd }
// cx/cz = center X/Z, topY = top surface Y, hw/hd = half-width/half-depth
const PLATFORM_DEFS = [
  { cx:  0,  topY:  0, cz:  0,  hw: 4.5, hd: 4.5 },  // 0: Start
  { cx:  7,  topY:  1, cz:  0,  hw: 2.0, hd: 2.0 },  // 1
  { cx: 12,  topY:  2, cz: -5,  hw: 2.0, hd: 2.0 },  // 2
  { cx:  7,  topY:  3, cz: -10, hw: 2.0, hd: 2.0 },  // 3
  { cx:  0,  topY:  4, cz: -13, hw: 2.0, hd: 2.0 },  // 4
  { cx: -7,  topY:  5, cz: -10, hw: 2.0, hd: 2.0 },  // 5
  { cx:-12,  topY:  6, cz: -5,  hw: 2.0, hd: 2.0 },  // 6
  { cx: -7,  topY:  7, cz:  0,  hw: 2.0, hd: 2.0 },  // 7
  { cx:  0,  topY:  8, cz:  5,  hw: 3.0, hd: 3.0 },  // 8: Goal
];

export class JumpScene {
  constructor(gm, scene, player, ui) {
    this.gm      = gm;
    this.scene   = scene;
    this.player  = player;
    this.ui      = ui;

    this.objects   = [];
    this.colliders = [];
    this.gemCollected = false;
    this.gemGroup  = null;
    this.gemLight  = null;
    this.gemTime   = 0;

    this.goalPos = new THREE.Vector3(
      PLATFORM_DEFS[8].cx, PLATFORM_DEFS[8].topY, PLATFORM_DEFS[8].cz
    );

    this.respawnPos = new THREE.Vector3(
      PLATFORM_DEFS[0].cx, PLATFORM_DEFS[0].topY, PLATFORM_DEFS[0].cz
    );
  }

  // ========= INIT =========

  init() {
    const s = this.scene;

    // Sky
    s.background = new THREE.Color(0x001530);
    s.fog = new THREE.FogExp2(0x001530, 0.022);

    // ---- Lights ----
    const ambient = new THREE.AmbientLight(0x4488ff, 2.0);
    s.add(ambient);
    this.objects.push(ambient);

    const sunLight = new THREE.DirectionalLight(0xaaddff, 1.5);
    sunLight.position.set(10, 30, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far  = 80;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top  = 30;
    sunLight.shadow.camera.bottom = -30;
    s.add(sunLight);
    this.objects.push(sunLight);

    // GI secondary lights — simulate blue light bouncing from gem
    const giPositions = [
      [0, 5, -5], [-6, 5, -8], [6, 5, -3]
    ];
    giPositions.forEach(([x, y, z]) => {
      const light = new THREE.PointLight(0x0044cc, 0.7, 20, 2);
      light.position.set(x, y, z);
      s.add(light);
      this.objects.push(light);
    });

    // ---- Platforms ----
    PLATFORM_DEFS.forEach((p, i) => {
      this._buildPlatform(p, i === 8); // last platform is goal
    });

    // ---- Connecting paths / arrows (decorative) ----
    this._buildArrows();

    // ---- Stars ----
    this._buildStars();

    // ---- Blue Soul Gem at goal ----
    this._buildGem();

    // ---- Player start ----
    this.player.teleportTo(
      this.respawnPos.x, this.respawnPos.y + 0.1, this.respawnPos.z, Math.PI
    );
    this.player.cameraDistance = 7;

    // ---- UI ----
    this.ui.setStageLabel('✦ Blue Jump Challenge ✦', '#88ccff');
    this.ui.setObjective('공중 발판을 건너 Blue Soul Gem을 찾아라!');
  }

  // ========= BUILD PLATFORM =========

  _buildPlatform(p, isGoal) {
    const thickness = 0.5;

    // Hover glow platforms — icy blue
    const color     = isGoal ? 0x88ffff : 0x2255aa;
    const emissive  = isGoal ? 0x44aaff : 0x112255;
    const emissInt  = isGoal ? 1.0 : 0.3;

    const geo = new THREE.BoxGeometry(p.hw * 2, thickness, p.hd * 2);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: emissInt,
      roughness: 0.2,
      metalness: 0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.cx, p.topY - thickness / 2, p.cz);
    mesh.receiveShadow = true;
    mesh.castShadow    = true;
    this.scene.add(mesh);
    this.objects.push(mesh);

    // Edge glow trim
    if (isGoal) {
      const trimGeo = new THREE.BoxGeometry(p.hw * 2 + 0.1, 0.08, p.hd * 2 + 0.1);
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0x44ddff,
        emissive: 0x00aaff,
        emissiveIntensity: 2.0,
      });
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(p.cx, p.topY + 0.01, p.cz);
      this.scene.add(trim);
      this.objects.push(trim);

      // Goal platform light
      const gLight = new THREE.PointLight(0x44aaff, 2.0, 10, 2);
      gLight.position.set(p.cx, p.topY + 1, p.cz);
      this.scene.add(gLight);
      this.objects.push(gLight);
    }

    // Collider
    this.colliders.push({
      minX: p.cx - p.hw, maxX: p.cx + p.hw,
      minY: p.topY - thickness, maxY: p.topY,
      minZ: p.cz - p.hd, maxZ: p.cz + p.hd,
    });
  }

  // ========= ARROWS =========

  _buildArrows() {
    // Simple directional cones between platforms
    for (let i = 0; i < PLATFORM_DEFS.length - 1; i++) {
      const a = PLATFORM_DEFS[i];
      const b = PLATFORM_DEFS[i + 1];
      const midX = (a.cx + b.cx) / 2;
      const midY = (a.topY + b.topY) / 2 + 0.5;
      const midZ = (a.cz + b.cz) / 2;

      const arrowGeo = new THREE.ConeGeometry(0.2, 0.6, 6);
      const arrowMat = new THREE.MeshStandardMaterial({
        color: 0x44aaff,
        emissive: 0x2266cc,
        emissiveIntensity: 0.8,
      });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.position.set(midX, midY, midZ);

      // Point toward next platform
      const dir = new THREE.Vector3(b.cx - a.cx, b.topY - a.topY, b.cz - a.cz).normalize();
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      this.scene.add(arrow);
      this.objects.push(arrow);
    }
  }

  // ========= STARS =========

  _buildStars() {
    const count = 400;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = Math.random() * 80 + 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat   = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.3, sizeAttenuation: true });
    const stars = new THREE.Points(geo, mat);
    this.scene.add(stars);
    this.objects.push(stars);
  }

  // ========= GEM =========

  _buildGem() {
    const gp = PLATFORM_DEFS[8];
    const group = new THREE.Group();
    group.position.set(gp.cx, gp.topY + 1.3, gp.cz);

    // Materials
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x554400,
      metalness: 0.9,
      roughness: 0.15
    });

    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x0077ff,
      emissiveIntensity: 2.2,
      roughness: 0.02,
      metalness: 0.95,
      transparent: true,
      opacity: 0.9,
      flatShading: true,
    });

    // 1. Faceted Spade Core
    const spadeGroup = new THREE.Group();
    
    // Top inverted cone
    const spadeTopGeo = new THREE.ConeGeometry(0.24, 0.48, 6);
    const spadeTop = new THREE.Mesh(spadeTopGeo, gemMat);
    spadeTop.position.y = 0.14;
    spadeGroup.add(spadeTop);
    
    // Two bottom lobes
    const lobeGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const leftLobe = new THREE.Mesh(lobeGeo, gemMat);
    leftLobe.position.set(-0.12, -0.06, 0);
    spadeGroup.add(leftLobe);
    const rightLobe = new THREE.Mesh(lobeGeo, gemMat);
    rightLobe.position.set(0.12, -0.06, 0);
    spadeGroup.add(rightLobe);

    // Stem / pedestal at bottom
    const stemGeo = new THREE.ConeGeometry(0.1, 0.25, 6);
    stemGeo.translate(0, -0.22, 0);
    const stem = new THREE.Mesh(stemGeo, gemMat);
    spadeGroup.add(stem);

    group.add(spadeGroup);
    this.gemMesh = spadeGroup;

    // 2. Gold Frame Border
    const frameGroup = new THREE.Group();
    // Slightly larger backing outline spade
    const fTop = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.50, 6), goldMat);
    fTop.position.set(0, 0.14, -0.02);
    frameGroup.add(fTop);
    
    const fLeftLobe = new THREE.Mesh(new THREE.SphereGeometry(0.20, 6, 6), goldMat);
    fLeftLobe.position.set(-0.12, -0.06, -0.02);
    frameGroup.add(fLeftLobe);
    const fRightLobe = new THREE.Mesh(new THREE.SphereGeometry(0.20, 6, 6), goldMat);
    fRightLobe.position.set(0.12, -0.06, -0.02);
    frameGroup.add(fRightLobe);

    const fStem = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 6), goldMat);
    fStem.position.set(0, -0.22, -0.02);
    frameGroup.add(fStem);
    
    group.add(frameGroup);

    // 3. Crown on Top of the Spade
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.44, 0);
    // Base ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16), goldMat);
    ring.rotation.x = Math.PI / 2;
    crownGroup.add(ring);
    // Crown spikes (3 cones)
    [-0.06, 0, 0.06].forEach((xOff, idx) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), goldMat);
      spike.position.set(xOff, 0.06, 0);
      if (idx === 1) spike.scale.set(1.2, 1.4, 1.2); // middle spike taller
      crownGroup.add(spike);
    });
    group.add(crownGroup);

    // 4. Ribbon bow and spade-tip dangling decoration at bottom
    const ribbonGroup = new THREE.Group();
    ribbonGroup.position.set(0, -0.42, 0);
    // Ribbon wings
    const ribGeo = new THREE.ConeGeometry(0.05, 0.1, 5);
    ribGeo.rotateZ(Math.PI / 2);
    const ribL = new THREE.Mesh(ribGeo, goldMat);
    ribL.position.set(-0.05, 0, 0);
    ribL.rotation.y = Math.PI / 6;
    ribbonGroup.add(ribL);
    const ribR = new THREE.Mesh(ribGeo, goldMat);
    ribR.position.set(0.05, 0, 0);
    ribR.rotation.y = -Math.PI / 6 + Math.PI;
    ribbonGroup.add(ribR);
    // Hanging spade gem
    const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), gemMat);
    drop.position.set(0, -0.1, 0.01);
    ribbonGroup.add(drop);
    group.add(ribbonGroup);

    // Sparkling particles orbiting the gem
    const sparkleGeo = new THREE.OctahedronGeometry(0.06, 0);
    const sparkleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x88ccff,
      emissiveIntensity: 3.0,
      flatShading: true,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const sMesh = new THREE.Mesh(sparkleGeo, sparkleMat);
      sMesh.position.set(
        Math.cos(angle) * 0.85,
        Math.sin(angle * 2) * 0.25,
        Math.sin(angle) * 0.85
      );
      group.add(sMesh);
    }

    // Main GI light — blue illumination on surroundings
    const gemLight = new THREE.PointLight(0x0088ff, 5.0, 25, 1.5);
    group.add(gemLight);
    this.gemLight = gemLight;

    // Bounce lights on nearby platforms
    const bLight1 = new THREE.PointLight(0x0055cc, 1.5, 10, 2);
    bLight1.position.set(-3, -2, 0);
    group.add(bLight1);
    const bLight2 = new THREE.PointLight(0x0055cc, 1.5, 10, 2);
    bLight2.position.set(3, -2, 0);
    group.add(bLight2);

    this.scene.add(group);
    this.objects.push(group);
    this.gemGroup = group;
  }

  // ========= UPDATE =========

  update(delta) {
    this.gemTime += delta;

    // Animate gem
    if (this.gemGroup && !this.gemCollected) {
      this.gemGroup.rotation.y += delta * 1.4;
      this.gemGroup.position.y  = PLATFORM_DEFS[8].topY + 1.3 + Math.sin(this.gemTime * 2) * 0.2;
      if (this.gemLight) {
        this.gemLight.intensity = 4.5 + Math.sin(this.gemTime * 3) * 0.5;
      }
    }

    // Move player
    this.player.update(delta, this.colliders, -999); // no global ground → fall kills

    // Fall detection
    if (this.player.pos.y < -6) {
      this._respawn();
      return;
    }

    if (this.gemCollected) return;

    // Check gem distance
    const distToGoal = this.player.pos.distanceTo(this.goalPos);
    if (distToGoal < 4.5) {
      this.ui.showInteractPrompt('✦ Blue Soul Gem 발견!');
      if (distToGoal < 2.5) {
        this._collectGem();
      }
    } else {
      this.ui.hideInteractPrompt();
    }
  }

  _respawn() {
    this.ui.showRespawn('발판에서 떨어졌다! 처음으로...');
    this.player.teleportTo(
      this.respawnPos.x, this.respawnPos.y + 0.5, this.respawnPos.z, Math.PI
    );
  }

  _collectGem() {
    if (this.gemCollected) return;
    this.gemCollected = true;

    if (this.gemGroup) this.scene.remove(this.gemGroup);

    this.gm.collectGem('blue');

    setTimeout(() => {
      this.gm.transitionTo('hub');
    }, 1800);
  }

  // ========= DISPOSE =========

  dispose() {
    this.objects.forEach(obj => {
      this.scene.remove(obj);
      obj.traverse && obj.traverse(child => {
        if (child.isMesh) {
          child.geometry && child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        }
      });
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this.objects   = [];
    this.colliders = [];
  }
}
