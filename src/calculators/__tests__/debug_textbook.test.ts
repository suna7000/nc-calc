import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('教科書式デバッグ', () => {
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

    it('30°テーパー単独での計算', () => {
        // セグメント1を削除して、テーパーのみでテスト
        const shape = {
            points: [
                createPoint(60, -45.653, noCorner()),  // 開始点
                createPoint(59.6, -46, noCorner()),     // テーパー終点
                createPoint(59.6, -50, noCorner())      // 次の点
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== テーパー単独での計算 ===')
        result.segments.forEach((seg, idx) => {
            console.log(`\nセグメント${idx + 1}:`)
            console.log(`  元座標: X${seg.endX} Z${seg.endZ}`)
            if (seg.compensated) {
                console.log(`  補正後: X${seg.compensated.endX} Z${seg.compensated.endZ}`)
            }
        })

        const seg1 = result.segments[0]
        const compZ = seg1.compensated?.endZ ?? seg1.endZ

        console.log('\n=== 結果 ===')
        console.log(`補正後Z: ${compZ}`)
        console.log(`手書き期待値: -46.586`)
        console.log(`誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)

        // 理論値を計算
        const theta = 30 * Math.PI / 180
        const halfTheta = theta / 2
        const tanHalf = Math.tan(halfTheta)
        const fz_textbook = 0.8 * (1 - tanHalf)
        const fz_bisector = 0.8 * tanHalf

        console.log('\n=== 理論値 ===')
        console.log(`教科書式 fz = R × (1 - tan(θ/2)) = ${fz_textbook.toFixed(3)}mm`)
        console.log(`bisector fz = R × tan(θ/2) = ${fz_bisector.toFixed(3)}mm`)
        console.log(`期待補正後Z（教科書）: ${(-46 - fz_textbook).toFixed(3)}`)
    })
})
