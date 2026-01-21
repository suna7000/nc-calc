import { describe, it, expect } from 'vitest'

/**
 * 工場長のネタ帳の記事に基づいた計算
 * 
 * 2段階の計算：
 * 1. 補正R（= 元R + noseR）で接点を計算 → 図面座標
 * 2. ノーズR補正量（fx, fz）を図面座標に適用 → NCプログラム座標
 * 
 * 公式（工場長のネタ帳より）:
 * fx = 2R(1 - tan(φ/2))  ※ φ = 90 - θ
 * fz = R(1 - tan(θ/2))
 */
describe('工場長のネタ帳の計算方法', () => {

    it('ユーザーケースを再計算', () => {
        // 入力データ
        const baseX = 46.5       // 直径値
        const baseZ = -101       // Z座標（コーナー点）
        const originalR = 0.5    // 元のコーナーR
        const noseR = 0.4        // ノーズR
        const taperAngle = 45    // テーパー角度（度）

        const theta = taperAngle * Math.PI / 180
        const phi = (90 - taperAngle) * Math.PI / 180

        console.log('========================================')
        console.log('工場長のネタ帳の計算方法')
        console.log('========================================')
        console.log(`入力: X${baseX} Z${baseZ} 角R${originalR} noseR${noseR} テーパー${taperAngle}度`)

        // ==========================================
        // 段階1: 補正Rで接点計算（図面座標）
        // ==========================================
        const compensatedR = originalR + noseR  // 0.9
        console.log(`\n【段階1: 補正Rで接点計算】`)
        console.log(`補正R = ${originalR} + ${noseR} = ${compensatedR}`)

        // 記事「その3」の計算方法:
        // Ｂ点（直線からの接点）: Ｂ点Ｚ = 基準Z + R × tan(θ/2)
        // → ただし記事では基準点から「+」方向に戻っている
        // 私たちのケースでは Z = -101 で、Z-方向に進むので、接点はZ+方向に戻る

        // 接線距離 = R / tan(θ/2)  ※記事では tan(θ/2) × R を使っているが異なる形式
        const tangentDist = compensatedR / Math.tan(theta / 2)
        console.log(`接線距離 = ${compensatedR} / tan(${taperAngle / 2}°) = ${tangentDist.toFixed(3)}`)

        // B点（直線からの接点 = R入口）
        // 直線は Z方向（X変化なし）なので、B点のXは変わらない
        // B点のZは、コーナー点から接線距離分Z+方向に戻る
        const bPointX = baseX
        const bPointZ = baseZ + tangentDist
        console.log(`B点（R入口）: X${bPointX.toFixed(3)} Z${bPointZ.toFixed(3)}`)

        // A点（テーパーへの接点 = R終点）
        // 記事「その3」の式:
        // ad間 = R × cos(θ)
        // de間 = R × sin(θ)
        // A点X = B点X - 2 × (R - ad間) = B点X - 2 × R × (1 - cos(θ))
        // A点Z = B点Z - de間 = B点Z - R × sin(θ)
        const bd = compensatedR * (1 - Math.cos(theta))  // = R × (1 - cos(θ))
        const de = compensatedR * Math.sin(theta)
        const aPointX = bPointX - 2 * bd
        const aPointZ = bPointZ - de
        console.log(`A点（R終点）: X${aPointX.toFixed(3)} Z${aPointZ.toFixed(3)}`)

        // ==========================================
        // 段階2: ノーズR補正量を適用（NCプログラム座標）
        // ==========================================
        console.log(`\n【段階2: ノーズR補正量を適用】`)

        // 公式: fx = 2R(1 - tan(φ/2)), fz = R(1 - tan(θ/2))
        // ※R = ノーズR
        const fx = 2 * noseR * (1 - Math.tan(phi / 2))
        const fz = noseR * (1 - Math.tan(theta / 2))
        console.log(`fx = 2 × ${noseR} × (1 - tan(${(90 - taperAngle) / 2}°)) = ${fx.toFixed(3)}`)
        console.log(`fz = ${noseR} × (1 - tan(${taperAngle / 2}°)) = ${fz.toFixed(3)}`)

        // 適用方向:
        // 記事によると、切削方向と刃物の向きによってプラスかマイナスかが決まる
        // 外径加工で-Z方向に進む場合（通常のケース）:
        // - fzはZ-方向に適用（座標を小さくする）
        // - fxはX-方向に適用（外径が削れる→座標が小さくなる）

        // B点への適用（直線終点）
        // 直線はZ方向のみなので、fzのみ適用
        const bPointZ_comp = bPointZ - fz
        console.log(`\nB点補正後: X${bPointX.toFixed(3)} Z${bPointZ_comp.toFixed(3)}`)

        // A点への適用（テーパー始点）
        // テーパーはX/Z両方変化するので、fx, fz両方適用
        const aPointX_comp = aPointX // テーパー方向によって異なる
        const aPointZ_comp = aPointZ - fz
        console.log(`A点補正後: X${aPointX_comp.toFixed(3)} Z${aPointZ_comp.toFixed(3)}`)

        // ==========================================
        // 比較
        // ==========================================
        console.log(`\n【ユーザー期待値との比較】`)
        console.log(`| 項目 | 計算結果 | ユーザー期待値 | 差 |`)
        console.log(`|------|----------|--------------|-----|`)
        console.log(`| B点Z（R始点）| ${bPointZ_comp.toFixed(3)} | -101.19 | ${(bPointZ_comp - (-101.19)).toFixed(3)} |`)
        console.log(`| A点X（R終点）| ${aPointX_comp.toFixed(3)} | 45.97 | ${(aPointX_comp - 45.97).toFixed(3)} |`)
        console.log(`| A点Z（R終点）| ${aPointZ_comp.toFixed(3)} | -101.82 | ${(aPointZ_comp - (-101.82)).toFixed(3)} |`)

        // 期待値に近いことを確認
        expect(aPointX_comp).toBeCloseTo(45.97, 1)
    })

    it('別のアプローチ: 図面座標から直接ノーズR補正', () => {
        // 記事の例のように、図面座標から直接計算する場合
        // 
        // 入力: コーナー点 X46.5 Z-101 角R0.5
        // これは「図面座標」（ワークの形状）
        // 
        // ノーズR補正をかけるには、まず元Rで接点を計算し、
        // その接点座標にfx, fzを適用する

        const baseX = 46.5
        const baseZ = -101
        const originalR = 0.5
        const noseR = 0.4
        const taperAngle = 45
        const theta = taperAngle * Math.PI / 180
        const phi = (90 - taperAngle) * Math.PI / 180

        console.log('\n========================================')
        console.log('アプローチ2: 元Rで接点計算 → ノーズR補正')
        console.log('========================================')

        // 元Rで接点計算
        const tangentDist = originalR / Math.tan(theta / 2)
        const bPointZ = baseZ + tangentDist
        const bd = originalR * (1 - Math.cos(theta))
        const de = originalR * Math.sin(theta)
        const aPointX = baseX - 2 * bd
        const aPointZ = bPointZ - de

        console.log(`元Rでの接点:`)
        console.log(`  B点: X${baseX.toFixed(3)} Z${bPointZ.toFixed(3)}`)
        console.log(`  A点: X${aPointX.toFixed(3)} Z${aPointZ.toFixed(3)}`)

        // ノーズR補正量
        const fx = 2 * noseR * (1 - Math.tan(phi / 2))
        const fz = noseR * (1 - Math.tan(theta / 2))
        console.log(`\nノーズR補正量: fx=${fx.toFixed(3)}, fz=${fz.toFixed(3)}`)

        // 補正適用
        const bPointZ_comp = bPointZ - fz
        const aPointX_comp = aPointX  // Xへの適用方法は要確認
        const aPointZ_comp = aPointZ - fz

        console.log(`\n補正後:`)
        console.log(`  B点: X${baseX.toFixed(3)} Z${bPointZ_comp.toFixed(3)}`)
        console.log(`  A点: X${aPointX_comp.toFixed(3)} Z${aPointZ_comp.toFixed(3)}`)

        console.log(`\n【ユーザー期待値との比較】`)
        console.log(`| 項目 | 計算結果 | ユーザー期待値 | 差 |`)
        console.log(`|------|----------|--------------|-----|`)
        console.log(`| B点Z | ${bPointZ_comp.toFixed(3)} | -101.19 | ${(bPointZ_comp - (-101.19)).toFixed(3)} |`)
        console.log(`| A点X | ${aPointX_comp.toFixed(3)} | 45.97 | ${(aPointX_comp - 45.97).toFixed(3)} |`)
        console.log(`| A点Z | ${aPointZ_comp.toFixed(3)} | -101.82 | ${(aPointZ_comp - (-101.82)).toFixed(3)} |`)
    })
})
