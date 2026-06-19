/**
 * MazeScene.js
 * Stage 1 — Pink Maze
 * Player navigates a zigzag maze to find the exit and collect the Pink Soul Gem.
 *
 * BUGFIX (v2):
 *  - Lighting was too dark (ambient 0.25 → 2.5, directional 0.35 → 1.5)
 *  - Camera started inside a wall (cameraDistance 3 → 2, and camera is
 *    manually snapped to correct position in init() before first render)
 *  - Wall/floor materials are now lighter with emissive so they are always visible
 */
import * as THREE from 'three';

// 13 cols × 13 rows.  S=start, E=exit, #=wall, ' '=open
const MAZE_LAYOUT = [
  "#############",
  "#S#         #",
  "# # ####### #",
  "#   #     # #",
  "#   # ### # #",
  "#   #   # # #",
  "#   ### # # #",
  "# #   # #   #",
  "#     # ### #",
  "#   # #   # #",
  "#   # ### # #",
  "#         #E#",
  "#############",
];

const CELL   = 4;    // world units per cell
const WALL_H = 3.5;
const COLS   = MAZE_LAYOUT[0].length;   // 9
const ROWS   = MAZE_LAYOUT.length;      // 11
// Centre the maze at world origin
const OFFSET_X = -(COLS * CELL) / 2;   // -18
const OFFSET_Z = -(ROWS * CELL) / 2;   // -22

export class MazeScene {
  constructor(gm, scene, player, ui) {
    this.gm      = gm;
    this.scene   = scene;
    this.player  = player;
    this.ui      = ui;

    this.objects      = [];
    this.colliders    = [];
    this.startPos     = new THREE.Vector3();
    this.exitPos      = new THREE.Vector3();
    this.gemCollected = false;
    this.gemGroup     = null;
    this.gemLight     = null;
    this.gemTime      = 0;
    this._disposed    = false;
  }

  // ========= INIT =========

  init() {
    const s = this.scene;
    this._disposed = false;

    // ------ Sky / Fog ------
    // Slightly lighter fog colour so the scene doesn't look completely black
    s.background = new THREE.Color(0x180010);
    s.fog = new THREE.FogExp2(0x180010, 0.032);

    // ------ Lights ------
    // Bright pink ambient so walls are always visible
    const ambient = new THREE.AmbientLight(0xff66aa, 2.5);
    s.add(ambient);
    this.objects.push(ambient);

    // Overhead directional (from above → illuminates floor and wall tops)
    const ceilLight = new THREE.DirectionalLight(0xffaadd, 1.5);
    ceilLight.position.set(0, 30, 0);
    ceilLight.castShadow = true;
    ceilLight.shadow.mapSize.set(512, 512);
    ceilLight.shadow.camera.left  = -25;
    ceilLight.shadow.camera.right =  25;
    ceilLight.shadow.camera.top   =  25;
    ceilLight.shadow.camera.bottom = -25;
    ceilLight.shadow.camera.near  = 0.5;
    ceilLight.shadow.camera.far   = 80;
    s.add(ceilLight);
    this.objects.push(ceilLight);

    // Rim light from below (adds depth to walls)
    const rimLight = new THREE.DirectionalLight(0xff2266, 0.6);
    rimLight.position.set(0, -10, 0);
    s.add(rimLight);
    this.objects.push(rimLight);

    // ------ Materials ------
    // Bright enough that they show up clearly under the pink lighting
    const wallMat = new THREE.MeshStandardMaterial({
      color:             0xaa2255,   // medium rose-pink
      emissive:          0x550020,   // always-on rose glow
      emissiveIntensity: 0.6,
      roughness: 0.55,
      metalness: 0.15,
    });

    const floorMat = new THREE.MeshStandardMaterial({
      color:             0x7a1040,
      emissive:          0x3a0820,
      emissiveIntensity: 0.5,
      roughness: 0.8,
      metalness: 0.05,
    });

    const ceilMat = new THREE.MeshStandardMaterial({
      color:             0x5a0830,
      emissive:          0x280010,
      emissiveIntensity: 0.4,
      roughness: 1.0,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color:             0xff3388,
      emissive:          0xff1166,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    // ------ Floor ------
    const floorGeo = new THREE.PlaneGeometry(COLS * CELL, ROWS * CELL);
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(
      OFFSET_X + (COLS * CELL) / 2,
      0,
      OFFSET_Z + (ROWS * CELL) / 2
    );
    floor.receiveShadow = true;
    s.add(floor);
    this.objects.push(floor);

    // ------ Ceiling ------
    const ceilGeo = new THREE.PlaneGeometry(COLS * CELL, ROWS * CELL);
    const ceil    = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(
      OFFSET_X + (COLS * CELL) / 2,
      WALL_H,
      OFFSET_Z + (ROWS * CELL) / 2
    );
    s.add(ceil);
    this.objects.push(ceil);

    // ------ Maze Walls ------
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const ch = MAZE_LAYOUT[row][col];

        const wx = OFFSET_X + col * CELL;
        const wz = OFFSET_Z + row * CELL;
        const cx = wx + CELL / 2;
        const cz = wz + CELL / 2;

        if (ch === 'S') {
          this.startPos.set(cx, 0, cz);
        } else if (ch === 'E') {
          this.exitPos.set(cx, 0, cz);
        }

        if (ch === '#') {
          const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
          const wall    = new THREE.Mesh(wallGeo, wallMat);
          wall.position.set(cx, WALL_H / 2, cz);
          wall.receiveShadow = true;
          wall.castShadow    = true;
          s.add(wall);
          this.objects.push(wall);

          // Glowing trim strip at top of every wall (GI atmosphere)
          const trimGeo = new THREE.BoxGeometry(CELL + 0.05, 0.1, CELL + 0.05);
          const trim    = new THREE.Mesh(trimGeo, trimMat);
          trim.position.set(cx, WALL_H + 0.05, cz);
          s.add(trim);
          this.objects.push(trim);

          // Collider
          this.colliders.push({
            minX: wx,       maxX: wx + CELL,
            minY: 0,        maxY: WALL_H,
            minZ: wz,       maxZ: wz + CELL,
          });
        }
      }
    }

    // ------ GI Simulation: corridor point lights ------
    // Simulates bounced pink light throughout the maze corridors
    // Placed at every open corridor turning-point
    const giLightPositions = [
      // Start corridor
      [this.startPos.x, 1.8, this.startPos.z],
      // Mid-maze (computed from layout)
      [OFFSET_X + COLS * CELL * 0.8, 1.8, OFFSET_Z + ROWS * CELL * 0.27],
      [OFFSET_X + COLS * CELL * 0.2, 1.8, OFFSET_Z + ROWS * CELL * 0.45],
      [OFFSET_X + COLS * CELL * 0.8, 1.8, OFFSET_Z + ROWS * CELL * 0.64],
      [OFFSET_X + COLS * CELL * 0.2, 1.8, OFFSET_Z + ROWS * CELL * 0.82],
    ];
    giLightPositions.forEach(([x, y, z]) => {
      const light = new THREE.PointLight(0xff1166, 2.0, 12, 2);
      light.position.set(x, y, z);
      s.add(light);
      this.objects.push(light);
    });

    // ------ Pink Soul Gem at exit ------
    this._buildGem();

    // ------ Player start ------
    // cameraDistance = 2 so camera stays within 4-unit corridors
    this.player.cameraDistance  = 2;
    this.player.cameraTargetY   = 1.0;
    this.player.teleportTo(this.startPos.x, 0, this.startPos.z, 0);

    // Snap camera to correct position immediately (avoids black 1st-frame during fade-in)
    this._snapCamera();

    // ------ UI ------
    this.ui.setStageLabel('✦ Pink Maze ✦', '#ff88cc');
    this.ui.setObjective('미로를 탈출하여 Pink Soul Gem을 찾아라!');
  }

  /** Immediately position camera to match player state. */
  _snapCamera() {
    const p     = this.player;
    const dist  = p.cameraDistance;
    const yaw   = p.cameraYaw;
    const pitch = p.cameraPitch;
    const cosP  = Math.cos(pitch);
    const sinP  = Math.sin(pitch);
    const tx    = p.pos.x;
    const ty    = p.pos.y + p.cameraTargetY;
    const tz    = p.pos.z;

    p.camera.position.set(
      tx + Math.sin(yaw) * dist * cosP,
      ty + sinP * dist,
      tz + Math.cos(yaw) * dist * cosP
    );
    p.camera.lookAt(tx, ty, tz);
  }

  // ========= GEM =========

  _buildGem() {
    const group = new THREE.Group();
    group.position.set(this.exitPos.x, 1.2, this.exitPos.z);

    // Materials
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x554400,
      metalness: 0.9,
      roughness: 0.15
    });

    const gemMat = new THREE.MeshStandardMaterial({
      color:             0xff66aa,
      emissive:          0xff0066,
      emissiveIntensity: 2.2,
      roughness: 0.02,
      metalness: 0.95,
      transparent: true,
      opacity: 0.92,
      flatShading: true,
    });

    // 1. Faceted Heart Core
    const heartGroup = new THREE.Group();
    
    // Two lobes
    const lobeGeo = new THREE.SphereGeometry(0.22, 6, 6);
    const leftLobe = new THREE.Mesh(lobeGeo, gemMat);
    leftLobe.position.set(-0.15, 0.15, 0);
    heartGroup.add(leftLobe);
    const rightLobe = new THREE.Mesh(lobeGeo, gemMat);
    rightLobe.position.set(0.15, 0.15, 0);
    heartGroup.add(rightLobe);

    // Bottom cone
    const coneGeo = new THREE.ConeGeometry(0.28, 0.5, 6);
    coneGeo.rotateX(Math.PI); // point down
    coneGeo.translate(0, -0.15, 0);
    const bottomCone = new THREE.Mesh(coneGeo, gemMat);
    heartGroup.add(bottomCone);

    group.add(heartGroup);
    this.gemMesh = heartGroup;

    // 2. Gold Frame Outline
    const frameGroup = new THREE.Group();
    
    const fLobeGeo = new THREE.SphereGeometry(0.24, 6, 6);
    const fLeftLobe = new THREE.Mesh(fLobeGeo, goldMat);
    fLeftLobe.position.set(-0.15, 0.15, -0.02);
    frameGroup.add(fLeftLobe);
    const fRightLobe = new THREE.Mesh(fLobeGeo, goldMat);
    fRightLobe.position.set(0.15, 0.15, -0.02);
    frameGroup.add(fRightLobe);
    
    const fConeGeo = new THREE.ConeGeometry(0.3, 0.52, 6);
    fConeGeo.rotateX(Math.PI);
    fConeGeo.translate(0, -0.15, -0.02);
    const fCone = new THREE.Mesh(fConeGeo, goldMat);
    frameGroup.add(fCone);
    
    group.add(frameGroup);

    // 3. Crown on Top of the Heart
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.4, 0);
    // Base ring
    const ringGeo = new THREE.TorusGeometry(0.12, 0.025, 6, 16);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.rotation.x = Math.PI / 2;
    crownGroup.add(ring);
    // Crown spikes (3 cones)
    [-0.08, 0, 0.08].forEach((xOff, idx) => {
      const spikeGeo = new THREE.ConeGeometry(0.04, 0.12, 5);
      const spike = new THREE.Mesh(spikeGeo, goldMat);
      spike.position.set(xOff, 0.08, 0);
      if (idx === 1) spike.scale.set(1.2, 1.4, 1.2); // middle spike taller
      crownGroup.add(spike);
    });
    group.add(crownGroup);

    // 4. Ribbon bow and hanging gem decoration at the bottom
    const ribbonGroup = new THREE.Group();
    ribbonGroup.position.set(0, -0.42, 0);
    // Ribbon wings
    const ribGeo = new THREE.ConeGeometry(0.06, 0.12, 5);
    ribGeo.rotateZ(Math.PI / 2);
    const ribL = new THREE.Mesh(ribGeo, goldMat);
    ribL.position.set(-0.06, 0, 0);
    ribL.rotation.y = Math.PI / 6;
    ribbonGroup.add(ribL);
    const ribR = new THREE.Mesh(ribGeo, goldMat);
    ribR.position.set(0.06, 0, 0);
    ribR.rotation.y = -Math.PI / 6 + Math.PI;
    ribbonGroup.add(ribR);
    // Hanging drop gem
    const dropGeo = new THREE.OctahedronGeometry(0.07, 0);
    const drop = new THREE.Mesh(dropGeo, gemMat);
    drop.position.set(0, -0.12, 0.02);
    ribbonGroup.add(drop);
    group.add(ribbonGroup);

    // Sparkling particles orbiting the gem
    const sparkleGeo = new THREE.OctahedronGeometry(0.06, 0);
    const sparkleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff88cc,
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

    // Main GI light — strong pink illumination on surrounding maze walls
    const gemLight = new THREE.PointLight(0xff1166, 6.0, 20, 1.5);
    group.add(gemLight);
    this.gemLight = gemLight;

    // Secondary bounce lights (simulate indirect light from gem hitting walls)
    const bounceOffsets = [[-3, 0.5, 0], [3, 0.5, 0], [0, 0.5, -3], [0, 0.5, 3]];
    bounceOffsets.forEach(([dx, dy, dz]) => {
      const bLight = new THREE.PointLight(0xff0055, 1.5, 8, 2);
      bLight.position.set(dx, dy, dz);
      group.add(bLight);
    });

    this.scene.add(group);
    this.objects.push(group);
    this.gemGroup = group;
  }

  // ========= UPDATE =========

  update(delta) {
    if (this._disposed) return;
    this.gemTime += delta;

    // Animate gem
    if (this.gemGroup && !this.gemCollected) {
      this.gemGroup.rotation.y += delta * 1.2;
      this.gemGroup.position.y  = 1.2 + Math.sin(this.gemTime * 2) * 0.15;
      if (this.gemLight) {
        this.gemLight.intensity = 5.5 + Math.sin(this.gemTime * 3) * 0.5;
      }
    }

    // Move + collide player
    this.player.update(delta, this.colliders, 0);
    // Fix camera if it clipped into a wall
    this.player.fixCameraCollision(this.colliders);

    if (this.gemCollected) return;

    // Check if player reached the exit gem
    const distToExit = new THREE.Vector2(
      this.player.pos.x - this.exitPos.x,
      this.player.pos.z - this.exitPos.z
    ).length();

    if (distToExit < 3.5) {
      this.ui.showInteractPrompt('✦ Pink Soul Gem 발견!');
      if (distToExit < 2.2) {
        this._collectGem();
      }
    } else {
      this.ui.hideInteractPrompt();
    }
  }

  _collectGem() {
    if (this.gemCollected || this._disposed) return;
    this.gemCollected = true;

    if (this.gemGroup) {
      this.scene.remove(this.gemGroup);
      this.gemGroup = null;
    }

    this.gm.collectGem('pink');

    setTimeout(() => {
      if (!this._disposed) this.gm.transitionTo('hub');
    }, 1800);
  }

  // ========= DISPOSE =========

  dispose() {
    this._disposed = true;
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
