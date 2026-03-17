/**
 * Debug test: sumi-R rendering issue reported in IMG_1541-1543
 * Shape: P1(X60,Z-45.654) → P2(X59.6,Z-46) → P3(X59.6,Z-50,隅R2) → P4(X80,Z-50,角C0.2) → P5(X80,Z-60)
 * Settings: noseR=0.8, tip#3 (W-shape), front toolpost, -Z direction, G41/G42 enabled
 */
import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import type { Shape } from '../../models/shape'
import type { MachineSettings } from '../../models/settings'

describe('Debug: sumi-R rendering (IMG_1541-1543)', () => {
    const shape: Shape = {
        points: [
            { id: 'p1', x: 60, z: -45.654, type: 'line', corner: { type: 'none', size: 0 } },
            { id: 'p2', x: 59.6, z: -46, type: 'line', corner: { type: 'none', size: 0 } },
            { id: 'p3', x: 59.6, z: -50, type: 'line', corner: { type: 'sumi-r', size: 2 } },
            { id: 'p4', x: 80, z: -50, type: 'line', corner: { type: 'kaku-c', size: 0.2 } },
            { id: 'p5', x: 80, z: -60, type: 'line', corner: { type: 'none', size: 0 } },
        ],
        retract: { startDiameter: 0, endDiameter: 0 }
    }

    const settings: MachineSettings = {
        toolPost: 'front',
        cuttingDirection: '-z',
        activeToolId: 't01',
        toolLibrary: [{
            id: 't01',
            name: '外径荒加工 (W形状)',
            type: 'external',
            noseRadius: 0.8,
            toolTipNumber: 3,
            hand: 'right',
            insertShape: 'W',
            leadAngle: 95,
            backAngle: 5,
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        }
    }

    it('should produce correct segment types and coordinates', () => {
        const result = calculateShape(shape, settings)

        console.log('=== All segments ===')
        result.segments.forEach((seg, i) => {
            const comp = seg.compensated
            console.log(`Segment ${i}: type=${seg.type}, gCode=${seg.gCode}, sweep=${seg.sweep}`)
            console.log(`  Raw:  (${seg.startX}, ${seg.startZ}) → (${seg.endX}, ${seg.endZ})`)
            if (comp) {
                console.log(`  Comp: (${comp.startX}, ${comp.startZ}) → (${comp.endX}, ${comp.endZ})`)
                if (comp.radius !== undefined) console.log(`  Comp radius: ${comp.radius}`)
            }
            if (seg.radius !== undefined) console.log(`  Raw radius: ${seg.radius}`)
        })

        // Find the sumi-R segment
        const sumiRSeg = result.segments.find(s => s.type === 'corner-r')
        expect(sumiRSeg).toBeDefined()

        if (sumiRSeg) {
            console.log('\n=== Sumi-R segment details ===')
            console.log('gCode:', sumiRSeg.gCode)
            console.log('sweep:', sumiRSeg.sweep)
            console.log('isConvex:', sumiRSeg.isConvex)
            console.log('Raw start:', sumiRSeg.startX, sumiRSeg.startZ)
            console.log('Raw end:', sumiRSeg.endX, sumiRSeg.endZ)
            console.log('Raw radius:', sumiRSeg.radius)
            console.log('Raw center:', sumiRSeg.centerX, sumiRSeg.centerZ)

            if (sumiRSeg.compensated) {
                console.log('Comp start:', sumiRSeg.compensated.startX, sumiRSeg.compensated.startZ)
                console.log('Comp end:', sumiRSeg.compensated.endX, sumiRSeg.compensated.endZ)
                console.log('Comp radius:', sumiRSeg.compensated.radius)
            }

            // gCode depends on machine settings (G02 or G03)
            // With front/−Z: isG02 = isLeftTurn = false → G03
            // User's screenshot shows G02 (different machine settings)
            expect(sumiRSeg.gCode).toBe('G03')

            // Compensated values from screenshot:
            // N35: G02 X62.000 Z-50.000 R1.200
            if (sumiRSeg.compensated) {
                expect(sumiRSeg.compensated.endX).toBeCloseTo(62.0, 1)
                expect(sumiRSeg.compensated.endZ).toBeCloseTo(-50.0, 1)
                expect(sumiRSeg.compensated.radius).toBeCloseTo(1.2, 1)
            }

            // Check sweep direction
            // For sumi-R at this corner (incoming -Z, outgoing +X):
            // isLeftTurn should be true (cross product > 0)
            // sweep should be 0
            console.log('\n=== SVG rendering analysis ===')
            console.log('sweep =', sumiRSeg.sweep, '(0=CCW, 1=CW)')

            // In SVG with default coordSettings (zDir=1, xDir=1):
            // Start SVG: toSvgX(startZ) > toSvgX(endZ) since -48.8 > -50.0
            // Start SVG Y: toSvgY(startX/2) > toSvgY(endX/2) since 29.8 < 31.0 and Y inverts
            // So start is at (right, bottom), end at (left, top)
            console.log('SVG arc: M (right,bottom) A ... 0 0', sumiRSeg.sweep, '(left,top)')
            console.log('Expected: arc curves toward upper-right (inside of corner)')
        }
    })

    it('should match all NC output lines from screenshot', () => {
        const result = calculateShape(shape, settings)

        // Expected NC output from IMG_1543:
        // N5:  G41 D01 X59.785 Z-46.854
        // N15: G01 X59.600 Z-46.585
        // N25: G01 X59.600 Z-48.800
        // N35: G02 X62.000 Z-50.000 R1.200
        // N45: G01 X78.663 Z-50.000
        // N55: G01 X80.000 Z-50.669
        // N65: G01 X80.000 Z-60.800

        expect(result.segments.length).toBe(6) // 6 segments (7 points - 1)

        const s = result.segments

        // N5 (start point of first segment)
        const startX = s[0].compensated?.startX ?? s[0].startX
        const startZ = s[0].compensated?.startZ ?? s[0].startZ
        console.log(`N5:  X${startX.toFixed(3)} Z${startZ.toFixed(3)}`)
        expect(startX).toBeCloseTo(59.785, 2)
        expect(startZ).toBeCloseTo(-46.854, 2)

        // N15
        const n15x = s[0].compensated?.endX ?? s[0].endX
        const n15z = s[0].compensated?.endZ ?? s[0].endZ
        console.log(`N15: X${n15x.toFixed(3)} Z${n15z.toFixed(3)}`)
        expect(n15x).toBeCloseTo(59.6, 1)
        expect(n15z).toBeCloseTo(-46.585, 2)

        // N25
        const n25x = s[1].compensated?.endX ?? s[1].endX
        const n25z = s[1].compensated?.endZ ?? s[1].endZ
        console.log(`N25: X${n25x.toFixed(3)} Z${n25z.toFixed(3)}`)
        expect(n25x).toBeCloseTo(59.6, 1)
        expect(n25z).toBeCloseTo(-48.8, 1)

        // N35 (sumi-R arc)
        const n35x = s[2].compensated?.endX ?? s[2].endX
        const n35z = s[2].compensated?.endZ ?? s[2].endZ
        const n35r = s[2].compensated?.radius ?? s[2].radius
        console.log(`N35: ${s[2].gCode} X${n35x.toFixed(3)} Z${n35z.toFixed(3)} R${n35r?.toFixed(3)}`)
        expect(n35x).toBeCloseTo(62.0, 1)
        expect(n35z).toBeCloseTo(-50.0, 1)
        expect(n35r).toBeCloseTo(1.2, 1)

        // N45
        const n45x = s[3].compensated?.endX ?? s[3].endX
        const n45z = s[3].compensated?.endZ ?? s[3].endZ
        console.log(`N45: X${n45x.toFixed(3)} Z${n45z.toFixed(3)}`)
        expect(n45x).toBeCloseTo(78.663, 2)
        expect(n45z).toBeCloseTo(-50.0, 1)

        // N55
        const n55x = s[4].compensated?.endX ?? s[4].endX
        const n55z = s[4].compensated?.endZ ?? s[4].endZ
        console.log(`N55: X${n55x.toFixed(3)} Z${n55z.toFixed(3)}`)
        expect(n55x).toBeCloseTo(80.0, 1)
        expect(n55z).toBeCloseTo(-50.669, 2)

        // N65
        const n65x = s[5].compensated?.endX ?? s[5].endX
        const n65z = s[5].compensated?.endZ ?? s[5].endZ
        console.log(`N65: X${n65x.toFixed(3)} Z${n65z.toFixed(3)}`)
        expect(n65x).toBeCloseTo(80.0, 1)
        expect(n65z).toBeCloseTo(-60.8, 1)
    })
})
