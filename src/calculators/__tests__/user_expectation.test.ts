import { describe, it, expect } from 'vitest'

/**
 * ユーザー期待値を再現するテスト
 * 
 * 入力データ:
 * - Point 1: X46.5 Z0 なし
 * - Point 2: X46.5 Z-101 角R0.5
 * - Point 3: X42 Z-103.25 角R2
 * - Point 4: X42 Z-110 なし
 * - ノーズR: 0.4
 * 
 * ユーザー期待値:
 * 1. 直線（R始点）: X46.5 Z-101.19
 * 2. R終点: X45.97 Z-101.82 R0.9
 * 3. 下りテーパーR始点: X42.93 Z-103.34
 * 4. 下りテーパーR終点: X42 Z-104.47 R1.6
 */
describe('ユーザー期待値の検証', () => {

    // 入力データ
    const points = [
        { x: 46.5, z: 0, corner: 'none', r: 0 },
        { x: 46.5, z: -101, corner: 'kaku-r', r: 0.5 },
        { x: 42, z: -103.25, corner: 'kaku-r', r: 2 },
        { x: 42, z: -110, corner: 'none', r: 0 },
    ]
    const noseR = 0.4

    it('Point 2の角R計算（直線→45度テーパー）', () => {
        // Point 1 → Point 2 は垂直直線 (X変化なし)
        // Point 2 → Point 3 は45度テーパー (X46.5→X42, Z-101→Z-103.25)
        // テーパー角度計算
        const dx = (points[2].x - points[1].x) / 2  // 半径値: (42-46.5)/2 = -2.25
        const dz = points[2].z - points[1].z         // Z: -103.25 - (-101) = -2.25
        const thetaRad = Math.atan2(Math.abs(dx), Math.abs(dz)) // = 45度
        const thetaDeg = thetaRad * 180 / Math.PI
        console.log(`テーパー角度: ${thetaDeg.toFixed(1)}度`)

        // 補正R = 元R + noseR
        const compensatedR = points[1].r + noseR  // 0.5 + 0.4 = 0.9
        console.log(`補正R: ${compensatedR}mm`)

        // ドキュメントの計算式: テーパーから角Rへの接点
        // 接点Z補正 = R × tan(θ/2)
        const halfThetaRad = thetaRad / 2
        const tangentDist = compensatedR / Math.tan(halfThetaRad)  // 接線距離
        console.log(`接線距離: ${tangentDist.toFixed(3)}mm`)

        // B点（円弧始点 = 直線終点）
        // 直線（Z軸方向）から角Rなので、Z方向に戻る
        const bPointX = points[1].x  // 変化なし
        const bPointZ = points[1].z + tangentDist * Math.cos(Math.PI / 2)  // 垂直なので0
        // 実際には、2つのセグメントの方向から接点を計算する必要がある

        // より正確な計算: 二等分線方向での接点
        // 前のセグメント方向: (0, 1) - 上向き
        // 次のセグメント方向: (dx/len, dz/len)
        const len = Math.sqrt(dx * dx + dz * dz)
        const u1x = 0, u1z = 1  // Z+方向
        const u2x = dx / len, u2z = dz / len

        // 接点距離 = R / tan(half)
        const dot = u1x * u2x + u1z * u2z
        const angleBetween = Math.acos(dot)
        const half = angleBetween / 2
        const tDist = compensatedR / Math.tan(half)

        // B点（円弧始点）= コーナー点 + u1方向 * tDist
        const entryX = points[1].x / 2 + u1x * tDist  // 半径値
        const entryZ = points[1].z + u1z * tDist

        console.log(`\nB点（円弧始点 = 直線終点）:`)
        console.log(`  X: ${(entryX * 2).toFixed(3)}mm (直径値)`)
        console.log(`  Z: ${entryZ.toFixed(3)}mm`)

        // A点（円弧終点）= コーナー点 + u2方向 * tDist
        const exitX = points[1].x / 2 + u2x * tDist
        const exitZ = points[1].z + u2z * tDist

        console.log(`\nA点（円弧終点）:`)
        console.log(`  X: ${(exitX * 2).toFixed(3)}mm (直径値)`)
        console.log(`  Z: ${exitZ.toFixed(3)}mm`)

        // ユーザー期待値との比較
        console.log(`\n【ユーザー期待値との比較】`)
        console.log(`直線終点 Z: 計算=${entryZ.toFixed(2)} 期待=-101.19 差=${(entryZ - (-101.19)).toFixed(3)}`)
        console.log(`R終点 X: 計算=${(exitX * 2).toFixed(2)} 期待=45.97 差=${((exitX * 2) - 45.97).toFixed(3)}`)
        console.log(`R終点 Z: 計算=${exitZ.toFixed(2)} 期待=-101.82 差=${(exitZ - (-101.82)).toFixed(3)}`)

        // 期待値に近いことを確認
        expect(entryZ).toBeCloseTo(-101.19, 1)
        expect(exitX * 2).toBeCloseTo(45.97, 1)
        expect(exitZ).toBeCloseTo(-101.82, 1)
    })

    it('Point 3の角R計算（45度テーパー→直線）', () => {
        // Point 2 → Point 3 は45度テーパー
        // Point 3 → Point 4 は垂直直線 (X変化なし)

        // 前のセグメント方向: 45度テーパー
        const dx1 = (points[2].x - points[1].x) / 2  // -2.25
        const dz1 = points[2].z - points[1].z         // -2.25
        const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1)
        const u1x = dx1 / len1, u1z = dz1 / len1

        // 次のセグメント方向: 垂直
        const dx2 = (points[3].x - points[2].x) / 2  // 0
        const dz2 = points[3].z - points[2].z         // -6.75
        const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2)
        const u2x = dx2 / len2, u2z = dz2 / len2

        // 補正R
        const compensatedR = points[2].r + noseR  // 2 + 0.4 = 2.4
        console.log(`\n=== Point 3 (角R2) ===`)
        console.log(`補正R: ${compensatedR}mm`)

        // 接点距離
        const dot = u1x * u2x + u1z * u2z
        const angleBetween = Math.acos(dot)
        const half = angleBetween / 2
        const tDist = compensatedR / Math.tan(half)
        console.log(`接線距離: ${tDist.toFixed(3)}mm`)

        // 円弧始点 = コーナー点 - u1方向 * tDist（前の方向から）
        const entryX = points[2].x / 2 - u1x * tDist
        const entryZ = points[2].z - u1z * tDist

        console.log(`\n円弧始点:`)
        console.log(`  X: ${(entryX * 2).toFixed(3)}mm`)
        console.log(`  Z: ${entryZ.toFixed(3)}mm`)

        // 円弧終点 = コーナー点 + u2方向 * tDist
        const exitX = points[2].x / 2 + u2x * tDist
        const exitZ = points[2].z + u2z * tDist

        console.log(`\n円弧終点:`)
        console.log(`  X: ${(exitX * 2).toFixed(3)}mm`)
        console.log(`  Z: ${exitZ.toFixed(3)}mm`)

        // ユーザー期待値との比較
        console.log(`\n【ユーザー期待値との比較】`)
        console.log(`テーパーR始点 X: 計算=${(entryX * 2).toFixed(2)} 期待=42.93 差=${((entryX * 2) - 42.93).toFixed(3)}`)
        console.log(`テーパーR始点 Z: 計算=${entryZ.toFixed(2)} 期待=-103.34 差=${(entryZ - (-103.34)).toFixed(3)}`)
        console.log(`テーパーR終点 X: 計算=${(exitX * 2).toFixed(2)} 期待=42 差=${((exitX * 2) - 42).toFixed(3)}`)
        console.log(`テーパーR終点 Z: 計算=${exitZ.toFixed(2)} 期待=-104.47 差=${(exitZ - (-104.47)).toFixed(3)}`)
    })
})
