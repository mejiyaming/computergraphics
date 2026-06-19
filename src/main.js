/**
 * main.js — Entry point for Soul Gem Awakening
 */
import * as THREE from 'three';
import { GameManager } from './game/GameManager.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const gm = new GameManager(renderer);
gm.start();

window.addEventListener('resize', () => {
  gm.onResize(window.innerWidth, window.innerHeight);
});
