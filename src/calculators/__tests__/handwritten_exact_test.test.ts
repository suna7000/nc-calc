import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * 手書きメモの検証
 * 注: 手書きメモのX62 Z-44.508は補正**後**の座標
 * 元の図面座標: X60 Z-45.653 → X59.6 Z-46（30°テーパー）
 * 補正後の期待値: X62 Z-44.508 → X59.6 Z-46.586
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

    it('正しい30°テーパー: X60 Z-45.653 → X59.6（元座標）', () => {
        // 正しい元の図面座標で計算
        // X60 Z-45.653 → X59.6 Z-46 (30°テーパー)
        // 教科書式: fz = R × (1 - tan(θ/2)) = 0.8 × (1 - tan(15°)) = 0.586mm
        // 補正後終点: Z = -46 - 0.586 = -46.586mm

        const shape = {
            points: [
                createPoint(60, -45.653, noCorner()),     // 30°テーパー開始点（元座標）
                createPoint(59.6, -46, noCorner()),       // テーパー終点（元座標）
                createPoint(59.6, -50, noCorner())        // 次の点
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 正しい30°テーパーでの計算結果 ===')
        console.log('元の図面座標:')
        console.log(`  始点: X60 Z-45.653`)
        console.log(`  終点: X59.6 Z-46`)
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

        // セグメント1（30°テーパー）の補正後終点を確認
        const seg = result.segments[0]
        const compZ = seg.compensated?.endZ ?? seg.endZ
        const compX = seg.compensated?.endX ?? seg.endX

        console.log('\n=== テーパー終点の補正座標 ===')
        console.log(`  X: ${compX.toFixed(3)}`)
        console.log(`  Z: ${compZ.toFixed(3)}`)

        console.log('\n手書き期待値:')
        console.log(`  Z: -46.586`)

        console.log(`\n誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)

        // 教科書式の理論値
        const theoreticalFz = 0.8 * (1 - Math.tan(15 * Math.PI / 180))
        console.log(`\n教科書式Z方向補正量（fz）: ${theoreticalFz.toFixed(3)}mm`)

        // HP方式（R×(1-tan(θ/2))）による補正後Z
        // テーパー終点: fz = 0.586mm により Z=-46.586
        expect(compZ).toBeCloseTo(-46.586, 3)
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
