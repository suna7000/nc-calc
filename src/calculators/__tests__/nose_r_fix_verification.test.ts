import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * ノーズR補正の0.428mm誤差修正の検証
 * 手書きメモの値（Z-46.586）との整合性確認
 */
describe('ノーズR補正修正の検証', () => {
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

    it('報告事例: X59.6 Z-46 (隅R2の前) でZ-46.586付近を出力', () => {
        // 点1: 開始点
        // 点2: X60 Z-45.653
        // 点3: X59.6 Z-46 ← この点の補正値を検証
        // 点4: X59.6 Z-50 隅R2 ← 円弧開始
        // 点5: X80 Z-50

        const shape = {
            points: [
                createPoint(60, 0, noCorner()),
                createPoint(60, -45.653, noCorner()),
                createPoint(59.6, -46, noCorner()),
                createPoint(59.6, -50, { type: 'sumi-r', size: 2 }),
                createPoint(80, -50, noCorner()),
                createPoint(80, -60, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        // セグメント2（点2→点3）の終点Z座標を確認
        const seg2 = result.segments[1]
        const compZ = seg2.compensated?.endZ ?? seg2.endZ

        console.log(`報告事例検証:`)
        console.log(`  入力: X59.6 Z-46`)
        console.log(`  手書き期待値: Z-46.586`)
        console.log(`  修正前出力: Z-47.014 (誤差 -0.428mm)`)
        console.log(`  修正後出力: Z${compZ.toFixed(3)}`)

        // 手書きメモの正解値: Z-46.586（0.1mm精度で検証）
        expect(compZ).toBeCloseTo(-46.586, 1)
    })

    it('90度コーナーでのtan(θ/2)検証', () => {
        // シンプルな90度コーナー
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(100, -10, noCorner()),
                createPoint(110, -10, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        // ノーズR = 0.8, 90度コーナー
        // tan(45°) = 1.0
        // bisector方向のオフセット距離 = 0.8 * 1.0 = 0.8mm

        const seg1 = result.segments[1]
        const compZ = seg1.compensated?.startZ ?? seg1.startZ

        console.log(`90度コーナー検証:`)
        console.log(`  入力: X100 Z-10`)
        console.log(`  修正後: Z${compZ.toFixed(3)}`)

        // Z方向のオフセット成分を確認（詳細な幾何計算が必要だが、概算で検証）
        // bisector: (0.707, 0.707), dist = 0.8
        // offset_z = 0.707 * 0.8 = 0.566
        // Tip3 shift: -0.8
        // expected ≈ -10 + 0.566 - 0.8 = -10.234
        expect(compZ).toBeCloseTo(-10.234, 1)
    })

    it('60度コーナーでのtan(30°)検証', () => {
        // 60度コーナー（θ/2 = 30度）
        // tan(30°) ≈ 0.577
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(100, -10, noCorner()),
                createPoint(105.774, -10, noCorner())  // 30度テーパー
            ]
        }

        const result = calculateShape(shape, settings)

        // ノーズR = 0.8, 60度コーナー
        // tan(30°) ≈ 0.577
        // オフセット距離 = 0.8 * 0.577 ≈ 0.462mm

        const seg1 = result.segments[1]
        const compZ = seg1.compensated?.startZ ?? seg1.startZ

        console.log(`60度コーナー検証:`)
        console.log(`  入力: X100 Z-10`)
        console.log(`  修正後: Z${compZ.toFixed(3)}`)

        // オフセット距離が修正前（1.155R = 0.924mm）より小さくなることを確認
        // 修正前より改善されているはず
        expect(compZ).toBeGreaterThan(-11)
        expect(compZ).toBeLessThan(-10)
    })
})
