/**
 * HubScene.js
 * Main hub map: central plaza with 3 portals and a magic circle.
 * When all 3 soul gems collected → magic circle activates → final portal appears.
 */
import * as THREE from 'three';

const PORTAL_RADIUS = 2.2;
const PORTAL_TUBE   = 0.18;

// Portal configurations
const PORTALS = [
  { name: 'maze',    color: 0xff44aa, label: 'Pink Maze',             pos: [0, 0, -18], yaw: 0 },
  { name: 'jump',    color: 0x44aaff, label: 'Blue Jump Challenge',   pos: [-16, 0, 10], yaw: Math.PI * 0.35 },
  { name: 'puzzle',  color: 0xffcc00, label: 'Golden Memory Puzzle',  pos: [16, 0, 10],  yaw: -Math.PI * 0.35 },
];

export class HubScene {
  constructor(gm, scene, player, ui) {
    this.gm     = gm;
    this.scene  = scene;
    this.player = player;
    this.ui     = ui;

    this.objects    = [];   // for disposal
    this.portals    = [];
    this.finalPortal = null;
    this.magicCircle = null;
    this.magicCircleActive = false;
    this.activatingFinalPortal = false;

    this.particleSystem = null;
    this.particles = null;
    this.particleVels = [];
  }

  // ========= INIT =========

  init() {
    const s = this.scene;

    // Sky colour
    s.background = new THREE.Color(0x1a0a30);
    s.fog = new THREE.FogExp2(0x1a0a30, 0.018);

    // ---- Lights ----
    const ambient = new THREE.AmbientLight(0x220033, 0.6);
    s.add(ambient);
    this.objects.push(ambient);

    const moonLight = new THREE.DirectionalLight(0x8866cc, 0.8);
    moonLight.position.set(-20, 40, 20);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far  = 100;
    moonLight.shadow.camera.left = -30;
    moonLight.shadow.camera.right = 30;
    moonLight.shadow.camera.top  = 30;
    moonLight.shadow.camera.bottom = -30;
    s.add(moonLight);
    this.objects.push(moonLight);

    // ---- Floor ----
    this._buildFloor();

    // ---- Portals ----
    PORTALS.forEach(cfg => this._buildPortal(cfg));

    // ---- Magic Circle ----
    this._buildMagicCircle();

    // ---- Pillars ----
    this._buildPillars();

    // ---- Stars (decorative points) ----
    this._buildStars();

    // ---- Gem lights (collected gems give off glow) ----
    this._updateGemLights();

    // ---- Player start ----
    this.player.teleportTo(0, 0, 5, 0);
    this.player.cameraDistance = 6;

    // ---- UI ----
    this.ui.setStageLabel('✦ Magical Hub ✦', '#cc88ff');
    this.ui.setObjective(
      this.gm.gemCount >= 3 ? '마법진을 활성화하라!' : 'Soul Gem을 찾아라!'
    );

    // Check if already have all gems (returning from last stage)
    if (this.gm.gemCount >= 3) {
      this._activateMagicCircle(true);
    }
  }

  // ========= FLOOR =========

  _buildFloor() {
    // Main circular plaza
    const floorGeo = new THREE.CylinderGeometry(22, 22, 0.5, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2a1845,
      roughness: 0.6,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.25;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.objects.push(floor);

    // Star pattern overlay (inner disc)
    const innerGeo = new THREE.CylinderGeometry(15, 15, 0.51, 64);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x3d1f60,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0x110022,
      emissiveIntensity: 0.3,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = -0.24;
    this.scene.add(inner);
    this.objects.push(inner);
  }

  // ========= PORTAL =========

  _buildPortal(cfg) {
    const group = new THREE.Group();
    group.position.set(...cfg.pos);
    group.rotation.y = cfg.yaw;

    // Torus ring
    const torusGeo = new THREE.TorusGeometry(PORTAL_RADIUS, PORTAL_TUBE, 16, 64);
    const torusMat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      emissive: cfg.color,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.8,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.castShadow = false;
    group.add(torus);

    // Inner portal plane (shimmering)
    const innerGeo = new THREE.CircleGeometry(PORTAL_RADIUS - 0.1, 32);
    const innerMat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      emissive: cfg.color,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    group.add(inner);

    // Point light
    const light = new THREE.PointLight(cfg.color, 2.5, 12, 2);
    light.position.set(0, 0, 0.5);
    group.add(light);

    // Label text (using a sprite-like plane)
    group.position.y = PORTAL_RADIUS; // portal center at this height

    this.scene.add(group);
    this.objects.push(group);

    // Base pedestal
    const pedGeo = new THREE.CylinderGeometry(0.5, 0.7, 1.0, 12);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x3a2060, roughness: 0.5 });
    const ped = new THREE.Mesh(pedGeo, pedMat);
    ped.position.set(cfg.pos[0], -0.5, cfg.pos[2]);
    ped.castShadow = true;
    this.scene.add(ped);
    this.objects.push(ped);

    this.portals.push({
      name: cfg.name,
      label: cfg.label,
      color: cfg.color,
      group,
      inner,
      light,
      worldPos: new THREE.Vector3(cfg.pos[0], 0, cfg.pos[2]),
    });
  }

  // ========= MAGIC CIRCLE =========

  _buildMagicCircle() {
    const geo = new THREE.CylinderGeometry(5, 5, 0.08, 64);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4422aa,
      emissive: 0x220055,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
    });
    const circle = new THREE.Mesh(geo, mat);
    circle.position.y = 0.01;
    this.scene.add(circle);
    this.objects.push(circle);
    this.magicCircle = { mesh: circle, mat };

    // Inner rune rings
    for (let r = 1; r <= 3; r++) {
      const rGeo = new THREE.TorusGeometry(r * 1.4, 0.05, 6, 64);
      const rMat = new THREE.MeshStandardMaterial({
        color: 0x9955ff,
        emissive: 0x6633cc,
        emissiveIntensity: 0.5,
        roughness: 0.2,
      });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.06;
      this.scene.add(ring);
      this.objects.push(ring);
      if (!this.magicCircle.rings) this.magicCircle.rings = [];
      this.magicCircle.rings.push({ mesh: ring, mat: rMat, baseRot: r * 0.5 });
    }

    // Central light (off by default)
    const cLight = new THREE.PointLight(0xaa44ff, 0, 8, 2);
    cLight.position.y = 1;
    this.scene.add(cLight);
    this.objects.push(cLight);
    this.magicCircle.light = cLight;
  }

  // ========= PILLARS =========

  _buildPillars() {
    const angles = [0, 60, 120, 180, 240, 300].map(a => a * Math.PI / 180);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x2d1850,
      roughness: 0.5,
      metalness: 0.3,
    });
    angles.forEach(angle => {
      const x = Math.sin(angle) * 20;
      const z = Math.cos(angle) * 20;
      const pillarGeo = new THREE.CylinderGeometry(0.5, 0.6, 6, 10);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 3, z);
      pillar.castShadow = true;
      this.scene.add(pillar);
      this.objects.push(pillar);

      // Pillar top crystal
      const crystalGeo = new THREE.OctahedronGeometry(0.4, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xcc88ff,
        emissive: 0x8833cc,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.5,
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.set(x, 6.5, z);
      this.scene.add(crystal);
      this.objects.push(crystal);
    });
  }

  // ========= STARS =========

  _buildStars() {
    const count = 500;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 80 + Math.random() * 40;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi));
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, sizeAttenuation: true });
    const stars = new THREE.Points(geo, mat);
    this.scene.add(stars);
    this.objects.push(stars);
  }

  // ========= GEM LIGHTS =========

  _updateGemLights() {
    // Remove old gem lights
    if (this.gemLights) {
      this.gemLights.forEach(l => { this.scene.remove(l); this.objects.splice(this.objects.indexOf(l), 1); });
    }
    this.gemLights = [];

    const gemColors = { pink: 0xff44aa, blue: 0x44aaff, gold: 0xffcc00 };
    const gemPortalPos = { pink: PORTALS[0].pos, blue: PORTALS[1].pos, gold: PORTALS[2].pos };

    Object.entries(this.gm.gems).forEach(([type, collected]) => {
      if (!collected) return;
      const col = gemColors[type];
      const pPos = gemPortalPos[type];
      const light = new THREE.PointLight(col, 1.5, 10, 2);
      light.position.set(pPos[0], 3, pPos[2]);
      this.scene.add(light);
      this.objects.push(light);
      this.gemLights.push(light);
    });
  }

  // ========= MAGIC CIRCLE ACTIVATION =========

  _activateMagicCircle(instant = false) {
    if (this.magicCircleActive) return;
    this.magicCircleActive = true;

    const { mat, rings, light } = this.magicCircle;

    // Activate circle
    mat.emissive.set(0x8844ff);
    mat.emissiveIntensity = 1.5;
    mat.color.set(0xaa66ff);
    light.intensity = 4;
    light.color.set(0xcc88ff);

    rings.forEach(r => {
      r.mat.emissive.set(0xff88ff);
      r.mat.emissiveIntensity = 1.5;
    });

    // Build final portal
    this._buildFinalPortal();
  }

  _buildFinalPortal() {
    const group = new THREE.Group();
    group.position.set(0, 5, 0);

    // Large rainbow torus
    const torusGeo = new THREE.TorusGeometry(3.5, 0.3, 16, 64);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
      roughness: 0.0,
      metalness: 1.0,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    group.add(torus);

    // Inner plane (multicolor)
    const innerGeo = new THREE.CircleGeometry(3.4, 32);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xaaddff,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    group.add(inner);

    // Bright light
    const light = new THREE.PointLight(0xffffff, 5, 20, 2);
    group.add(light);

    this.scene.add(group);
    this.objects.push(group);
    this.finalPortal = { group, inner, light, innerMat, torusMat };
  }

  // ========= UPDATE =========

  update(delta) {
    const player = this.player;
    const time   = performance.now() * 0.001;

    // Portal animations
    this.portals.forEach(p => {
      p.group.rotation.y += delta * 0.4;
      p.inner.material.opacity = 0.35 + 0.15 * Math.sin(time * 2 + p.color);
    });

    // Magic circle rotation
    if (this.magicCircle && this.magicCircle.rings) {
      this.magicCircle.rings.forEach((r, i) => {
        r.mesh.rotation.z = time * (i % 2 === 0 ? 0.4 : -0.3) + r.baseRot;
      });
    }

    // Final portal animation
    if (this.finalPortal) {
      const fp = this.finalPortal;
      fp.group.rotation.y += delta * 0.5;
      fp.innerMat.opacity   = 0.4 + 0.25 * Math.sin(time * 3);
      fp.torusMat.emissive.setHSL((time * 0.1) % 1, 1, 0.5);
    }

    // ---- Interaction check ----
    let nearPortal = null;
    let nearPortalDist = Infinity;

    this.portals.forEach(p => {
      const dist = player.pos.distanceTo(p.worldPos);
      if (dist < 4.0 && dist < nearPortalDist) {
        nearPortal     = p;
        nearPortalDist = dist;
      }
    });

    // Check gem activation
    if (this.gm.gemCount >= 3 && !this.magicCircleActive && !this.activatingFinalPortal) {
      this.activatingFinalPortal = true;
      player.exitPointerLock();
      player.controlsDisabled = true;

      this.ui.showDialogue([
        "세 가지 젬을 모두 모았어! 💖",
        "이제 마법의 힘이 돌아와서 날개를 펴고 탈출할 수 있어! ✨",
        "마지막 포탈로 들어가 이 마물의 세계를 탈출하자! 💫"
      ], () => {
        player.controlsDisabled = false;
        this._activateMagicCircle();
        this._updateGemLights();
        this.ui.setObjective('✦ 파이널 포탈로 진입하라! ✦');
        this.ui.showPopup("✦ 파이널 포탈로 들어가시오! ✦", 2000);
        player.requestPointerLock();
      });
    }

    // Final portal interaction
    if (this.finalPortal && this.magicCircleActive) {
      const dist = player.pos.distanceTo(new THREE.Vector3(0, 0, 0));
      if (dist < 5.5) {
        this.ui.showInteractPrompt('[ E ] 차원문으로 진입');
        if (player.pressedE) {
          this.gm.transitionTo('ending');
          return;
        }
      } else if (!nearPortal) {
        this.ui.hideInteractPrompt();
      }
    }

    // Portal interaction
    if (nearPortal) {
      const gem = this.gm.gems[nearPortal.name === 'maze' ? 'pink' : nearPortal.name === 'jump' ? 'blue' : 'gold'];
      if (gem) {
        this.ui.showInteractPrompt(`[ E ] ${nearPortal.label} (클리어 완료)`);
      } else {
        this.ui.showInteractPrompt(`[ E ] ${nearPortal.label}으로 이동`);
        if (player.pressedE) {
          this.gm.transitionTo(nearPortal.name);
        }
      }
    } else if (!this.finalPortal || !this.magicCircleActive) {
      this.ui.hideInteractPrompt();
    }

    // Player collision (just the ground for hub)
    player.update(delta, [], 0);
  }

  // ========= DISPOSE =========

  dispose() {
    this.objects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
      obj.traverse && obj.traverse(child => {
        if (child.isMesh) {
          child.geometry && child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        }
      });
    });
    this.objects = [];
    this.portals = [];
    this.finalPortal = null;
    this.magicCircle = null;
  }
}
