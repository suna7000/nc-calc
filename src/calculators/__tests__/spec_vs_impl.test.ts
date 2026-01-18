import { describe, it, expect } from 'vitest'

/**
 * 仕様書の計算式 vs 現在の実装 の差異を検証
 * 
 * 【仕様書の計算】nose_r_compensation_reference.md Line 71-77
 * 角R（凸）からテーパーへの接点：
 *   bd間 = R × (1 - cos(θ))
 *   A点_X = B点_X - 2 × bd間
 *   A点_Z = B点_Z - R × sin(θ)
 * 
 * ここでR = 元のR + noseR （補正後のR）
 */
describe('仕様書の計算式検証', () => {

    it('手書き図面のφ45.97を理論計算で再現', () => {
        // 入力データ（図面情報）
        const baseX = 46.5       // 直径値
        const baseZ = -101       // Z座標
        const originalR = 0.5    // 元のコーナーR
        const noseR = 0.4        // ノーズR
        const taperAngle = 45    // テーパー角度（度）

        // 仕様書の計算
        const compensatedR = originalR + noseR  // = 0.9
        const theta = taperAngle * Math.PI / 180  // ラジアン変換

        // 角Rからテーパーへの接点（A点）
        const bd = compensatedR * (1 - Math.cos(theta))
        const de = compensatedR * Math.sin(theta)

        // B点（接点開始）はbaseから接線距離戻った位置
        const tangentDist = compensatedR / Math.tan(theta / 2)
        const bPointZ = baseZ + tangentDist  // Z方向に戻る

        // A点（円弧終点 = テーパー始点）
        const aPointX = baseX - 2 * bd
        const aPointZ = bPointZ - de

        console.log('\n========================================')
        console.log('仕様書の計算式による検証')
        console.log('========================================')
        console.log(`入力: X${baseX} Z${baseZ} 角R${originalR} noseR${noseR}`)
        console.log(`補正R: ${compensatedR}mm`)
        console.log(`テーパー角: ${taperAngle}度`)
        console.log('')
        console.log('【計算過程】')
        console.log(`  bd間 = R × (1 - cos(θ)) = ${compensatedR} × (1 - ${Math.cos(theta).toFixed(4)}) = ${bd.toFixed(4)}`)
        console.log(`  de間 = R × sin(θ) = ${compensatedR} × ${Math.sin(theta).toFixed(4)} = ${de.toFixed(4)}`)
        console.log(`  接線距離 = R / tan(θ/2) = ${compensatedR} / ${Math.tan(theta / 2).toFixed(4)} = ${tangentDist.toFixed(4)}`)
        console.log('')
        console.log('【結果】')
        console.log(`  B点（直線終点/R入口）: X${baseX.toFixed(3)} Z${bPointZ.toFixed(3)}`)
        console.log(`  A点（R終点/テーパー始点）: X${aPointX.toFixed(3)} Z${aPointZ.toFixed(3)}`)
        console.log('')
        console.log('【手書き図面との比較】')
        console.log(`  手書き: φ45.97 Z-101.82 R0.9`)
        console.log(`  計算結果A点: φ${aPointX.toFixed(2)} 差: ${(45.97 - aPointX).toFixed(3)}mm`)

        // 検証
        // 手書き図面では φ45.97 なので、計算結果もこれに近いはず
        expect(aPointX).toBeCloseTo(45.97, 1)  // 0.1mm以内
    })

    it('現在の実装の計算方法を確認', () => {
        console.log('\n========================================')
        console.log('現在の実装の問題点')
        console.log('========================================')
        console.log('')
        console.log('【現在の実装】')
        console.log('1. shape.ts の calculateCorner で元のR(0.5)で接点計算')
        console.log('2. noseRCompensation.ts で法線方向にnoseR分オフセット')
        console.log('')
        console.log('【仕様書の正しい計算】')
        console.log('1. 補正R = 元R + noseR で接点を計算し直す')
        console.log('2. 接点座標自体が変わる（法線オフセットではなく、Rの拡大による接点移動）')
        console.log('')
        console.log('【差異】')
        console.log('現在: 法線オフセットのみ → X座標がほぼ変化しない')
        console.log('正解: 補正Rで再計算 → X座標がRの分だけシフトする')
    })
})
