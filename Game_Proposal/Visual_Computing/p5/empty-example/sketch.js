// ============================================
// RACE TO THE TOP - 2 Player Competitive Puzzle
// ============================================

// GLOBAL VARIABLES
let gameState = 'menu';
let winner = null;
let players = [];
let particles = [];
// Menu / difficulty UI
let difficultyButtons = [];
let gameMode = 'two';
let selectedDifficulty = 'medium';
let singlePlayerMode = false;

// COLOR PALETTE (5 distinct colors)
let COLORS;

// CONSTANTS (Grid structure)
const COLS = 4;           // 4 columns per player
const ROWS = 12;          // Grid height
const DROP_SPEED = 8;     // Falling speed
const TNT_CHANCE = 0.08;  // 8% chance for TNT block

// DYNAMIC LAYOUT VARIABLES (recalculated on resize)
let BLOCK_SIZE;
let SIDE_PANEL_WIDTH;
let GAME_AREA_WIDTH;
let GAME_AREA_HEIGHT;
const LIMIT_LINE_ROW = 1;  // Win condition row

// ============================================
// RESPONSIVE LAYOUT CALCULATION
// ============================================
function calculateLayout() {
  // Calculate optimal block size based on screen dimensions
  // Use 70% of screen height for game area, divided by number of rows
  let maxHeightBlock = (windowHeight * 0.7) / ROWS;
  // Use available width (accounting for side panels and spacing)
  let maxWidthBlock = (windowWidth * 0.35) / COLS;
  
  // Use the smaller value to ensure it fits both dimensions
  BLOCK_SIZE = min(maxHeightBlock, maxWidthBlock);
  BLOCK_SIZE = constrain(BLOCK_SIZE, 30, 60); // Min 30px, Max 60px
  
  // Calculate derived dimensions
  GAME_AREA_WIDTH = COLS * BLOCK_SIZE;
  GAME_AREA_HEIGHT = ROWS * BLOCK_SIZE;
  SIDE_PANEL_WIDTH = windowWidth * 0.08; // 8% of screen width
  SIDE_PANEL_WIDTH = constrain(SIDE_PANEL_WIDTH, 80, 150);
}

// ============================================
// PLAYER CLASS
// ============================================
class Player {
  constructor(id, offsetX, offsetY) {
    this.id = id;
    this.offsetX = offsetX;  // X offset for this player's game area
    this.offsetY = offsetY;  // Y offset for this player's game area
    this.grid = this.createEmptyGrid();
    this.craneCol = 1;  // Start in second column (0-indexed)
    this.currentBlock = null;
    this.nextBlockColor = null;
    this.nextBlockIsTNT = false;
    this.dropping = false;
    this.dropY = 0;
    this.score = 0;
    this.comboCount = 0;
    
    this.prepareNextBlock();
    this.spawnBlock();
  }
  
  createEmptyGrid() {
    let grid = [];
    for (let row = 0; row < ROWS; row++) {
      grid[row] = [];
      for (let col = 0; col < COLS; col++) {
        grid[row][col] = null;
      }
    }
    return grid;
  }
  
  prepareNextBlock() {
    // Determine next block
    this.nextBlockIsTNT = random() < TNT_CHANCE;
    if (!this.nextBlockIsTNT) {
      this.nextBlockColor = floor(random(5));  // 0-4 for 5 colors
    }
  }
  
  spawnBlock() {
    if (this.nextBlockIsTNT) {
      this.currentBlock = { color: -1, isTNT: true };
    } else {
      this.currentBlock = { color: this.nextBlockColor, isTNT: false };
    }
    this.dropping = false;
    this.dropY = 0;
    this.prepareNextBlock();
  }
  
  moveCrane(dir) {
    if (this.dropping) return;
    this.craneCol = constrain(this.craneCol + dir, 0, COLS - 1);
  }
  
  dropBlock() {
    if (this.dropping || !this.currentBlock) return;
    this.dropping = true;
    this.dropY = 0;
  }
  
  update() {
    if (this.dropping && this.currentBlock) {
      this.dropY += DROP_SPEED;
      
      // Find landing row
      let landingRow = this.findLandingRow(this.craneCol);
      let targetY = landingRow * BLOCK_SIZE;
      
      if (this.dropY >= targetY) {
        // Block has landed
        this.dropY = targetY;
        this.placeBlock(landingRow, this.craneCol);
        this.dropping = false;
      }
    }
  }
  
  findLandingRow(col) {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.grid[row][col] === null) {
        return row;
      }
    }
    return -1;  // Column is full
  }
  
  placeBlock(row, col) {
    if (row < 0) return;  // Column full
    
    if (this.currentBlock.isTNT) {
      // TNT explosion!
      this.explodeTNT(row, col);
    } else {
      this.grid[row][col] = this.currentBlock.color;
      this.score += 10;
      
      // Check for matches
      this.comboCount = 0;
      this.checkAndClearMatches();
    }
    
    // Spawn next block
    this.spawnBlock();
  }
  
  explodeTNT(row, col) {
    // Create explosion particles
    let centerX = this.offsetX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
    let centerY = this.offsetY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
    
    for (let i = 0; i < 30; i++) {
      let a = random(TWO_PI);
      let s = random(3, 8);
      particles.push(new Particle(centerX, centerY, cos(a) * s, sin(a) * s, color(255, 150, 0)));
    }
    
    // Clear 3x3 area around explosion
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        let r = row + dr;
        let c = col + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          if (this.grid[r][c] !== null) {
            // Create pop particles
            let px = this.offsetX + c * BLOCK_SIZE + BLOCK_SIZE / 2;
            let py = this.offsetY + r * BLOCK_SIZE + BLOCK_SIZE / 2;
            this.createPopParticles(px, py, COLORS[this.grid[r][c]]);
            this.grid[r][c] = null;
            this.score += 20;
          }
        }
      }
    }
    
    // Apply gravity
    this.applyGravity();
    this.checkAndClearMatches();
  }
  
  checkAndClearMatches() {
    let matched = this.findMatches();
    
    if (matched.length > 0) {
      this.comboCount++;
      
      // Clear matched blocks
      for (let pos of matched) {
        let px = this.offsetX + pos.col * BLOCK_SIZE + BLOCK_SIZE / 2;
        let py = this.offsetY + pos.row * BLOCK_SIZE + BLOCK_SIZE / 2;
        this.createPopParticles(px, py, COLORS[this.grid[pos.row][pos.col]]);
        this.grid[pos.row][pos.col] = null;
      }
      
      this.score += matched.length * 15 * this.comboCount;
      
      // Apply gravity
      this.applyGravity();
      
      // Check for chain reactions
      this.checkAndClearMatches();
    }
  }
  
  findMatches() {
    let matched = new Set();
    
    // Check all positions for groups of 3+
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] !== null) {
          let color = this.grid[row][col];
          let group = this.floodFill(row, col, color, new Set());
          
          if (group.size >= 3) {
            for (let pos of group) {
              matched.add(pos);
            }
          }
        }
      }
    }
    
    // Convert set to array of positions
    let result = [];
    for (let pos of matched) {
      let [r, c] = pos.split(',').map(Number);
      result.push({ row: r, col: c });
    }
    
    return result;
  }
  
  floodFill(row, col, targetColor, visited) {
    let key = `${row},${col}`;
    
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return visited;
    if (visited.has(key)) return visited;
    if (this.grid[row][col] !== targetColor) return visited;
    
    visited.add(key);
    
    // Check 4 directions (orthogonal only)
    this.floodFill(row - 1, col, targetColor, visited);
    this.floodFill(row + 1, col, targetColor, visited);
    this.floodFill(row, col - 1, targetColor, visited);
    this.floodFill(row, col + 1, targetColor, visited);
    
    return visited;
  }
  
  applyGravity() {
    // For each column, drop blocks down
    for (let col = 0; col < COLS; col++) {
      let writeRow = ROWS - 1;
      
      for (let row = ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] !== null) {
          if (row !== writeRow) {
            this.grid[writeRow][col] = this.grid[row][col];
            this.grid[row][col] = null;
          }
          writeRow--;
        }
      }
    }
  }
  
  createPopParticles(x, y, col) {
    for (let i = 0; i < 8; i++) {
      let a = random(TWO_PI);
      let s = random(2, 5);
      particles.push(new Particle(x, y, cos(a) * s, sin(a) * s, col));
    }
  }
  
  checkWinCondition() {
    // Check if any block is at or above the limit line
    for (let col = 0; col < COLS; col++) {
      if (this.grid[LIMIT_LINE_ROW][col] !== null) {
        return true;
      }
    }
    return false;
  }
  
  draw() {
    push();
    
    // Holographic panel frame
    let frameCol = this.id === 1 ? color(0, 255, 255) : color(255, 100, 255);
    noFill();
    stroke(frameCol);
    strokeWeight(2);
    rect(this.offsetX - 5, this.offsetY - 5, GAME_AREA_WIDTH + 10, GAME_AREA_HEIGHT + 10);
    
    // Outer glow
    stroke(red(frameCol), green(frameCol), blue(frameCol), 30);
    strokeWeight(8);
    rect(this.offsetX - 8, this.offsetY - 8, GAME_AREA_WIDTH + 16, GAME_AREA_HEIGHT + 16);
    
    // Corner brackets
    stroke(frameCol);
    strokeWeight(3);
    let cornerSize = 15;
    // Top-left
    line(this.offsetX - 10, this.offsetY - 10, this.offsetX - 10 + cornerSize, this.offsetY - 10);
    line(this.offsetX - 10, this.offsetY - 10, this.offsetX - 10, this.offsetY - 10 + cornerSize);
    // Top-right
    line(this.offsetX + GAME_AREA_WIDTH + 10 - cornerSize, this.offsetY - 10, this.offsetX + GAME_AREA_WIDTH + 10, this.offsetY - 10);
    line(this.offsetX + GAME_AREA_WIDTH + 10, this.offsetY - 10, this.offsetX + GAME_AREA_WIDTH + 10, this.offsetY - 10 + cornerSize);
    // Bottom-left
    line(this.offsetX - 10, this.offsetY + GAME_AREA_HEIGHT + 10, this.offsetX - 10 + cornerSize, this.offsetY + GAME_AREA_HEIGHT + 10);
    line(this.offsetX - 10, this.offsetY + GAME_AREA_HEIGHT + 10 - cornerSize, this.offsetX - 10, this.offsetY + GAME_AREA_HEIGHT + 10);
    // Bottom-right
    line(this.offsetX + GAME_AREA_WIDTH + 10 - cornerSize, this.offsetY + GAME_AREA_HEIGHT + 10, this.offsetX + GAME_AREA_WIDTH + 10, this.offsetY + GAME_AREA_HEIGHT + 10);
    line(this.offsetX + GAME_AREA_WIDTH + 10, this.offsetY + GAME_AREA_HEIGHT + 10 - cornerSize, this.offsetX + GAME_AREA_WIDTH + 10, this.offsetY + GAME_AREA_HEIGHT + 10);
    
    // Draw game area background (dark transparent)
    fill(5, 10, 20, 180);
    noStroke();
    rect(this.offsetX, this.offsetY, GAME_AREA_WIDTH, GAME_AREA_HEIGHT);
    
    // Draw grid lines (tech grid)
    stroke(red(frameCol), green(frameCol), blue(frameCol), 20);
    strokeWeight(1);
    for (let i = 1; i < COLS; i++) {
      let x = this.offsetX + i * BLOCK_SIZE;
      line(x, this.offsetY, x, this.offsetY + GAME_AREA_HEIGHT);
    }
    for (let i = 1; i < ROWS; i++) {
      let y = this.offsetY + i * BLOCK_SIZE;
      line(this.offsetX, y, this.offsetX + GAME_AREA_WIDTH, y);
    }
    
    // Draw limit line (neon red)
    stroke(255, 20, 60);
    strokeWeight(3);
    let limitY = this.offsetY + (LIMIT_LINE_ROW + 1) * BLOCK_SIZE;
    line(this.offsetX, limitY, this.offsetX + GAME_AREA_WIDTH, limitY);
    
    // Glowing limit line
    stroke(255, 20, 60, 100);
    strokeWeight(6);
    line(this.offsetX, limitY, this.offsetX + GAME_AREA_WIDTH, limitY);
    
    // Draw "WIN LINE" label with glow
    fill(255, 20, 60, 150);
    noStroke();
    textSize(11);
    textAlign(LEFT, BOTTOM);
    text('WIN', this.offsetX + 6, limitY - 3);
    fill(255, 20, 60);
    textSize(10);
    text('WIN', this.offsetX + 5, limitY - 2);
    
    // Draw placed blocks
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] !== null) {
          let x = this.offsetX + col * BLOCK_SIZE;
          let y = this.offsetY + row * BLOCK_SIZE;
          this.drawBlock(x, y, COLORS[this.grid[row][col]], false);
        }
      }
    }
    
    // Draw crane
    this.drawCrane();
    
    // Draw current falling block
    if (this.currentBlock) {
      let x = this.offsetX + this.craneCol * BLOCK_SIZE;
      let y = this.offsetY + (this.dropping ? this.dropY : -BLOCK_SIZE + 10);
      
      if (this.currentBlock.isTNT) {
        this.drawTNTBlock(x, y);
      } else {
        this.drawBlock(x, y, COLORS[this.currentBlock.color], false);
      }
    }
    
    pop();
  }
  
  drawCrane() {
    let craneX = this.offsetX + this.craneCol * BLOCK_SIZE + BLOCK_SIZE / 2;
    let craneY = this.offsetY + (-BLOCK_SIZE + 5);
    let glowCol = this.id === 1 ? color(0, 255, 255) : color(255, 100, 255);
    
    push();
    
    // Sci-fi data beam
    stroke(red(glowCol), green(glowCol), blue(glowCol), 40);
    strokeWeight(BLOCK_SIZE - 8);
    line(craneX, craneY - 25, craneX, craneY + 10);
    
    // Energy beam core
    stroke(glowCol);
    strokeWeight(2);
    line(craneX, craneY - 25, craneX, craneY + 10);
    
    // Data injector head
    fill(10, 15, 25);
    stroke(glowCol);
    strokeWeight(3);
    rect(craneX - 12, craneY - 30, 24, 12, 2);
    
    // Holographic brackets
    noFill();
    stroke(glowCol);
    strokeWeight(2);
    line(craneX - 15, craneY - 28, craneX - 10, craneY - 28);
    line(craneX - 15, craneY - 28, craneX - 15, craneY - 23);
    line(craneX + 15, craneY - 28, craneX + 10, craneY - 28);
    line(craneX + 15, craneY - 28, craneX + 15, craneY - 23);
    
    // Column highlight with scan effect
    noFill();
    stroke(red(glowCol), green(glowCol), blue(glowCol), 30);
    strokeWeight(2);
    rect(this.offsetX + this.craneCol * BLOCK_SIZE + 2, this.offsetY, BLOCK_SIZE - 4, GAME_AREA_HEIGHT);
    
    // Scanning line
    let scanY = (frameCount * 3) % GAME_AREA_HEIGHT;
    stroke(glowCol);
    strokeWeight(1);
    line(this.offsetX + this.craneCol * BLOCK_SIZE + 2, this.offsetY + scanY, 
         this.offsetX + this.craneCol * BLOCK_SIZE + BLOCK_SIZE - 2, this.offsetY + scanY);
    
    pop();
  }
  
  drawBlock(x, y, col, highlighted) {
    push();
    
    // Translucent interior (glass/energy field effect)
    fill(red(col), green(col), blue(col), 35);
    noStroke();
    rect(x + 4, y + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8, 3);
    
    // Thick neon glowing border
    noFill();
    stroke(col);
    strokeWeight(3);
    rect(x + 3, y + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6, 3);
    
    // Outer glow
    stroke(red(col), green(col), blue(col), 80);
    strokeWeight(5);
    rect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 3);
    
    // Inner circuit pattern
    stroke(col);
    strokeWeight(1);
    line(x + 8, y + BLOCK_SIZE/2, x + BLOCK_SIZE - 8, y + BLOCK_SIZE/2);
    line(x + BLOCK_SIZE/2, y + 8, x + BLOCK_SIZE/2, y + BLOCK_SIZE - 8);
    
    // Corner accents
    strokeWeight(2);
    point(x + 6, y + 6);
    point(x + BLOCK_SIZE - 6, y + 6);
    point(x + 6, y + BLOCK_SIZE - 6);
    point(x + BLOCK_SIZE - 6, y + BLOCK_SIZE - 6);
    
    pop();
  }
  
  drawTNTBlock(x, y) {
    push();
    let tntCol = color(255, 50, 0);
    
    // Translucent interior
    fill(255, 50, 0, 40);
    noStroke();
    rect(x + 4, y + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8, 3);
    
    // Pulsing glow effect
    let pulse = sin(frameCount * 0.15) * 20 + 150;
    stroke(255, 50, 0, pulse);
    strokeWeight(4);
    rect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 3);
    
    // Bright neon border
    stroke(tntCol);
    strokeWeight(3);
    rect(x + 3, y + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6, 3);
    
    // Warning symbol
    fill(255, 255, 0);
    noStroke();
    textSize(BLOCK_SIZE * 0.3);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    text('⚠', x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2);
    textStyle(NORMAL);
    
    pop();
  }
  
  drawNextBlock(x, y) {
    push();
    translate(x, y);
    
    // Holographic preview box
    let boxCol = this.id === 1 ? color(0, 255, 255) : color(255, 100, 255);
    fill(5, 10, 20, 200);
    stroke(boxCol);
    strokeWeight(2);
    rect(0, 0, BLOCK_SIZE + 10, BLOCK_SIZE + 10, 3);
    
    // Corner accents
    strokeWeight(3);
    let cs = 6;
    line(0, 0, cs, 0);
    line(0, 0, 0, cs);
    line(BLOCK_SIZE + 10 - cs, 0, BLOCK_SIZE + 10, 0);
    line(BLOCK_SIZE + 10, 0, BLOCK_SIZE + 10, cs);
    line(0, BLOCK_SIZE + 10 - cs, 0, BLOCK_SIZE + 10);
    line(0, BLOCK_SIZE + 10, cs, BLOCK_SIZE + 10);
    line(BLOCK_SIZE + 10 - cs, BLOCK_SIZE + 10, BLOCK_SIZE + 10, BLOCK_SIZE + 10);
    line(BLOCK_SIZE + 10, BLOCK_SIZE + 10 - cs, BLOCK_SIZE + 10, BLOCK_SIZE + 10);
    
    // Next block
    if (this.nextBlockIsTNT) {
      this.drawTNTBlock(5, 5);
    } else {
      this.drawBlock(5, 5, COLORS[this.nextBlockColor], false);
    }
    
    pop();
  }
}

// ============================================
// PARTICLE CLASS
// ============================================
class Particle {
  constructor(x, y, vx, vy, col) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.col = col;
    this.life = 255;
    this.size = random(4, 10);
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.3;
    this.vx *= 0.98;
    this.life -= 8;
  }
  
  draw() {
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), this.life);
    circle(this.x, this.y, this.size);
  }
  
  isDead() {
    return this.life <= 0;
  }
}

// ============================================
// CORE FUNCTIONS
// ============================================
function setup() {
  // Create full-screen canvas
  createCanvas(windowWidth, windowHeight);
  textFont('Arial');
  
  // Calculate responsive layout
  calculateLayout();
  
  // Initialize colors - NEON TECH PALETTE
  COLORS = [
    color(255, 20, 147),   // Neon Pink
    color(0, 255, 255),    // Cyan
    color(0, 255, 100),    // Electric Green
    color(255, 215, 0),    // Gold
    color(138, 43, 226)    // Neon Purple
  ];
}

function windowResized() {
  // Resize canvas to new window dimensions
  resizeCanvas(windowWidth, windowHeight);
  
  // Recalculate layout with new dimensions
  calculateLayout();
  
  // Reinitialize menu buttons with new positions
  if (gameState === 'menu') {
    initMenuButtons();
  }
  
  // Update player positions if game is active
  if (gameState === 'playing' || gameState === 'gameOver') {
    updatePlayerPositions();
  }
}

function drawTechBackground() {
  background(5, 10, 20);
  
  // Digital grid overlay
  stroke(0, 255, 255, 20);
  strokeWeight(1);
  
  let gridSize = 40;
  // Vertical lines
  for (let x = 0; x < windowWidth; x += gridSize) {
    line(x, 0, x, windowHeight);
  }
  // Horizontal lines
  for (let y = 0; y < windowHeight; y += gridSize) {
    line(0, y, windowWidth, y);
  }
  
  // Subtle scanline effect
  for (let y = 0; y < windowHeight; y += 4) {
    stroke(0, 255, 255, 2);
    line(0, y, windowWidth, y);
  }
}

function updatePlayerPositions() {
  if (players.length === 2) {
    let gameY = windowHeight * 0.15; // 15% from top
    let spacing = windowWidth * 0.05; // 5% spacing
    
    // Player 1 at 25% of screen width (left quarter)
    let p1X = (windowWidth * 0.25) - (GAME_AREA_WIDTH / 2);
    
    // Player 2 at 75% of screen width (right quarter)
    let p2X = (windowWidth * 0.75) - (GAME_AREA_WIDTH / 2);
    
    players[0].offsetX = p1X;
    players[0].offsetY = gameY;
    players[1].offsetX = p2X;
    players[1].offsetY = gameY;
  }
}

function draw() {
  drawTechBackground();
  
  if (gameState === 'menu') {
    drawMenu();
  } else if (gameState === 'difficultySelect') {
    drawDifficultyMenu();
  } else if (gameState === 'playing') {
    updateGame();
    drawGame();
  } else if (gameState === 'gameOver') {
    drawGame();
    drawWinScreen();
  }
}

function initDifficultyButtons() {
  difficultyButtons = [];
  let w = min(windowWidth * 0.25, 260);
  let h = min(windowHeight * 0.08, 70);
  let centerX = windowWidth / 2 - w / 2;
  let startY = windowHeight * 0.4;

  let labels = [
    { label: 'Easy', sublabel: 'Relaxed' },
    { label: 'Medium', sublabel: 'Standard' },
    { label: 'Hard', sublabel: 'Challenging' }
  ];

  for (let i = 0; i < labels.length; i++) {
    difficultyButtons.push({
      x: centerX,
      y: startY + i * (h + 18),
      w: w,
      h: h,
      label: labels[i].label,
      sublabel: labels[i].sublabel,
      enabled: true
    });
  }

  // Back button
  difficultyButtons.push({
    x: centerX,
    y: startY + 3 * (h + 18),
    w: w,
    h: h * 0.8,
    label: 'Back',
    sublabel: '',
    enabled: true
  });
}

function drawDifficultyMenu() {
  // Dark overlay
  fill(0, 0, 0, 200);
  rect(0, 0, windowWidth, windowHeight);

  // Title
  push();
  textAlign(CENTER, CENTER);
  textSize(min(windowWidth * 0.04, 36));
  fill(0, 255, 255);
  text('Select Difficulty', windowWidth / 2, windowHeight * 0.22);
  pop();

  if (!difficultyButtons || difficultyButtons.length === 0) initDifficultyButtons();
  for (let b of difficultyButtons) drawButton(b);
}

// ============================================
// MENU
// ============================================

// Button dimensions and positions
let singlePlayerButton, twoPlayerButton;

function initMenuButtons() {
  let buttonWidth = min(windowWidth * 0.35, 350);
  let buttonHeight = windowHeight * 0.08;
  buttonHeight = constrain(buttonHeight, 60, 90);
  let buttonSpacing = windowHeight * 0.04;
  let startY = windowHeight * 0.55;
  
  singlePlayerButton = {
    x: windowWidth / 2 - buttonWidth / 2,
    y: startY,
    w: buttonWidth,
    h: buttonHeight,
    label: 'Single Player',
    sublabel: 'Solo Challenge',
    enabled: true
  };
  
  twoPlayerButton = {
    x: windowWidth / 2 - buttonWidth / 2,
    y: startY + buttonHeight + buttonSpacing,
    w: buttonWidth,
    h: buttonHeight,
    label: '2 Player',
    sublabel: 'Race to the Top!',
    enabled: true
  };
}

function drawMenu() {
  // Animated background blocks
  drawMenuBackground();
  
  // Title - "Tower Tumble" with neon glow
  push();
  textAlign(CENTER, CENTER);
  
  // Calculate responsive font sizes
  let titleSize = min(windowWidth * 0.09, 80);
  let subtitleSize = min(windowWidth * 0.025, 24);
  
  // "TOWER" with cyan glow
  textSize(titleSize);
  textStyle(BOLD);
  fill(0, 255, 255, 100);
  text('TOWER', windowWidth / 2 + 3, windowHeight * 0.25 + 3);
  fill(0, 255, 255);
  text('TOWER', windowWidth / 2, windowHeight * 0.25);
  
  // "TUMBLE" with pink glow
  fill(255, 20, 147, 100);
  text('TUMBLE', windowWidth / 2 + 3, windowHeight * 0.35 + 3);
  fill(255, 20, 147);
  text('TUMBLE', windowWidth / 2, windowHeight * 0.35);
  textStyle(NORMAL);
  
  // Subtitle with glow
  textSize(subtitleSize);
  fill(138, 43, 226, 120);
  text('Competitive Puzzle Challenge', windowWidth / 2 + 2, windowHeight * 0.44 + 2);
  fill(138, 43, 226);
  text('Competitive Puzzle Challenge', windowWidth / 2, windowHeight * 0.44);
  pop();
  
  // Draw buttons
  if (!singlePlayerButton) initMenuButtons();
  
  drawButton(singlePlayerButton);
  drawButton(twoPlayerButton);
  
  // Instructions at bottom with glow
  textAlign(CENTER, CENTER);
  textSize(min(windowWidth * 0.018, 16));
  fill(0, 255, 255, 150);
  text('Match 3+ blocks • First to the top wins!', windowWidth / 2 + 1, windowHeight - 59);
  fill(0, 255, 255);
  text('Match 3+ blocks • First to the top wins!', windowWidth / 2, windowHeight - 60);
}

function drawMenuBackground() {
  // Draw decorative neon blocks floating in background
  for (let i = 0; i < 5; i++) {
    let x = (i + 0.5) * (windowWidth / 5);
    let yOffset = sin(frameCount * 0.02 + i) * 20;
    let y = windowHeight * 0.1 + yOffset;
    let blockSize = min(windowWidth * 0.04, 50);
    let col = COLORS[i];
    
    push();
    
    // Translucent fill
    fill(red(col), green(col), blue(col), 40);
    noStroke();
    rect(x - blockSize / 2 + 2, y + 2, blockSize - 4, blockSize - 4, 3);
    
    // Neon border
    noFill();
    stroke(col);
    strokeWeight(3);
    rect(x - blockSize / 2, y, blockSize, blockSize, 3);
    
    // Outer glow
    stroke(red(col), green(col), blue(col), 100);
    strokeWeight(5);
    rect(x - blockSize / 2 - 1, y - 1, blockSize + 2, blockSize + 2, 3);
    
    // Circuit lines
    stroke(col);
    strokeWeight(1);
    line(x - blockSize / 4, y + blockSize / 2, x + blockSize / 4, y + blockSize / 2);
    line(x, y + blockSize / 4, x, y + 3 * blockSize / 4);
    
    pop();
  }
}

function drawButton(btn) {
  push();
  
  // Check if mouse is hovering
  let isHovering = mouseX > btn.x && mouseX < btn.x + btn.w &&
                   mouseY > btn.y && mouseY < btn.y + btn.h;
  
  if (btn.enabled) {
    // Holographic button
    if (isHovering) {
      // Hover glow
      fill(0, 255, 255, 30);
      noStroke();
      rect(btn.x - 5, btn.y - 5, btn.w + 10, btn.h + 10, 8);
      
      fill(5, 10, 20, 220);
      stroke(0, 255, 255);
      strokeWeight(3);
    } else {
      fill(5, 10, 20, 180);
      stroke(0, 255, 255, 180);
      strokeWeight(2);
    }
    rect(btn.x, btn.y, btn.w, btn.h, 6);
    
    // Corner brackets
    stroke(0, 255, 255);
    strokeWeight(3);
    let cs = 15;
    noFill();
    // Top-left
    line(btn.x, btn.y, btn.x + cs, btn.y);
    line(btn.x, btn.y, btn.x, btn.y + cs);
    // Top-right
    line(btn.x + btn.w - cs, btn.y, btn.x + btn.w, btn.y);
    line(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + cs);
    // Bottom-left
    line(btn.x, btn.y + btn.h - cs, btn.x, btn.y + btn.h);
    line(btn.x, btn.y + btn.h, btn.x + cs, btn.y + btn.h);
    // Bottom-right
    line(btn.x + btn.w - cs, btn.y + btn.h, btn.x + btn.w, btn.y + btn.h);
    line(btn.x + btn.w, btn.y + btn.h - cs, btn.x + btn.w, btn.y + btn.h);
  } else {
    // Disabled button (red tech style)
    fill(60, 65, 80);
    stroke(90, 95, 110);
    // Disabled button (red tech style)
    fill(5, 10, 20, 180);
    stroke(255, 50, 50, 100);
    strokeWeight(2);
    rect(btn.x, btn.y, btn.w, btn.h, 6);
  }
  
  // Button text with glow
  textAlign(CENTER, CENTER);
  let mainTextSize = min(btn.h * 0.4, 32);
  let subTextSize = min(btn.h * 0.2, 16);
  
  if (btn.enabled) {
    // Glow
    fill(0, 255, 255, 150);
    noStroke();
    textSize(mainTextSize);
    textStyle(BOLD);
    text(btn.label, btn.x + btn.w / 2 + 1, btn.y + btn.h / 2 - mainTextSize * 0.3 + 1);
    
    // Main text
    fill(0, 255, 255);
    text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 - mainTextSize * 0.3);
    
    textStyle(NORMAL);
    textSize(subTextSize);
    fill(138, 43, 226);
    text(btn.sublabel, btn.x + btn.w / 2, btn.y + btn.h / 2 + mainTextSize * 0.5);
  } else {
    fill(255, 50, 50, 180);
    noStroke();
    textSize(mainTextSize);
    textStyle(BOLD);
    text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 - mainTextSize * 0.3);
    
    textStyle(NORMAL);
    textSize(subTextSize);
    fill(255, 50, 50, 120);
    text(btn.sublabel, btn.x + btn.w / 2, btn.y + btn.h / 2 + mainTextSize * 0.5);
  }
  
  // Disabled badge - holographic style
  if (!btn.enabled) {
    fill(10, 5, 5, 200);
    stroke(255, 50, 50);
    strokeWeight(2);
    let badgeW = 80;
    let badgeH = 22;
    rect(btn.x + btn.w - badgeW - 10, btn.y + 10, badgeW, badgeH, 3);
    
    noStroke();
    fill(255, 50, 50);
    textSize(11);
    textStyle(BOLD);
    text('LOCKED', btn.x + btn.w - badgeW / 2 - 10, btn.y + 10 + badgeH / 2);
    textStyle(NORMAL);
  }
  // Highlight selection when in difficulty menu
  if (gameState === 'difficultySelect' && btn.label && btn.label.toLowerCase() === selectedDifficulty) {
    noFill();
    stroke(0, 255, 100);
    strokeWeight(3);
    rect(btn.x - 6, btn.y - 6, btn.w + 12, btn.h + 12, 10);
  }

  pop();
}

// ============================================
// GAME UPDATE
// ============================================
function updateGame() {
  // Update players
  for (let p of players) {
    p.update();
    
    // Check win condition
    if (p.checkWinCondition()) {
      winner = p.id;
      gameState = 'gameOver';
    }
  }
  
  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].isDead()) particles.splice(i, 1);
  }
}

// ============================================
// GAME DRAWING
// ============================================
function drawGame() {
  // Calculate responsive positions
  let gameY = windowHeight * 0.15; // 15% from top
  let spacing = windowWidth * 0.05; // 5% spacing
  
  // Player 1 at 25% of screen width (left quarter)
  let p1X = (windowWidth * 0.25) - (GAME_AREA_WIDTH / 2);
  
  // Player 2 at 75% of screen width (right quarter)  
  let p2X = (windowWidth * 0.75) - (GAME_AREA_WIDTH / 2);
  
  // Draw header bar - Holographic HUD
  fill(5, 10, 20, 220);
  noStroke();
  rect(0, 0, windowWidth, windowHeight * 0.08);
  
  // Tech border lines
  stroke(0, 255, 255, 180);
  strokeWeight(2);
  line(0, windowHeight * 0.08, windowWidth, windowHeight * 0.08);
  stroke(0, 255, 255, 80);
  strokeWeight(1);
  line(0, windowHeight * 0.08 - 3, windowWidth, windowHeight * 0.08 - 3);
  
  // Title with neon glow
  push();
  textAlign(CENTER, CENTER);
  let headerTextSize = min(windowWidth * 0.025, 24);
  textSize(headerTextSize);
  
  // Glow effect
  fill(0, 255, 255, 100);
  text('TOWER TUMBLE', windowWidth / 2 + 2, windowHeight * 0.04 + 2);
  text('TOWER TUMBLE', windowWidth / 2 - 2, windowHeight * 0.04 - 2);
  
  // Main text
  fill(0, 255, 255);
  text('TOWER TUMBLE', windowWidth / 2, windowHeight * 0.04);
  pop();
  
  // For single player mode (all difficulties), center player 1 with no player 2
  if (singlePlayerMode) {
    // Single player mode: centered player with side panel
    let centerX = (windowWidth / 2) - (GAME_AREA_WIDTH / 2);
    
    // Player 1 side panel (left side of center)
    push();
    translate(centerX - SIDE_PANEL_WIDTH - 10, gameY);
    drawPlayerPanel(players[0], 'left');
    pop();
    
    // Draw only player 1
    players[0].draw();
  } else {
    // Two player mode
    // Player 1 side panel (left side)
    push();
    translate(p1X - SIDE_PANEL_WIDTH - 10, gameY);
    drawPlayerPanel(players[0], 'left');
    pop();
    
    // Player 2 side panel (right side)
    push();
    translate(p2X + GAME_AREA_WIDTH + 10, gameY);
    drawPlayerPanel(players[1], 'right');
    pop();
    
    // Draw game areas
    players[0].draw();
    players[1].draw();
    
    // Draw center divider
    stroke(60, 70, 100);
    strokeWeight(3);
    let dividerX = windowWidth / 2;
    line(dividerX, gameY, dividerX, gameY + GAME_AREA_HEIGHT);
    
    // VS label - Neon holographic
    push();
    let vsTextSize = min(windowWidth * 0.03, 28);
    textSize(vsTextSize);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    
    // Pulsing glow
    let glowIntensity = sin(frameCount * 0.08) * 30 + 120;
    fill(255, 255, 0, glowIntensity);
    text('VS', dividerX + 2, gameY + GAME_AREA_HEIGHT / 2 + 2);
    fill(255, 100, 255, glowIntensity);
    text('VS', dividerX - 2, gameY + GAME_AREA_HEIGHT / 2 - 2);
    
    // Main text
    fill(255, 255, 0);
    text('VS', dividerX, gameY + GAME_AREA_HEIGHT / 2);
    textStyle(NORMAL);
    pop();
  }
  
  // Draw particles
  for (let p of particles) {
    p.draw();
  }
  
  // Draw controls reminder at bottom with glow
  let controlTextSize = min(windowWidth * 0.015, 14);
  textSize(controlTextSize);
  textAlign(CENTER, CENTER);
  fill(0, 255, 255, 100);
  text('P1: A/D Move, W Drop  |  P2: ←/→ Move, ↑ Drop', windowWidth / 2 + 1, windowHeight - 19);
  fill(0, 255, 255);
  text('P1: A/D Move, W Drop  |  P2: ←/→ Move, ↑ Drop', windowWidth / 2, windowHeight - 20);
}

function drawPlayerPanel(player, side) {
  let panelX = 10;
  
  // Player label with neon glow
  let labelColor = player.id === 1 ? color(0, 255, 255) : color(255, 100, 255);
  let labelSize = min(SIDE_PANEL_WIDTH * 0.18, 20);
  let scoreSize = min(SIDE_PANEL_WIDTH * 0.14, 16);
  let scoreValueSize = min(SIDE_PANEL_WIDTH * 0.22, 24);
  let smallTextSize = min(SIDE_PANEL_WIDTH * 0.12, 13);
  
  textAlign(CENTER, TOP);
  textSize(labelSize);
  textStyle(BOLD);
  
  // Glow effect
  fill(red(labelColor), green(labelColor), blue(labelColor), 80);
  text('PLAYER ' + player.id, SIDE_PANEL_WIDTH / 2 + 1, 11);
  
  // Main text
  fill(labelColor);
  text('PLAYER ' + player.id, SIDE_PANEL_WIDTH / 2, 10);
  textStyle(NORMAL);
  
  // Score with glow
  fill(150, 200, 255);
  textSize(scoreSize);
  text('Score', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.15);
  
  textSize(scoreValueSize);
  // Glow
  fill(red(labelColor), green(labelColor), blue(labelColor), 100);
  text(player.score, SIDE_PANEL_WIDTH / 2 + 1, GAME_AREA_HEIGHT * 0.15 + scoreSize + 6);
  // Main
  fill(labelColor);
  text(player.score, SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.15 + scoreSize + 5);
  
  // Next block preview
  fill(180);
  textSize(smallTextSize);
  text('NEXT', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.35);
  
  let previewX = (SIDE_PANEL_WIDTH - BLOCK_SIZE - 10) / 2;
  let previewY = GAME_AREA_HEIGHT * 0.4;
  player.drawNextBlock(previewX, previewY);
  
  // Controls reminder
  fill(100);
  textSize(smallTextSize * 0.85);
  if (player.id === 1) {
    text('A/D: Move', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7);
    text('W: Drop', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7 + smallTextSize * 1.2);
  } else {
    text('←/→: Move', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7);
    text('↑: Drop', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7 + smallTextSize * 1.2);
  }
}

// ============================================
// WIN SCREEN
// ============================================
function drawWinScreen() {
  // Dark overlay
  fill(0, 0, 0, 200);
  rect(0, 0, windowWidth, windowHeight);
  
  // Holographic frame
  stroke(255, 215, 0, 150);
  strokeWeight(3);
  noFill();
  let frameW = windowWidth * 0.6;
  let frameH = windowHeight * 0.5;
  let frameX = windowWidth / 2 - frameW / 2;
  let frameY = windowHeight / 2 - frameH / 2;
  rect(frameX, frameY, frameW, frameH, 10);
  
  // Outer glow
  stroke(255, 215, 0, 50);
  strokeWeight(10);
  rect(frameX - 5, frameY - 5, frameW + 10, frameH + 10, 10);
  
  // Winner announcement with neon glow
  let winnerColor = winner === 1 ? color(0, 255, 255) : color(255, 100, 255);
  
  let winTextSize = min(windowWidth * 0.06, 56);
  let scoreTextSize = min(windowWidth * 0.025, 22);
  let promptTextSize = min(windowWidth * 0.022, 20);
  
  textAlign(CENTER, CENTER);
  textSize(winTextSize);
  textStyle(BOLD);
  
  // Glow effect
  fill(red(winnerColor), green(winnerColor), blue(winnerColor), 150);
  text('PLAYER ' + winner + ' WINS!', windowWidth / 2 + 3, windowHeight / 2 - 37);
  
  // Main text
  fill(winnerColor);
  text('PLAYER ' + winner + ' WINS!', windowWidth / 2, windowHeight / 2 - 40);
  textStyle(NORMAL);
  
  // Scores with glow
  textSize(scoreTextSize);
  fill(0, 255, 255, 120);
  text('Player 1 Score: ' + players[0].score, windowWidth / 2 + 2, windowHeight / 2 + 22);
  fill(0, 255, 255);
  text('Player 1 Score: ' + players[0].score, windowWidth / 2, windowHeight / 2 + 20);
  
  fill(255, 100, 255, 120);
  text('Player 2 Score: ' + players[1].score, windowWidth / 2 + 2, windowHeight / 2 + 52);
  fill(255, 100, 255);
  text('Player 2 Score: ' + players[1].score, windowWidth / 2, windowHeight / 2 + 50);
  
  // Restart prompt with pulsing glow
  textSize(promptTextSize);
  let pulse = sin(frameCount * 0.08) * 50 + 205;
  fill(0, 255, 100, pulse);
  text('PRESS SPACE TO PLAY AGAIN', windowWidth / 2 + 2, windowHeight / 2 + 112);
  fill(0, 255, 100);
  text('PRESS SPACE TO PLAY AGAIN', windowWidth / 2, windowHeight / 2 + 110);
}

// ============================================
// INPUT HANDLING
// ============================================
function mousePressed() {
  if (gameState === 'menu') {
    // Check if Single Player button was clicked -> open difficulty menu
    if (singlePlayerButton && singlePlayerButton.enabled) {
      if (mouseX > singlePlayerButton.x && mouseX < singlePlayerButton.x + singlePlayerButton.w &&
          mouseY > singlePlayerButton.y && mouseY < singlePlayerButton.y + singlePlayerButton.h) {
        gameState = 'difficultySelect';
        initDifficultyButtons();
        return;
      }
    }

    // Check if 2 Player button was clicked
    if (twoPlayerButton && twoPlayerButton.enabled) {
      if (mouseX > twoPlayerButton.x && mouseX < twoPlayerButton.x + twoPlayerButton.w &&
          mouseY > twoPlayerButton.y && mouseY < twoPlayerButton.y + twoPlayerButton.h) {
        startGame('two');
      }
    }
  }

  else if (gameState === 'difficultySelect') {
    // Check difficulty buttons
    for (let b of difficultyButtons) {
      if (mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h) {
        if (b.label === 'Back') {
          gameState = 'menu';
          return;
        }
        // Select difficulty and start game immediately
        let diff = b.label.toLowerCase();
        selectedDifficulty = diff;
        startGame('single', diff);
        return;
      }
    }
  }
}

function keyPressed() {
  if (gameState === 'menu') {
    if (key === ' ') {
      startGame('two');
    }
  } else if (gameState === 'playing') {
    // Player 1 controls (A/D/W)
    if (key === 'a' || key === 'A') {
      players[0].moveCrane(-1);
    } else if (key === 'd' || key === 'D') {
      players[0].moveCrane(1);
    } else if (key === 'w' || key === 'W') {
      players[0].dropBlock();
    }
    
    // Player 2 controls (Arrow keys)
    if (keyCode === LEFT_ARROW) {
      players[1].moveCrane(-1);
    } else if (keyCode === RIGHT_ARROW) {
      players[1].moveCrane(1);
    } else if (keyCode === UP_ARROW) {
      players[1].dropBlock();
    }
  } else if (gameState === 'gameOver') {
    if (key === ' ') {
      startGame(gameMode, selectedDifficulty);
    }
  }
  
  // Prevent default browser behavior for arrow keys
  if ([32, 37, 38, 39, 40].includes(keyCode)) {
    return false;
  }
}

// ============================================
// GAME LOGIC
// ============================================
function startGame(mode = 'two', difficulty = 'medium') {
  gameMode = mode;
  selectedDifficulty = difficulty;
  singlePlayerMode = (mode === 'single');

  gameState = 'playing';
  winner = null;
  particles = [];
  lastObstacleSpawn = millis();

  // Calculate responsive player positions
  let gameY = windowHeight * 0.15; // 15% from top

  if (singlePlayerMode) {
    // Single player mode (any difficulty): centered on screen
    let centerX = (windowWidth / 2) - (GAME_AREA_WIDTH / 2);
    players = [new Player(1, centerX, gameY)];
  } else {
    // Two player mode: side by side
    let p1X = (windowWidth * 0.25) - (GAME_AREA_WIDTH / 2);
    let p2X = (windowWidth * 0.75) - (GAME_AREA_WIDTH / 2);

    players = [
      new Player(1, p1X, gameY),
      new Player(2, p2X, gameY)
    ];

    // Mark player 2 as AI for medium/hard (not implemented yet)
    if (singlePlayerMode && difficulty !== 'easy') {
      players[1].isAI = true;
    } else {
      players[1].isAI = false;
    }
  }
}