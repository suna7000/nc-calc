import { describe, it } from 'vitest'

/**
 * 手書きメモの幾何学的検証
 * 始点 X62 Z-44.508 から 30°テーパー下りで X59.6 まで進んだ時の Z座標を計算
 */
describe('手書きメモの幾何学検証', () => {
    it('30°テーパーの幾何学計算', () => {
        const startX = 62  // 直径
        const startZ = -44.508
        const endX = 59.6  // 直径

        // 半径変化
        const deltaR = (startX - endX) / 2  // = 1.2mm

        // 30°テーパー: tan(30°) = ΔZ / ΔR
        const angle = 30  // 度
        const tan30 = Math.tan(angle * Math.PI / 180)  // ≈ 0.577

        // ΔZ = ΔR / tan(30°)
        const deltaZ = deltaR / tan30

        // 終点Z座標
        const endZ = startZ - deltaZ  // マイナス方向へ

        console.log('\n=== 30°テーパーの幾何学計算 ===')
        console.log(`始点: X${startX} Z${startZ}`)
        console.log(`終点X: ${endX}`)
        console.log('')
        console.log(`半径変化 ΔR: ${deltaR.toFixed(3)}mm`)
        console.log(`tan(30°): ${tan30.toFixed(3)}`)
        console.log(`Z方向変化 ΔZ: ${deltaZ.toFixed(3)}mm`)
        console.log('')
        console.log(`計算された終点Z: ${endZ.toFixed(3)}`)
        console.log(`手書きメモのZ: -46.586`)
        console.log(`差: ${(endZ - (-46.586)).toFixed(3)}mm`)

        // 逆算：Z-46.586 を実現するテーパー角度は？
        const actualDeltaZ = -46.586 - startZ  // = -2.078
        const actualAngle = Math.atan(deltaR / Math.abs(actualDeltaZ)) * 180 / Math.PI

        console.log('')
        console.log('=== 逆算 ===')
        console.log(`Z-46.586を実現するには:`)
        console.log(`  実際のΔZ: ${actualDeltaZ.toFixed(3)}mm`)
        console.log(`  必要な角度: ${actualAngle.toFixed(2)}°`)
    })

    it('ノーズR補正を考慮した手書き計算の再現', () => {
        // ユーザーの手書き計算を推測して再現
        const noseR = 0.8
        const angle = 30  // テーパー角度

        // fz = R × tan(θ/2)
        const fz = noseR * Math.tan((angle / 2) * Math.PI / 180)

        console.log('\n=== 手書き簡易補正計算の推測 ===')
        console.log(`ノーズR: ${noseR}mm`)
        console.log(`テーパー角度: ${angle}°`)
        console.log(`fz = R × tan(θ/2) = ${fz.toFixed(3)}mm`)

        // もし手書きが「Z-46にfzを加算」という計算をしていたら？
        const baseZ = -46
        const compensatedZ = baseZ - fz

        console.log('')
        console.log(`仮定: 元座標 Z-46 に fz を加算`)
        console.log(`  補正後Z: ${compensatedZ.toFixed(3)}`)
        console.log(`  手書き値: -46.586`)
        console.log(`  差: ${(compensatedZ - (-46.586)).toFixed(3)}mm`)
    })
})
