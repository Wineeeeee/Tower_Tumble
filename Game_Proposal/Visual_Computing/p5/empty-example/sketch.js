let gameState = 'menu';
let score = 0;
let crane, currentBlock;
let blocks = [];
let particles = [];

const GRAVITY = 0.3;
const FRICTION = 0.98;
const DAMPING = 0.95;
const MAX_VEL = 15;

const FLOOR_WIDTH = 200;
const FLOOR_X = 400;
const FLOOR_Y = 550;
const BLOCK_W = 70;
const BLOCK_H = 35;

let swingSpeed = 0.025;

class Block {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.w = BLOCK_W;
    this.h = BLOCK_H;
    this.vx = 0;
    this.vy = 0;
    this.rot = 0;
    this.rotSpeed = 0;
    this.settled = false;
    this.settleTimer = 0;
    this.onCrane = true;
    this.type = type;
    
    if (type === 'heavy') {
      this.weight = 2;
      this.col = color(60, 60, 60);
      this.label = 'HEAVY';
    } else if (type === 'glue') {
      this.weight = 1;
      this.col = color(255, 180, 30);
      this.label = 'GLUE';
      this.friction = 0.85;
    } else if (type === 'bomb') {
      this.weight = 1;
      this.col = color(255, 40, 40);
      this.label = 'BOMB';
      this.exploded = false;
    } else {
      this.weight = 1;
      this.col = color(80, 140, 255);
      this.label = '';
    }
  }
  
  physics() {
    if (this.settled || this.onCrane) return;
    
    this.vy += GRAVITY * this.weight;
    this.vx = constrain(this.vx, -MAX_VEL, MAX_VEL);
    this.vy = constrain(this.vy, -MAX_VEL, MAX_VEL);
    
    this.x += this.vx;
    this.y += this.vy;
    this.rot += this.rotSpeed;
    
    this.vx *= (this.friction || FRICTION);
    this.rotSpeed *= DAMPING;
    
    this.checkFloor();
    this.checkBlocks();
    this.checkOffscreen();
  }
  
  checkFloor() {
    let floorLeft = FLOOR_X - FLOOR_WIDTH / 2;
    let floorRight = FLOOR_X + FLOOR_WIDTH / 2;
    
    if (this.y + this.h/2 >= FLOOR_Y) {
      if (this.x > floorLeft && this.x < floorRight) {
        this.y = FLOOR_Y - this.h/2;
        this.vy = 0;
        this.vx *= 0.5;
        this.checkSettle();
      }
    }
  }
  
  checkBlocks() {
    for (let b of blocks) {
      if (b === this || !b.settled) continue;
      
      if (this.collidesWith(b)) {
        this.y = b.y - (this.h + b.h) / 2;
        this.vy = 0;
        this.vx *= 0.3;
        this.rotSpeed *= 0.5;
        
        if (this.type === 'bomb' && !this.exploded) {
          this.explode();
        }
        
        this.checkSettle();
        break;
      }
    }
  }
  
  collidesWith(b) {
    let overlapX = (this.x + this.w/2 > b.x - b.w/2 && this.x - this.w/2 < b.x + b.w/2);
    let overlapY = (this.y + this.h/2 > b.y - b.h/2 && this.y - this.h/2 < b.y + b.h/2);
    return overlapX && overlapY && this.vy > 0;
  }
  
  checkSettle() {
    if (abs(this.vx) < 0.1 && abs(this.vy) < 0.1 && abs(this.rotSpeed) < 0.01) {
      this.settleTimer++;
      if (this.settleTimer > 30) {
        this.settled = true;
        this.vx = 0;
        this.vy = 0;
        this.rotSpeed = 0;
      }
    } else {
      this.settleTimer = 0;
    }
  }
  
  checkOffscreen() {
    if (this.y > height + 50) {
      if (this.type === 'bomb') {
        this.destroy();
        spawnBlock();
      } else {
        gameOver();
      }
    }
  }
  
  explode() {
    this.exploded = true;
    for (let i = 0; i < 25; i++) {
      let a = random(TWO_PI);
      let s = random(2, 7);
      particles.push(new Particle(this.x, this.y, cos(a)*s, sin(a)*s, color(255, 150, 0)));
    }
    
    for (let b of blocks) {
      if (b === this) continue;
      let d = dist(this.x, this.y, b.x, b.y);
      if (d < 120) {
        let force = map(d, 0, 120, 12, 2);
        let ang = atan2(b.y - this.y, b.x - this.x);
        b.vx += cos(ang) * force;
        b.vy += sin(ang) * force;
        b.rotSpeed += random(-0.3, 0.3);
        b.settled = false;
      }
    }
  }
  
  destroy() {
    let idx = blocks.indexOf(this);
    if (idx > -1) blocks.splice(idx, 1);
    if (currentBlock === this) currentBlock = null;
  }
  
  show() {
    push();
    translate(this.x, this.y);
    rotate(this.rot);
    fill(this.col);
    stroke(0);
    strokeWeight(2);
    rectMode(CENTER);
    rect(0, 0, this.w, this.h, 4);
    
    if (this.label) {
      fill(255);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(11);
      text(this.label, 0, 0);
    }
    pop();
  }
}

class Crane {
  constructor() {
    this.x = FLOOR_X;
    this.y = 60;
    this.angle = 0;
    this.len = 140;
  }
  
  update() {
    this.angle += swingSpeed;
  }
  
  getPos() {
    return {
      x: this.x + sin(this.angle) * this.len,
      y: this.y + this.len
    };
  }
  
  show() {
    stroke(80);
    strokeWeight(4);
    line(this.x - 25, this.y - 15, this.x + 25, this.y - 15);
    line(this.x, this.y - 15, this.x, this.y);
    
    fill(120);
    noStroke();
    circle(this.x, this.y, 12);
    
    let p = this.getPos();
    stroke(120);
    strokeWeight(2);
    line(this.x, this.y, p.x, p.y);
    
    fill(150);
    noStroke();
    circle(p.x, p.y, 7);
  }
}

class Particle {
  constructor(x, y, vx, vy, col) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.col = col;
    this.life = 255;
    this.size = random(3, 7);
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.2;
    this.life -= 5;
  }
  
  show() {
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), this.life);
    circle(this.x, this.y, this.size);
  }
  
  isDead() {
    return this.life <= 0;
  }
}

function setup() {
  createCanvas(800, 600);
  textFont('Arial');
}

function draw() {
  background(15, 20, 35);
  
  if (gameState === 'menu') {
    drawMenu();
  } else if (gameState === 'playing') {
    updateGame();
    drawGame();
  } else if (gameState === 'gameOver') {
    drawGameOver();
  }
}

function drawMenu() {
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(64);
  text('TOWER TUMBLE', width/2, height/2 - 100);
  
  textSize(28);
  text('High Stakes Edition', width/2, height/2 - 50);
  
  textSize(16);
  fill(200);
  text('Build on the small platform', width/2, height/2);
  text('Miss the floor = GAME OVER', width/2, height/2 + 25);
  text('Bombs are the exception - they just respawn!', width/2, height/2 + 50);
  
  textSize(20);
  fill(100, 255, 100);
  text('CLICK TO START', width/2, height/2 + 120);
}

function updateGame() {
  crane.update();
  
  if (currentBlock) {
    if (currentBlock.onCrane) {
      let p = crane.getPos();
      currentBlock.x = p.x;
      currentBlock.y = p.y;
    } else {
      currentBlock.physics();
      if (currentBlock.settled) {
        blocks.push(currentBlock);
        score += 10;
        spawnBlock();
      }
    }
  }
  
  for (let b of blocks) {
    if (!b.settled) b.physics();
  }
  
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].isDead()) particles.splice(i, 1);
  }
}

function drawGame() {
  fill(20, 25, 40);
  noStroke();
  rect(0, FLOOR_Y, width, height - FLOOR_Y);
  
  fill(100, 80, 60);
  stroke(80, 60, 40);
  strokeWeight(3);
  rectMode(CENTER);
  rect(FLOOR_X, FLOOR_Y + 10, FLOOR_WIDTH, 20);
  
  stroke(255, 100, 100, 80);
  strokeWeight(1);
  line(FLOOR_X - FLOOR_WIDTH/2, FLOOR_Y, FLOOR_X - FLOOR_WIDTH/2, 0);
  line(FLOOR_X + FLOOR_WIDTH/2, FLOOR_Y, FLOOR_X + FLOOR_WIDTH/2, 0);
  
  crane.show();
  
  for (let b of blocks) b.show();
  if (currentBlock) currentBlock.show();
  
  for (let p of particles) p.show();
  
  fill(0, 0, 0, 180);
  noStroke();
  rect(0, 0, width, 60);
  
  fill(255);
  textAlign(LEFT, CENTER);
  textSize(20);
  text('Score: ' + score, 20, 30);
  
  textAlign(RIGHT, CENTER);
  text('Blocks: ' + blocks.length, width - 20, 30);
  
  if (currentBlock && currentBlock.onCrane) {
    textAlign(CENTER, CENTER);
    textSize(16);
    fill(200);
    text('CLICK/SPACE: DROP', width/2, 30);
  }
}

function drawGameOver() {
  background(15, 20, 35);
  
  fill(50, 20, 20, 200);
  rect(0, 0, width, height);
  
  fill(255, 80, 80);
  textAlign(CENTER, CENTER);
  textSize(56);
  text('GAME OVER', width/2, height/2 - 80);
  
  fill(255);
  textSize(28);
  text('Score: ' + score, width/2, height/2 - 20);
  text('Blocks: ' + blocks.length, width/2, height/2 + 20);
  
  textSize(24);
  fill(100, 255, 100);
  text('CLICK TO RESTART', width/2, height/2 + 100);
}

function mousePressed() {
  handleInput();
}

function keyPressed() {
  if (key === ' ') handleInput();
}

function handleInput() {
  if (gameState === 'menu') {
    startGame();
  } else if (gameState === 'playing') {
    releaseBlock();
  } else if (gameState === 'gameOver') {
    startGame();
  }
}

function startGame() {
  gameState = 'playing';
  score = 0;
  blocks = [];
  particles = [];
  swingSpeed = 0.025;
  crane = new Crane();
  spawnBlock();
}

function releaseBlock() {
  if (currentBlock && currentBlock.onCrane) {
    currentBlock.onCrane = false;
    currentBlock.vx = sin(crane.angle) * 3.5;
    currentBlock.vy = 0;
  }
}

function spawnBlock() {
  let p = crane.getPos();
  let r = random(100);
  let type = 'normal';
  
  if (blocks.length >= 3) {
    if (r < 12) type = 'heavy';
    else if (r < 24) type = 'glue';
    else if (r < 32) type = 'bomb';
  }
  
  currentBlock = new Block(p.x, p.y, type);
}

function gameOver() {
  gameState = 'gameOver';
}
//h