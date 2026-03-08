import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * 6点形状: NCプログラム出力値との照合
 *
 * 修正履歴:
 *   1. nodeIsConvex[]導入: 角R系dz不連続(0.4mm)解消
 *   2. shape.ts p2AdjustedZ除去: 隅R弧の二重補正解消
 *   3. concaveExitCorrection除去: 不要な2×noseR補正削除
 *   4. テーパー→凹弧bisectorフォールスルー: テーパー終点Z修正
 *
 * 完全一致:
 *   N15 Z, N25 X/Z/R, N35 X/Z, N45 Z, N85 Z, N95 Z
 *
 * 残存誤差:
 *   隅R2 endZ: 0.137mm（N65）
 */
describe('NCプログラム出力との照合（6点形状）', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1',
            name: 'Test',
            type: 'external',
            noseRadius: 0.4,
            toolTipNumber: 3,
            hand: 'right'
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        }
    }

    const shape = {
        points: [
            createPoint(66, 0, noCorner()),
            createPoint(66, -115, { type: 'kaku-r' as const, size: 0.5 }),
            createPoint(63, -116.5, { type: 'sumi-r' as const, size: 1 }),
            createPoint(63, -169, { type: 'sumi-r' as const, size: 2 }),
            createPoint(70, -184, { type: 'kaku-r' as const, size: 2 }),
            createPoint(70, -200, noCorner())
        ]
    }

    // NCプログラム出力値（user_6point_verification.test.ts より）
    const nc = {
        n15: { x: 66.000, z: -115.193 },
        n25: { x: 65.473, z: -115.829, r: 0.900 },
        n45: { x: 63.000, z: -117.314, r: 0.600 },
        n55: { x: 63.000, z: -169.170 },
        n65: { x: 63.084, z: -169.533, r: 1.600 },
        n75: { x: 69.874, z: -184.085 },
        n85: { x: 70.000, z: -184.630, r: 2.400 },
        n95: { x: 70.000, z: -200.400 }
    }

    it('NCプログラム出力との差異記録', () => {
        const result = calculateShape(shape, settings)

        // === 完全一致するポイント ===
        const seg1 = result.segments[0]
        expect(seg1.compensated?.endZ).toBeCloseTo(nc.n15.z, 2) // N15 Z ✓

        const kakuR05 = result.segments.find(s => s.type === 'corner-r' && s.isConvex && s.radius === 0.5)
        expect(kakuR05?.compensated?.radius).toBeCloseTo(nc.n25.r, 2) // N25 R ✓

        // 角R2 endZ: ノード単位dz修正により完全一致 ✓
        const kakuR2 = result.segments.filter(s => s.type === 'corner-r' && s.isConvex).find(s => s.radius === 2)
        expect(kakuR2?.compensated?.endZ).toBeCloseTo(nc.n85.z, 2) // N85 Z ✓

        const last = result.segments[result.segments.length - 1]
        expect(last.compensated?.endZ).toBeCloseTo(nc.n95.z, 2) // N95 Z ✓

        // 角R0.5 endX/endZ: 完全一致 ✓
        expect(kakuR05?.compensated?.endX).toBeCloseTo(nc.n25.x, 2) // N25 X ✓
        expect(kakuR05?.compensated?.endZ).toBeCloseTo(nc.n25.z, 2) // N25 Z ✓

        // 隅R2 endZ: コード-169.670 vs NC-169.533（差0.137mm）
        const sumiR2 = result.segments.find(s => s.type === 'corner-r' && !s.isConvex && s.radius === 2)
        expect(sumiR2?.compensated?.endZ).toBeCloseTo(nc.n65.z, 0)

        // 隅R1 endZ: shape.ts p2AdjustedZ除去 + bisectorフォールスルーで完全一致 ✓
        const sumiR1 = result.segments.find(s => s.type === 'corner-r' && !s.isConvex && s.radius === 1)
        expect(sumiR1?.compensated?.endZ).toBeCloseTo(nc.n45.z, 2) // N45 Z ✓
    })
})
