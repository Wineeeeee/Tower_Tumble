// ============================================
// RACE TO THE TOP - 2 Player Competitive Puzzle
// ============================================

// GLOBAL VARIABLES
let gameState = 'menu';
let winner = null;
let players = [];
let particles = [];
let pieceIdCounter = 0; // Unique ID generator for each piece

// COLOR PALETTE (3 colors for high match frequency = harder gameplay)
let COLORS;

// TETROMINO SHAPES (colors assigned randomly for matching mechanic)
const SHAPES = {
  I: { blocks: [[0,0], [0,1], [0,2], [0,3]] },      // Line piece
  J: { blocks: [[0,0], [1,0], [1,1], [1,2]] },      // J piece
  L: { blocks: [[0,2], [1,0], [1,1], [1,2]] },      // L piece
  O: { blocks: [[0,0], [0,1], [1,0], [1,1]] },      // Square piece
  S: { blocks: [[0,1], [0,2], [1,0], [1,1]] },      // S piece
  T: { blocks: [[0,1], [1,0], [1,1], [1,2]] },      // T piece
  Z: { blocks: [[0,0], [0,1], [1,1], [1,2]] }       // Z piece
};
const SHAPE_NAMES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

// CONSTANTS (Grid structure)
const COLS = 10;          // 10 columns per player (expanded for Tetris pieces)
const ROWS = 16;          // Grid height (increased for more gameplay space)
const DROP_SPEED = 12;    // Falling speed (faster for larger grid)
const TNT_CHANCE = 0.05;  // 5% chance for TNT block (reduced)

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
// PIECE CLASS (Tetromino)
// ============================================
class Piece {
  constructor(shapeName) {
    this.shapeName = shapeName;
    this.shape = SHAPES[shapeName];
    this.blocks = JSON.parse(JSON.stringify(this.shape.blocks)); // Deep copy
    this.colorIndex = floor(random(3)); // Randomly assign one of 3 colors
    this.isTNT = false;
    this.id = pieceIdCounter++; // Assign unique ID to track piece identity
  }
  
  // Rotate the piece 90 degrees clockwise
  rotate() {
    if (this.shapeName === 'O') return; // Square doesn't rotate
    
    // Rotate each block around center: (x,y) -> (y, -x)
    let rotated = [];
    for (let block of this.blocks) {
      rotated.push([block[1], -block[0]]);
    }
    
    // Normalize to positive coordinates
    let minRow = Math.min(...rotated.map(b => b[0]));
    let minCol = Math.min(...rotated.map(b => b[1]));
    
    this.blocks = rotated.map(b => [b[0] - minRow, b[1] - minCol]);
  }
  
  // Get width of the piece
  getWidth() {
    return Math.max(...this.blocks.map(b => b[1])) + 1;
  }
  
  // Get height of the piece
  getHeight() {
    return Math.max(...this.blocks.map(b => b[0])) + 1;
  }
}

// ============================================
// PLAYER CLASS
// ============================================
class Player {
  constructor(id, offsetX, offsetY) {
    this.id = id;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.grid = this.createEmptyGrid();
    this.currentPiece = null;
    this.nextPiece = null;
    this.pieceCol = 3;  // Starting column (center-ish)
    this.pieceRow = -2; // Start above visible area
    this.dropping = false;
    this.dropY = 0;
    this.score = 0;
    this.powerMeter = 0; // 0-100%, fills 25% per line
    this.chargedLines = new Set(); // Track which lines have been charged
    this.opponent = null; // Reference to opponent player
    
    this.prepareNextPiece();
    this.spawnPiece();
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
  
  prepareNextPiece() {
    // Small chance for TNT, otherwise random Tetromino
    if (random() < TNT_CHANCE) {
      this.nextPiece = { isTNT: true };
    } else {
      let shapeName = random(SHAPE_NAMES);
      this.nextPiece = new Piece(shapeName);
    }
  }
  
  spawnPiece() {
    this.currentPiece = this.nextPiece;
    this.pieceCol = floor(COLS / 2) - 2; // Start near center
    this.pieceRow = -2; // Start above visible area
    this.dropping = false;
    this.dropY = this.pieceRow * BLOCK_SIZE;
    this.prepareNextPiece();
  }
  
  movePiece(dir) {
    if (this.dropping || !this.currentPiece) return;
    
    let newCol = this.pieceCol + dir;
    
    // Check if move is valid
    if (this.canPlacePiece(this.pieceRow, newCol, this.currentPiece)) {
      this.pieceCol = newCol;
    }
  }
  
  rotatePiece() {
    if (this.dropping || !this.currentPiece || this.currentPiece.isTNT) return;
    
    // Try rotation
    let originalBlocks = JSON.parse(JSON.stringify(this.currentPiece.blocks));
    this.currentPiece.rotate();
    
    // Check if rotation is valid, if not revert
    if (!this.canPlacePiece(this.pieceRow, this.pieceCol, this.currentPiece)) {
      this.currentPiece.blocks = originalBlocks;
    }
  }
  
  dropPiece() {
    if (this.dropping || !this.currentPiece) return;
    this.dropping = true;
  }
  
  canPlacePiece(row, col, piece) {
    if (!piece || piece.isTNT) {
      // For TNT (single block)
      if (col < 0 || col >= COLS) return false;
      if (row >= 0 && row < ROWS && this.grid[row][col] !== null) return false;
      return true;
    }
    
    // Check each block of the Tetromino
    for (let block of piece.blocks) {
      let r = row + block[0];
      let c = col + block[1];
      
      // Check boundaries
      if (c < 0 || c >= COLS) return false;
      if (r >= ROWS) return false;
      
      // Check collision with existing blocks (only if in visible area)
      if (r >= 0 && this.grid[r][c] !== null) return false;
    }
    
    return true;
  }
  
  update() {
    if (this.dropping && this.currentPiece) {
      this.dropY += DROP_SPEED;
      
      // Calculate landing position
      let targetRow = this.findLandingRow();
      let targetY = targetRow * BLOCK_SIZE;
      
      if (this.dropY >= targetY) {
        // Piece has landed
        this.dropY = targetY;
        this.pieceRow = targetRow;
        this.placePiece();
        this.dropping = false;
      } else {
        this.pieceRow = floor(this.dropY / BLOCK_SIZE);
      }
    }
  }
  
  findLandingRow() {
    if (!this.currentPiece) return ROWS - 1;
    
    if (this.currentPiece.isTNT) {
      // Single block landing
      for (let row = max(0, this.pieceRow); row < ROWS; row++) {
        if (this.grid[row][this.pieceCol] !== null) {
          return row - 1;
        }
      }
      return ROWS - 1;
    }
    
    // Find lowest valid position for Tetromino
    for (let testRow = max(0, this.pieceRow); testRow < ROWS; testRow++) {
      if (!this.canPlacePiece(testRow, this.pieceCol, this.currentPiece)) {
        return testRow - 1;
      }
    }
    return ROWS - 1;
  }
  
  placePiece() {
    if (!this.currentPiece) return;
    
    if (this.currentPiece.isTNT) {
      // TNT explosion
      if (this.pieceRow >= 0 && this.pieceRow < ROWS) {
        this.explodeTNT(this.pieceRow, this.pieceCol);
      }
    } else {
      // Place Tetromino blocks with both color AND piece ID
      console.log('[LOCK] Piece ID', this.currentPiece.id, 'locked at row:', this.pieceRow, 'col:', this.pieceCol, 'color:', window.COLOR_NAMES[this.currentPiece.colorIndex]);
      for (let block of this.currentPiece.blocks) {
        let r = this.pieceRow + block[0];
        let c = this.pieceCol + block[1];
        
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          this.grid[r][c] = { color: this.currentPiece.colorIndex, id: this.currentPiece.id };
          console.log('[LOCK] Block placed at [', r, ',', c, '] with color:', window.COLOR_NAMES[this.currentPiece.colorIndex], 'ID:', this.currentPiece.id);
        }
      }
      
      this.score += 10;
      
      // STEP 1: Check for color matches (destructive - removes blocks)
      console.log('[CHECK] Starting match-3 detection...');
      this.checkMatches();
      
      // STEP 2: Check for completed lines (non-destructive - charges power)
      console.log('[CHECK] Starting line detection...');
      this.checkLines();
    }
    
    // Spawn next piece
    this.spawnPiece();
  }
  
  checkLines() {
    // MECHANIC A: Non-Destructive Line Detection (Power-Up Charge)
    let completedLines = 0;
    
    // Check each row from bottom to top
    for (let row = ROWS - 1; row >= 0; row--) {
      let isComplete = true;
      
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] === null) {
          isComplete = false;
          break;
        }
      }
      
      if (isComplete) {
        completedLines++;
        
        // Visual Cue: Flash row white briefly (blocks stay on screen)
        for (let col = 0; col < COLS; col++) {
          let px = this.offsetX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
          let py = this.offsetY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
          // Small white sparkle particles to show charge
          for (let i = 0; i < 3; i++) {
            let a = random(TWO_PI);
            let s = random(1, 3);
            particles.push(new Particle(px, py, cos(a) * s, sin(a) * s, color(255, 255, 255)));
          }
        }
        // NOTE: Blocks remain on grid - we do NOT remove them!
      }
    }
    
    // Charge power meter (+20% per line)
    if (completedLines > 0) {
      this.powerMeter += completedLines * 20;
      this.score += completedLines * 50;
      
      // Trigger attack at 100%
      if (this.powerMeter >= 100) {
        this.powerMeter = 0;
        this.activatePowerAttack();
      }
    }
  }
  
  checkMatches() {
    // MECHANIC B: Destructive Color Matching (Space Clearing)
    let matched = this.findMatches();
    
    console.log('[MATCH] Found', matched.length, 'blocks to remove');
    
    if (matched.length > 0) {
      console.log('🎯 MATCH FOUND! Removing', matched.length, 'blocks');
      
      // Destroy matched blocks
      for (let pos of matched) {
        let cellData = this.grid[pos.row][pos.col];
        let colorIndex = cellData.color;
        console.log('[REMOVE] Removing block at [', pos.row, ',', pos.col, '] color:', window.COLOR_NAMES[colorIndex], 'ID:', cellData.id);
        
        let px = this.offsetX + pos.col * BLOCK_SIZE + BLOCK_SIZE / 2;
        let py = this.offsetY + pos.row * BLOCK_SIZE + BLOCK_SIZE / 2;
        this.createPopParticles(px, py, COLORS[colorIndex]);
        
        // Set to null (empty)
        this.grid[pos.row][pos.col] = null;
      }
      
      this.score += matched.length * 15;
      
      console.log('[GRAVITY] Applying gravity...');
      // Apply gravity to fill gaps
      this.applyGravity();
      
      console.log('[CHAIN] Checking for chain reactions...');
      // Check for chain reactions
      this.checkMatches();
    } else {
      console.log('[MATCH] No matches found');
    }
  }
  
  findMatches() {
    let matched = new Set();
    let visited = new Set();
    
    console.log('[SCAN] Scanning entire grid for matches...');
    this.debugGrid(); // Show grid state
    
    // Search entire grid for color groups
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let key = `${row},${col}`;
        if (this.grid[row][col] !== null && !visited.has(key)) {
          let color = this.grid[row][col].color;
          let group = this.floodFill(row, col, color, new Set());
          
          // Count unique piece IDs in this group
          let uniqueIds = new Set();
          for (let pos of group) {
            let [r, c] = pos.split(',').map(Number);
            let cellId = this.grid[r][c].id;
            uniqueIds.add(cellId);
          }
          
          console.log('[SCAN] Found group at [', row, ',', col, '] color:', window.COLOR_NAMES[color], '(' + color + ')', 'blocks:', group.size, 'unique pieces:', uniqueIds.size);
          
          // Mark all cells in this group as visited
          for (let pos of group) {
            visited.add(pos);
          }
          
          // Only pop if 3+ DIFFERENT pieces are connected
          if (uniqueIds.size >= 3) {
            console.log('✓ [GROUP] Group has', uniqueIds.size, 'unique pieces (>= 3) - QUALIFIES FOR REMOVAL!');
            for (let pos of group) {
              matched.add(pos);
            }
          } else {
            console.log('✗ [GROUP] Group has only', uniqueIds.size, 'unique piece(s) - SAFE (need 3+)');
          }
        }
      }
    }
    
    // Convert set to array
    let result = [];
    for (let pos of matched) {
      let [r, c] = pos.split(',').map(Number);
      result.push({ row: r, col: c });
    }
    
    console.log('[RESULT] Total blocks to remove:', result.length);
    return result;
  }
  
  debugGrid() {
    // Print grid state for debugging (bottom rows only to save space)
    console.log('=== GRID STATE (Bottom 8 rows) ===');
    console.log('Legend: R=Red, B=Blue, G=Green, .=empty, [Color:ID]');
    for (let row = ROWS - 8; row < ROWS; row++) {
      let rowStr = 'Row ' + row.toString().padStart(2) + ': ';
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] === null) {
          rowStr += '.    ';
        } else {
          // Show color and piece ID
          let colorLabel = ['R', 'B', 'G'][this.grid[row][col].color];
          let idStr = this.grid[row][col].id.toString().padStart(2);
          rowStr += colorLabel + ':' + idStr + ' ';
        }
      }
      console.log(rowStr);
    }
    console.log('===================================');
  }
  
  floodFill(row, col, targetColor, visited) {
    let key = `${row},${col}`;
    
    // Boundary checks
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return visited;
    if (visited.has(key)) return visited;
    if (this.grid[row][col] === null || this.grid[row][col].color !== targetColor) return visited;
    
    visited.add(key);
    
    // Check 4 orthogonal directions
    this.floodFill(row - 1, col, targetColor, visited);
    this.floodFill(row + 1, col, targetColor, visited);
    this.floodFill(row, col - 1, targetColor, visited);
    this.floodFill(row, col + 1, targetColor, visited);
    
    return visited;
  }
  
  activatePowerAttack() {
    // Attack the opponent by removing their top 3 rows
    if (this.opponent) {
      this.opponent.receiveAttack();
      
      // Create visual effect at opponent's screen
      let centerX = this.opponent.offsetX + (GAME_AREA_WIDTH / 2);
      let centerY = this.opponent.offsetY + (GAME_AREA_HEIGHT / 4);
      
      for (let i = 0; i < 50; i++) {
        let a = random(TWO_PI);
        let s = random(5, 12);
        particles.push(new Particle(centerX, centerY, cos(a) * s, sin(a) * s, color(255, 50, 0)));
      }
    }
  }
  
  receiveAttack() {
    // POWER-UP ATTACK: Remove BOTTOM 3 rows (lowers opponent's height)
    let rowsToRemove = 3;
    
    // Remove from bottom rows (ROWS-3, ROWS-2, ROWS-1)
    for (let row = ROWS - rowsToRemove; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] !== null) {
          // Create pop particles
          let px = this.offsetX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
          let py = this.offsetY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
          this.createPopParticles(px, py, COLORS[this.grid[row][col].color]);
          this.grid[row][col] = null;
        }
      }
    }
  }
  
  explodeTNT(row, col) {
    // Create explosion particles
    let centerX = this.offsetX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
    let centerY = this.offsetY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
    
    for (let i = 0; i < 40; i++) {
      let a = random(TWO_PI);
      let s = random(4, 10);
      particles.push(new Particle(centerX, centerY, cos(a) * s, sin(a) * s, color(255, 150, 0)));
    }
    
    // Clear 3x3 area around explosion
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        let r = row + dr;
        let c = col + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          if (this.grid[r][c] !== null) {
            let px = this.offsetX + c * BLOCK_SIZE + BLOCK_SIZE / 2;
            let py = this.offsetY + r * BLOCK_SIZE + BLOCK_SIZE / 2;
            this.createPopParticles(px, py, COLORS[this.grid[r][c].color]);
            this.grid[r][c] = null;
            this.score += 25;
          }
        }
      }
    }
    
    // Apply gravity
    this.applyGravity();
    
    // Check for matches after TNT explosion
    console.log('[TNT] Checking for matches after explosion...');
    this.checkMatches();
  }
  
  applyGravity() {
    console.log('[GRAVITY] Applying gravity to grid...');
    let moveCount = 0;
    
    // Drop blocks down in each column
    for (let col = 0; col < COLS; col++) {
      let writeRow = ROWS - 1;
      
      for (let row = ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] !== null) {
          if (row !== writeRow) {
            this.grid[writeRow][col] = this.grid[row][col];
            this.grid[row][col] = null;
            moveCount++;
          }
          writeRow--;
        }
      }
    }
    
    console.log('[GRAVITY] Moved', moveCount, 'blocks down');
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
    
    // Draw game area background
    fill(5, 10, 20, 180);
    noStroke();
    rect(this.offsetX, this.offsetY, GAME_AREA_WIDTH, GAME_AREA_HEIGHT);
    
    // Draw grid lines
    stroke(red(frameCol), green(frameCol), blue(frameCol), 15);
    strokeWeight(1);
    for (let i = 1; i < COLS; i++) {
      let x = this.offsetX + i * BLOCK_SIZE;
      line(x, this.offsetY, x, this.offsetY + GAME_AREA_HEIGHT);
    }
    for (let i = 1; i < ROWS; i++) {
      let y = this.offsetY + i * BLOCK_SIZE;
      line(this.offsetX, y, this.offsetX + GAME_AREA_WIDTH, y);
    }
    
    // Draw limit line (win condition)
    stroke(255, 20, 60);
    strokeWeight(3);
    let limitY = this.offsetY + (LIMIT_LINE_ROW + 1) * BLOCK_SIZE;
    line(this.offsetX, limitY, this.offsetX + GAME_AREA_WIDTH, limitY);
    
    stroke(255, 20, 60, 100);
    strokeWeight(6);
    line(this.offsetX, limitY, this.offsetX + GAME_AREA_WIDTH, limitY);
    
    // WIN LINE label
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
          this.drawBlock(x, y, COLORS[this.grid[row][col].color]);
        }
      }
    }
    
    // Draw current falling piece
    if (this.currentPiece) {
      if (this.currentPiece.isTNT) {
        let x = this.offsetX + this.pieceCol * BLOCK_SIZE;
        let y = this.offsetY + this.dropY;
        this.drawTNTBlock(x, y);
      } else {
        // Draw Tetromino
        for (let block of this.currentPiece.blocks) {
          let x = this.offsetX + (this.pieceCol + block[1]) * BLOCK_SIZE;
          let y = this.offsetY + this.dropY + block[0] * BLOCK_SIZE;
          this.drawBlock(x, y, COLORS[this.currentPiece.colorIndex]);
        }
      }
    }
    
    // Draw power meter below the game area
    this.drawPowerMeter();
    
    pop();
  }
  
  drawPowerMeter() {
    let meterWidth = GAME_AREA_WIDTH;
    let meterHeight = 20;
    let meterX = this.offsetX;
    let meterY = this.offsetY + GAME_AREA_HEIGHT + 20;
    
    // Background
    fill(5, 10, 20, 200);
    noStroke();
    rect(meterX, meterY, meterWidth, meterHeight, 3);
    
    // Border
    let meterCol = this.id === 1 ? color(0, 255, 255) : color(255, 100, 255);
    stroke(meterCol);
    strokeWeight(2);
    noFill();
    rect(meterX, meterY, meterWidth, meterHeight, 3);
    
    // Fill bar
    if (this.powerMeter > 0) {
      let fillWidth = (meterWidth - 4) * (this.powerMeter / 100);
      fill(255, 215, 0, 180);
      noStroke();
      rect(meterX + 2, meterY + 2, fillWidth, meterHeight - 4, 2);
      
      // Glow effect
      fill(255, 215, 0, 80);
      rect(meterX + 2, meterY + 2, fillWidth, meterHeight - 4, 2);
    }
    
    // Label
    fill(255);
    noStroke();
    textSize(11);
    textAlign(CENTER, CENTER);
    text('POWER', meterX + meterWidth / 2, meterY + meterHeight / 2);
  }
  
  drawBlock(x, y, col) {
    push();
    
    // Translucent interior
    fill(red(col), green(col), blue(col), 35);
    noStroke();
    rect(x + 3, y + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6, 2);
    
    // Neon border
    noFill();
    stroke(col);
    strokeWeight(2);
    rect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 2);
    
    // Outer glow
    stroke(red(col), green(col), blue(col), 60);
    strokeWeight(4);
    rect(x + 1, y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2, 2);
    
    pop();
  }
  
  drawTNTBlock(x, y) {
    push();
    let tntCol = color(255, 50, 0);
    
    // Translucent interior
    fill(255, 50, 0, 40);
    noStroke();
    rect(x + 3, y + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6, 2);
    
    // Pulsing glow
    let pulse = sin(frameCount * 0.15) * 20 + 150;
    stroke(255, 50, 0, pulse);
    strokeWeight(3);
    rect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 2);
    
    // Bright border
    stroke(tntCol);
    strokeWeight(2);
    rect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 2);
    
    // Warning symbol
    fill(255, 255, 0);
    noStroke();
    textSize(BLOCK_SIZE * 0.4);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    text('⚠', x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2);
    textStyle(NORMAL);
    
    pop();
  }
  
  drawNextBlock(x, y) {
    push();
    translate(x, y);
    
    // Preview box
    let boxCol = this.id === 1 ? color(0, 255, 255) : color(255, 100, 255);
    let boxSize = BLOCK_SIZE * 3;
    
    fill(5, 10, 20, 200);
    stroke(boxCol);
    strokeWeight(2);
    rect(0, 0, boxSize, boxSize, 3);
    
    // Next piece
    if (this.nextPiece) {
      if (this.nextPiece.isTNT) {
        this.drawTNTBlock(boxSize / 2 - BLOCK_SIZE / 2, boxSize / 2 - BLOCK_SIZE / 2);
      } else {
        // Center the Tetromino preview
        let offsetX = (boxSize - this.nextPiece.getWidth() * BLOCK_SIZE) / 2;
        let offsetY = (boxSize - this.nextPiece.getHeight() * BLOCK_SIZE) / 2;
        
        for (let block of this.nextPiece.blocks) {
          let bx = offsetX + block[1] * BLOCK_SIZE;
          let by = offsetY + block[0] * BLOCK_SIZE;
          this.drawBlock(bx, by, COLORS[this.nextPiece.colorIndex]);
        }
      }
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
  
  // Initialize colors - NEON TECH PALETTE (3 colors for high match frequency)
  COLORS = [
    color(255, 30, 60),    // Neon Red
    color(0, 120, 255),    // Neon Blue
    color(0, 255, 100)     // Neon Green
  ];
  
  // Color names for debugging
  window.COLOR_NAMES = ['Red', 'Blue', 'Green'];
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
  } else if (gameState === 'playing') {
    updateGame();
    drawGame();
  } else if (gameState === 'gameOver') {
    drawGame();
    drawWinScreen();
  }
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
    sublabel: 'Coming Soon',
    enabled: false
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
  text('Match 3+ colors pop blocks • Complete lines charge power • Race to the top!', windowWidth / 2 + 1, windowHeight - 59);
  fill(0, 255, 255);
  text('Match 3+ colors pop blocks • Complete lines charge power • Race to the top!', windowWidth / 2, windowHeight - 60);
}

function drawMenuBackground() {
  // Draw decorative neon blocks floating in background (3 colors)
  for (let i = 0; i < 3; i++) {
    let x = (i + 1.5) * (windowWidth / 5);
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
  
  // Draw particles
  for (let p of particles) {
    p.draw();
  }
  
  // Draw controls reminder at bottom with glow
  let controlTextSize = min(windowWidth * 0.015, 14);
  textSize(controlTextSize);
  textAlign(CENTER, CENTER);
  fill(0, 255, 255, 100);
  text('P1: A/D Move, W Rotate, S Drop  |  P2: ←/→ Move, ↑ Rotate, ↓ Drop', windowWidth / 2 + 1, windowHeight - 19);
  fill(0, 255, 255);
  text('P1: A/D Move, W Rotate, S Drop  |  P2: ←/→ Move, ↑ Rotate, ↓ Drop', windowWidth / 2, windowHeight - 20);
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
    text('W: Rotate', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7 + smallTextSize * 1.2);
    text('S: Drop', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7 + smallTextSize * 2.4);
  } else {
    text('←/→: Move', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7);
    text('↑: Rotate', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7 + smallTextSize * 1.2);
    text('↓: Drop', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7 + smallTextSize * 2.4);
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
    // Check if 2 Player button was clicked
    if (twoPlayerButton && twoPlayerButton.enabled) {
      if (mouseX > twoPlayerButton.x && mouseX < twoPlayerButton.x + twoPlayerButton.w &&
          mouseY > twoPlayerButton.y && mouseY < twoPlayerButton.y + twoPlayerButton.h) {
        startGame();
      }
    }
  }
}

function keyPressed() {
  if (gameState === 'menu') {
    if (key === ' ') {
      startGame();
    }
  } else if (gameState === 'playing') {
    // Player 1 controls (A/D/W/S)
    if (key === 'a' || key === 'A') {
      players[0].movePiece(-1);
    } else if (key === 'd' || key === 'D') {
      players[0].movePiece(1);
    } else if (key === 'w' || key === 'W') {
      players[0].rotatePiece();
    } else if (key === 's' || key === 'S') {
      players[0].dropPiece();
    }
    
    // Player 2 controls (Arrow keys)
    if (keyCode === LEFT_ARROW) {
      players[1].movePiece(-1);
    } else if (keyCode === RIGHT_ARROW) {
      players[1].movePiece(1);
    } else if (keyCode === UP_ARROW) {
      players[1].rotatePiece();
    } else if (keyCode === DOWN_ARROW) {
      players[1].dropPiece();
    }
  } else if (gameState === 'gameOver') {
    if (key === ' ') {
      startGame();
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
function startGame() {
  gameState = 'playing';
  winner = null;
  particles = [];
  
  // Calculate responsive player positions
  let gameY = windowHeight * 0.15; // 15% from top
  
  // Player 1 at 25% of screen width (left quarter)
  let p1X = (windowWidth * 0.25) - (GAME_AREA_WIDTH / 2);
  
  // Player 2 at 75% of screen width (right quarter)
  let p2X = (windowWidth * 0.75) - (GAME_AREA_WIDTH / 2);
  
  // Create players
  players = [
    new Player(1, p1X, gameY),
    new Player(2, p2X, gameY)
  ];
  
  // Set opponent references for power attacks
  players[0].opponent = players[1];
  players[1].opponent = players[0];
}