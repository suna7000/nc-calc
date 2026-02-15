import { describe, it, expect } from 'vitest'

/**
 * 教科書式ノーズR補正の検証
 * 出典: nose_r_calculation_reference.md
 *
 * 正刃（通常の切削方向）:
 * fx = 2R(1 - tan(φ/2))  where φ = 90° - θ
 * fz = R(1 - tan(θ/2))
 *
 * 適用方法:
 * -Z方向切削: Z - fz
 */
describe('教科書式ノーズR補正の検証', () => {
    const noseR = 0.8

    it('30°テーパーの補正量計算（教科書式）', () => {
        const theta = 30  // テーパー角度
        const thetaRad = theta * Math.PI / 180
        const halfThetaRad = thetaRad / 2

        // fz = R(1 - tan(θ/2))
        const fz = noseR * (1 - Math.tan(halfThetaRad))

        console.log('\n=== 教科書式による30°テーパー補正 ===')
        console.log(`テーパー角度θ: ${theta}°`)
        console.log(`θ/2: ${theta/2}°`)
        console.log(`tan(θ/2): ${Math.tan(halfThetaRad).toFixed(3)}`)
        console.log(`1 - tan(θ/2): ${(1 - Math.tan(halfThetaRad)).toFixed(3)}`)
        console.log(`fz = R × (1 - tan(θ/2)) = ${fz.toFixed(3)}mm`)

        // 手書き期待値と比較
        const expected = 0.586
        console.log(`\n手書き期待値: ${expected}mm`)
        console.log(`計算値: ${fz.toFixed(3)}mm`)
        console.log(`誤差: ${(fz - expected).toFixed(3)}mm`)

        expect(fz).toBeCloseTo(expected, 3)
    })

    it('実際の図面座標での適用', () => {
        const theta = 30
        const thetaRad = theta * Math.PI / 180
        const halfThetaRad = thetaRad / 2

        // 補正量計算
        const fz = noseR * (1 - Math.tan(halfThetaRad))

        // 点3の座標
        const x3 = 59.6  // 直径
        const z3 = -46   // 補正前

        // 補正後座標
        // -Z方向切削: Z - fz
        const compensatedZ = z3 - fz

        console.log('\n=== 実際の図面座標での適用 ===')
        console.log(`点3（補正前）: X${x3} Z${z3}`)
        console.log(`補正量 fz: ${fz.toFixed(3)}mm`)
        console.log(`補正後Z = ${z3} - ${fz.toFixed(3)} = ${compensatedZ.toFixed(3)}`)
        console.log(`\n手書き期待値: Z-46.586`)
        console.log(`計算値: Z${compensatedZ.toFixed(3)}`)
        console.log(`誤差: ${(compensatedZ - (-46.586)).toFixed(3)}mm`)

        expect(compensatedZ).toBeCloseTo(-46.586, 3)
    })

    it('現在の実装（bisector法）との比較', () => {
        const theta = 30
        const thetaRad = theta * Math.PI / 180
        const halfThetaRad = thetaRad / 2

        // 教科書式
        const fz_textbook = noseR * (1 - Math.tan(halfThetaRad))

        // 現在の実装（bisector法）
        const fz_bisector = noseR * Math.tan(halfThetaRad)

        console.log('\n=== 計算方法の比較 ===')
        console.log(`教科書式: fz = R × (1 - tan(θ/2)) = ${fz_textbook.toFixed(3)}mm`)
        console.log(`bisector法: fz = R × tan(θ/2) = ${fz_bisector.toFixed(3)}mm`)
        console.log(`\n差: ${(fz_textbook - fz_bisector).toFixed(3)}mm`)
        console.log(`\n教科書式での補正後: Z${(-46 - fz_textbook).toFixed(3)}`)
        console.log(`bisector法での補正後: Z${(-46 - fz_bisector).toFixed(3)}`)
        console.log(`\n手書き期待値: Z-46.586`)
        console.log(`教科書式の誤差: ${((-46 - fz_textbook) - (-46.586)).toFixed(3)}mm`)
        console.log(`bisector法の誤差: ${((-46 - fz_bisector) - (-46.586)).toFixed(3)}mm`)
    })

    it('45°テーパーの検証（教科書の例）', () => {
        const theta = 45
        const thetaRad = theta * Math.PI / 180
        const halfThetaRad = thetaRad / 2

        // fz = R(1 - tan(θ/2))
        const fz = noseR * (1 - Math.tan(halfThetaRad))

        console.log('\n=== 45°テーパーの検証 ===')
        console.log(`テーパー角度: ${theta}°`)
        console.log(`fz = 0.8 × (1 - tan(22.5°)) = ${fz.toFixed(3)}mm`)

        // nose_r_compensation_reference.md の例（230行）では
        // R=0.4, 45°テーパーで fz = 0.234mm
        const fz_ref = 0.4 * (1 - Math.tan(22.5 * Math.PI / 180))
        console.log(`\n参考値（R=0.4）: ${fz_ref.toFixed(3)}mm`)
        console.log(`ドキュメント記載値: 0.234mm`)

        expect(fz_ref).toBeCloseTo(0.234, 3)
    })

    it('fx（X方向補正）の計算', () => {
        const theta = 30
        const phi = 90 - theta  // φ = 90° - θ
        const phiRad = phi * Math.PI / 180
        const halfPhiRad = phiRad / 2

        // fx = 2R(1 - tan(φ/2))  直径値
        const fx = 2 * noseR * (1 - Math.tan(halfPhiRad))

        console.log('\n=== X方向補正量の計算 ===')
        console.log(`テーパー角度θ: ${theta}°`)
        console.log(`φ = 90° - θ = ${phi}°`)
        console.log(`fx = 2R × (1 - tan(φ/2)) = ${fx.toFixed(3)}mm`)

        // 点3のX補正
        const x3 = 59.6
        const compensatedX = x3 - fx  // 外径加工なので減算

        console.log(`\n点3（補正前）X: ${x3}`)
        console.log(`補正後X: ${compensatedX.toFixed(3)}`)
    })
})
