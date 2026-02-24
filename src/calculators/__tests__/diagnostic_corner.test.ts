import { describe, it } from 'vitest'
import { CenterTrackCalculator, type Segment, pToO } from '../noseRCompensation'

describe('診断: 角R0.5の補正計算トレース', () => {
    it('各ステップの詳細を出力', () => {
        const noseR = 0.4
        const toolType = 3

        // 形状: P1(X66 Z0) → P2(X66 Z-115, 角R0.5) → P3(X63 Z-116.5)
        // P2での接続: 垂直線 → 45°斜線

        // shape.tsから生成されたセグメントを手動で再現
        // corner-r セグメントの始点・終点は calculateCorner で計算されたもの
        const segments: Segment[] = [
            {
                type: 'line',
                startX: 66,
                startZ: 0,
                endX: 66,
                endZ: -114 // approximation
            },
            {
                type: 'arc',
                startX: 66,
                startZ: -114, // 角R0.5の始点
                endX: 65.5, // approximation
                endZ: -115.5, // 角R0.5の終点
                centerX: 65.5,
                centerZ: -114.5,
                radius: 0.5,
                isConvex: true
            }
        ]

        const calc = new CenterTrackCalculator(noseR, true, toolType)
        const result = calc.calculate(segments)

        console.log('\n=== セグメント2 (角R0.5) の補正計算 ===\n')

        if (result[1]) {
            const seg = result[1]
            console.log('【プロファイル座標】')
            console.log(`  始点: X${seg.startX} Z${seg.startZ}`)
            console.log(`  終点: X${seg.endX} Z${seg.endZ}`)
            console.log(`  半径: R${seg.radius}`)
            console.log(`  中心: X${seg.centerX} Z${seg.centerZ}`)

            console.log('\n【補正後座標】')
            console.log(`  始点: X${seg.compensatedStartX} Z${seg.compensatedStartZ}`)
            console.log(`  終点: X${seg.compensatedEndX} Z${seg.compensatedEndZ}`)

            console.log('\n【期待値との比較】')
            console.log(`  始点期待: X66.000 Z-114.827`)
            console.log(`  始点実測: X${seg.compensatedStartX.toFixed(3)} Z${seg.compensatedStartZ.toFixed(3)}`)
            console.log(`  始点誤差: ΔZ=${(seg.compensatedStartZ - (-114.827)).toFixed(3)}mm`)
        }

        // pToO関数の動作確認
        console.log('\n=== pToO関数の動作 ===')
        console.log('\nTip 3 (外径/前):')
        const testP = { x: 66, z: -114.827 }
        const testO = pToO(testP.x, testP.z, noseR, 3)
        console.log(`  入力 P: X${testP.x} Z${testP.z}`)
        console.log(`  出力 O: X${testO.ox} Z${testO.oz}`)
        console.log(`  オフセット: ΔX=${testP.x - testO.ox} ΔZ=${testP.z - testO.oz}`)

        // 逆算: 期待されるO座標から、どんなP座標が必要か？
        console.log('\n=== 逆算 ===')
        const expectedO = { x: 66, z: -114.827 }
        // O = P - offset なので P = O + offset
        // For Tip 3: dx=noseR, dz=noseR
        // ox = px - 2*dx → px = ox + 2*dx
        // oz = pz - dz → pz = oz + dz
        const requiredP = {
            x: expectedO.x + 2 * noseR,
            z: expectedO.z + noseR
        }
        console.log(`  期待O座標: X${expectedO.x} Z${expectedO.z}`)
        console.log(`  必要P座標: X${requiredP.x.toFixed(3)} Z${requiredP.z.toFixed(3)}`)
        console.log(`  (P = O + offset, where offset.x=2*noseR=${2*noseR}, offset.z=noseR=${noseR})`)
    })
})
