import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('テーパー補正計算の詳細デバッグ', () => {
    it('30°テーパーの各ステップを追跡', () => {
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
            }
        }

        // 30°テーパー: X60 Z-45.653 → X59.6 Z-46
        const shape = {
            points: [
                createPoint(60, -45.653, noCorner()),
                createPoint(59.6, -46, noCorner()),
                createPoint(59.6, -50, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 30°テーパーセグメントの詳細 ===\n')

        const seg = result.segments[0]

        console.log('【入力座標】')
        console.log(`  始点: X${seg.startX} Z${seg.startZ}`)
        console.log(`  終点: X${seg.endX} Z${seg.endZ}`)
        console.log(`  angle: ${seg.angle}°`)

        console.log('\n【理論計算】')
        const R = 0.8
        const theta = 30
        const isDiameterDecreasing = seg.endX < seg.startX
        console.log(`  R = ${R}mm`)
        console.log(`  θ = ${theta}°`)
        console.log(`  直径変化: ${seg.startX} → ${seg.endX} (${isDiameterDecreasing ? '減少' : '増加'})`)

        const factor = isDiameterDecreasing
            ? (1 - Math.tan(theta / 2 * Math.PI / 180))
            : (1 + Math.tan(theta / 2 * Math.PI / 180))

        const expectedFz = R * factor
        console.log(`  公式: fz = R × (1 ${isDiameterDecreasing ? '-' : '+'} tan(θ/2))`)
        console.log(`      = ${R} × (1 ${isDiameterDecreasing ? '-' : '+'} tan(${theta/2}°))`)
        console.log(`      = ${R} × ${factor.toFixed(4)}`)
        console.log(`      = ${expectedFz.toFixed(3)}mm`)

        console.log('\n【期待される補正後座標】')
        const expectedEndZ = seg.endZ - expectedFz  // Tip3: oz = pz - dz
        console.log(`  終点Z = ${seg.endZ} - ${expectedFz.toFixed(3)}`)
        console.log(`        = ${expectedEndZ.toFixed(3)}`)

        if (seg.compensated) {
            console.log('\n【実際の補正結果】')
            console.log(`  始点: X${seg.compensated.startX.toFixed(3)} Z${seg.compensated.startZ.toFixed(3)}`)
            console.log(`  終点: X${seg.compensated.endX.toFixed(3)} Z${seg.compensated.endZ.toFixed(3)}`)

            const actualFz = Math.abs(seg.compensated.endZ - seg.endZ)
            console.log(`  実際の補正量: ${actualFz.toFixed(3)}mm`)

            console.log('\n【誤差分析】')
            console.log(`  期待値: Z${expectedEndZ.toFixed(3)}`)
            console.log(`  実測値: Z${seg.compensated.endZ.toFixed(3)}`)
            const error = seg.compensated.endZ - expectedEndZ
            console.log(`  誤差: ${error.toFixed(3)}mm`)

            if (Math.abs(error) > 0.01) {
                console.log('\n【誤差の原因調査】')
                console.log(`  期待fz: ${expectedFz.toFixed(3)}mm`)
                console.log(`  実際fz: ${actualFz.toFixed(3)}mm`)
                console.log(`  差分: ${(actualFz - expectedFz).toFixed(3)}mm`)

                // 可能性のある原因
                console.log('\n  考えられる原因:')

                // 1. Bisectorのdist計算が影響？
                const bisectorTanFactor = Math.tan(15 * Math.PI / 180)
                const bisectorDist = R * bisectorTanFactor
                console.log(`  1. Bisector dist = R×tan(15°) = ${bisectorDist.toFixed(3)}mm`)

                // 2. 標準dz=noseRが適用されている？
                console.log(`  2. 標準dz = noseR = ${R}mm`)

                // 3. 組み合わせ？
                console.log(`  3. tan公式が適用されていない可能性`)
            }

            // セグメントの角度変化をチェック
            console.log('\n【セグメント形状の確認】')
            const inputDZ = seg.endZ - seg.startZ
            const inputDX = (seg.endX - seg.startX) / 2
            const outputDZ = seg.compensated.endZ - seg.compensated.startZ
            const outputDX = (seg.compensated.endX - seg.compensated.startX) / 2

            console.log(`  入力: ΔZ=${inputDZ.toFixed(3)}, ΔX=${inputDX.toFixed(3)}`)
            console.log(`  出力: ΔZ=${outputDZ.toFixed(3)}, ΔX=${outputDX.toFixed(3)}`)

            if (Math.abs(outputDZ) < 0.01) {
                console.log(`  ⚠️ 警告: 補正後のセグメントがほぼ水平になっています！`)
                console.log(`  テーパー線は補正後も同じ角度を保つべきです。`)
            }
        }

        console.log('\n【手書きメモとの比較】')
        console.log(`  手書き期待値: Z-46.586`)
        console.log(`  理論計算値: Z${expectedEndZ.toFixed(3)}`)
        console.log(`  実測値: Z${seg.compensated?.endZ.toFixed(3) || 'N/A'}`)
    })
})
