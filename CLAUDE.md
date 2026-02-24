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

### Recently Fixed Issues (Reference for Future Work)
- ✅ **Taper line compensation error** (2026-02-24): -0.428mm systematic error in 30° taper lines
  - Root causes: angle info loss, wrong bisector formula, double offset application
  - Solution: Taper-specific fz formula with n={0,0} approach
  - See: `docs/nose_r_fix_2026-02-24/` for complete analysis

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

## Development Guidelines

- X coordinates are always in **diameter** throughout the codebase (convert to radius only for geometric calculations)
- Use `round3()` helper to round to 3 decimal places (±0.001mm precision)
- When modifying corner calculations, verify against test fixtures in `adjacent_corners.test.ts`
- G02/G03 determination depends on `toolPost` and `cuttingDirection` settings
- For nose R changes, consult `noseRCompensation.ts` comments and `nose_r_compensation_reference.md`

### Critical Implementation Detail 1: Taper Line Compensation Fix (2026-02-24)

**Location**: `src/calculators/noseRCompensation.ts` → `calculateDzForTaper()` and node calculation

**Status** (2026-02-24): ✅ Complete - Taper compensation error eliminated (-0.428mm → 0.000mm)

**Problem**: 30° taper lines had systematic -0.428mm error due to:
1. ❌ `angle` information lost in shape.ts → noseRCompensation.ts transfer
2. ❌ Bisector distance using `R/cos(θ/2)` instead of `R×tan(θ/2)`
3. ❌ No taper-specific compensation function (fz formula)
4. ❌ Bisector method distorting straight line segments
5. ❌ Double application: perpendicular offset + fz

**Solution - Taper-Specific Approach**:
```typescript
// 1. Taper detection
function isTaperSegment(seg: Segment): boolean {
    return seg.type === 'line' &&
           seg.angle !== undefined &&
           seg.angle !== 0 &&
           seg.angle !== 90
}

// 2. For taper segments: n = {0, 0} (NO perpendicular offset)
if (isTaperSegment(seg)) {
    n = { nx: 0, nz: 0 }  // P coordinate = geometric coordinate
}

// 3. Taper-specific dz using fz formula
function calculateDzForTaper(angle, noseR, tipNumber, isDiameterIncreasing) {
    const thetaRad = (angle * Math.PI) / 180
    const halfAngleRad = thetaRad / 2
    const factor = isDiameterIncreasing
        ? (1 + Math.tan(halfAngleRad))  // Descending: fz = R(1+tan(θ/2))
        : (1 - Math.tan(halfAngleRad))  // Ascending: fz = R(1-tan(θ/2))
    return noseR * factor * sign
}

// 4. Direction by DIAMETER change (NOT Z coordinate)
const isDiameterIncreasing = seg.endX > seg.startX
```

**Key Concepts**:
- **fz is TOTAL compensation** (not additional): includes perpendicular offset component
- **Taper coordinate model**: P = geometric (no offset), O = P - fz
- **Non-taper coordinate model**: P = geometric + perpendicular offset, O = P - dz
- **Direction terminology**: "Ascending taper" = diameter decreasing (上りテーパー)

**Bisector Distance Fix**:
```typescript
// ❌ Wrong: R/cos(θ/2) - overestimates by 41% for 90° corner
const dist = noseR / Math.max(0.01, cosHalf)

// ✅ Correct: R×tan(θ/2)
const sinHalf = Math.sqrt((1.0 - dot) / 2.0)
const tanHalf = sinHalf / Math.max(0.01, cosHalf)
const dist = noseR * tanHalf
```

**Critical Documents**:
- `docs/nose_r_fix_2026-02-24/完全ドキュメント_改訂版.md` - Complete analysis (⭐ START HERE)
- `docs/nose_r_fix_2026-02-24/README.md` - Executive summary
- `docs/quick_reference.md` - DO/DON'T quick reference

**Validation**:
- ✅ User's hand calculation (proven by actual machining): Z-46.586
- ✅ App output after fix: Z-46.586 (0.000mm error)
- ✅ Segment shape preserved (30° angle maintained)

---

### Critical Implementation Detail 2: Hybrid Z-Offset Solution (Phase 2 Complete)

**Location**: `src/calculators/noseRCompensation.ts` → `calculateDzFromBisector()` function

**Status** (2026-02-21): ✅ Phase 2 Complete - Hybrid solution implemented and validated (108 tests passing)

**Hybrid Solution** combines bisector Z-component (bz) analysis with concave arc handling:

```typescript
// Rule 1: Concave arcs (隅R) always need offset
if (isConvex === false) return noseR × sign

// Rule 2: Convex arcs (角R) & Lines use bz-based detection
if (|bz| < 0.01) return 0      // Horizontal normals
else return noseR × sign        // Angled normals
```

**Why Hybrid?**
- **Pure bz-based fails for concave arcs**: Even when bz≈0, concave arcs need offset (tool must reach into concave region)
- **Works perfectly for convex arcs & lines**: bz-based detection eliminates most isConvex dependencies
- **Best of both worlds**: Mathematical foundation + practical edge case handling

**Mathematical Foundation**:
- **Formula**: `P = ref + b̂ × dist`, therefore `Pz = refZ + bz × dist`
- **Numerical proof**: bz × dist = Pz - refZ (-0.7068 × 0.4 = -0.2827mm, exact match)
- **Causality**: When normals are horizontal (bz≈0), Pz≈refZ, so no additional Z offset needed

**Validation Results** (Tasks 1-3 + Phase 2):
- ✅ Direction reversal (Task 3-1): Solution is direction-invariant
- ✅ Internal turning (Task 3-2): Works for external/internal (sideSign reversal)
- ✅ Other tool tips (Task 3-3): bz value independent of tip number
- ✅ Concave arcs (Phase 2): Hybrid approach handles edge case
- ✅ **All 108 tests pass** (97 existing + 9 new + 2 others)

**Key Documents**:
- `docs/bisector_general_solution_verified.md` - Complete verification report (⭐ START HERE)
- `docs/bisector_algorithm_mathematical_analysis.md` - Mathematical proof
- `docs/phase2_implementation_plan.md` - Implementation details
- `docs/bisector_method_z_offset_implementation.md` - Original implementation notes

**Benefits Over Pure isConvex**:
- ✅ Eliminates isConvex for convex arcs & lines (majority of cases)
- ✅ Direction-invariant (works forward and backward)
- ✅ Works for internal/external turning
- ✅ All tool tip numbers supported
- ⚠️ Still uses isConvex for concave arc detection (necessary constraint)

**Next Steps (Phase 3)**:
- Monitor in production with `USE_BZ_BASED_DZ = true`
- Consider geometric curvature detection to eliminate final isConvex dependency
