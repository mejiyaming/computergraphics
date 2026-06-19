/**
 * UIManager.js
 * Manages all DOM-based UI: story screen, HUD, prompts, ending screen, fades.
 */
export class UIManager {
  constructor() {
    this.fadeEl        = document.getElementById('fade');
    this.storyEl       = document.getElementById('story-screen');
    this.hudEl         = document.getElementById('hud');
    this.endingEl      = document.getElementById('ending-screen');
    this.promptEl      = document.getElementById('interact-prompt');
    this.crosshairEl   = document.getElementById('crosshair');
    this.controlsEl    = document.getElementById('controls-hint');
    this.stageLabelEl  = document.getElementById('stage-label');
    this.gemCountEl    = document.getElementById('gem-count-num');
    this.objectiveEl   = document.getElementById('objective-text');
    this.clickToPlayEl = document.getElementById('click-to-play');
    this.respawnEl     = document.getElementById('respawn-msg');
    this.puzzleUiEl    = document.getElementById('puzzle-ui');
    this.puzzleMsgEl   = document.getElementById('puzzle-message');
    this.popupEl       = document.getElementById('gem-popup');
    this.popupTextEl   = document.getElementById('gem-popup-text');

    this.seqEls = [0,1,2,3].map(i => document.getElementById(`seq-${i}`));

    this.restartBtnEl  = document.getElementById('restart-btn');
    this._restartBtnTimer = null;
    this._respawnTimer = null;
    this._popupTimer   = null;
    this.dialogueActive = false;
  }

  showStory(onStart) {
    this.storyEl.style.display = 'flex';
    this.storyEl.style.opacity = '1';
    this.fadeEl.style.transition = 'opacity 1s';
    this.fadeEl.style.opacity = '0';

    const btn = document.getElementById('start-btn');
    btn.addEventListener('click', () => {
      this.storyEl.style.opacity = '0';
      setTimeout(() => {
        this.storyEl.style.display = 'none';
        onStart();
      }, 1000);
    }, { once: true });
  }

  showDialogue(pages, onComplete) {
    const container = document.getElementById('dialogue-box-container');
    const textEl = document.getElementById('dialogue-text');
    if (!container || !textEl) {
      onComplete();
      return;
    }

    this.dialogueActive = true;
    container.style.display = 'flex';
    let currentPage = 0;
    textEl.textContent = pages[currentPage];

    const nextHandler = (e) => {
      e.stopPropagation();
      currentPage++;
      if (currentPage < pages.length) {
        textEl.textContent = pages[currentPage];
      } else {
        container.removeEventListener('click', nextHandler);
        container.style.display = 'none';
        this.dialogueActive = false;
        onComplete();
      }
    };

    container.addEventListener('click', nextHandler);
  }

  // ========= GAME UI =========

  showGameUI() {
    this.hudEl.style.display = 'block';
    this.crosshairEl.style.display = 'block';
    this.controlsEl.style.display = 'block';
  }

  showClickToPlay(callback) {
    this.clickToPlayEl.style.display = 'flex';
    const handler = () => {
      this.clickToPlayEl.style.display = 'none';
      callback();
    };
    this.clickToPlayEl.addEventListener('click', handler, { once: true });
  }

  hideClickToPlay() {
    this.clickToPlayEl.style.display = 'none';
  }

  // ========= GEM =========

  collectGem(type, totalCount) {
    const el = document.getElementById(`gem-${type}`);
    if (el) el.classList.add('collected');
    if (this.gemCountEl) this.gemCountEl.textContent = totalCount;

    const labels = { pink: '✦ Pink Soul Gem 획득!', blue: '✦ Blue Soul Gem 획득!', gold: '✦ Gold Soul Gem 획득!' };
    this.showPopup(labels[type] || '✦ Soul Gem 획득!');

    if (totalCount >= 3) {
      this.setObjective('마법진을 활성화하라!');
    }
  }

  setObjective(text) {
    if (this.objectiveEl) this.objectiveEl.textContent = text;
  }

  // ========= LABELS / PROMPTS =========

  setStageLabel(text, color = '#ffffff') {
    if (!this.stageLabelEl) return;
    if (text) {
      this.stageLabelEl.style.display = 'block';
      this.stageLabelEl.textContent   = text;
      this.stageLabelEl.style.color   = color;
      this.stageLabelEl.style.textShadow = `0 0 20px ${color}`;
    } else {
      this.stageLabelEl.style.display = 'none';
    }
  }

  showInteractPrompt(text) {
    if (!this.promptEl) return;
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.style.display = 'block';
    } else {
      this.promptEl.style.display = 'none';
    }
  }

  hideInteractPrompt() {
    if (this.promptEl) this.promptEl.style.display = 'none';
  }

  showRespawn(text = '떨어졌다! 다시 시작...') {
    if (!this.respawnEl) return;
    this.respawnEl.textContent = text;
    this.respawnEl.style.display = 'block';
    if (this._respawnTimer) clearTimeout(this._respawnTimer);
    this._respawnTimer = setTimeout(() => {
      this.respawnEl.style.display = 'none';
    }, 1800);
  }

  showPopup(text, duration = 3000) {
    if (!this.popupEl) return;
    this.popupTextEl.textContent = text;
    this.popupEl.style.display = 'block';
    
    const animDur = duration / 1000;
    this.popupEl.style.animation = 'none';
    // Force reflow
    void this.popupEl.offsetWidth;
    this.popupEl.style.animation = `popupAnim ${animDur}s ease forwards`;
    
    if (this._popupTimer) clearTimeout(this._popupTimer);
    this._popupTimer = setTimeout(() => {
      this.popupEl.style.display = 'none';
    }, duration + 200);
  }

  // ========= PUZZLE =========

  showPuzzleUI(show) {
    if (this.puzzleUiEl) {
      this.puzzleUiEl.style.display = show ? 'flex' : 'none';
    }
  }

  setPuzzleMessage(text) {
    if (this.puzzleMsgEl) this.puzzleMsgEl.textContent = text;
  }

  highlightSeqGem(index, state, colorVal = null) {
    // state: 'on' | 'off' | 'correct' | 'wrong'
    const el = this.seqEls[index];
    if (!el) return;
    el.classList.remove('lit', 'correct', 'wrong');
    if (state === 'on')      el.classList.add('lit');
    else if (state === 'correct') {
      el.classList.add('correct');
      if (colorVal !== null) {
        el.classList.add(`c${colorVal}`);
        el.classList.add('lit');
      }
    }
    else if (state === 'wrong')   el.classList.add('wrong');
  }

  setSeqColors(sequence) {
    this.seqEls.forEach((el, idx) => {
      if (!el) return;
      el.classList.remove('c0', 'c1', 'c2', 'c3');
      const val = sequence[idx];
      if (val !== undefined) {
        el.classList.add(`c${val}`);
      }
    });
  }

  resetSeqGems() {
    this.seqEls.forEach(el => el.classList.remove('lit', 'correct', 'wrong'));
  }

  clearSeqColors() {
    this.seqEls.forEach(el => {
      if (el) {
        el.classList.remove('c0', 'c1', 'c2', 'c3');
      }
    });
  }

  // ========= ENDING =========

  showEnding(onRestartClicked) {
    this.hudEl.style.display        = 'none';
    this.crosshairEl.style.display  = 'none';
    this.controlsEl.style.display   = 'none';
    this.stageLabelEl.style.display = 'none';
    this.promptEl.style.display     = 'none';
    this.endingEl.style.display     = 'flex';
    this.fadeEl.style.transition    = 'opacity 0.5s';
    this.fadeEl.style.opacity       = '0';

    if (this.restartBtnEl) {
      this.restartBtnEl.style.display = 'none';
      this.restartBtnEl.style.opacity = '0';
      this.restartBtnEl.style.transition = 'opacity 1.2s ease';

      if (this._restartBtnTimer) clearTimeout(this._restartBtnTimer);
      this._restartBtnTimer = setTimeout(() => {
        if (this.restartBtnEl) {
          this.restartBtnEl.style.display = 'block';
          // Force layout reflow
          void this.restartBtnEl.offsetWidth;
          this.restartBtnEl.style.opacity = '1';
        }
      }, 5500);

      this.restartBtnEl.onclick = (e) => {
        e.stopPropagation();
        if (this._restartBtnTimer) clearTimeout(this._restartBtnTimer);
        this.restartBtnEl.style.display = 'none';
        this.restartBtnEl.style.opacity = '0';
        this.endingEl.style.display     = 'none';
        onRestartClicked();
      };
    }
  }

  // ========= FADE =========

  fadeOut(duration = 500) {
    return new Promise(resolve => {
      this.fadeEl.style.transition = `opacity ${duration / 1000}s ease`;
      this.fadeEl.style.opacity    = '1';
      setTimeout(resolve, duration + 50);
    });
  }

  fadeIn(duration = 500) {
    return new Promise(resolve => {
      this.fadeEl.style.transition = `opacity ${duration / 1000}s ease`;
      this.fadeEl.style.opacity    = '0';
      setTimeout(resolve, duration + 50);
    });
  }
}
