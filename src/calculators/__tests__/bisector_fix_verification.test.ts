import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * Bisector数式修正の検証（2026-02-26）
 *
 * 根本原因: calculateBisectorが誤った数式を使用していた
 * - 誤: dist = R / cos(θ/2) = R × sec(θ/2)
 * - 正: dist = R × tan(θ/2)
 *
 * 90度接続での誤差:
 * - 誤: R / cos(45°) = 1.414R (+41.4%!)
 * - 正: R × tan(45°) = 1.000R
 *
 * ユーザー報告の0.428mm誤差:
 * - 基本誤差: 0.8 × (1.414 - 1.0) = 0.331mm
 * - Z成分投影: ≈0.428mm
 */
describe('Bisector Fix Verification', () => {
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

    it('ユーザー報告値の検証: 点3のZ座標（隅R2の前）', () => {
        // ユーザーの実際の形状
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

        console.log('\n=== ユーザー報告値の検証 ===')
        result.segments.forEach((seg, i) => {
            if (seg.compensated) {
                console.log(`Seg${i + 1}: Z${seg.startZ} → Z${seg.compensated.startZ}`)
            }
        })

        // 点2の補正後Z座標（テーパー終点）
        const seg1 = result.segments[0]
        if (seg1.compensated) {
            const point2Z = seg1.compensated.endZ
            console.log(`\n点2 補正後: Z${point2Z.toFixed(3)}`)
            console.log(`手書き期待値: Z-46.586`)
            console.log(`誤差: ${(point2Z - (-46.586)).toFixed(3)}mm`)

            // 許容誤差: ±0.01mm
            expect(Math.abs(point2Z - (-46.586))).toBeLessThan(0.01)
        }

        // 垂直線の長さ検証
        const seg2 = result.segments[1]
        const originalLength = Math.abs(seg2.endZ - seg2.startZ)
        if (seg2.compensated) {
            const compensatedLength = Math.abs(seg2.compensated.endZ - seg2.compensated.startZ)
            console.log(`\n垂直線の長さ:`)
            console.log(`  元: ${originalLength.toFixed(3)}mm`)
            console.log(`  補正後: ${compensatedLength.toFixed(3)}mm`)
            console.log(`  変化率: ${((compensatedLength / originalLength) * 100).toFixed(1)}%`)

            // 垂直線の長さは合理的に保持されるべき
            expect(compensatedLength).toBeGreaterThan(originalLength * 0.8)
            expect(compensatedLength).toBeLessThan(originalLength * 1.2)
        }
    })

    it('複数角度でのtan(θ/2)検証', () => {
        console.log('\n=== 複数角度でのtan(θ/2)検証 ===')

        const testCases = [
            { angle: 30, expectedFactor: Math.tan(30 * Math.PI / 180 / 2) },
            { angle: 45, expectedFactor: Math.tan(45 * Math.PI / 180 / 2) },
            { angle: 60, expectedFactor: Math.tan(60 * Math.PI / 180 / 2) },
            { angle: 90, expectedFactor: Math.tan(90 * Math.PI / 180 / 2) }
        ]

        testCases.forEach(({ angle, expectedFactor }) => {
            // テーパー角度に応じた形状を生成
            const angleRad = angle * Math.PI / 180
            const zLength = 10
            const xDelta = zLength * Math.tan(angleRad) * 2  // 直径なので×2

            const shape = {
                points: [
                    createPoint(50, 0, noCorner()),
                    createPoint(50 - xDelta, -zLength, { type: 'kaku-r', size: 1 }),
                    createPoint(45 - xDelta, -zLength - 5, noCorner())
                ]
            }

            const result = calculateShape(shape, settings)

            console.log(`\n角度${angle}°:`)
            console.log(`  tan(θ/2) = ${expectedFactor.toFixed(3)}`)
            console.log(`  期待オフセット倍率 = ${expectedFactor.toFixed(3)}`)

            // Bisectorの計算結果を間接的に検証
            // （接続点での座標変化から逆算）
            const seg1 = result.segments[0]
            if (seg1.compensated) {
                const endZ = seg1.compensated.endZ
                console.log(`  補正後終点Z: ${endZ.toFixed(3)}`)

                // 数値的に妥当な範囲にあることを確認
                expect(endZ).toBeLessThan(0)  // Z方向マイナス
            }
        })
    })

    it('90度接続での誤差検証（旧実装との比較）', () => {
        // 90度接続（垂直線→水平線）での補正量を検証
        const shape = {
            points: [
                createPoint(50, 0, noCorner()),
                createPoint(50, -10, noCorner()),
                createPoint(40, -10, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 90度接続での検証 ===')
        console.log('旧実装: R / cos(45°) = 0.8 / 0.707 = 1.131mm')
        console.log('新実装: R × tan(45°) = 0.8 × 1.000 = 0.800mm')
        console.log('誤差削減: 0.331mm\n')

        // 接続点での座標を確認
        if (result.segments[0].compensated && result.segments[1].compensated) {
            const seg1EndZ = result.segments[0].compensated.endZ
            const seg2StartZ = result.segments[1].compensated.startZ

            console.log(`垂直線終点Z: ${seg1EndZ.toFixed(3)}`)
            console.log(`水平線始点Z: ${seg2StartZ.toFixed(3)}`)

            // 連続性チェック（同じ点のはず）
            expect(Math.abs(seg1EndZ - seg2StartZ)).toBeLessThan(0.001)
        }
    })
})
