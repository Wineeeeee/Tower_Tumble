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

// CONSTANTS (Grid structure)
const COLS = 10;          // 10 columns per player
const ROWS = 16;          // Grid height
const DROP_SPEED = 12;    // Falling speed
const TNT_CHANCE = 0.05;  // 5% chance for TNT block (reduced)
const MAX_STEEPNESS = 2;  // Max height difference between columns (anti-spire)
const COLOR_BOMB_CHANCE = 0.08; // 8% chance for Color Bomb (clears entire color)
const DECAY_MIN_DELAY = 8000; // Min 8 seconds between block decay (cluster removal)
const DECAY_MAX_DELAY = 12000; // Max 12 seconds between block decay (cluster removal)
const WIN_LINE_ROW = 2; // Row threshold for "close to winning"

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
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.grid = this.createEmptyGrid();
    this.currentPiece = null;  // Single block: { colorIndex, id, isTNT }
    this.nextPiece = null;     // Next block to spawn
    this.pieceCol = 3;         // Starting column (center-ish)
    this.pieceRow = -2;        // Start above visible area
    this.dropping = false;
    this.dropY = 0;
    this.score = 0;
    this.powerMeter = 0;       // 0-100%, fills 25% per line
    this.opponent = null;      // Reference to opponent player
    
    // CHAOS MECHANIC A: Block Decay Timer
    this.decayTimer = millis() + random(DECAY_MIN_DELAY, DECAY_MAX_DELAY);
    
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
    // CHAOS MECHANIC B: Blue Shell Logic - Increase TNT chance if close to winning
    let maxHeight = this.getMaxHeight();
    let heightPercent = maxHeight / ROWS;
    let dynamicTNTChance = TNT_CHANCE;
    
    if (heightPercent > 0.8) {
      // Player is >80% to win line - quadruple TNT chance (5% -> 20%)
      dynamicTNTChance = TNT_CHANCE * 4;
      console.log('[BLUE SHELL] Player', this.id, 'at', (heightPercent * 100).toFixed(1), '% height! TNT chance increased to', (dynamicTNTChance * 100).toFixed(1), '%');
    }
    
    // Check for TNT first
    if (random() < dynamicTNTChance) {
      this.nextPiece = { isTNT: true, id: pieceIdCounter++, width: 1 };
    }
    // COLOR BOMB: Ultra-powerful color clear (no specific color - rainbow effect)
    else if (random() < COLOR_BOMB_CHANCE) {
      this.nextPiece = {
        id: pieceIdCounter++,
        isTNT: false,
        isColorBomb: true,  // Special Color Bomb flag
        width: 1  // Single block (1x1)
      };
      console.log('[COLOR BOMB] Spawning Color Bomb!');
    }
    // Normal colored block
    else {
      this.nextPiece = {
        colorIndex: floor(random(3)),  // Random color (0-2)
        id: pieceIdCounter++,           // Unique ID for match-3 tracking
        isTNT: false,
        isColorBomb: false,
        width: 2  // Horizontal bar is 2 blocks wide
      };
    }
  }
  
  spawnPiece() {
    this.currentPiece = this.nextPiece;
    this.pieceCol = floor(COLS / 2);  // Start at center
    this.pieceRow = -1;               // Start above visible area
    this.dropping = false;
    this.dropY = this.pieceRow * BLOCK_SIZE;
    this.prepareNextPiece();
  }
  
  getBarWidth() {
    // Helper to get the width of the current piece
    if (!this.currentPiece) return 1;
    return this.currentPiece.width || 1;
  }
  
  movePiece(dir) {
    if (this.dropping || !this.currentPiece) return;
    
    let newCol = this.pieceCol + dir;
    let barWidth = this.getBarWidth();
    
    // Check boundaries for horizontal bar (must fit both columns)
    if (newCol >= 0 && newCol + barWidth - 1 < COLS) {
      // Check if all destination cells are empty (only if in visible area)
      if (this.pieceRow >= 0 && this.pieceRow < ROWS) {
        let canMove = true;
        for (let i = 0; i < barWidth; i++) {
          if (this.grid[this.pieceRow][newCol + i] !== null) {
            canMove = false;
            break;
          }
        }
        if (canMove) {
          this.pieceCol = newCol;
        }
      } else {
        // Above grid, always allow movement
        this.pieceCol = newCol;
      }
    }
  }
  
  dropPiece() {
    if (this.dropping || !this.currentPiece) return;
    this.dropping = true;
  }
  
  canPlacePiece(row, col) {
    // Horizontal bar boundary and collision check (checks all cells of the bar)
    let barWidth = this.getBarWidth();
    
    // Check boundaries
    if (col < 0 || col + barWidth - 1 >= COLS) return false;
    if (row >= ROWS) return false;
    
    // Check collision for all cells of the bar
    if (row >= 0) {
      for (let i = 0; i < barWidth; i++) {
        if (this.grid[row][col + i] !== null) return false;
      }
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
    
    // CHAOS MECHANIC A: Block Decay - Check timer
    if (millis() > this.decayTimer) {
      this.applyBlockDecay();
      // Reset timer for next decay (random interval)
      this.decayTimer = millis() + random(DECAY_MIN_DELAY, DECAY_MAX_DELAY);
    }
  }
  
  findLandingRow() {
    if (!this.currentPiece) return ROWS - 1;
    
    let barWidth = this.getBarWidth();
    
    // For horizontal bar - find the highest obstruction across all columns it occupies
    let landingRow = ROWS - 1;
    
    for (let i = 0; i < barWidth; i++) {
      let col = this.pieceCol + i;
      if (col < 0 || col >= COLS) continue;
      
      // Find first occupied cell in this column from current position down
      for (let row = max(0, this.pieceRow); row < ROWS; row++) {
        if (this.grid[row][col] !== null) {
          landingRow = min(landingRow, row - 1);
          break;
        }
      }
    }
    
    return landingRow;
  }
  
  placePiece() {
    if (!this.currentPiece) return;
    
    if (this.currentPiece.isTNT) {
      // TNT explosion
      if (this.pieceRow >= 0 && this.pieceRow < ROWS) {
        this.explodeTNT(this.pieceRow, this.pieceCol);
      }
    } else if (this.currentPiece.isColorBomb) {
      // COLOR BOMB: Check what's below and clear all blocks of that color
      console.log('[COLOR BOMB] Color Bomb landing at [', this.pieceRow, ',', this.pieceCol, ']');
      let bombActivated = this.activateColorBomb();
      
      if (bombActivated) {
        console.log('[COLOR BOMB] Successfully cleared target color!');
      } else {
        console.log('[COLOR BOMB] Fizzled - landed on floor or empty space');
      }
      
      // Color Bomb always disappears (no placement)
      this.spawnPiece();
      return;
    } else {
      // Place piece (single block or horizontal bar) with color, piece ID, and scoring state
      let r = this.pieceRow;
      let c = this.pieceCol;
      let barWidth = this.getBarWidth();
      
      console.log('[LOCK] Bar ID', this.currentPiece.id, 'placing at row:', r, 'cols:', c, 'to', c + barWidth - 1, 'color:', window.COLOR_NAMES[this.currentPiece.colorIndex]);
      
      // Place all blocks of the horizontal bar
      for (let i = 0; i < barWidth; i++) {
        let colIndex = c + i;
        if (r >= 0 && r < ROWS && colIndex >= 0 && colIndex < COLS) {
          this.grid[r][colIndex] = { 
            color: this.currentPiece.colorIndex, 
            id: this.currentPiece.id,
            isScored: false  // Track if this block has contributed to power meter
          };
          console.log('[LOCK] Block placed at [', r, ',', colIndex, '] color:', window.COLOR_NAMES[this.currentPiece.colorIndex]);
        }
      }
      
      this.score += 10;
      
      // STEP 0: Check stability (anti-spire mechanic - slide unstable blocks)
      console.log('[STABILITY] Checking tower stability...');
      this.checkStability();
      
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
    // Uses state tracking to ensure each line charges meter EXACTLY ONCE
    let newlyCompletedLines = 0;
    
    console.log('[LINE CHECK] Scanning for completed lines...');
    
    // Check each row from bottom to top
    for (let row = ROWS - 1; row >= 0; row--) {
      let isComplete = true;
      let hasUnscoredBlocks = false;
      
      // Check if row is completely filled
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] === null) {
          isComplete = false;
          break;
        }
      }
      
      // If complete, check if any blocks are unscored
      if (isComplete) {
        for (let col = 0; col < COLS; col++) {
          if (this.grid[row][col].isScored === false) {
            hasUnscoredBlocks = true;
            break;
          }
        }
        
        // Only award power if this is a NEW completed line (has unscored blocks)
        if (hasUnscoredBlocks) {
          console.log('[LINE COMPLETE] Row', row, 'is newly complete! Awarding power.');
          newlyCompletedLines++;
          
          // Mark all blocks in this row as scored
          for (let col = 0; col < COLS; col++) {
            this.grid[row][col].isScored = true;
          }
          
          // Visual Cue: Sparkle effect
          for (let col = 0; col < COLS; col++) {
            let px = this.offsetX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
            let py = this.offsetY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
            for (let i = 0; i < 3; i++) {
              let a = random(TWO_PI);
              let s = random(1, 3);
              particles.push(new Particle(px, py, cos(a) * s, sin(a) * s, color(255, 255, 255)));
            }
          }
        } else {
          console.log('[LINE SKIP] Row', row, 'is complete but already scored - no charge');
        }
      }
    }
    
    // Charge power meter (+25% per NEW line)
    if (newlyCompletedLines > 0) {
      let powerGain = newlyCompletedLines * 25;
      this.powerMeter += powerGain;
      this.score += newlyCompletedLines * 50;
      
      console.log('[POWER] Charged', powerGain, '% from', newlyCompletedLines, 'new line(s). Meter now at', this.powerMeter, '%');
      
      // Trigger attack at 100%
      if (this.powerMeter >= 100) {
        this.powerMeter = 0;
        this.activatePowerAttack();
      }
    } else {
      console.log('[LINE CHECK] No new completed lines found');
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
      
      // Check stability after gravity (blocks may have created new steep towers)
      console.log('[STABILITY] Checking stability after gravity...');
      this.checkStability();
      
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
    console.log('Legend: R=Red, B=Blue, G=Green, .=empty | [Color:ID*] *=isScored');
    for (let row = ROWS - 8; row < ROWS; row++) {
      let rowStr = 'Row ' + row.toString().padStart(2) + ': ';
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] === null) {
          rowStr += '.     ';
        } else {
          // Show color, piece ID, and scored status
          let colorLabel = ['R', 'B', 'G'][this.grid[row][col].color];
          let idStr = this.grid[row][col].id.toString().padStart(2);
          let scoredMarker = this.grid[row][col].isScored ? '*' : ' ';
          rowStr += colorLabel + ':' + idStr + scoredMarker + ' ';
        }
      }
      console.log(rowStr);
    }
    console.log('===================================');
  }
  
  getColumnHeight(col) {
    // Count blocks from bottom up to find column height
    if (col < 0 || col >= COLS) return 0;
    
    let height = 0;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.grid[row][col] !== null) {
        height = ROWS - row;
        break;
      }
    }
    return height;
  }
  
  checkStability() {
    // "TUMBLE" MECHANIC: Prevent single-column spire exploit
    // If a column is too steep compared to neighbors, slide blocks sideways
    
    let slidOccurred = true;
    let iterations = 0;
    const MAX_ITERATIONS = 20; // Prevent infinite loops
    
    while (slidOccurred && iterations < MAX_ITERATIONS) {
      slidOccurred = false;
      iterations++;
      
      // Scan from top to bottom, left to right
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (this.grid[row][col] !== null) {
            // Check if this block is part of a too-steep column
            let currentHeight = this.getColumnHeight(col);
            let leftHeight = this.getColumnHeight(col - 1);
            let rightHeight = this.getColumnHeight(col + 1);
            
            // Determine if too steep and which direction to slide
            let shouldSlideLeft = col > 0 && (currentHeight > leftHeight + MAX_STEEPNESS);
            let shouldSlideRight = col < COLS - 1 && (currentHeight > rightHeight + MAX_STEEPNESS);
            
            // Slide to the lower neighbor
            if (shouldSlideLeft || shouldSlideRight) {
              // Pick the lower neighbor (or left if equal)
              let targetCol = shouldSlideLeft ? 
                (shouldSlideRight ? (leftHeight <= rightHeight ? col - 1 : col + 1) : col - 1) :
                col + 1;
              
              // Only slide topmost block of the steep column
              let isTopBlock = (row === 0 || this.grid[row - 1][col] === null);
              
              if (isTopBlock) {
                console.log('[TUMBLE] Block at [', row, ',', col, '] too steep! Sliding to col', targetCol);
                
                // Find landing position in target column
                let targetRow = ROWS - 1;
                for (let r = 0; r < ROWS; r++) {
                  if (this.grid[r][targetCol] !== null) {
                    targetRow = r - 1;
                    break;
                  }
                }
                
                if (targetRow >= 0) {
                  // Move block to target column
                  this.grid[targetRow][targetCol] = this.grid[row][col];
                  this.grid[row][col] = null;
                  
                  // Visual feedback: particles showing slide direction
                  let px = this.offsetX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
                  let py = this.offsetY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
                  let slideDirection = targetCol > col ? 1 : -1;
                  for (let i = 0; i < 5; i++) {
                    particles.push(new Particle(
                      px, py, 
                      slideDirection * random(2, 4), random(-1, 1), 
                      color(255, 200, 100, 150)
                    ));
                  }
                  
                  slidOccurred = true;
                }
              }
            }
          }
        }
      }
    }
    
    if (iterations >= MAX_ITERATIONS) {
      console.log('[STABILITY] Warning: Max iterations reached');
    } else if (iterations > 1) {
      console.log('[STABILITY] Stabilized after', iterations, 'passes');
    } else {
      console.log('[STABILITY] Tower is stable');
    }
  }
  
  // ============================================
  // CHAOS MECHANIC A: BLOCK DECAY (CLUSTER REMOVAL)
  // ============================================
  applyBlockDecay() {
    // Find all occupied cells
    let occupiedCells = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] !== null) {
          occupiedCells.push({ row, col });
        }
      }
    }
    
    if (occupiedCells.length === 0) {
      console.log('[DECAY] No blocks to decay');
      return;
    }
    
    // Find the tallest column (weighted target)
    let columnHeights = [];
    for (let col = 0; col < COLS; col++) {
      columnHeights.push(this.getColumnHeight(col));
    }
    let maxHeight = Math.max(...columnHeights);
    let tallestColumns = [];
    for (let col = 0; col < COLS; col++) {
      if (columnHeights[col] === maxHeight) {
        tallestColumns.push(col);
      }
    }
    
    console.log('[DECAY] Tallest column(s):', tallestColumns, 'with height:', maxHeight);
    
    // Build weighted list (blocks in tallest columns appear 3x)
    let weightedCells = [];
    for (let cell of occupiedCells) {
      if (tallestColumns.includes(cell.col)) {
        // Add this cell 3 times for 3x probability
        weightedCells.push(cell, cell, cell);
      } else {
        weightedCells.push(cell);
      }
    }
    
    // Pick a random cell from weighted list (TargetBlock)
    let selectedCell = random(weightedCells);
    let targetRow = selectedCell.row;
    let targetCol = selectedCell.col;
    let targetColor = this.grid[targetRow][targetCol].color;
    
    console.log('[DECAY] Target block at [', targetRow, ',', targetCol, '] color:', window.COLOR_NAMES[targetColor]);
    
    // CLUSTER IDENTIFICATION: Find all connected blocks of the same color
    let cluster = this.getConnectedCluster(targetRow, targetCol, targetColor);
    
    console.log('[DECAY] Found cluster of', cluster.length, 'blocks to remove');
    
    // MASS DELETION: Destroy all blocks in the cluster
    for (let cell of cluster) {
      // Create destruction particles for visual feedback
      let px = this.offsetX + cell.col * BLOCK_SIZE + BLOCK_SIZE / 2;
      let py = this.offsetY + cell.row * BLOCK_SIZE + BLOCK_SIZE / 2;
      
      // Add more particles for dramatic effect
      for (let i = 0; i < 3; i++) {
        let angle = random(TWO_PI);
        let speed = random(2, 5);
        particles.push(new Particle(
          px, py,
          cos(angle) * speed, sin(angle) * speed,
          COLORS[targetColor]
        ));
      }
      
      // Destroy the block
      this.grid[cell.row][cell.col] = null;
    }
    
    // Apply gravity to fill the voids
    this.applyGravity();
    
    // Check stability after gravity
    this.checkStability();
  }
  
  // ============================================
  // COLOR BOMB: Clear all blocks of target color
  // ============================================
  activateColorBomb() {
    let bombRow = this.pieceRow;
    let bombCol = this.pieceCol;
    
    // Check if there's a block directly below the Color Bomb
    let blockBelowRow = bombRow + 1;
    
    // SCENARIO A: Landed on floor or empty space - FIZZLE
    if (blockBelowRow >= ROWS || blockBelowRow < 0) {
      console.log('[COLOR BOMB] Hit the floor - FIZZLE!');
      // Create fizzle particles
      let px = this.offsetX + bombCol * BLOCK_SIZE + BLOCK_SIZE / 2;
      let py = this.offsetY + bombRow * BLOCK_SIZE + BLOCK_SIZE / 2;
      for (let i = 0; i < 10; i++) {
        let angle = random(TWO_PI);
        let speed = random(1, 3);
        particles.push(new Particle(
          px, py,
          cos(angle) * speed, sin(angle) * speed,
          color(200, 200, 200, 150)
        ));
      }
      return false; // No effect
    }
    
    let blockBelow = this.grid[blockBelowRow][bombCol];
    
    if (blockBelow === null) {
      console.log('[COLOR BOMB] Landed on empty space - FIZZLE!');
      // Create fizzle particles
      let px = this.offsetX + bombCol * BLOCK_SIZE + BLOCK_SIZE / 2;
      let py = this.offsetY + bombRow * BLOCK_SIZE + BLOCK_SIZE / 2;
      for (let i = 0; i < 10; i++) {
        let angle = random(TWO_PI);
        let speed = random(1, 3);
        particles.push(new Particle(
          px, py,
          cos(angle) * speed, sin(angle) * speed,
          color(200, 200, 200, 150)
        ));
      }
      return false; // No effect
    }
    
    // SCENARIO B: Landed on a colored block - ACTIVATE!
    let targetColor = blockBelow.color;
    console.log('[COLOR BOMB] HIT!', window.COLOR_NAMES[targetColor], 'block detected!');
    console.log('[COLOR BOMB] Clearing ALL', window.COLOR_NAMES[targetColor], 'blocks from grid!');
    
    let removedCount = 0;
    
    // Scan the ENTIRE grid and remove all blocks matching the target color
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] !== null && this.grid[row][col].color === targetColor) {
          // Create massive particle explosion
          let px = this.offsetX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
          let py = this.offsetY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
          
          for (let i = 0; i < 8; i++) {
            let angle = random(TWO_PI);
            let speed = random(4, 9);
            particles.push(new Particle(
              px, py,
              cos(angle) * speed, sin(angle) * speed,
              COLORS[targetColor]
            ));
          }
          
          // EXECUTE WIPE: Set cell to EMPTY
          this.grid[row][col] = null;
          removedCount++;
        }
      }
    }
    
    console.log('[COLOR BOMB] Removed', removedCount, window.COLOR_NAMES[targetColor], 'blocks!');
    
    // PHYSICS UPDATE: Apply gravity to fill gaps
    this.applyGravity();
    this.checkStability();
    
    return true; // Successfully activated
  }
  
  // ============================================
  // HELPER: GET CONNECTED CLUSTER (FLOOD FILL)
  // ============================================
  getConnectedCluster(startRow, startCol, targetColor) {
    // Flood fill algorithm to find all connected blocks of the same color
    let cluster = [];
    let visited = new Set();
    let queue = [{ row: startRow, col: startCol }];
    
    while (queue.length > 0) {
      let current = queue.shift();
      let key = `${current.row},${current.col}`;
      
      // Skip if already visited
      if (visited.has(key)) continue;
      
      // Boundary checks
      if (current.row < 0 || current.row >= ROWS || current.col < 0 || current.col >= COLS) continue;
      
      // Check if cell is empty or wrong color
      if (this.grid[current.row][current.col] === null) continue;
      if (this.grid[current.row][current.col].color !== targetColor) continue;
      
      // Mark as visited and add to cluster
      visited.add(key);
      cluster.push({ row: current.row, col: current.col });
      
      // Add all 4 orthogonal neighbors to queue
      queue.push({ row: current.row - 1, col: current.col }); // Up
      queue.push({ row: current.row + 1, col: current.col }); // Down
      queue.push({ row: current.row, col: current.col - 1 }); // Left
      queue.push({ row: current.row, col: current.col + 1 }); // Right
    }
    
    return cluster;
  }
  
  // ============================================
  // HELPER: GET MAXIMUM HEIGHT
  // ============================================
  getMaxHeight() {
    // Return the maximum height across all columns
    let maxHeight = 0;
    for (let col = 0; col < COLS; col++) {
      let height = this.getColumnHeight(col);
      if (height > maxHeight) {
        maxHeight = height;
      }
    }
    return maxHeight;
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
    
    // Check stability after explosion
    console.log('[STABILITY] Checking stability after explosion...');
    this.checkStability();
    
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
    
    // Draw current falling piece (horizontal bar or special blocks)
    if (this.currentPiece) {
      if (this.currentPiece.isTNT) {
        let x = this.offsetX + this.pieceCol * BLOCK_SIZE;
        let y = this.offsetY + this.dropY;
        this.drawTNTBlock(x, y);
      } else if (this.currentPiece.isColorBomb) {
        let x = this.offsetX + this.pieceCol * BLOCK_SIZE;
        let y = this.offsetY + this.dropY;
        this.drawColorBomb(x, y);
      } else {
        // Draw horizontal bar (2 blocks wide)
        let barWidth = this.getBarWidth();
        for (let i = 0; i < barWidth; i++) {
          let x = this.offsetX + (this.pieceCol + i) * BLOCK_SIZE;
          let y = this.offsetY + this.dropY;
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
  
  drawColorBomb(x, y) {
    push();
    
    // Rainbow/white pulsing core (ultra-powerful look)
    let pulse = sin(frameCount * 0.15);
    let coreBrightness = 200 + pulse * 55;
    
    // Rotating rainbow gradient effect
    let hueShift = (frameCount * 2) % 360;
    colorMode(HSB);
    
    // Inner glowing core (white/rainbow)
    fill(hueShift, 60, coreBrightness);
    noStroke();
    ellipse(x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2, BLOCK_SIZE * 0.7);
    
    // Middle ring (shifting colors)
    noFill();
    stroke((hueShift + 120) % 360, 80, 255, 200);
    strokeWeight(3);
    ellipse(x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2, BLOCK_SIZE * 0.85);
    
    // Outer glow ring (complementary color)
    stroke((hueShift + 240) % 360, 70, 255, 150);
    strokeWeight(4);
    ellipse(x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2, BLOCK_SIZE * 0.95);
    
    colorMode(RGB);
    
    // Outer box frame
    noFill();
    stroke(255, 255, 255, 150 + pulse * 50);
    strokeWeight(2);
    rect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 2);
    
    // "BOMB" symbol - rotating star/sparkle
    push();
    translate(x + BLOCK_SIZE / 2, y + BLOCK_SIZE / 2);
    rotate(frameCount * 0.05);
    fill(255, 255, 255, 250);
    noStroke();
    textSize(BLOCK_SIZE * 0.7);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    text('✦', 0, 0);
    textStyle(NORMAL);
    pop();
    
    pop();
  }
  
  drawNextBlock(x, y) {
    push();
    translate(x, y);
    
    // Preview box (wider for horizontal bar)
    let boxCol = this.id === 1 ? color(0, 255, 255) : color(255, 100, 255);
    let boxSize = BLOCK_SIZE * 3;
    
    fill(5, 10, 20, 200);
    stroke(boxCol);
    strokeWeight(2);
    rect(0, 0, boxSize, boxSize, 3);
    
    // Next piece (horizontal bar, TNT, or Color Bomb)
    if (this.nextPiece) {
      if (this.nextPiece.isTNT) {
        let centerX = boxSize / 2 - BLOCK_SIZE / 2;
        let centerY = boxSize / 2 - BLOCK_SIZE / 2;
        this.drawTNTBlock(centerX, centerY);
      } else if (this.nextPiece.isColorBomb) {
        let centerX = boxSize / 2 - BLOCK_SIZE / 2;
        let centerY = boxSize / 2 - BLOCK_SIZE / 2;
        this.drawColorBomb(centerX, centerY);
      } else {
        // Draw horizontal bar preview (2 blocks wide)
        let barWidth = this.nextPiece.width || 1;
        let totalWidth = barWidth * BLOCK_SIZE;
        let startX = (boxSize - totalWidth) / 2;
        let centerY = boxSize / 2 - BLOCK_SIZE / 2;
        
        for (let i = 0; i < barWidth; i++) {
          let bx = startX + i * BLOCK_SIZE;
          this.drawBlock(bx, centerY, COLORS[this.nextPiece.colorIndex]);
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
  } else if (gameState === 'START_SCREEN') {
    // Draw game in background
    drawGame();
    // Draw semi-transparent overlay
    fill(0, 0, 0, 220);
    noStroke();
    rect(0, 0, windowWidth, windowHeight);
    // Draw instructions on top
    drawInstructions();
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
// INSTRUCTIONS OVERLAY
// ============================================
function drawInstructions() {
  // Calculate dynamic text size based on smallest dimension
  let tSize = min(windowWidth, windowHeight) * 0.025;
  tSize = constrain(tSize, 12, 24);
  
  // Central panel dimensions (85% width, 80% height)
  let panelW = windowWidth * 0.85;
  let panelH = windowHeight * 0.8;
  let panelX = windowWidth / 2;
  let panelY = windowHeight / 2;
  
  push();
  rectMode(CENTER);
  
  // Neon-bordered glass panel
  fill(5, 10, 20, 240);
  stroke(0, 255, 255, 200);
  strokeWeight(3);
  rect(panelX, panelY, panelW, panelH, 10);
  
  // Inner glow
  noFill();
  stroke(0, 255, 255, 100);
  strokeWeight(6);
  rect(panelX, panelY, panelW - 8, panelH - 8, 8);
  
  // Corner decorations
  stroke(0, 255, 255);
  strokeWeight(4);
  let cornerSize = min(panelW, panelH) * 0.04;
  let left = panelX - panelW / 2;
  let right = panelX + panelW / 2;
  let top = panelY - panelH / 2;
  let bottom = panelY + panelH / 2;
  
  // Draw corner brackets
  line(left, top, left + cornerSize, top);
  line(left, top, left, top + cornerSize);
  line(right - cornerSize, top, right, top);
  line(right, top, right, top + cornerSize);
  line(left, bottom - cornerSize, left, bottom);
  line(left, bottom, left + cornerSize, bottom);
  line(right - cornerSize, bottom, right, bottom);
  line(right, bottom, right, bottom - cornerSize);
  
  pop();
  
  // === TITLE ===
  textAlign(CENTER, CENTER);
  let titleSize = tSize * 2.2;
  textSize(titleSize);
  textStyle(BOLD);
  fill(0, 255, 255, 150);
  text('TOWER TUMBLE', panelX + 2, top + titleSize * 1.2 + 2);
  fill(0, 255, 255);
  text('TOWER TUMBLE', panelX, top + titleSize * 1.2);
  
  textSize(titleSize * 0.5);
  fill(255, 100, 255);
  text('MISSION BRIEFING', panelX, top + titleSize * 2);
  textStyle(NORMAL);
  
  // === PLAYER CONTROLS (Two Columns) ===
  let controlY = top + titleSize * 3;
  let colSpacing = panelW * 0.28;
  
  // Player 1 (Left - Cyan)
  let p1X = panelX - colSpacing;
  textSize(tSize * 1.2);
  textStyle(BOLD);
  fill(0, 255, 255);
  text('PLAYER 1', p1X, controlY);
  textStyle(NORMAL);
  
  textSize(tSize * 0.9);
  fill(0, 255, 255, 220);
  text('A / D - Move', p1X, controlY + tSize * 2);
  text('S - Drop', p1X, controlY + tSize * 3.2);
  
  // Player 2 (Right - Magenta)
  let p2X = panelX + colSpacing;
  textSize(tSize * 1.2);
  textStyle(BOLD);
  fill(255, 100, 255);
  text('PLAYER 2', p2X, controlY);
  textStyle(NORMAL);
  
  textSize(tSize * 0.9);
  fill(255, 100, 255, 220);
  text('← / → - Move', p2X, controlY + tSize * 2);
  text('↓ - Drop', p2X, controlY + tSize * 3.2);
  
  // === GAME MECHANICS ===
  let mechY = controlY + tSize * 5.5;
  textSize(tSize * 1.3);
  textStyle(BOLD);
  fill(255, 215, 0);
  text('CORE MECHANICS', panelX, mechY);
  textStyle(NORMAL);
  
  textAlign(LEFT, CENTER);
  let mechX = panelX - panelW * 0.38;
  let lineH = tSize * 1.8;
  textSize(tSize * 0.85);
  
  // Race to Top
  fill(255, 255, 255);
  textStyle(BOLD);
  text('RACE TO TOP:', mechX, mechY + lineH * 1.5);
  textStyle(NORMAL);
  fill(220, 220, 220);
  text('Reach the top to win.', mechX + tSize * 7, mechY + lineH * 1.5);
  
  // Physics
  fill(255, 255, 255);
  textStyle(BOLD);
  text('PHYSICS:', mechX, mechY + lineH * 2.8);
  textStyle(NORMAL);
  fill(220, 220, 220);
  text('Steep Towers will COLLAPSE! Build wide.', mechX + tSize * 7, mechY + lineH * 2.8);
  
  // Color Bomb Special
  fill(255, 255, 255);
  textStyle(BOLD);
  text('SPECIAL:', mechX, mechY + lineH * 4.1);
  textStyle(NORMAL);
  
  // Animated rainbow text for Color Bomb
  colorMode(HSB);
  let bombHue = (frameCount * 3) % 360;
  fill(bombHue, 70, 255);
  colorMode(RGB);
  textStyle(BOLD);
  text('Color Bomb', mechX + tSize * 7, mechY + lineH * 4.1);
  textStyle(NORMAL);
  fill(220, 220, 220);
  text('clears all matching blocks!', mechX + tSize * 12, mechY + lineH * 4.1);
  
  // Match-3
  fill(255, 255, 255);
  textStyle(BOLD);
  text('MATCH-3:', mechX, mechY + lineH * 5.4);
  textStyle(NORMAL);
  fill(220, 220, 220);
  text('Connect 3+ same colors to clear blocks.', mechX + tSize * 7, mechY + lineH * 5.4);
  
  // === PULSING START BUTTON ===
  let buttonY = bottom - tSize * 4;
  let pulse = sin(frameCount * 0.12) * 25 + 205;
  
  textAlign(CENTER, CENTER);
  textSize(tSize * 1.5);
  textStyle(BOLD);
  
  // Button glow
  fill(0, 255, 255, pulse * 0.5);
  text('PRESS SPACE TO START', panelX + 2, buttonY + 2);
  
  // Button text
  fill(0, 255, 255, pulse);
  text('PRESS SPACE TO START', panelX, buttonY);
  
  textStyle(NORMAL);
  textSize(tSize * 0.8);
  fill(0, 255, 255, 180);
  text('(or click anywhere)', panelX, buttonY + tSize * 1.8);
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
    text('S: Drop', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7 + smallTextSize * 1.2);
  } else {
    text('←/→: Move', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7);
    text('↓: Drop', SIDE_PANEL_WIDTH / 2, GAME_AREA_HEIGHT * 0.7 + smallTextSize * 1.2);
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
  } else if (gameState === 'START_SCREEN') {
    // Click to dismiss instructions and start game
    gameState = 'playing';
  }
}

function keyPressed() {
  if (gameState === 'menu') {
    if (key === ' ') {
      startGame();
    }
  } else if (gameState === 'START_SCREEN') {
    // Press SPACE to dismiss instructions and start game
    if (key === ' ') {
      gameState = 'playing';
    }
  } else if (gameState === 'playing') {
    // Player 1 controls (A/D/S) - No rotation!
    if (key === 'a' || key === 'A') {
      players[0].movePiece(-1);
    } else if (key === 'd' || key === 'D') {
      players[0].movePiece(1);
    } else if (key === 's' || key === 'S') {
      players[0].dropPiece();
    }
    
    // Player 2 controls (Arrow keys) - No rotation!
    if (keyCode === LEFT_ARROW) {
      players[1].movePiece(-1);
    } else if (keyCode === RIGHT_ARROW) {
      players[1].movePiece(1);
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
  // Initialize game but show instructions first
  gameState = 'START_SCREEN';
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