const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const modeEl = document.getElementById('mode');
const levelEl = document.getElementById('level');
const killsToNextEl = document.getElementById('kills-to-next');
const scoreEl = document.getElementById('score');
const healthFill = document.getElementById('health-fill');
const healthText = document.getElementById('health-text');
const restartBtn = document.getElementById('restart');

let player = { x: 400, y: 300, size: 20, speed: 5, health: 100, maxHealth: 100 };
let bullets = [], enemies = [], particles = [];
let score = 0, gameOver = false, keys = {};
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Level variables
let mode = 'Levels', level = 1, kills = 0;
let killsPerLevel = 10, enemySpawnRate = 0.02, enemySpeed = 2, enemyHealth = 1;
let shake = 0;
let levelUpBanner = { text: "", timer: 0 };

// Background stars
let stars = [];
for (let i = 0; i < 100; i++) {
  stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2 + 1 });
}

// --- Desktop Controls ---
document.addEventListener('keydown', (e) => keys[e.key] = true);
document.addEventListener('keyup', (e) => keys[e.key] = false);
canvas.addEventListener('click', shootBullet);

// --- Mobile Controls ---
let touchStartX = 0, touchStartY = 0, isDragging = false;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  if (x < canvas.width / 2) {
    touchStartX = x; touchStartY = y; isDragging = true;
  } else {
    shootBullet({ clientX: touch.clientX, clientY: touch.clientY });
  }
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!isDragging) return;
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  player.x += (x - touchStartX) * 0.3;
  player.y += (y - touchStartY) * 0.3;
  touchStartX = x; touchStartY = y;
});
canvas.addEventListener('touchend', () => { isDragging = false; });

// --- Shooting ---
function shootBullet(e) {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
  bullets.push({
    x: player.x, y: player.y,
    dx: Math.cos(angle) * 10, dy: Math.sin(angle) * 10,
    size: 5, life: 100
  });
}

// --- Particles ---
function createParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y,
      dx: (Math.random() - 0.5) * 5,
      dy: (Math.random() - 0.5) * 5,
      size: Math.random() * 3 + 1,
      life: 30,
      color
    });
  }
}

// --- Update Loop ---
function update() {
  if (gameOver) return;

  // Player movement (desktop)
  if (!isMobile) {
    if (keys['w'] || keys['ArrowUp']) player.y -= player.speed;
    if (keys['s'] || keys['ArrowDown']) player.y += player.speed;
    if (keys['a'] || keys['ArrowLeft']) player.x -= player.speed;
    if (keys['d'] || keys['ArrowRight']) player.x += player.speed;
  }

  // Keep player in bounds
  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

  // Bullets
  bullets = bullets.filter(bullet => {
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;
    bullet.life--;
    return bullet.life > 0 && bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height;
  });

  // Particles
  particles = particles.filter(p => {
    p.x += p.dx;
    p.y += p.dy;
    p.life--;
    return p.life > 0;
  });

  // Spawn enemies
  if (Math.random() < enemySpawnRate) {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = 0; y = Math.random() * canvas.height; }
    else if (side === 1) { x = canvas.width; y = Math.random() * canvas.height; }
    else if (side === 2) { x = Math.random() * canvas.width; y = 0; }
    else { x = Math.random() * canvas.width; y = canvas.height; }
    enemies.push({ x, y, size: 15, speed: enemySpeed, health: enemyHealth, trail: [] });
  }

  // Enemy AI
  enemies.forEach(enemy => {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed;
    enemy.y += Math.sin(angle) * enemy.speed;
    enemy.trail.push({ x: enemy.x, y: enemy.y });
    if (enemy.trail.length > 5) enemy.trail.shift();
  });

  // Bullet-enemy collisions
  bullets.forEach((bullet, bIndex) => {
    enemies.forEach((enemy, eIndex) => {
      if (Math.abs(bullet.x - enemy.x) < enemy.size && Math.abs(bullet.y - enemy.y) < enemy.size) {
        enemy.health--;
        bullets.splice(bIndex, 1);
        shake = 5;
        if (enemy.health <= 0) {
          createParticles(enemy.x, enemy.y, 'red');
          enemies.splice(eIndex, 1);
          score += 10;
          kills++;
          scoreEl.textContent = score;
          checkLevelUp();
        }
      }
    });
  });

  // Player-enemy collisions
  enemies.forEach(enemy => {
    if (Math.abs(player.x - enemy.x) < player.size && Math.abs(player.y - enemy.y) < player.size) {
      player.health -= 10;
      shake = 10;
      updateHealthBar();
      createParticles(player.x, player.y, 'blue');
      enemies.splice(enemies.indexOf(enemy), 1);
      if (player.health <= 0) {
        gameOver = true;
        alert('Game Over! Final Score: ' + score + ' at Level ' + level);
      }
    }
  });

  if (shake > 0) shake -= 0.5;
}

// --- Level Progression ---
function checkLevelUp() {
  const killsNeeded = level * killsPerLevel;
  if (kills >= killsNeeded) {
    level++;
    kills = 0;

    // Difficulty scaling
    enemySpawnRate += 0.005;
    enemySpeed += 0.3;
    enemyHealth += Math.floor(level / 3);

    // UI update
    levelEl.textContent = level;
    killsToNextEl.textContent = level * killsPerLevel;

    // Level-up particles
    createParticles(player.x, player.y, 'gold');
  } else {
    killsToNextEl.textContent = killsNeeded - kills;
  }
}

// --- Health Bar ---
function updateHealthBar() {
  const percent = (player.health / player.maxHealth) * 100;
  healthFill.style.width = percent + '%';
  healthFill.style.backgroundColor = percent > 50 ? '#0f0' : percent > 25 ? '#ff0' : '#f00';
  healthText.textContent = player.health + '/' + player.maxHealth;
}
function checkLevelUp() {
  const killsNeeded = level * killsPerLevel;
  if (kills >= killsNeeded) {
    level++;
    kills = 0;

    // Difficulty scaling
    enemySpawnRate += 0.005;
    enemySpeed += 0.3;
    enemyHealth += Math.floor(level / 3);

    // UI update
    levelEl.textContent = level;
    killsToNextEl.textContent = level * killsPerLevel;

    // Level-up particles
    createParticles(player.x, player.y, 'gold');

    // Show banner
    levelUpBanner.text = "LEVEL " + level + "!";
    levelUpBanner.timer = 120; // frames (~2 seconds)
  } else {
    killsToNextEl.textContent = killsNeeded - kills;
  }
}

// --- Drawing ---
function draw() {
  ctx.save();
  ctx.translate(Math.random() * shake - shake / 2, Math.random() * shake - shake / 2);
// Level-up banner
if (levelUpBanner.timer > 0) {
  ctx.font = "bold 48px Arial";
  ctx.fillStyle = "gold";
  ctx.textAlign = "center";
  ctx.shadowColor = "orange";
  ctx.shadowBlur = 20;
  ctx.globalAlpha = Math.min(1, levelUpBanner.timer / 30); // fade in/out
  ctx.fillText(levelUpBanner.text, canvas.width / 2, canvas.height / 2);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  levelUpBanner.timer--;
}

  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  stars.forEach(star => ctx.fillRect(star.x, star.y, star.size, star.size));

  // Grid
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i < canvas.height; i += 50) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }

  // Particles
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 30;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  });

  // Enemies
  enemies.forEach(enemy => {
    ctx.fillStyle = 'red';
    ctx.shadowColor = 'red';
    ctx.shadowBlur = 10;
    ctx.fillRect(enemy.x - enemy.size / 2, enemy.y - enemy.size / 2, enemy.size, enemy.size);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    enemy.trail.forEach(t => ctx.fillRect(t.x - 2, t.y - 2, 4, 4));
  });

  // Bullets
  bullets.forEach(bullet => {
    ctx.fillStyle = 'yellow';
    ctx.shadowColor = 'yellow';
    ctx.shadowBlur = 5;
    ctx.globalAlpha = bullet.life / 100;
    ctx.fillRect(bullet.x - bullet.size / 2, bullet.y - bullet.size / 2, bullet.size, bullet.size);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  });

  // Player
  ctx.fillStyle = 'blue';
  ctx.shadowColor = 'blue';
  ctx.shadowBlur = 10;
  ctx.fillRect(player.x - player.size / 2, player.y - player.size / 2, player.size, player.size);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// --- Game Loop ---
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// --- Restart ---
restartBtn.addEventListener('click', () => {
  player = { x: 400, y: 300, size: 20, speed: 5, health: 100, maxHealth: 100 };
  bullets = [];
  enemies = [];
  particles = [];
  score = 0;
  kills = 0;
  level = 1;
  mode = 'Levels';
  enemySpawnRate = 0.02;
  enemySpeed = 2;
  enemyHealth = 1;
  shake = 0;
  gameOver = false;

  modeEl.textContent = mode;
  levelEl.textContent = level;
  killsToNextEl.textContent = killsPerLevel;
  scoreEl.textContent = score;
  updateHealthBar();
});

// --- Initialize ---
updateHealthBar();
gameLoop();
