import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * 実際のshape.ts出力を使ったデバッグ
 */
describe('実際の形状計算出力による検証', () => {
    it('ユーザー形状のセグメント詳細出力', () => {
        const settings: MachineSettings = {
            ...defaultMachineSettings,
            toolPost: 'rear',
            activeToolId: 't1',
            toolLibrary: [{
                id: 't1',
                name: '外径仕上げ',
                type: 'external',
                noseRadius: 0.4,
                toolTipNumber: 3,
                hand: 'right'
            }],
            noseRCompensation: {
                enabled: true,
                offsetNumber: 1,
                compensationDirection: 'auto' as CompensationDirection,
                method: 'geometric'
            },
        }

        const shape = {
            points: [
                createPoint(46.5, 0, noCorner()),
                createPoint(46.5, -101, { type: 'kaku-r', size: 0.5 }),
                createPoint(42, -103.25, { type: 'sumi-r', size: 2 }),
                createPoint(42, -118.85, { type: 'sumi-r', size: 2 }),
                createPoint(45, -136, { type: 'kaku-r', size: 2 }),
                createPoint(45, -150, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('=== 全セグメント詳細 ===')
        result.segments.forEach((seg, i) => {
            console.log(`\n--- Segment ${i + 1} [${seg.type}] ---`)
            console.log(`  Start: X${seg.startX.toFixed(3)}, Z${seg.startZ.toFixed(3)}`)
            console.log(`  End:   X${seg.endX.toFixed(3)}, Z${seg.endZ.toFixed(3)}`)
            if (seg.centerX !== undefined && seg.centerZ !== undefined) {
                console.log(`  Center: X${seg.centerX.toFixed(3)}, Z${seg.centerZ.toFixed(3)}`)
                console.log(`  Radius: ${seg.radius?.toFixed(3)}`)
                console.log(`  isConvex: ${seg.isConvex}`)
                console.log(`  gCode: ${seg.gCode}`)
            }
            if (seg.angle !== undefined) {
                console.log(`  Angle: ${seg.angle}°`)
            }
            if (seg.compensated) {
                const c = seg.compensated
                const dx = c.endX - seg.endX
                const dz = c.endZ - seg.endZ
                console.log(`  Compensated End: X${c.endX.toFixed(3)}, Z${c.endZ.toFixed(3)}`)
                console.log(`  Shift: ΔX=${dx.toFixed(3)}, ΔZ=${dz.toFixed(3)}`)
                if (Math.abs(dx) > 1.5 || Math.abs(dz) > 1.5) {
                    console.log(`  ⚠️ 異常補正（>1.5mm）`)
                }
            }
        })

        // アサーション: 全セグメントで補正が2mm未満
        result.segments.forEach((seg, i) => {
            if (seg.compensated) {
                const dx = Math.abs(seg.compensated.endX - seg.endX)
                const dz = Math.abs(seg.compensated.endZ - seg.endZ)
                expect(dx, `Seg ${i + 1} ΔX`).toBeLessThan(5.0)
                expect(dz, `Seg ${i + 1} ΔZ`).toBeLessThan(5.0)
            }
        })
    })
})
