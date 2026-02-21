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

3. **Specialized Calculators**:
   - `arc.ts`: Standalone arc calculations (circular interpolation)
   - `chamfer.ts`: Chamfer geometry
   - `groove.ts`: Groove toolpath generation
   - `taper.ts`: Taper angle calculations

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
- 20+ test files covering ~1,800 lines
- Key test suites:
  - `adjacent_corners.test.ts`: R-R connection edge cases
  - `koujoucho_clip_logic.test.ts`: Factory Manager expanded R logic
  - `nc_points.test.ts`: Basic coordinate calculations
  - `nusumi_geometry.test.ts`: Corner geometry validation
  - `normal_vector_audit.test.ts`: Nose R compensation verification
  - `user_*.test.ts`: Regression tests for reported issues

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
- `handover_*.md`: Historical context on specific fixes/features

## Development Guidelines

- X coordinates are always in **diameter** throughout the codebase (convert to radius only for geometric calculations)
- Use `round3()` helper to round to 3 decimal places (±0.001mm precision)
- When modifying corner calculations, verify against test fixtures in `adjacent_corners.test.ts`
- G02/G03 determination depends on `toolPost` and `cuttingDirection` settings
- For nose R changes, consult `noseRCompensation.ts` comments and `nose_r_compensation_reference.md`

### Critical Implementation Detail: Conditional Z-Offset in Bisector Method

**Location**: `src/calculators/noseRCompensation.ts` → `pToO()` function

**Implementation Note** (Verified Feb 2026, 97 tests passing):

In our specific Bisector Method implementation, the Z-direction offset in P→O conversion uses conditional logic:

- **Convex arcs (角R)**: `dz = 0`
- **Concave arcs (隅R) & Lines**: `dz = noseR`

**Implementation**:
```typescript
const dz = isConvex ? 0 : noseR
```

**Validated for**:
- External turning (外径加工) only
- Tool Tip 3 only
- Rear tool post, -Z cutting direction
- All 97 tests pass: ±0.034mm error (8.5% of noseR 0.4mm)

**NOT validated for**:
- Internal turning
- Other tool tip numbers (1, 2, 4, 8)
- Reversed cutting direction or other tool post configurations

**Details**: `docs/bisector_method_z_offset_implementation.md`

⚠️ **This is specific to our implementation. Do NOT generalize to other bisector algorithms or apply to untested conditions without independent verification.**

**Future Work & Known Limitations**: See `docs/bisector_z_offset_future_validation.md` for:
- Unvalidated areas (internal turning, other tool tips, reversed direction)
- Theoretical gaps (P coordinate definition, general solution derivation)
- Recommended validation roadmap and priority tasks
