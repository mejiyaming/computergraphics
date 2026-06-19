/**
 * CollisionUtils.js
 * Per-axis AABB collision detection and resolution.
 * Player position (pos) is the FEET position (bottom of player).
 */

export const PLAYER_HALF_W = 0.4;
export const PLAYER_HEIGHT = 1.8;
export const GRAVITY = 28;

/**
 * Move player and resolve collisions against a list of box colliders.
 * Each box collider: { minX, maxX, minY, maxY, minZ, maxZ }
 * @param {object} player - { pos: THREE.Vector3, vel: THREE.Vector3, onGround: boolean }
 * @param {Array}  colliders
 * @param {number} delta - seconds
 * @param {number} [groundY=0] - default ground plane
 */
export function moveAndCollide(player, colliders, delta, groundY = 0) {
  const hw = PLAYER_HALF_W;
  const ph = PLAYER_HEIGHT;

  // ---- X axis ----
  player.pos.x += player.vel.x * delta;
  for (const box of colliders) {
    if (!overlapY(player, box, ph)) continue;
    if (!overlapZ(player, box, hw)) continue;
    const pMinX = player.pos.x - hw;
    const pMaxX = player.pos.x + hw;
    if (pMaxX <= box.minX || pMinX >= box.maxX) continue;

    if (player.vel.x > 0) {
      player.pos.x = box.minX - hw;
    } else if (player.vel.x < 0) {
      player.pos.x = box.maxX + hw;
    } else {
      // stationary but inside — push to nearest side
      const dL = pMaxX - box.minX;
      const dR = box.maxX - pMinX;
      player.pos.x += dL < dR ? -dL : dR;
    }
    player.vel.x = 0;
  }

  // ---- Y axis (gravity + jump) ----
  player.vel.y -= GRAVITY * delta;
  player.pos.y += player.vel.y * delta;
  player.onGround = false;

  for (const box of colliders) {
    if (!overlapX(player, box, hw)) continue;
    if (!overlapZ(player, box, hw)) continue;
    const pMinY = player.pos.y;
    const pMaxY = player.pos.y + ph;
    if (pMaxY <= box.minY || pMinY >= box.maxY) continue;

    if (player.vel.y <= 0) {
      // Landing on top
      player.pos.y = box.maxY;
      player.vel.y = 0;
      player.onGround = true;
    } else {
      // Hit ceiling
      player.pos.y = box.minY - ph;
      player.vel.y = 0;
    }
  }

  // Ground plane
  if (player.pos.y <= groundY) {
    player.pos.y = groundY;
    if (player.vel.y < 0) player.vel.y = 0;
    player.onGround = true;
  }

  // ---- Z axis ----
  player.pos.z += player.vel.z * delta;
  for (const box of colliders) {
    if (!overlapX(player, box, hw)) continue;
    if (!overlapY(player, box, ph)) continue;
    const pMinZ = player.pos.z - hw;
    const pMaxZ = player.pos.z + hw;
    if (pMaxZ <= box.minZ || pMinZ >= box.maxZ) continue;

    if (player.vel.z > 0) {
      player.pos.z = box.minZ - hw;
    } else if (player.vel.z < 0) {
      player.pos.z = box.maxZ + hw;
    } else {
      const dL = pMaxZ - box.minZ;
      const dR = box.maxZ - pMinZ;
      player.pos.z += dL < dR ? -dL : dR;
    }
    player.vel.z = 0;
  }
}

// ----- Helper overlap checks -----

function overlapX(player, box, hw) {
  return player.pos.x + hw > box.minX && player.pos.x - hw < box.maxX;
}

function overlapY(player, box, ph) {
  return player.pos.y + ph > box.minY && player.pos.y < box.maxY;
}

function overlapZ(player, box, hw) {
  return player.pos.z + hw > box.minZ && player.pos.z - hw < box.maxZ;
}

/**
 * Returns true if player is standing on the given platform box.
 */
export function isOnPlatform(player, box) {
  const hw = PLAYER_HALF_W;
  return (
    player.pos.y >= box.maxY - 0.15 &&
    player.pos.y <= box.maxY + 0.3 &&
    player.pos.x + hw > box.minX && player.pos.x - hw < box.maxX &&
    player.pos.z + hw > box.minZ && player.pos.z - hw < box.maxZ
  );
}
