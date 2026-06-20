/**
 * GameManager.js
 * Core game controller: owns the Three.js scene/camera, game state,
 * scene transitions, Soul Gem tracking, and the main loop.
 */
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { Player }       from './Player.js';
import { UIManager }    from '../ui/UIManager.js';
import { HubScene }     from '../scenes/HubScene.js';
import { MazeScene }    from '../scenes/MazeScene.js';
import { JumpScene }    from '../scenes/JumpScene.js';
import { PuzzleScene }  from '../scenes/PuzzleScene.js';
import { EndingScene }  from '../scenes/EndingScene.js';

export class GameManager {
  constructor(renderer) {
    this.renderer = renderer;

    // Core Three.js objects
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );

    // Post-processing (Bloom for gem glow)
    this.composer = this._buildComposer();

    // Clock
    this.clock = new THREE.Clock();

    // Game state
    this.gems = { pink: false, blue: false, gold: false };

    // Scene management
    this.currentScene     = null;
    this.currentSceneName = null;
    this.transitioning    = false;

    // Sub-systems (created in start())
    this.player = null;
    this.ui     = null;

    // Animation frame id
    this._animId = null;
  }

  // ========= POST-PROCESSING =========

  _buildComposer() {
    const renderer = this.renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      1.2,   // strength
      0.6,   // radius
      0.55   // threshold
    );
    composer.addPass(bloom);

    this.bloomPass = bloom;
    return composer;
  }

  // ========= GEM STATE =========

  get gemCount() {
    return (this.gems.pink ? 1 : 0) +
           (this.gems.blue ? 1 : 0) +
           (this.gems.gold ? 1 : 0);
  }

  collectGem(type) {
    if (this.gems[type]) return;
    this.gems[type] = true;
    this.ui.collectGem(type, this.gemCount);
  }

  // ========= SCENE TRANSITION =========

  async transitionTo(name) {
    if (this.transitioning) return;
    this.transitioning = true;

    // Fade out
    await this.ui.fadeOut(450);

    // Dispose current scene's Three.js objects
    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }

    // Reset scene / fog / bg
    this.scene.fog        = null;
    this.scene.background = new THREE.Color(0x000000);

    this.currentSceneName = name;

    // Build new scene
    const SceneClass = {
      hub:     HubScene,
      maze:    MazeScene,
      jump:    JumpScene,
      puzzle:  PuzzleScene,
      ending:  EndingScene,
    }[name];

    if (!SceneClass) {
      console.error('Unknown scene:', name);
      this.transitioning = false;
      return;
    }

    this.currentScene = new SceneClass(this, this.scene, this.player, this.ui);
    this.currentScene.init();

    // Ensure pointer lock is available (not already locked is fine)
    await this.ui.fadeIn(450);

    if (name === 'maze') {
      this.player.controlsDisabled = true;
      this.ui.showPopup("💗 미로 속을 탐색해 핑크 소울 젬을 획득하세요! 💗", 4000);
      setTimeout(() => {
        this.player.controlsDisabled = false;
        this.player.requestPointerLock();
      }, 4000);
    } else if (name === 'jump') {
      this.player.controlsDisabled = true;
      this.ui.showPopup("💙 떨어지지 않고 발판을 밟아 블루 소울 젬을 획득하세요! 💙", 4000);
      setTimeout(() => {
        this.player.controlsDisabled = false;
        this.player.requestPointerLock();
      }, 4000);
    } else if (name === 'puzzle') {
      this.player.controlsDisabled = true;
      this.ui.showPopup("💛 보석이 빛나는 순서를 기억해 퍼즐을 해결하세요! 💛", 4000);
      setTimeout(() => {
        this.player.controlsDisabled = false;
        this.player.requestPointerLock();
      }, 4000);
    }

    this.transitioning = false;
  }

  // ========= START =========

  start() {
    if (!this.ui) {
      this.ui = new UIManager();
    }
    
    // Clean up any old player model before spawning a new one
    if (this.player) {
      this.player.dispose();
    }
    this.player = new Player(this.scene, this.camera);

    // Renderer settings
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;

    // Show story screen
    this.ui.showStory(() => {
      // Transition immediately to the 3D hub scene
      this.transitionTo('hub').then(() => {
        const pages = [
          "여기가 어디지??ㅠㅠ",
          "마법소녀로서 마물과의 전투 중, 방심하여 마물 세계에 갇히고 말았어... 😢",
          "게다가 내 변신이 해제되면서 세 개의 소울 젬(Soul Gem)이 어딘가로 다 흩어져 버렸지 뭐야!",
          "이 세계를 탈출하려면 미로, 점프 발판, 메모리 퍼즐 속에 숨겨진 소울 젬들을 모두 되찾아야 해. 💫",
          "자, 변신 요술봉의 힘을 다시 모아 마법을 되찾고 탈출하자! 준비됐지? 출발! 💕"
        ];
        // Show JRPG style dialogue box overlaying the 3D scene
        this.ui.showDialogue(pages, () => {
          this.ui.showGameUI();
          this.player.controlsDisabled = true;
          this.ui.showPopup("각 포탈에 들어가서 퀘스트를 깨고 소울젬을 얻으세요! ✨", 4000);
          setTimeout(() => {
            this.player.controlsDisabled = false;
            this.player.requestPointerLock();
          }, 4000);
        });
      });
    });

    // Track pointer lock lost → show click-to-play (registered only once)
    if (!this._pointerLockSetup) {
      this._pointerLockSetup = true;
      document.addEventListener('pointerlockchange', () => {
        const locked = document.pointerLockElement === document.getElementById('game-canvas');
        if (!locked && this.currentSceneName && this.currentSceneName !== 'ending') {
          // No fullscreen overlay.
        }
      });
    }

    // Start game loop (avoid duplicate loops)
    if (!this._animId) {
      this._animate();
    }
  }

  // ========= GAME LOOP =========

  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());

    const delta = Math.min(this.clock.getDelta(), 0.05); // cap at 50ms

    if (this.currentScene && !this.transitioning) {
      this.currentScene.update(delta);
    }

    this.composer.render();
  }

  // ========= RESTART =========

  restart() {
    // 1. Reset game state
    this.gems = { pink: false, blue: false, gold: false };

    // 2. Clear UI collected classes
    const gemTypes = ['pink', 'blue', 'gold'];
    gemTypes.forEach(type => {
      const el = document.getElementById(`gem-${type}`);
      if (el) el.classList.remove('collected');
    });
    if (this.ui.gemCountEl) this.ui.gemCountEl.textContent = '0';
    
    // Hide hud and ending screens
    this.ui.hudEl.style.display   = 'none';
    this.ui.endingEl.style.display = 'none';
    if (this.ui.playerNameInputEl) {
      this.ui.playerNameInputEl.value = '';
    }

    // 3. Clean up and dispose old player instance
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }

    // 4. Dispose current scene
    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }
    this.currentSceneName = null;

    // 5. Run start sequence again
    this.start();
  }

  // ========= RESIZE =========

  onResize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }
}
