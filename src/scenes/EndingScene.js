/**
 * EndingScene.js
 * 3D cinematic ending scene where the magical girl character sprouts wings
 * and flies up into the clouds while ending credits scroll.
 */
import * as THREE from 'three';

export class EndingScene {
  constructor(gm, scene, player, ui) {
    this.gm     = gm;
    this.scene  = scene;
    this.player = player;
    this.ui     = ui;
    this.camera = gm.camera;

    this.objects   = [];
    this.clouds    = [];
    this.sparkles  = [];
    this.time      = 0;
    this.creditsShown = false;
    
    this.characterGroup = null;
    this.leftWing       = null;
    this.rightWing      = null;
  }

  init() {
    const s = this.scene;
    this.time = 0;
    this.creditsShown = false;

    // Hide original player mesh
    if (this.player && this.player.mesh) {
      this.player.mesh.visible = false;
    }

    // Exit pointer lock so user can view ending
    this.player.exitPointerLock();
    this.ui.hideInteractPrompt();

    // Sky - dark magical twilight purple
    s.background = new THREE.Color(0x30153c);
    s.fog = new THREE.FogExp2(0x30153c, 0.025);

    // ---- Lights ----
    const ambient = new THREE.AmbientLight(0xffd5e5, 0.4);
    s.add(ambient);
    this.objects.push(ambient);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.5);
    mainLight.position.set(5, 15, 5);
    s.add(mainLight);
    this.objects.push(mainLight);

    // ---- Build Character ----
    this.characterGroup = this._buildCharacter();
    // Start lower to fly upwards
    this.characterGroup.position.set(0, -1.5, 0);
    s.add(this.characterGroup);
    this.objects.push(this.characterGroup);

    // ---- Build Wings ----
    this._buildWings();
    // Start with tiny scale representing wingless initial state
    this.leftWing.scale.set(0.001, 0.001, 0.001);
    this.rightWing.scale.set(0.001, 0.001, 0.001);

    // ---- Build Clouds ----
    this._buildClouds();

    // ---- Build Sparkles ----
    this._buildSparkles();

    // Initial camera position (focused close up on character back)
    this.camera.position.set(0, 0.8, -2.5);
    this.camera.lookAt(0, 1.2, 0);
  }

  _buildCharacter() {
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
      emissiveIntensity: 0.5,
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
    
    const leftChestRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    leftChestRibbon.position.set(-0.08, 0, 0);
    leftChestRibbon.rotation.y = Math.PI / 6;
    leftChestRibbon.scale.set(1.45, 1.45, 1.45);
    bowGroup.add(leftChestRibbon);

    const rightChestRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    rightChestRibbon.position.set(0.08, 0, 0);
    rightChestRibbon.rotation.y = -Math.PI / 6 + Math.PI;
    rightChestRibbon.scale.set(1.45, 1.45, 1.45);
    bowGroup.add(rightChestRibbon);

    const broochHeartGeo = new THREE.SphereGeometry(0.038, 6, 6);
    const broochHeart = new THREE.Mesh(broochHeartGeo, innerHeartMat);
    broochHeart.position.set(0, 0, 0.02);
    bowGroup.add(broochHeart);
    
    const leftMiniWing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.01), wingMat);
    leftMiniWing.position.set(-0.05, 0.01, 0.01);
    leftMiniWing.rotation.z = Math.PI / 10;
    bowGroup.add(leftMiniWing);
    
    const rightMiniWing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.01), wingMat);
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

    // 3. Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0xffe6d5, roughness: 0.6 });
    const stockingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xff4499, roughness: 0.3 });
  
    [-0.09, 0.09].forEach(xOff => {
      const legGroup = new THREE.Group();
      legGroup.position.x = xOff;
      
      const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.5, 8), stockingMat);
      legMesh.position.y = 0.25;
      legGroup.add(legMesh);
      
      const thighRibbon = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.012, 6, 12), ribbonMat);
      thighRibbon.rotation.x = Math.PI / 2;
      thighRibbon.position.y = 0.42;
      legGroup.add(thighRibbon);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.14), shoeMat);
      shoe.position.set(0, 0.04, 0.04);
      legGroup.add(shoe);
      
      root.add(legGroup);
    });

    // 4. Head
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffddcc, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 10), headMat);
    head.position.y = 1.38;
    root.add(head);

    // Eyes
    const eyeMatLeft = new THREE.MeshBasicMaterial({ color: 0xff3388 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMatLeft);
    leftEye.position.set(-0.08, 1.4, 0.2);
    leftEye.scale.set(1, 1.4, 0.5);
    root.add(leftEye);
    
    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    leftPupil.position.set(-0.08, 1.43, 0.22);
    root.add(leftPupil);
    
    const rightEye = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x551122 }));
    rightEye.position.set(0.08, 1.4, 0.22);
    rightEye.rotation.z = Math.PI;
    root.add(rightEye);

    // Cheek blush
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff5577, transparent: true, opacity: 0.65 });
    const leftBlush = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), blushMat);
    leftBlush.position.set(-0.13, 1.34, 0.18);
    root.add(leftBlush);

    const rightBlush = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), blushMat);
    rightBlush.position.set(0.13, 1.34, 0.18);
    root.add(rightBlush);

    // 5. Hair
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0xff77aa,
      emissive: 0x220010,
      roughness: 0.4,
      metalness: 0.2
    });

    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 10), hairMat);
    backHair.position.set(0, 1.42, -0.06);
    root.add(backHair);

    const frontHair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), hairMat);
    frontHair.position.set(0, 1.48, 0.04);
    root.add(frontHair);

    [-0.2, 0.2].forEach(xOff => {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), hairMat);
      bun.position.set(xOff, 1.48, 0.05);
      root.add(bun);
    });

    const tailGeo = new THREE.ConeGeometry(0.08, 0.6, 8);
    tailGeo.translate(0, -0.3, 0);
    
    const leftTail = new THREE.Mesh(tailGeo, hairMat);
    leftTail.position.set(-0.22, 1.48, 0.05);
    leftTail.rotation.z = Math.PI / 7;
    leftTail.rotation.x = Math.PI / 15;
    root.add(leftTail);

    const rightTail = new THREE.Mesh(tailGeo, hairMat);
    rightTail.position.set(0.22, 1.48, 0.05);
    rightTail.rotation.z = -Math.PI / 7;
    rightTail.rotation.x = Math.PI / 15;
    root.add(rightTail);

    // Hair Accessories (white wings + pink hearts)
    const wingBoxGeo = new THREE.BoxGeometry(0.12, 0.05, 0.02);
    
    const leftAccessoryWing = new THREE.Mesh(wingBoxGeo, wingMat);
    leftAccessoryWing.position.set(-0.28, 1.56, 0.08);
    leftAccessoryWing.rotation.z = Math.PI / 6;
    leftAccessoryWing.rotation.y = -Math.PI / 6;
    root.add(leftAccessoryWing);
    
    const rightAccessoryWing = new THREE.Mesh(wingBoxGeo, wingMat);
    rightAccessoryWing.position.set(0.28, 1.56, 0.08);
    rightAccessoryWing.rotation.z = -Math.PI / 6;
    rightAccessoryWing.rotation.y = Math.PI / 6;
    root.add(rightAccessoryWing);
    
    const leftBunHeart = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), ribbonMat);
    leftBunHeart.position.set(-0.22, 1.53, 0.09);
    root.add(leftBunHeart);
    
    const rightBunHeart = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), ribbonMat);
    rightBunHeart.position.set(0.22, 1.53, 0.09);
    root.add(rightBunHeart);

    // 6. Magical Star-Heart Wand in right hand
    const wandGroup = new THREE.Group();
    wandGroup.position.set(0.4, 0.7, 0.15);
    wandGroup.rotation.x = -Math.PI / 6;
    wandGroup.rotation.z = -Math.PI / 12;

    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 8), new THREE.MeshStandardMaterial({
      color: 0xff66aa,
      emissive: 0x330010,
      metalness: 0.3,
      roughness: 0.4
    }));
    stick.position.y = -0.15;
    wandGroup.add(stick);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 8), goldMat);
    tip.rotateX(Math.PI);
    tip.position.y = -0.425;
    wandGroup.add(tip);

    const wandBowL = new THREE.Mesh(ribbonGeo, ribbonMat);
    wandBowL.position.set(-0.06, 0.1, 0);
    wandBowL.scale.set(0.8, 0.8, 0.8);
    wandGroup.add(wandBowL);
    const wandBowR = new THREE.Mesh(ribbonGeo, ribbonMat);
    wandBowR.position.set(0.06, 0.1, 0);
    wandBowR.scale.set(0.8, 0.8, 0.8);
    wandBowR.rotation.y = Math.PI;
    wandGroup.add(wandBowR);

    // Wand gold heart frame
    const wandHead = new THREE.Group();
    wandHead.position.y = 0.22;

    const goldLobeL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), goldMat);
    goldLobeL.position.set(-0.05, 0.05, 0);
    wandHead.add(goldLobeL);
    const goldLobeR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), goldMat);
    goldLobeR.position.set(0.05, 0.05, 0);
    wandHead.add(goldLobeR);
    const goldCone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 8), goldMat);
    goldCone.rotateX(Math.PI);
    goldCone.position.y = -0.06;
    wandHead.add(goldCone);

    // Inner pink heart
    const innerLobeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), innerHeartMat);
    innerLobeL.position.set(-0.035, 0.04, 0.02);
    wandHead.add(innerLobeL);
    const innerLobeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), innerHeartMat);
    innerLobeR.position.set(0.035, 0.04, 0.02);
    wandHead.add(innerLobeR);
    const innerCone = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.12, 8), innerHeartMat);
    innerCone.rotateX(Math.PI);
    innerCone.position.set(0, -0.04, 0.02);
    wandHead.add(innerCone);

    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), goldMat);
    star.position.y = -0.09;
    wandHead.add(star);

    wandGroup.add(wandHead);

    const wandLight = new THREE.PointLight(0xff00aa, 1.2, 3, 2);
    wandLight.position.set(0, 0.22, 0);
    wandGroup.add(wandLight);

    root.add(wandGroup);
    return root;
  }

  _buildWings() {
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xcccccc,
      emissiveIntensity: 0.8,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    // Left Wing
    this.leftWing = new THREE.Group();
    this.leftWing.position.set(-0.16, 0.9, -0.15);
    for (let i = 0; i < 4; i++) {
      const feather = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.02), wingMat);
      feather.position.set(-0.2, -i * 0.06, 0);
      feather.rotation.z = -i * Math.PI / 16;
      this.leftWing.add(feather);
    }
    this.characterGroup.add(this.leftWing);

    // Right Wing
    this.rightWing = new THREE.Group();
    this.rightWing.position.set(0.16, 0.9, -0.15);
    for (let i = 0; i < 4; i++) {
      const feather = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.02), wingMat);
      feather.position.set(0.2, -i * 0.06, 0);
      feather.rotation.z = i * Math.PI / 16;
      this.rightWing.add(feather);
    }
    this.characterGroup.add(this.rightWing);
  }

  _buildClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xfff0f5,
      emissive: 0xffaacc,
      emissiveIntensity: 0.05,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < 20; i++) {
      const cloudGroup = new THREE.Group();
      
      // Spawn cloud randomly in X, Y, Z
      const cx = (Math.random() - 0.5) * 24;
      const cy = Math.random() * 26 - 8;
      const cz = (Math.random() - 0.5) * 20;
      cloudGroup.position.set(cx, cy, cz);

      // Overlapping fluffy spheres
      const spheresCount = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < spheresCount; j++) {
        const rad = 1.0 + Math.random() * 1.5;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(rad, 8, 8), cloudMat);
        mesh.position.set(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 1.5
        );
        cloudGroup.add(mesh);
      }

      this.scene.add(cloudGroup);
      this.objects.push(cloudGroup);
      this.clouds.push(cloudGroup);
    }
  }

  _buildSparkles() {
    const sparkleMat = new THREE.MeshStandardMaterial({
      color: 0xfff277,
      emissive: 0xffd700,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.05
    });
    const sparkleGeo = new THREE.OctahedronGeometry(0.06, 0);

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(sparkleGeo, sparkleMat);
      // Position around character
      const angle = (i * Math.PI) / 4;
      const rad = 0.5 + Math.random() * 0.6;
      const pos = new THREE.Vector3(
        Math.cos(angle) * rad,
        0.5 + Math.random() * 1.2,
        Math.sin(angle) * rad
      );
      mesh.position.copy(pos);
      this.characterGroup.add(mesh);

      this.sparkles.push({
        mesh,
        basePos: pos.clone(),
        speed: 1.5 + Math.random() * 1.5,
        offset: Math.random() * Math.PI * 2
      });
    }
  }

  update(delta) {
    this.time += delta;

    let wingScale = 0.001;
    let flapSpeed = 6.5;
    let yPos = -1.5;
    let cloudSpeed = 1.5;
    let camRadius = 4.2;

    if (this.time < 1.2) {
      // Phase 1: Floating wingless
      wingScale = 0.001;
      flapSpeed = 0;
      yPos = -1.5;
      cloudSpeed = 1.5;
      
      // Camera stays close up on back
      this.camera.position.set(0, 0.8, -2.5);
      this.camera.lookAt(0, 1.2, 0);
    } else if (this.time < 3.2) {
      // Phase 2: Wings sprout and launch/escape upwards!
      const progress = (this.time - 1.2) / 2.0; // 0.0 to 1.0 over 2 seconds
      wingScale = 0.001 + progress * 0.999;
      flapSpeed = 15.0; // very fast flutter
      yPos = -1.5 + progress * 3.5; // fly from -1.5 up to 2.0
      cloudSpeed = 2.0 + progress * 5.0; // speed up cloud scroll
      
      // Camera follows player up and tilts to look up at back
      const camY = 0.8 + progress * 1.5; // camera rises slower than character
      const camZ = -2.5 - progress * 2.0; // camera zooms out to -4.5
      this.camera.position.set(0, camY, camZ);
      this.camera.lookAt(0, yPos + 1.1, 0);
    } else {
      // Phase 3: Majestic flying with rotating camera
      wingScale = 1.0;
      flapSpeed = 6.5;
      yPos = 2.0 + Math.sin(this.time * 2.0) * 0.15; // gentle bobbing
      cloudSpeed = 6.0;
      
      // Cinematic slow camera rotation
      const angle = (this.time - 3.2) * 0.25;
      const targetY = yPos + 1.1;
      this.camera.position.set(
        Math.sin(angle) * camRadius,
        targetY - 0.6 + Math.sin(this.time * 0.4) * 0.3,
        -Math.cos(angle) * camRadius
      );
      this.camera.lookAt(0, targetY, 0);

      // Trigger credits scroll
      if (!this.creditsShown) {
        this.creditsShown = true;
        this.ui.showEnding();
      }
    }

    // Apply animations
    if (this.characterGroup) {
      this.characterGroup.position.y = yPos;
      if (this.time >= 1.2) {
        this.characterGroup.rotation.y = Math.sin(this.time * 0.5) * 0.08;
      }
    }

    if (this.leftWing && this.rightWing) {
      this.leftWing.scale.set(wingScale, wingScale, wingScale);
      this.rightWing.scale.set(wingScale, wingScale, wingScale);

      const flap = Math.sin(this.time * flapSpeed) * 0.4;
      this.leftWing.rotation.y = flap;
      this.leftWing.rotation.z = flap * 0.2;
      this.rightWing.rotation.y = -flap;
      this.rightWing.rotation.z = -flap * 0.2;
    }

    // Move clouds downwards
    this.clouds.forEach(cloud => {
      cloud.position.y -= delta * cloudSpeed;
      if (cloud.position.y < -8) {
        cloud.position.y = 18;
        cloud.position.x = (Math.random() - 0.5) * 24;
        cloud.position.z = (Math.random() - 0.5) * 20;
      }
    });

    // Animate character sparkles
    this.sparkles.forEach(sp => {
      sp.mesh.position.y = sp.basePos.y + Math.sin(this.time * sp.speed + sp.offset) * 0.15;
      sp.mesh.rotation.x += delta * 2.0;
      sp.mesh.rotation.y += delta * 1.5;
    });
  }

  dispose() {
    if (this.player && this.player.mesh) {
      this.player.mesh.visible = true;
    }
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
    this.clouds    = [];
    this.sparkles  = [];
    this.characterGroup = null;
    this.leftWing       = null;
    this.rightWing      = null;
  }
}
