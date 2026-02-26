import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * ユーザー報告の問題検証（2026-02-12）
 *
 * 問題：垂直線のセグメント長が異常に短縮
 * - 元の垂直線（点2→点3）：Z-46 → Z-50（長さ4.0mm）
 * - 補正後：Z-46.585 → Z-48.800（長さ2.215mm）
 * - 差：約1.8mm短縮 ❌
 */
describe('ユーザー報告の問題検証', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1',
            name: 'Test Tool',
            type: 'external',
            noseRadius: 0.8,
            toolTipNumber: 3,
            hand: 'right'
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        },
    }

    it('実際の形状での垂直線セグメント長の検証', () => {
        // ユーザーが現場で使用した実際の形状
        const shape = {
            points: [
                createPoint(60, -45.654, noCorner()),    // 点1
                createPoint(59.6, -46, noCorner()),       // 点2（30°テーパー終点）
                createPoint(59.6, -50, { type: 'sumi-r', size: 2 }),  // 点3（垂直線終点、隅R2）
                createPoint(80, -50, { type: 'kaku-c', size: 0.2 }),  // 点4（角C0.2）
                createPoint(80, -60, noCorner())          // 点5
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== セグメント詳細 ===')
        result.segments.forEach((seg, i) => {
            console.log(`\nセグメント${i + 1} [${seg.type}]:`)
            console.log(`  元座標: (${seg.startX}, ${seg.startZ}) → (${seg.endX}, ${seg.endZ})`)
            if (seg.compensated) {
                console.log(`  補正後: (${seg.compensated.startX}, ${seg.compensated.startZ}) → (${seg.compensated.endX}, ${seg.compensated.endZ})`)
            }
            if (seg.angle !== undefined) {
                console.log(`  角度: ${seg.angle}°`)
            }
        })

        // セグメント1: 30°テーパー（点1→点2）
        const seg1 = result.segments[0]
        expect(seg1.type).toBe('line')
        expect(seg1.angle).toBeCloseTo(30, 1)

        // セグメント2: 垂直線（点2→点3）
        const seg2 = result.segments[1]
        expect(seg2.type).toBe('line')
        expect(seg2.startX).toBe(59.6)
        expect(seg2.endX).toBe(59.6)

        // 垂直線の長さ検証
        const originalLength = Math.abs(seg2.endZ - seg2.startZ)
        console.log(`\n=== 垂直線の長さ検証 ===`)
        console.log(`元の長さ: ${originalLength.toFixed(3)}mm`)

        if (seg2.compensated) {
            const compensatedLength = Math.abs(seg2.compensated.endZ - seg2.compensated.startZ)
            console.log(`補正後の長さ: ${compensatedLength.toFixed(3)}mm`)
            console.log(`差: ${(compensatedLength - originalLength).toFixed(3)}mm`)
            console.log(`変化率: ${((compensatedLength / originalLength) * 100).toFixed(1)}%`)

            // 垂直線の長さは、隅Rのエントリーポイント調整を考慮しても、
            // 極端に短縮されるべきではない
            // 元の長さの少なくとも50%以上は保持されるべき
            expect(compensatedLength).toBeGreaterThan(originalLength * 0.5)
        }

        // 点2の補正後座標検証（手書き計算との比較）
        const point2CompZ = seg1.compensated?.endZ ?? seg1.endZ
        console.log(`\n=== 点2の補正後Z座標 ===`)
        console.log(`補正後: Z${point2CompZ.toFixed(3)}`)
        console.log(`手書き期待値: Z-46.586`)
        console.log(`誤差: ${(point2CompZ - (-46.586)).toFixed(3)}mm`)

        // 許容誤差：±0.1mm
        expect(Math.abs(point2CompZ - (-46.586))).toBeLessThan(0.1)
    })
})
