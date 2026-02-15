import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * 手書きメモの正確な条件で検証
 * 始点: X62 Z-44.508
 * 30°テーパー下り
 * 終点: X59.6 Z-46.586（期待値）
 */
describe('手書きメモ完全再現テスト', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1',
            name: 'Test',
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

    it('手書きメモの条件: X62 Z-44.508 → X59.6（30°テーパー）', () => {
        // 始点のZ座標を計算
        // ΔX = 62 - 59.6 = 2.4（直径）= 1.2（半径）
        // 30°テーパー: tan(30°) ≈ 0.577
        // ΔZ = 1.2 / tan(30°) = 1.2 / 0.577 ≈ 2.078
        // 終点Z = -44.508 - 2.078 ≈ -46.586（これが手書き期待値！）

        const shape = {
            points: [
                createPoint(62, 0, noCorner()),           // 初期位置
                createPoint(62, -44.508, noCorner()),     // 始点（刃物が逃げた位置）
                createPoint(59.6, -46.586, noCorner()),   // 終点（元座標）
                createPoint(59.6, -50, noCorner())        // 次の点
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 手書きメモ条件での計算結果 ===')
        console.log('入力:')
        console.log(`  始点: X62 Z-44.508`)
        console.log(`  終点: X59.6 Z-46.586（元座標）`)
        console.log(`  テーパー角度: 30°`)
        console.log(`  ノーズR: 0.8`)

        console.log('\n=== 全セグメント詳細 ===')
        result.segments.forEach((seg, idx) => {
            console.log(`\nセグメント${idx + 1} [${seg.type}]:`)
            console.log(`  元座標: (${seg.startX}, ${seg.startZ}) → (${seg.endX}, ${seg.endZ})`)
            if (seg.compensated) {
                console.log(`  補正後: (${seg.compensated.startX}, ${seg.compensated.startZ}) → (${seg.compensated.endX}, ${seg.compensated.endZ})`)
            }
        })

        // セグメント2（始点→終点）の補正後終点を確認
        const seg = result.segments[1]
        const compZ = seg.compensated?.endZ ?? seg.endZ
        const compX = seg.compensated?.endX ?? seg.endX

        console.log('\n=== 点3（テーパー終点）の補正座標 ===')
        console.log(`  X: ${compX.toFixed(3)}`)
        console.log(`  Z: ${compZ.toFixed(3)}`)

        console.log('\n手書き期待値:')
        console.log(`  Z: -46.586`)

        console.log(`\n誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)

        // 30°テーパーの理論値を計算
        // fz = R × tan(θ/2) = 0.8 × tan(15°) ≈ 0.8 × 0.268 ≈ 0.214
        const theoreticalFz = 0.8 * Math.tan(15 * Math.PI / 180)
        console.log(`\n理論的なZ方向補正量（fz）: ${theoreticalFz.toFixed(3)}mm`)

        // 手書きメモと一致するか確認（0.01mm精度）
        expect(compZ).toBeCloseTo(-46.586, 2)
    })

    it('元のアプリ入力との比較', () => {
        const shapeApp = {
            points: [
                createPoint(60, 0, noCorner()),
                createPoint(60, -45.653, noCorner()),
                createPoint(59.6, -46, noCorner()),
                createPoint(59.6, -50, { type: 'sumi-r', size: 2 }),
                createPoint(80, -50, noCorner()),
                createPoint(80, -60, noCorner())
            ]
        }

        const result = calculateShape(shapeApp, settings)
        const seg = result.segments[1]
        const compZ = seg.compensated?.endZ ?? seg.endZ

        console.log('\n=== アプリ入力での計算結果 ===')
        console.log(`補正後Z: ${compZ.toFixed(3)}`)
        console.log(`手書き期待値: -46.586`)
        console.log(`誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)
    })
})
