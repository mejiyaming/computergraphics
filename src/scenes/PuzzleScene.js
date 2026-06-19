/**
 * PuzzleScene.js
 * Stage 3 — Golden Memory Puzzle
 * 4 crystals light up in sequence; player must touch them in the same order.
 * Gold GI lighting illuminates the room with warm yellow indirect light.
 */
import * as THREE from 'three';

const CRYSTAL_COLORS = [0xff3333, 0x33cc55, 0x3366ff, 0xffcc00];
const CRYSTAL_EMITS  = [0xcc0000, 0x009933, 0x0033cc, 0xcc9900];
const CRYSTAL_LABELS = ['RED', 'GREEN', 'BLUE', 'YELLOW'];

// Crystal positions in a row in front of player
const CRYSTAL_POSITIONS = [
  new THREE.Vector3(-4.5, 0, -6),
  new THREE.Vector3(-1.5, 0, -6),
  new THREE.Vector3( 1.5, 0, -6),
  new THREE.Vector3( 4.5, 0, -6),
];

const SEQUENCE_LENGTH = 4;
const SHOW_DELAY_MS   = 700;  // time each crystal lights up

export class PuzzleScene {
  constructor(gm, scene, player, ui) {
    this.gm      = gm;
    this.scene   = scene;
    this.player  = player;
    this.ui      = ui;

    this.objects      = [];
    this.colliders    = [];
    this.crystalMeshes = [];
    this.crystalLights = [];
    this.gemGroup     = null;
    this.gemLight     = null;
    this.gemTime      = 0;
    this.gemCollected = false;

    // Puzzle state machine
    // 'showing' | 'player_input' | 'wrong' | 'solved'
    this.puzzleState  = 'showing';
    this.sequence     = [];
    this.inputSeq     = [];
    this.showIndex    = 0;
    this.showTimer    = 0;
    // 'waiting' = initial delay, 'on' = crystal lit, 'off' = gap between crystals
    this.showPhase    = 'waiting';
    this.nearCrystal  = -1;
    this._disposed    = false;

    this._generateSequence();
  }

  _generateSequence() {
    this.sequence = [];
    for (let i = 0; i < SEQUENCE_LENGTH; i++) {
      this.sequence.push(Math.floor(Math.random() * 4));
    }
  }

  // ========= INIT =========

  init() {
    const s = this.scene;

    // Sky — dark gold
    s.background = new THREE.Color(0x1a1000);
    s.fog = new THREE.FogExp2(0x1a1000, 0.030);

    // ---- Lights ----
    const ambient = new THREE.AmbientLight(0xffaa44, 2.2);
    s.add(ambient);
    this.objects.push(ambient);

    const mainLight = new THREE.DirectionalLight(0xffdd99, 1.5);
    mainLight.position.set(5, 20, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(1024, 1024);
    s.add(mainLight);
    this.objects.push(mainLight);

    // GI secondary — warm golden bounce lights
    const giPositions = [[-4, 1, 0], [4, 1, 0], [0, 1, -4], [0, 1, 4]];
    giPositions.forEach(([x, y, z]) => {
      const light = new THREE.PointLight(0xcc8800, 0.8, 15, 2);
      light.position.set(x, y, z);
      s.add(light);
      this.objects.push(light);
    });

    // ---- Room ----
    this._buildRoom();

    // ---- Crystals ----
    this._buildCrystals();

    // ---- Gold Soul Gem (hidden until solved) ----
    this._buildGem();

    // ---- Altar / pedestal ----
    this._buildAltar();

    // ---- Player start ----
    this.player.teleportTo(0, 0, 4, Math.PI);
    this.player.cameraDistance = 6;

    // ---- UI ----
    this.ui.setStageLabel('✦ Golden Memory Puzzle ✦', '#ffcc44');
    this.ui.setObjective('수정이 점등되는 순서를 기억하라!');
    this.ui.showPuzzleUI(true);

    this.roundsCleared = 0;
    this._disposed     = false;
    this._startNewRound();
  }

  _startNewRound() {
    this._generateSequence();
    this.ui.setSeqColors(this.sequence);
    this.ui.resetSeqGems();

    // Clear the sequence colors in the UI after 2 seconds
    if (this._roundTimeout) clearTimeout(this._roundTimeout);
    this._roundTimeout = setTimeout(() => {
      if (!this._disposed) {
        this.ui.clearSeqColors();
      }
    }, 2000);

    this.showIndex   = 0;
    this.showPhase   = 'waiting';
    this.inputSeq    = [];
    this.puzzleState = 'showing';
    this.showTimer   = 2.5; // wait 2.5s (2s show + 0.5s pause)
    this.ui.setPuzzleMessage(`기억하라! Round ${this.roundsCleared + 1} / 3`);
  }

  // ========= ROOM =========

  _buildRoom() {
    const s = this.scene;
    const roomW = 16, roomH = 5, roomD = 16;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a1800,
      roughness: 0.7,
      metalness: 0.1,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3d2200,
      roughness: 0.5,
      metalness: 0.3,
    });

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomW, roomD);
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor); this.objects.push(floor);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(roomW, roomD);
    const ceil    = new THREE.Mesh(ceilGeo, wallMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = roomH;
    s.add(ceil); this.objects.push(ceil);

    // Walls
    const wallDefs = [
      { pos: [0, roomH/2, -roomD/2], rot: [0,0,0],         w: roomW, h: roomH }, // front
      { pos: [0, roomH/2,  roomD/2], rot: [0, Math.PI,0],   w: roomW, h: roomH }, // back
      { pos: [-roomW/2, roomH/2, 0], rot: [0, Math.PI/2,0], w: roomD, h: roomH }, // left
      { pos: [ roomW/2, roomH/2, 0], rot: [0,-Math.PI/2,0], w: roomD, h: roomH }, // right
    ];
    const wallColDefs = [
      { minX:-roomW/2, maxX:roomW/2, minY:0, maxY:roomH, minZ:-roomD/2-0.5, maxZ:-roomD/2+0.5 },
      { minX:-roomW/2, maxX:roomW/2, minY:0, maxY:roomH, minZ: roomD/2-0.5, maxZ: roomD/2+0.5 },
      { minX:-roomW/2-0.5, maxX:-roomW/2+0.5, minY:0, maxY:roomH, minZ:-roomD/2, maxZ:roomD/2 },
      { minX: roomW/2-0.5, maxX: roomW/2+0.5, minY:0, maxY:roomH, minZ:-roomD/2, maxZ:roomD/2 },
    ];

    wallDefs.forEach((w, i) => {
      const geo  = new THREE.PlaneGeometry(w.w, w.h);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(...w.pos);
      mesh.rotation.set(...w.rot);
      mesh.receiveShadow = true;
      s.add(mesh); this.objects.push(mesh);
      this.colliders.push(wallColDefs[i]);
    });

    // Gold trim at floor & ceiling edges
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xcc8800,
      emissive: 0x885500,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const trimPositions = [
      [0, 0.06, -roomD/2], [0, 0.06, roomD/2],
      [-roomW/2, 0.06, 0],  [roomW/2, 0.06, 0],
    ];
    trimPositions.forEach(([x,y,z], i) => {
      const isZ = i < 2;
      const trimGeo = new THREE.BoxGeometry(isZ ? roomW : 0.12, 0.12, isZ ? 0.12 : roomD);
      const trim    = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(x, y, z);
      s.add(trim); this.objects.push(trim);
    });
  }

  // ========= CRYSTALS =========

  _buildCrystals() {
    const s = this.scene;

    CRYSTAL_POSITIONS.forEach((pos, i) => {
      const group = new THREE.Group();
      group.position.copy(pos);
      group.position.y = 1.0;

      // Crystal body - flat shaded for faceted jewel look
      const gemGeo = new THREE.OctahedronGeometry(0.38, 0);
      const gemMat = new THREE.MeshStandardMaterial({
        color:    CRYSTAL_COLORS[i],
        emissive: CRYSTAL_EMITS[i],
        emissiveIntensity: 0.3,
        roughness: 0.02,
        metalness: 0.9,
        transparent: true,
        opacity: 0.85,
        flatShading: true,
      });
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.castShadow = true;
      group.add(gem);

      // Pedestal
      const pedGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.8, 8);
      const pedMat = new THREE.MeshStandardMaterial({ color: 0x3a2200, roughness: 0.6 });
      const ped    = new THREE.Mesh(pedGeo, pedMat);
      ped.position.y = -0.9;
      group.add(ped);

      // Point light (off initially)
      const light = new THREE.PointLight(CRYSTAL_COLORS[i], 0, 8, 2);
      group.add(light);

      s.add(group);
      this.objects.push(group);
      this.crystalMeshes.push({ group, gem, gemMat, light });
      this.crystalLights.push(light);
    });
  }

  // ========= ALTAR =========

  _buildAltar() {
    const s = this.scene;
    const altarGeo = new THREE.BoxGeometry(13, 0.3, 2);
    const altarMat = new THREE.MeshStandardMaterial({
      color: 0x3d2200,
      emissive: 0x221100,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.5,
    });
    const altar = new THREE.Mesh(altarGeo, altarMat);
    altar.position.set(0, 0.15, -6);
    altar.castShadow = true;
    altar.receiveShadow = true;
    s.add(altar);
    this.objects.push(altar);
  }

  // ========= GEM =========

  _buildGem() {
    const group = new THREE.Group();
    group.position.set(0, 2.5, -6);
    group.visible = false;

    // Materials
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x554400,
      metalness: 0.9,
      roughness: 0.15
    });

    const gemMat = new THREE.MeshStandardMaterial({
      color: 0xffdd44,
      emissive: 0xffaa00,
      emissiveIntensity: 2.2,
      roughness: 0.02,
      metalness: 0.95,
      transparent: true,
      opacity: 0.9,
      flatShading: true,
    });

    // 1. Faceted Elongated Rhombus Core
    const diamondGroup = new THREE.Group();
    const coreGeo = new THREE.OctahedronGeometry(0.38, 0);
    const core = new THREE.Mesh(coreGeo, gemMat);
    core.scale.set(0.9, 1.4, 0.9); // Elongate to match reference diamond
    diamondGroup.add(core);
    group.add(diamondGroup);

    // 2. Gold Frame Border
    const frameGroup = new THREE.Group();
    
    // Equatorial ring
    const ringGeo = new THREE.TorusGeometry(0.36, 0.025, 6, 24);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1.0, 1.0, 0.5);
    frameGroup.add(ring);
    
    // Elongated gold outer shell outline
    const outerGeo = new THREE.OctahedronGeometry(0.40, 0);
    const outer = new THREE.Mesh(outerGeo, goldMat);
    outer.scale.set(0.92, 1.42, 0.92);
    outer.position.set(0, 0, -0.01);
    frameGroup.add(outer);
    
    group.add(frameGroup);

    // 3. Heart Decoration on Top of the Diamond
    const heartGroup = new THREE.Group();
    heartGroup.position.set(0, 0.54, 0);
    heartGroup.scale.set(0.5, 0.5, 0.5);
    // Heart lobes
    const lobeGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const leftLobe = new THREE.Mesh(lobeGeo, goldMat);
    leftLobe.position.set(-0.08, 0.08, 0);
    heartGroup.add(leftLobe);
    const rightLobe = new THREE.Mesh(lobeGeo, goldMat);
    rightLobe.position.set(0.08, 0.08, 0);
    heartGroup.add(rightLobe);
    // Heart bottom
    const heartConeGeo = new THREE.ConeGeometry(0.15, 0.26, 6);
    heartConeGeo.rotateX(Math.PI);
    heartConeGeo.translate(0, -0.08, 0);
    const heartCone = new THREE.Mesh(heartConeGeo, goldMat);
    heartGroup.add(heartCone);
    group.add(heartGroup);

    // 4. Hanging Teardrop Gem Decoration at the bottom
    const dropGroup = new THREE.Group();
    dropGroup.position.set(0, -0.6, 0);
    // Link loop
    const linkGeo = new THREE.TorusGeometry(0.05, 0.015, 4, 12);
    const link = new THREE.Mesh(linkGeo, goldMat);
    dropGroup.add(link);
    // Teardrop gem
    const dropGeo = new THREE.ConeGeometry(0.09, 0.22, 8);
    dropGeo.rotateX(Math.PI);
    dropGeo.translate(0, -0.12, 0);
    const dropGem = new THREE.Mesh(dropGeo, gemMat);
    dropGroup.add(dropGem);
    group.add(dropGroup);

    // Sparkling particles orbiting the gem
    const sparkleGeo = new THREE.OctahedronGeometry(0.065, 0);
    const sparkleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffdd44,
      emissiveIntensity: 3.0,
      flatShading: true,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const sMesh = new THREE.Mesh(sparkleGeo, sparkleMat);
      sMesh.position.set(
        Math.cos(angle) * 0.95,
        Math.sin(angle * 2) * 0.25,
        Math.sin(angle) * 0.95
      );
      group.add(sMesh);
    }

    // Main GI light — gold illumination
    const gemLight = new THREE.PointLight(0xffaa00, 6.0, 20, 1.5);
    group.add(gemLight);
    this.gemLight = gemLight;

    // Bounce lights on walls
    const bLight1 = new THREE.PointLight(0xff8800, 2.0, 12, 2);
    bLight1.position.set(-3, 0, 2);
    group.add(bLight1);
    const bLight2 = new THREE.PointLight(0xff8800, 2.0, 12, 2);
    bLight2.position.set(3, 0, 2);
    group.add(bLight2);

    this.scene.add(group);
    this.objects.push(group);
    this.gemGroup = group;
  }

  // ========= UPDATE =========

  update(delta) {
    this.gemTime += delta;

    // Animate crystals (idle float)
    this.crystalMeshes.forEach((c, i) => {
      c.gem.rotation.y += delta * 0.8;
      c.group.position.y = CRYSTAL_POSITIONS[i].y + 1.0 + Math.sin(this.gemTime * 1.5 + i) * 0.06;
    });

    // Animate gem (if visible)
    if (this.gemGroup && this.gemGroup.visible) {
      this.gemGroup.rotation.y += delta * 1.5;
      this.gemGroup.position.y  = 2.5 + Math.sin(this.gemTime * 2) * 0.15;
      if (this.gemLight) this.gemLight.intensity = 5.5 + Math.sin(this.gemTime * 3) * 0.5;
    }

    // ---- Puzzle state machine ----
    if (this.puzzleState === 'showing') {
      this._updateShowing(delta);
    } else if (this.puzzleState === 'player_input') {
      this._updatePlayerInput();
    } else if (this.puzzleState === 'wrong') {
      // handled by timer in _handleWrong
    } else if (this.puzzleState === 'solved') {
      // check gem collect
      if (!this.gemCollected && this.gemGroup) {
        const dist = this.player.pos.distanceTo(
          new THREE.Vector3(0, 0, -6)
        );
        if (dist < 4.5) {
          this.ui.showInteractPrompt('✦ Gold Soul Gem 발견!');
          if (dist < 3.0) this._collectGem();
        } else {
          this.ui.hideInteractPrompt();
        }
      }
    }

    // Move player
    this.player.update(delta, this.colliders, 0);
  }

  // ---- Show sequence ----
  // Two-phase: 'on' (crystal lit for 0.65s) → 'off' gap (0.3s) → next crystal
  // The gap ensures duplicate consecutive crystals are clearly distinguishable.

  _updateShowing(delta) {
    this.showTimer -= delta;
    if (this.showTimer > 0) return;

    if (this.showPhase === 'on') {
      // Crystal was ON — turn it off, start the gap
      const idx = this.sequence[this.showIndex];
      this._setCrystalLit(idx, false);
      this.ui.highlightSeqGem(this.showIndex, 'off');
      this.showIndex++;
      this.showPhase = 'off';
      this.showTimer = 0.30;   // gap between crystals (visible even if same crystal repeats)
    } else {
      // Gap ended (or initial wait ended) — light up next crystal
      if (this.showIndex >= SEQUENCE_LENGTH) {
        // All crystals shown — player's turn
        this.puzzleState = 'player_input';
        this.inputSeq    = [];
        this.ui.setPuzzleMessage('수정을 같은 순서로 터치하라!');
        this.nearCrystal = -1;
        return;
      }
      const idx = this.sequence[this.showIndex];
      this._setCrystalLit(idx, true);
      this.ui.highlightSeqGem(this.showIndex, 'on');
      this.ui.setPuzzleMessage(`순서 ${this.showIndex + 1} / ${SEQUENCE_LENGTH}`);
      this.showPhase = 'on';
      this.showTimer = 0.65;   // how long each crystal stays lit
    }
  }

  // ---- Player input ----

  _updatePlayerInput() {
    // Find nearest crystal
    this.nearCrystal = -1;
    let nearDist = Infinity;
    CRYSTAL_POSITIONS.forEach((pos, i) => {
      const dist = this.player.pos.distanceTo(
        new THREE.Vector3(pos.x, this.player.pos.y, pos.z)
      );
      if (dist < 2.2 && dist < nearDist) {
        nearDist     = dist;
        this.nearCrystal = i;
      }
    });

    if (this.nearCrystal >= 0) {
      this.ui.showInteractPrompt(`[ E ] ${CRYSTAL_LABELS[this.nearCrystal]} 수정 터치`);

      if (this.player.pressedE) {
        const chosen = this.nearCrystal;
        const expected = this.sequence[this.inputSeq.length];

        // Flash chosen crystal
        this._flashCrystal(chosen);

        if (chosen === expected) {
          this.inputSeq.push(chosen);
          this.ui.highlightSeqGem(this.inputSeq.length - 1, 'correct');

          if (this.inputSeq.length >= SEQUENCE_LENGTH) {
            this.roundsCleared++;
            if (this.roundsCleared < 3) {
              this.puzzleState = 'waiting_next_round';
              this.ui.setPuzzleMessage(`✦ Round ${this.roundsCleared} 통과! ✦`);
              setTimeout(() => {
                if (!this._disposed) {
                  this._startNewRound();
                }
              }, 1500);
            } else {
              // Correct round 3! Solved completely!
              this.puzzleState = 'solved';
              this.ui.setPuzzleMessage('✦ 성공! Gold Soul Gem이 나타났다!');
              this.ui.setObjective('Gold Soul Gem을 획득하라!');
              if (this.gemGroup) this.gemGroup.visible = true;
              this.ui.hideInteractPrompt();
            }
          } else {
            this.ui.setPuzzleMessage(`정답! (${this.inputSeq.length}/${SEQUENCE_LENGTH})`);
          }
        } else {
          // Wrong
          this._handleWrong();
        }
      }
    } else {
      this.ui.showInteractPrompt('수정에 가까이 다가가라');
    }
  }

  _flashCrystal(idx) {
    this._setCrystalLit(idx, true);
    setTimeout(() => this._setCrystalLit(idx, false), 250);
  }

  _setCrystalLit(idx, on) {
    const c = this.crystalMeshes[idx];
    if (!c) return;
    c.gemMat.emissiveIntensity = on ? 2.5 : 0.3;
    c.light.intensity = on ? 3.0 : 0;
  }

  _handleWrong() {
    this.puzzleState = 'wrong';
    this.ui.setPuzzleMessage('틀렸다! 다시 시도...');

    // Flash ALL crystals red briefly to signal wrong answer
    this.crystalMeshes.forEach((c) => {
      c.gemMat.emissiveIntensity = 2.0;
      c.light.intensity = 2.0;
    });
    setTimeout(() => {
      if (this._disposed) return;
      this.crystalMeshes.forEach((c) => {
        c.gemMat.emissiveIntensity = 0.3;
        c.light.intensity = 0;
      });
    }, 350);

    // Mark incorrect inputs in UI
    for (let i = 0; i < this.inputSeq.length; i++) {
      this.ui.highlightSeqGem(i, 'wrong');
    }

    // BUG FIX: replay the SAME sequence (not a new one) so the player
    // can learn from their mistake. New sequence only after a solve.
    setTimeout(() => {
      if (this._disposed) return;
      this.ui.resetSeqGems();
      this.ui.setSeqColors(this.sequence); // Show colors again!
      
      if (this._roundTimeout) clearTimeout(this._roundTimeout);
      this._roundTimeout = setTimeout(() => {
        if (!this._disposed) {
          this.ui.clearSeqColors();
        }
      }, 2000);

      // Keep this.sequence unchanged — replay same order
      this.inputSeq   = [];
      this.showIndex  = 0;
      this.showPhase  = 'waiting';
      this.showTimer  = 2.5; // wait 2.5s (2s show + 0.5s pause)
      this.puzzleState = 'showing';
      this.ui.setPuzzleMessage('다시 보여줄게! 잘 봐...');
    }, 1500);
  }

  _collectGem() {
    if (this.gemCollected || this._disposed) return;
    this.gemCollected = true;

    if (this.gemGroup) this.scene.remove(this.gemGroup);

    this.ui.showPuzzleUI(false);
    this.gm.collectGem('gold');
    // Generate fresh sequence for potential re-entry (shouldn't happen, but safe)
    this._generateSequence();

    setTimeout(() => {
      if (!this._disposed) this.gm.transitionTo('hub');
    }, 1800);
  }

  // ========= DISPOSE =========

  dispose() {
    this._disposed = true;   // guard: prevents setTimeout callbacks from firing after dispose
    if (this._roundTimeout) clearTimeout(this._roundTimeout);
    this.ui.showPuzzleUI(false);
    this.ui.resetSeqGems();

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
    this.objects        = [];
    this.colliders      = [];
    this.crystalMeshes  = [];
    this.crystalLights  = [];
  }
}
