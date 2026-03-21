// Global configuration and constants
let gameState = 'menu';
let winner = null;
let players = [];
let particles = [];
let pieceIdCounter = 0; // Unique ID generator for each piece
let gameMode = 'multi'; // 'single' or 'multi'
let difficulty = 'MEDIUM'; // 'EASY', 'MEDIUM', 'HARD'
let difficultyButtons = [];
let backButton = null;

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
