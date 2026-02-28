# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Important**:
- Always respond in Japanese (日本語) when working in this repository
- Think in English, but always answer in Japanese (英語で考え、日本語で答えること)
- **Commit changes every time** after completing work (作業完了後は必ずコミットすること)
  - Use descriptive commit messages in English
  - Include "Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" in commit messages
  - Stage relevant files with `git add` before committing
  - Verify changes with `git diff` before committing

## Project Overview

NC-Calc is a web-based NC (Numerical Control) lathe coordinate calculation tool built as a Progressive Web App (PWA). It helps CNC machinists calculate precise coordinates for lathe operations including corner treatments (R/C), nose radius compensation, groove operations, and taper calculations. The application is designed for field use by machining professionals.

**Tech Stack**: React 19 + TypeScript + Vite 7 + Vitest
**Styling**: Vanilla CSS (no framework)
**Storage**: localStorage (settings, tool library, shape history)
**Diagrams**: SVG-based preview rendering
**PWA**: vite-plugin-pwa, app name "NC旋盤座標計算機", standalone display

## Common Commands

```bash
# Development
npm run dev          # Start dev server with HMR (default: http://localhost:5173)

# Build
npm run build        # Type-check and build for production (output: dist/)

# Testing
npm run test         # Run all tests with Vitest
npm run test -- <file>  # Run specific test file
npm run test -- --watch # Run tests in watch mode

# Code Quality
npm run lint         # Run ESLint on all files
npm run preview      # Preview production build locally
```

## Architecture

### Domain Model (MAZATROL-Style Point-Based System)

The application uses a point-based shape building approach inspired by MAZATROL CNC controllers:

- **Point**: Core data structure representing a coordinate with corner treatment and segment type
  - `x`, `z`: Coordinates (X is diameter value, Z is axial)
  - `type`: Segment type to reach this point ('line' | 'arc')
  - `corner`: Corner treatment at this point (CornerTreatment)
  - `groove`: Optional groove insertion after this point

- **CornerType**: Four corner treatment types
  - `none`: No corner treatment
  - `sumi-r`: Inner corner radius (concave)
  - `kaku-r`: Outer corner radius (convex)
  - `kaku-c`: Outer corner chamfer

- **Shape**: Collection of points defining the workpiece profile

### Calculation Pipeline (src/calculators/)

1. **Shape Calculation** (`shape.ts`):
   - Entry point: `calculateShape(shape: Shape, machineSettings: MachineSettings)`
   - Processes point sequence into line and arc segments
   - Handles corner treatments (R/C) with geometric calculations
   - Manages special cases: adjacent corners (R-R connections), dual arcs, expanded mode
   - Returns `ShapeCalculationResult` with segments and warnings

2. **Nose R Compensation** (`noseRCompensation.ts`):
   - Implements "Center Track Method" for tool nose radius compensation
   - Class: `CenterTrackCalculator`
   - Key concept: Calculates tool center path, then converts to program coordinates using `pToO()`
   - Handles bisector calculation at corner nodes for accurate taper-to-taper connections
   - Supports different tool tip numbers (1-9) with proper offset vectors

   **Tool Tip Offset Table (V_tip, radius values)**:
   | Tip | X offset | Z offset | Typical use |
   |:---:|:--------:|:--------:|:------------|
   | 3   | +R       | +R       | External / front / right-hand |
   | 2   | -R       | -R       | Internal / front / right-hand |
   | 1   | -R       | +R       | Internal / rear |
   | 4   | +R       | -R       | External / rear |
   | 8   | +R       | 0        | Face / X-direction relief |

3. **Specialized Calculators**:
   - `arc.ts`: Standalone arc calculations (circular interpolation)
   - `chamfer.ts`: Chamfer geometry
   - `groove.ts`: Groove toolpath generation
   - `taper.ts`: Taper angle calculations
   - `advancedGeometry.ts`: Peter Smid advanced geometry (taper inverse calculation, arc center finding, line-arc intersection)

### Key Algorithms

**Corner Calculation** (`calculateCorner` in shape.ts):
- Computes entry/exit points for R/C corners based on incoming/outgoing vectors
- Implements "Factory Manager Logic" for expanded R mode (Step R intersection clipping)
- When R > gap: allows R to extend beyond gap, clips at intersection with next wall
- Auto-shrink disabled in expanded mode to preserve user intent

**Adjacent Corners** (`calculateAdjacentCorners` in shape.ts):
- Handles R-R connections (two consecutive corner radii)
- S-curve detection: parallel walls with opposite turn directions
- Critical threshold: Only activates for extremely short gaps (`l2 < 0.1`)
- Otherwise defers to individual corner calculations

**G02/G03 Determination** (`determineGCode` in shape.ts):
- Base rule: `isLeftTurn` → G02 (clockwise arc)
- Modified by `toolPost` (front/rear) and `cuttingDirection` (+z/-z)
- Formula: G02 if `isLeftTurn XOR (toolPost=rear) XOR (direction=+z)`

### Component Structure (src/components/)

- **ShapeBuilder/**: Main shape editor with point-based interface
- **calculators/**: UI components for specific calculator modes
- **preview/**: SVG-based preview renderers (ArcPreview, GroovePreview, ShapePreview)
- **ResultsView/**: Displays calculated coordinates and NC code
- **SettingsPage**: Machine and coordinate system configuration
- **ToolManager**: Tool library management

### Settings & Configuration (src/models/settings.ts)

**MachineSettings**:
- `toolPost`: 'front' | 'rear' (affects G02/G03 determination)
- `cuttingDirection`: '+z' | '-z' (cutting toward tailstock or chuck)
- `activeToolId`: Currently selected tool
- `toolLibrary`: Array of Tool definitions
- `noseRCompensation`: Compensation settings (enabled, method, direction)

**Tool Definition**:
- Core properties: `noseRadius`, `toolTipNumber`, `hand` (right/left/neutral)
- Optional: `leadAngle`, `backAngle` (for interference checking)
- Insert shape codes: 'W', 'D', 'V', 'S', 'T', 'R', etc.

### Testing Strategy

**Test Organization** (`src/calculators/__tests__/`):
- 49 test files organized by category:
  - Shape & corners: `adjacent_corners`, `koujoucho_clip_logic`, `nc_points`, `nusumi_geometry`
  - Nose R compensation: `normal_vector_audit`, `bisector_*`, `nose_r_fix_verification`, `total_truth_audit`
  - Direction/turning: `direction_reversal`, `internal_turning`, `other_tool_tips`, `toolpost_*`
  - Regression: `user_*.test.ts` (reported issues), `debug_*.test.ts`

**Testing Approach**:
- Most tests verify calculated coordinates against expected values
- Use `expect(result.segments[i].endX).toBeCloseTo(expected, 3)` for floating-point tolerance
- Test fixture pattern: Define input shape → Calculate → Assert output coordinates

## Domain-Specific Notes

### Coordinate System
- **X-axis**: Diameter values (not radius) for external turning
- **Z-axis**: Axial position along spindle
- **I/K values**: Always in radius (even when X is diameter)
- Sign conventions vary by machine (front/rear tool post)

### Critical Edge Cases
1. **Step R with Virtual Corner**: When R > gap length, use expanded mode with intersection clipping
2. **S-Curve Adjacent R**: Only auto-connect when `l2 < 0.1` AND parallel walls
3. **Nose R Bisector**: Use `tan(θ/2)` projection for accurate taper connections
4. **Tool Tip Number**: Critical for P→O conversion (program to offset coordinates)

### Known Issues to Watch
- X-offset anomalies in specific R configurations (see docs/bug_report_x_offset_issue.md)
- Continuous corner R may produce unusual coordinates if S-curve threshold too loose
- Zero-gap R-R connections require special handling

## Documentation

Extensive domain knowledge in `docs/`:
- `nc_knowledge_base.md`: NC lathe fundamentals, G-codes, tooling
- `nose_r_compensation_reference.md`: Theoretical basis for compensation algorithms
- `corner_r_calculation.md`: Corner treatment geometry
- `bisector_algorithm_mathematical_analysis.md`: Mathematical proof of bisector P coordinate calculation
- `bisector_general_solution.md`: General solution for conditional Z-offset (bz-based)
- `bisector_method_z_offset_implementation.md`: Implementation notes for conditional dz
- `bisector_z_offset_future_validation.md`: Unvalidated areas and future work roadmap
- `handover_*.md`: Historical context on specific fixes/features
- **Peter Smid "CNC Programming Handbook"** (Ch. 26-27): Reference for nose R compensation formulas and advanced geometry

## Development Guidelines

- X coordinates are always in **diameter** throughout the codebase (convert to radius only for geometric calculations)
- Use `round3()` helper to round to 3 decimal places (±0.001mm precision)
- Calculation functions in `src/calculators/` should be pure functions where possible
- When modifying corner calculations, verify against test fixtures in `adjacent_corners.test.ts`
- G02/G03 determination depends on `toolPost` and `cuttingDirection` settings
- For nose R changes, consult `noseRCompensation.ts` comments and `nose_r_compensation_reference.md`

### Nose R Compensation: Taper Lines

**Location**: `CenterTrackCalculator.calculateWithBisector()` in `noseRCompensation.ts`

Key concepts for taper line compensation:
- **Taper detection**: `isTaper()` method — line segments where `angle != 0` and `angle != 90`
- **Taper endpoint (isPrevTaper)**: fz formula for Z, **next segment normal** for X
- **Taper startpoint (isNextTaper)**: fz formula for Z, **prev segment normal** for X
- **fz formula** (Peter Smid): `fz = R(1 - tan(θ/2))` for diameter-decreasing, `fz = R(1 + tan(θ/2))` for diameter-increasing
- **Direction determined by diameter change** (endX vs startX), NOT by Z coordinate
- **Bisector distance**: `R / cos(α/2)` — offset line intersection along bisector direction
- See: `docs/unified_compensation_theory.md` and `docs/quick_reference.md`

### Nose R Compensation: Z-Offset (Hybrid bz-based Solution)

**Location**: `calculateDzFromBisector()` in `noseRCompensation.ts`

Hybrid rule combining bisector Z-component analysis with concave arc handling:
- **Concave arcs (sumi-R)**: Always apply Z-offset = noseR × sign
- **Convex arcs (kaku-R) & lines**: Use bisector Z-component (bz) — if `|bz| < 0.01` then dz=0, else dz = noseR × sign
- Direction-invariant, works for all tool tip numbers and internal/external turning
- See: `docs/bisector_general_solution_verified.md` and `docs/bisector_algorithm_mathematical_analysis.md`
