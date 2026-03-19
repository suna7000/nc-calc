/**
 * Debug test: IMG_1547-1550 discrepancy investigation
 * Shape: 9 points with 3 sumi-R5 corners
 * Tool: D-shape, noseR=0.4, tip#3, lead 93°, back 32°
 *
 * App results (IMG_1549) vs hand calc (IMG_1550) — discrepancies marked
 */
import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import type { Shape } from '../../models/shape'
import type { MachineSettings } from '../../models/settings'

describe('Debug: IMG_1547 calculation discrepancy', () => {
    const shape: Shape = {
        points: [
            { id: 'p1', x: 43, z: 0, type: 'line', corner: { type: 'none', size: 0 } },
            { id: 'p2', x: 43, z: -80, type: 'line', corner: { type: 'none', size: 0 } },
            { id: 'p3', x: 40, z: -83.217, type: 'line', corner: { type: 'sumi-r', size: 5 } },
            { id: 'p4', x: 40, z: -131.247, type: 'line', corner: { type: 'sumi-r', size: 5 } },
            { id: 'p5', x: 43.5, z: -135, type: 'line', corner: { type: 'none', size: 0 } },
            { id: 'p6', x: 43.5, z: -485, type: 'line', corner: { type: 'none', size: 0 } },
            { id: 'p7', x: 44, z: -512.844, type: 'line', corner: { type: 'sumi-r', size: 5 } },
            { id: 'p8', x: 60, z: -530, type: 'line', corner: { type: 'none', size: 0 } },
            { id: 'p9', x: 60, z: -550, type: 'line', corner: { type: 'none', size: 0 } },
        ],
        retract: { startDiameter: 0, endDiameter: 0 }
    }

    // Default: rear toolpost, -Z direction
    const settingsRear: MachineSettings = {
        toolPost: 'rear',
        cuttingDirection: '-z',
        activeToolId: 't02',
        toolLibrary: [{
            id: 't02',
            name: '外径仕上 (D形状)',
            type: 'external',
            noseRadius: 0.4,
            toolTipNumber: 3,
            hand: 'right',
            insertShape: 'D',
            leadAngle: 93,
            backAngle: 32,
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        }
    }

    it('should dump all segment details for comparison', () => {
        const result = calculateShape(shape, settingsRear)

        console.log('=== Raw segments (before noseR comp) ===')
        result.segments.forEach((seg, i) => {
            console.log(`Seg${i}: type=${seg.type}, gCode=${seg.gCode}, angle=${seg.angle}`)
            console.log(`  Raw: (${seg.startX}, ${seg.startZ}) → (${seg.endX}, ${seg.endZ})`)
            if (seg.radius !== undefined) console.log(`  radius=${seg.radius}, center=(${seg.centerX}, ${seg.centerZ})`)
            if (seg.isConvex !== undefined) console.log(`  isConvex=${seg.isConvex}`)
        })

        console.log('\n=== Compensated coordinates (NC output) ===')
        result.segments.forEach((seg, i) => {
            const c = seg.compensated
            if (c) {
                const rStr = c.radius !== undefined ? ` R${c.radius.toFixed(3)}` : ''
                console.log(`N${(i + 1) * 10 + 5}: ${seg.gCode} X${c.endX.toFixed(3)} Z${c.endZ.toFixed(3)}${rStr}`)
                console.log(`  start: X${c.startX.toFixed(3)} Z${c.startZ.toFixed(3)}`)
            } else {
                console.log(`N${(i + 1) * 10 + 5}: ${seg.gCode} X${seg.endX.toFixed(3)} Z${seg.endZ.toFixed(3)} (NO COMP)`)
            }
        })

        // Hand-calculated expected values from IMG_1550
        // Format: [endX, endZ, radius?]
        const handExpected = [
            // N5 (start): X43, Z-0.400 — matches
            { label: 'N15', endX: 43.000, endZ: -80.49 },      // App: -80.311
            { label: 'N25', endX: 40.862, endZ: -82.782 },     // App: -82.781 ≈ match
            { label: 'N35', endX: 40.000, endZ: -84.726, r: 4.6 }, // App: -84.725 ≈ match
            { label: 'N45', endX: 40.000, endZ: -130.538 },    // App: -130.539 ≈ match
            { label: 'N55', endX: 40.862, endZ: -132.982, r: 4.6 }, // App: -132.741 — DISCREPANCY
            { label: 'N65', endX: 43.500, endZ: -135.311 },    // App: -135.311 match
            { label: 'N75', endX: 43.500, endZ: -485.402 },    // App: match?
            { label: 'N85', endX: 44.000, endZ: -512.135 },    // App: X43.981, Z-512.155 — DISCREPANCY
            { label: 'N95', endX: 44.862, endZ: -514.08, r: 4.6 }, // App: X44.842, Z-514.316 — DISCREPANCY
            { label: 'N105', endX: 60.000, endZ: -530.312 },   // App: -530.311 ≈ match
            { label: 'N115', endX: 60.000, endZ: -550.400 },   // App: match
        ]

        console.log('\n=== Comparison: App vs Hand ===')
        const segs = result.segments
        for (let i = 0; i < segs.length; i++) {
            const comp = segs[i].compensated
            if (!comp) continue
            const hand = handExpected[i]
            if (!hand) continue
            const dx = comp.endX - hand.endX
            const dz = comp.endZ - hand.endZ
            const flag = (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) ? ' *** MISMATCH ***' : ' OK'
            console.log(`${hand.label}: App(X${comp.endX.toFixed(3)}, Z${comp.endZ.toFixed(3)}) vs Hand(X${hand.endX.toFixed(3)}, Z${hand.endZ.toFixed(3)}) ΔX=${dx.toFixed(3)} ΔZ=${dz.toFixed(3)}${flag}`)
            if (hand.r !== undefined && comp.radius !== undefined) {
                console.log(`  R: App=${comp.radius.toFixed(3)} vs Hand=${hand.r.toFixed(3)}`)
            }
        }

        // Start point check
        const startX = segs[0].compensated?.startX ?? segs[0].startX
        const startZ = segs[0].compensated?.startZ ?? segs[0].startZ
        console.log(`\nN5 (start): X${startX.toFixed(3)} Z${startZ.toFixed(3)}`)
        expect(startX).toBeCloseTo(43.0, 1)
        expect(startZ).toBeCloseTo(-0.4, 1)
    })

    it('should investigate taper angles at each junction', () => {
        const result = calculateShape(shape, settingsRear)

        console.log('=== Segment angles and taper detection ===')
        result.segments.forEach((seg, i) => {
            const angle = seg.angle !== undefined ? seg.angle.toFixed(3) : 'N/A'
            const isTaper = seg.type === 'line' && seg.angle !== undefined && seg.angle !== 0 && seg.angle !== 90
            console.log(`Seg${i}: type=${seg.type}, angle=${angle}, isTaper=${isTaper}, X:${seg.startX}→${seg.endX}, Z:${seg.startZ}→${seg.endZ}`)
        })
    })

    it('should verify bisector method gives correct results for N15 and N55', () => {
        // The isNextTaper branch uses fz formula with dz=0, but bisector + dz should be used
        // Manual bisector calculation for node i=1 (Z-line → taper):
        // n1 = (1, 0), n2 ≈ (0.9063, -0.4226)
        // bisector: b = normalize(1.9063, -0.4226) = (0.9762, -0.2164)
        // dist = R / cos(α/2) = 0.4 / cos(12.5°) = 0.4097
        // pz = -80 + (-0.2217) * 0.4 = -80.0887
        // dz = 0.4 (nodeIsConvex=false, isConvex=false in calculateDzFromBisector)
        // oz = -80.0887 - 0.4 = -80.489 ≈ -80.49 (hand calc)

        const result = calculateShape(shape, settingsRear)
        const s = result.segments

        // Current app values (using fz formula - WRONG)
        const n15z = s[0].compensated?.endZ ?? s[0].endZ
        console.log(`N15 current: Z${n15z.toFixed(3)} (expected: Z-80.49)`)
        console.log(`N15 error: ${(n15z - (-80.49)).toFixed(3)} mm`)

        const n55z = s[4].compensated?.endZ ?? s[4].endZ
        console.log(`N55 current: Z${n55z.toFixed(3)} (expected: Z-132.482)`)
        console.log(`N55 error: ${(n55z - (-132.482)).toFixed(3)} mm`)

        const n85x = s[7].compensated?.endX ?? s[7].endX
        const n85z = s[7].compensated?.endZ ?? s[7].endZ
        console.log(`N85 current: X${n85x.toFixed(3)} Z${n85z.toFixed(3)} (expected: X44.000 Z-512.135)`)

        const n95x = s[8].compensated?.endX ?? s[8].endX
        const n95z = s[8].compensated?.endZ ?? s[8].endZ
        console.log(`N95 current: X${n95x.toFixed(3)} Z${n95z.toFixed(3)} (expected: X44.862 Z-514.08)`)
    })
})
