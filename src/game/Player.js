/**
 * Player.js
 * Third-person camera, WASD movement, jump, sprint, E interaction.
 * player.pos = feet position (bottom of player AABB).
 */
import * as THREE from 'three';
import { moveAndCollide, PLAYER_HALF_W, PLAYER_HEIGHT } from '../utils/CollisionUtils.js';

const WALK_SPEED  = 5.5;
const SPRINT_SPEED = 9.5;
const JUMP_VEL    = 10;
const CAM_SENSITIVITY = 0.002;

export class Player {
  constructor(scene, camera) {
    this.scene  = scene;
    this.camera = camera;

    // Physics state
    this.pos      = new THREE.Vector3(0, 0, 0);
    this.vel      = new THREE.Vector3(0, 0, 0);
    this.onGround = false;
    this.jumpPressed = false;

    // Sparkles
    this.sparkles = [];
    this.gemTime  = 0;

    // Camera
    this.cameraYaw      = 0;        // radians — horizontal orbit
    this.cameraPitch    = 0.35;     // radians — vertical orbit (positive = looking down)
    this.cameraDistance = 6;        // units behind player
    this.cameraTargetY  = 1.0;      // look-at offset from feet

    // Input
    this.keys = {};
    this.pressedE = false;          // true for ONE frame when E is pressed
    this._eDown   = false;

    // Pointer lock
    this.pointerLocked = false;
    this.controlsDisabled = false;

    // Mesh
    this.mesh = this._buildMesh();
    scene.add(this.mesh);

    this._setupInput();
  }

  // -------- Mesh --------

  _buildMesh() {
    const root = new THREE.Group();

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff88bb,
      roughness: 0.4,
      metalness: 0.1,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x554400,
      metalness: 0.9,
      roughness: 0.1
    });

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0x550000,
      metalness: 0.4,
      roughness: 0.3
    });

    const innerHeartMat = new THREE.MeshStandardMaterial({
      color: 0xff33aa,
      emissive: 0xff0066,
      emissiveIntensity: 2.5,
      metalness: 0.8,
      roughness: 0.05,
      flatShading: true
    });

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8
    });

    // 1. Dress / body
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.7, 10);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    root.add(body);

    // 2. Skirt frills (flared tiered skirt)
    // Upper tier (pink)
    const skirtGeo1 = new THREE.CylinderGeometry(0.28, 0.48, 0.35, 12, 1, true);
    const skirtMat1 = new THREE.MeshStandardMaterial({
      color: 0xff4499,
      emissive: 0x440020,
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const skirt1 = new THREE.Mesh(skirtGeo1, skirtMat1);
    skirt1.position.y = 0.55;
    skirt1.castShadow = true;
    root.add(skirt1);

    // Lower tier (white frills underneath)
    const skirtGeo2 = new THREE.CylinderGeometry(0.26, 0.52, 0.45, 12, 1, true);
    const skirtMat2 = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      roughness: 0.5,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    const skirt2 = new THREE.Mesh(skirtGeo2, skirtMat2);
    skirt2.position.y = 0.5;
    skirt2.castShadow = true;
    root.add(skirt2);

    // Gold waist belt
    const beltGeo = new THREE.TorusGeometry(0.24, 0.02, 8, 16);
    const belt = new THREE.Mesh(beltGeo, goldMat);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.8;
    root.add(belt);

    // Chest bow (large pink bow with heart brooch and wings)
    const ribbonGeo = new THREE.ConeGeometry(0.07, 0.13, 5);
    ribbonGeo.rotateZ(Math.PI / 2);

    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, 0.85, 0.22);
    
    // Left ribbon loop
    const leftChestRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    leftChestRibbon.position.set(-0.08, 0, 0);
    leftChestRibbon.rotation.y = Math.PI / 6;
    leftChestRibbon.scale.set(1.45, 1.45, 1.45);
    bowGroup.add(leftChestRibbon);

    // Right ribbon loop
    const rightChestRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    rightChestRibbon.position.set(0.08, 0, 0);
    rightChestRibbon.rotation.y = -Math.PI / 6 + Math.PI;
    rightChestRibbon.scale.set(1.45, 1.45, 1.45);
    bowGroup.add(rightChestRibbon);

    // Heart Brooch in center of chest bow
    const broochHeartGeo = new THREE.SphereGeometry(0.038, 6, 6);
    const broochHeart = new THREE.Mesh(broochHeartGeo, innerHeartMat);
    broochHeart.position.set(0, 0, 0.02);
    bowGroup.add(broochHeart);
    
    // Tiny white wings on chest brooch
    const miniWingGeo = new THREE.BoxGeometry(0.06, 0.025, 0.01);
    const leftMiniWing = new THREE.Mesh(miniWingGeo, wingMat);
    leftMiniWing.position.set(-0.05, 0.01, 0.01);
    leftMiniWing.rotation.z = Math.PI / 10;
    bowGroup.add(leftMiniWing);
    
    const rightMiniWing = new THREE.Mesh(miniWingGeo, wingMat);
    rightMiniWing.position.set(0.05, 0.01, 0.01);
    rightMiniWing.rotation.z = -Math.PI / 10;
    bowGroup.add(rightMiniWing);
    
    root.add(bowGroup);

    // Large waist bow at the back
    const backBowGroup = new THREE.Group();
    backBowGroup.position.set(0, 0.7, -0.2);
    backBowGroup.rotation.y = Math.PI; // face backward
    
    const backLobeL = new THREE.Mesh(ribbonGeo, ribbonMat);
    backLobeL.position.set(-0.11, 0, 0);
    backLobeL.rotation.y = Math.PI / 6;
    backLobeL.scale.set(2.0, 2.0, 2.0);
    backBowGroup.add(backLobeL);
    
    const backLobeR = new THREE.Mesh(ribbonGeo, ribbonMat);
    backLobeR.position.set(0.11, 0, 0);
    backLobeR.rotation.y = -Math.PI / 6 + Math.PI;
    backLobeR.scale.set(2.0, 2.0, 2.0);
    backBowGroup.add(backLobeR);
    
    root.add(backBowGroup);

    // 3. Legs (with white stockings and thigh ribbon rings)
    const legMat = new THREE.MeshStandardMaterial({ color: 0xffe6d5, roughness: 0.6 }); // skin color
    const stockingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); // white stockings
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xff4499, roughness: 0.3 }); // pink shoes
  
    [-0.09, 0.09].forEach(xOff => {
      const legGroup = new THREE.Group();
      legGroup.position.x = xOff;
      
      // Stocking leg cylinder
      const legGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.5, 8);
      const legMesh = new THREE.Mesh(legGeo, stockingMat);
      legMesh.position.y = 0.25;
      legMesh.castShadow = true;
      legGroup.add(legMesh);
      
      // Pink ribbon band on stocking top
      const thighRibbonGeo = new THREE.TorusGeometry(0.068, 0.012, 6, 12);
      const thighRibbon = new THREE.Mesh(thighRibbonGeo, ribbonMat);
      thighRibbon.rotation.x = Math.PI / 2;
      thighRibbon.position.y = 0.42;
      legGroup.add(thighRibbon);

      // Shoe box
      const shoeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.14);
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(0, 0.04, 0.04);
      shoe.castShadow = true;
      legGroup.add(shoe);
      
      root.add(legGroup);
    });

    // 4. Head
    const headGeo = new THREE.SphereGeometry(0.23, 10, 10);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffddcc, roughness: 0.6 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.38;
    head.castShadow = true;
    root.add(head);

    // Big shiny pink winking eyes
    const eyeMatLeft = new THREE.MeshBasicMaterial({ color: 0xff3388 });
    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMatLeft);
    leftEye.position.set(-0.08, 1.4, 0.2);
    leftEye.scale.set(1, 1.4, 0.5); // vertical oval
    root.add(leftEye);
    
    // Left eye pupil highlight
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.012, 6, 6);
    const leftPupil = new THREE.Mesh(pupilGeo, whiteMat);
    leftPupil.position.set(-0.08, 1.43, 0.22);
    root.add(leftPupil);
    
    // Right eye winking eyelid (inverted smile arch)
    const winkMat = new THREE.MeshBasicMaterial({ color: 0x551122 });
    const winkGeo = new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI);
    const rightEye = new THREE.Mesh(winkGeo, winkMat);
    rightEye.position.set(0.08, 1.4, 0.22);
    rightEye.rotation.z = Math.PI; // flip to arch downward
    root.add(rightEye);

    // Cheek blush
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff5577, transparent: true, opacity: 0.65 });
    const blushGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const leftBlush = new THREE.Mesh(blushGeo, blushMat);
    leftBlush.position.set(-0.13, 1.34, 0.18);
    root.add(leftBlush);

    const rightBlush = new THREE.Mesh(blushGeo, blushMat);
    rightBlush.position.set(0.13, 1.34, 0.18);
    root.add(rightBlush);

    // 5. Hair
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0xff77aa,
      emissive: 0x220010,
      roughness: 0.4,
      metalness: 0.2
    });

    // Top / base hair
    const backHairGeo = new THREE.SphereGeometry(0.23, 10, 10);
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.position.set(0, 1.42, -0.06);
    backHair.castShadow = true;
    root.add(backHair);

    const frontHairGeo = new THREE.SphereGeometry(0.21, 10, 10);
    const frontHair = new THREE.Mesh(frontHairGeo, hairMat);
    frontHair.position.set(0, 1.48, 0.04);
    root.add(frontHair);

    // Pigtail bases (side buns)
    [-0.2, 0.2].forEach(xOff => {
      const bunGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const bun = new THREE.Mesh(bunGeo, hairMat);
      bun.position.set(xOff, 1.48, 0.05);
      bun.castShadow = true;
      root.add(bun);
    });

    // Pigtails (long cones)
    const tailGeo = new THREE.ConeGeometry(0.08, 0.6, 8);
    tailGeo.translate(0, -0.3, 0); // origin to top of cone
    
    const leftTail = new THREE.Mesh(tailGeo, hairMat);
    leftTail.position.set(-0.22, 1.48, 0.05);
    leftTail.rotation.z = Math.PI / 7;
    leftTail.rotation.x = Math.PI / 15;
    leftTail.castShadow = true;
    root.add(leftTail);

    const rightTail = new THREE.Mesh(tailGeo, hairMat);
    rightTail.position.set(0.22, 1.48, 0.05);
    rightTail.rotation.z = -Math.PI / 7;
    rightTail.rotation.x = Math.PI / 15;
    rightTail.castShadow = true;
    root.add(rightTail);

    // Hair Accessories (white wings + pink hearts)
    const wingBoxGeo = new THREE.BoxGeometry(0.12, 0.05, 0.02);
    
    // Left wing accessory
    const leftAccessoryWing = new THREE.Mesh(wingBoxGeo, wingMat);
    leftAccessoryWing.position.set(-0.28, 1.56, 0.08);
    leftAccessoryWing.rotation.z = Math.PI / 6;
    leftAccessoryWing.rotation.y = -Math.PI / 6;
    root.add(leftAccessoryWing);
    
    // Right wing accessory
    const rightAccessoryWing = new THREE.Mesh(wingBoxGeo, wingMat);
    rightAccessoryWing.position.set(0.28, 1.56, 0.08);
    rightAccessoryWing.rotation.z = -Math.PI / 6;
    rightAccessoryWing.rotation.y = Math.PI / 6;
    root.add(rightAccessoryWing);
    
    // Small pink heart in center of buns
    const bunHeartGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const leftBunHeart = new THREE.Mesh(bunHeartGeo, ribbonMat);
    leftBunHeart.position.set(-0.22, 1.53, 0.09);
    root.add(leftBunHeart);
    
    const rightBunHeart = new THREE.Mesh(bunHeartGeo, ribbonMat);
    rightBunHeart.position.set(0.22, 1.53, 0.09);
    root.add(rightBunHeart);

    // 6. Magical Star-Heart Wand in right hand
    const wandGroup = new THREE.Group();
    wandGroup.position.set(0.4, 0.7, 0.15);
    wandGroup.rotation.x = -Math.PI / 6;
    wandGroup.rotation.z = -Math.PI / 12;

    // Pink Shaft
    const stickGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.55, 8);
    const stickMat = new THREE.MeshStandardMaterial({
      color: 0xff66aa,
      emissive: 0x330010,
      metalness: 0.3,
      roughness: 0.4
    });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = -0.15;
    wandGroup.add(stick);

    // Gold tip at bottom of shaft
    const tipGeo = new THREE.ConeGeometry(0.025, 0.06, 8);
    tipGeo.rotateX(Math.PI);
    const tip = new THREE.Mesh(tipGeo, goldMat);
    tip.position.y = -0.425;
    wandGroup.add(tip);

    // Large pink ribbon bow on wand
    const wandBowL = new THREE.Mesh(ribbonGeo, ribbonMat);
    wandBowL.position.set(-0.06, 0.1, 0);
    wandBowL.scale.set(0.8, 0.8, 0.8);
    wandGroup.add(wandBowL);
    const wandBowR = new THREE.Mesh(ribbonGeo, ribbonMat);
    wandBowR.position.set(0.06, 0.1, 0);
    wandBowR.scale.set(0.8, 0.8, 0.8);
    wandBowR.rotation.y = Math.PI;
    wandGroup.add(wandBowR);

    // Wand gold heart frame enclosing pink heart
    const wandHead = new THREE.Group();
    wandHead.position.y = 0.22;

    // Gold outer heart frame
    const goldLobeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const goldLobeL = new THREE.Mesh(goldLobeGeo, goldMat);
    goldLobeL.position.set(-0.05, 0.05, 0);
    wandHead.add(goldLobeL);
    const goldLobeR = new THREE.Mesh(goldLobeGeo, goldMat);
    goldLobeR.position.set(0.05, 0.05, 0);
    wandHead.add(goldLobeR);
    const goldConeGeo = new THREE.ConeGeometry(0.09, 0.16, 8);
    goldConeGeo.rotateX(Math.PI);
    goldConeGeo.translate(0, -0.06, 0);
    const goldCone = new THREE.Mesh(goldConeGeo, goldMat);
    wandHead.add(goldCone);

    // Inner pink heart
    const innerHeartLobeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const innerLobeL = new THREE.Mesh(innerHeartLobeGeo, innerHeartMat);
    innerLobeL.position.set(-0.035, 0.04, 0.02);
    wandHead.add(innerLobeL);
    const innerLobeR = new THREE.Mesh(innerHeartLobeGeo, innerHeartMat);
    innerLobeR.position.set(0.035, 0.04, 0.02);
    wandHead.add(innerLobeR);
    const innerConeGeo = new THREE.ConeGeometry(0.065, 0.12, 8);
    innerConeGeo.rotateX(Math.PI);
    innerConeGeo.translate(0, -0.04, 0.02);
    const innerCone = new THREE.Mesh(innerConeGeo, innerHeartMat);
    wandHead.add(innerCone);

    // Gold star accessory underneath the heart frame
    const starGeo = new THREE.OctahedronGeometry(0.04, 0);
    const star = new THREE.Mesh(starGeo, goldMat);
    star.position.y = -0.09;
    wandHead.add(star);

    wandGroup.add(wandHead);

    // Point light on the wand star
    const wandLight = new THREE.PointLight(0xff00aa, 1.2, 3, 2);
    wandLight.position.set(0, 0.22, 0);
    wandGroup.add(wandLight);

    root.add(wandGroup);

    // Kirakira Sparkles floating around player
    const sparkleMat = new THREE.MeshStandardMaterial({
      color: 0xfff277,
      emissive: 0xffd700,
      emissiveIntensity: 2.5,
      metalness: 0.9,
      roughness: 0.05
    });
    const sparkleGeo = new THREE.OctahedronGeometry(0.05, 0);
    const sparklePositions = [
      { pos: new THREE.Vector3(-0.45, 1.2, 0.25), speed: 2.2, offset: 0 },
      { pos: new THREE.Vector3(0.45, 1.5, -0.3), speed: 1.8, offset: Math.PI * 0.5 },
      { pos: new THREE.Vector3(-0.2, 1.7, -0.45), speed: 2.5, offset: Math.PI },
      { pos: new THREE.Vector3(0.5, 0.9, 0.35), speed: 1.5, offset: Math.PI * 1.5 }
    ];
    sparklePositions.forEach(sp => {
      const sMesh = new THREE.Mesh(sparkleGeo, sparkleMat);
      sMesh.position.copy(sp.pos);
      root.add(sMesh);
      this.sparkles.push({
        mesh: sMesh,
        basePos: sp.pos.clone(),
        speed: sp.speed,
        offset: sp.offset
      });
    });

    return root;
  }

  // -------- Input --------

  _setupInput() {
    document.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE' && !this._eDown) {
        this.pressedE = true;
        this._eDown   = true;
      }
    });
    document.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      if (e.code === 'KeyE') this._eDown = false;
      if (e.code === 'Space') this.jumpPressed = false;
    });

    document.addEventListener('mousemove', e => {
      if (!this.pointerLocked) return;
      this.cameraYaw   -= e.movementX * CAM_SENSITIVITY;
      this.cameraPitch -= e.movementY * CAM_SENSITIVITY;
      this.cameraPitch  = Math.max(-0.4, Math.min(1.1, this.cameraPitch));
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === document.getElementById('game-canvas');
    });

    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.addEventListener('click', () => {
        if (this.pointerLocked) return;
        const dialogue = document.getElementById('dialogue-box-container');
        const dialogueVisible = dialogue && dialogue.style.display === 'flex';
        const ending = document.getElementById('ending-screen');
        const endingVisible = ending && ending.style.display === 'flex';
        
        if (!dialogueVisible && !endingVisible) {
          this.requestPointerLock();
        }
      });
    }
  }

  requestPointerLock() {
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.requestPointerLock();
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // -------- Teleport --------

  teleportTo(x, y, z, yaw = 0) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.cameraYaw   = yaw;
    this.cameraPitch = 0.35;
    this.onGround    = false;
    this.jumpPressed = false;
    // Immediately apply camera position so first rendered frame is correct
    this._updateCamera();
  }

  // -------- Update --------

  /**
   * @param {number} delta
   * @param {Array}  colliders  - array of AABB box objects
   * @param {number} [groundY=0]
   */
  update(delta, colliders, groundY = 0) {
    if (this.controlsDisabled) {
      this.vel.set(0, 0, 0);
      moveAndCollide(this, colliders, delta, groundY);
      this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
      this._updateCamera();
      this.pressedE = false;
      return;
    }

    // Directional vectors from camera yaw
    const yaw = this.cameraYaw;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));

    // Movement input
    const moveDir = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    moveDir.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  moveDir.sub(forward);
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  moveDir.sub(right);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir.add(right);

    const speed = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? SPRINT_SPEED : WALK_SPEED;
    const friction = this.onGround ? 0.78 : 0.94;

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize();
      this.vel.x = moveDir.x * speed;
      this.vel.z = moveDir.z * speed;
      // Face direction of movement
      this.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    } else {
      this.vel.x *= friction;
      this.vel.z *= friction;
      if (Math.abs(this.vel.x) < 0.01) this.vel.x = 0;
      if (Math.abs(this.vel.z) < 0.01) this.vel.z = 0;
    }

    // Jump
    if ((this.keys['Space']) && this.onGround && !this.jumpPressed) {
      this.vel.y   = JUMP_VEL;
      this.onGround = false;
      this.jumpPressed = true;
    }
    if (!this.keys['Space']) {
      this.jumpPressed = false;
    }

    // Collision + gravity
    moveAndCollide(this, colliders, delta, groundY);

    // Update mesh position
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);

    // Animate sparkles
    if (this.sparkles && this.sparkles.length > 0) {
      this.gemTime += delta;
      this.sparkles.forEach(sp => {
        sp.mesh.position.y = sp.basePos.y + Math.sin(this.gemTime * sp.speed + sp.offset) * 0.12;
        sp.mesh.rotation.x += delta * 2.0;
        sp.mesh.rotation.y += delta * 1.5;
      });
    }

    // Update camera
    this._updateCamera();

    // Reset single-frame flags
    this.pressedE = false;
  }

  _updateCamera() {
    const dist  = this.cameraDistance;
    const pitch = this.cameraPitch;
    const yaw   = this.cameraYaw;

    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    // Camera orbits around a point above player's feet
    const targetX = this.pos.x;
    const targetY = this.pos.y + this.cameraTargetY;
    const targetZ = this.pos.z;

    const camX = targetX + Math.sin(yaw) * dist * cosP;
    const camY = targetY + sinP * dist;
    const camZ = targetZ + Math.cos(yaw) * dist * cosP;

    this.camera.position.set(camX, Math.max(camY, targetY - 1.5), camZ);
    this.camera.lookAt(targetX, targetY, targetZ);
  }

  /**
   * Simple camera push-forward if inside a wall box.
   * Call after update() to prevent camera clipping.
   * @param {Array} colliders
   */
  fixCameraCollision(colliders) {
    const cam = this.camera;
    for (const box of colliders) {
      if (
        cam.position.x > box.minX && cam.position.x < box.maxX &&
        cam.position.y > box.minY && cam.position.y < box.maxY &&
        cam.position.z > box.minZ && cam.position.z < box.maxZ
      ) {
        // Lerp camera toward player
        const target = new THREE.Vector3(this.pos.x, this.pos.y + this.cameraTargetY, this.pos.z);
        cam.position.lerp(target, 0.6);
        cam.lookAt(target);
        break;
      }
    }
  }

  // -------- Cleanup --------

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
  }
}
