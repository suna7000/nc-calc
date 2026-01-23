import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'

/**
 * spec_vs_impl.test.ts の理論計算 vs 現在のアプリ実装の比較
 */
describe('理論計算 vs 実装の比較', () => {

    it('同じ入力データで比較', () => {
        // 入力データ（spec_vs_impl.test.tsと同じ）
        const baseX = 46.5
        const baseZ = -101
        const originalR = 0.5
        const noseR = 0.4
        const taperAngle = 45

        // ======= 理論計算（spec_vs_impl.test.tsから） =======
        const compensatedR = originalR + noseR  // = 0.9
        const theta = taperAngle * Math.PI / 180

        const bd = compensatedR * (1 - Math.cos(theta))  // 0.2636
        const de = compensatedR * Math.sin(theta)        // 0.6364
        const tangentDist = compensatedR / Math.tan(theta / 2)  // 2.1728

        const bPointZ = baseZ + tangentDist  // -98.827
        const aPointX = baseX - 2 * bd       // 45.973
        const aPointZ = bPointZ - de         // -99.464

        console.log('======= 理論計算（spec_vs_impl.test.ts） =======')
        console.log(`B点: X${baseX.toFixed(3)} Z${bPointZ.toFixed(3)}`)
        console.log(`A点: X${aPointX.toFixed(3)} Z${aPointZ.toFixed(3)}`)

        // ======= アプリ実装 =======
        const shape = {
            points: [
                { id: '1', x: 46.5, z: 0, corner: { type: 'none' as const, size: 0 } },
                { id: '2', x: 46.5, z: -101, corner: { type: 'kaku-r' as const, size: 0.5 } },
                { id: '3', x: 42, z: -103.25, corner: { type: 'none' as const, size: 0 } },
            ]
        }

        const machineSettings = {
            toolPost: 'rear' as const,
            cuttingDirection: '-z' as const,
            noseRCompensation: { enabled: true, method: 'geometric' as const, offsetNumber: 1, compensationDirection: 'auto' as const },
            toolLibrary: [{ id: 'tool1', name: 'Test', noseRadius: 0.4, toolTipNumber: 3, type: 'external' as const, hand: 'right' as const }],
            activeToolId: 'tool1',
            coordinateDisplay: { xAxis: 'diameter' as const }
        }

        const result = calculateShape(shape, machineSettings as any)

        console.log('\n======= アプリ実装出力 =======')
        result.segments.forEach((seg, i) => {
            console.log(`Seg${i + 1} ${seg.type}: X${seg.endX} Z${seg.endZ}`)
            if (seg.compensated) {
                console.log(`   補正後: X${seg.compensated.endX} Z${seg.compensated.endZ}`)
            }
        })

        // ======= ユーザー期待値 =======
        console.log('\n======= ユーザー期待値 =======')
        console.log('1. 直線（R始点）: X46.5 Z-101.19')
        console.log('2. R終点: X45.97 Z-101.82 R0.9')
        console.log('3. 下りテーパーR始点: X42.93 Z-103.34')
        console.log('4. 下りテーパーR終点: X42 Z-104.47 R1.6')

        // ======= 比較表 =======
        console.log('\n======= 比較表 =======')
        console.log('| 項目 | 理論計算 | アプリ出力 | ユーザー期待値 |')
        console.log('|------|----------|-----------|--------------|')
        console.log(`| R始点(B点)Z | ${bPointZ.toFixed(3)} | ${result.segments[0].endZ.toFixed(3)} | -101.19 |`)

        const seg1 = result.segments[1]
        console.log(`| R終点(A点)X | ${aPointX.toFixed(3)} | ${seg1.endX.toFixed(3)} | 45.97 |`)
        console.log(`| R終点(A点)Z | ${aPointZ.toFixed(3)} | ${seg1.endZ.toFixed(3)} | -101.82 |`)

        // 分析
        console.log('\n======= 分析 =======')
        console.log('理論計算とユーザー期待値の差:')
        console.log(`  R始点Z: ${bPointZ.toFixed(3)} vs -101.19 = 差${(bPointZ - (-101.19)).toFixed(3)}mm`)
        console.log(`  R終点X: ${aPointX.toFixed(3)} vs 45.97 = 差${(aPointX - 45.97).toFixed(3)}mm ← ほぼ一致`)
        console.log(`  R終点Z: ${aPointZ.toFixed(3)} vs -101.82 = 差${(aPointZ - (-101.82)).toFixed(3)}mm`)

        console.log('\nアプリ出力とユーザー期待値の差:')
        console.log(`  R始点Z: ${result.segments[0].endZ.toFixed(3)} vs -101.19 = 差${(result.segments[0].endZ - (-101.19)).toFixed(3)}mm`)
        console.log(`  R終点X: ${seg1.endX.toFixed(3)} vs 45.97 = 差${(seg1.endX - 45.97).toFixed(3)}mm`)
        console.log(`  R終点Z: ${seg1.endZ.toFixed(3)} vs -101.82 = 差${(seg1.endZ - (-101.82)).toFixed(3)}mm`)
    })
})
