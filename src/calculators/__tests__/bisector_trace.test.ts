import { describe, it } from 'vitest'
import { CenterTrackCalculator, type Segment } from '../noseRCompensation'

describe('Bisector法のトレース', () => {
    it('角R0.5での法線と交点計算を詳細に追跡', () => {
        const noseR = 0.4
        const toolType = 3

        // shape.tsが生成した実際のセグメント座標を使用
        const segments: Segment[] = [
            {
                type: 'line',
                startX: 66,
                startZ: 0,
                endX: 66,
                endZ: -114.793
            },
            {
                type: 'arc',
                startX: 66,
                startZ: -114.793,
                endX: 65.707,
                endZ: -115.146,
                centerX: 65,
                centerZ: -114.793,
                radius: 0.5,
                isConvex: true
            },
            {
                type: 'line',
                startX: 65.707,
                startZ: -115.146,
                endX: 63.586,
                endZ: -116.207
            }
        ]

        const calc = new CenterTrackCalculator(noseR, true, toolType)
        const result = calc.calculate(segments)

        console.log('\n=== セグメント2 (角R0.5) の解析 ===\n')

        console.log('【プロファイル】')
        console.log(`  arc始点: X${segments[1].startX} Z${segments[1].startZ}`)
        console.log(`  arc終点: X${segments[1].endX} Z${segments[1].endZ}`)
        console.log(`  arc中心: X${segments[1].centerX} Z${segments[1].centerZ}`)

        console.log('\n【補正後】')
        console.log(`  始点: X${result[1].compensatedStartX} Z${result[1].compensatedStartZ}`)
        console.log(`  終点: X${result[1].compensatedEndX} Z${result[1].compensatedEndZ}`)

        console.log('\n【期待値】')
        console.log(`  始点: X66.000 Z-114.827`)
        console.log(`  誤差: ΔZ=${(result[1].compensatedStartZ - (-114.827)).toFixed(3)}mm`)

        // 逆算：期待されるノード位置
        console.log('\n【逆算：必要なノード位置P】')
        const expectedOz = -114.827
        const requiredPz = expectedOz + noseR
        console.log(`  期待O.z = ${expectedOz}`)
        console.log(`  pToO式: oz = pz - noseR`)
        console.log(`  → 必要P.z = ${requiredPz}`)

        const refZ = segments[1].startZ
        console.log(`  refZ(プロファイル始点) = ${refZ}`)
        console.log(`  pz = refZ + n.nz * noseR より`)
        console.log(`  → 必要n.nz = (${requiredPz} - ${refZ}) / ${noseR} = ${(requiredPz - refZ) / noseR}`)

        console.log('\n【幾何学的考察】')
        console.log('  入力セグメント1: 垂直線 (0, -1)')
        console.log('  出力セグメント2: 角R0.5 arc')
        console.log('  出力セグメント3: 45°斜線 (-0.707, -0.707)')
        console.log('  ')
        console.log('  ノード1(arcの始点)での法線:')
        console.log('    - seg1の終端法線: (1, 0) (右向き)')
        console.log('    - seg2の開始法線: arcの始点における半径方向')
        console.log('    - 中心(X65 Z-114.793)から始点(X66 Z-114.793)へのベクトル')
        console.log('    - = (66/2 - 65/2, -114.793 - (-114.793)) = (0.5, 0)')
        console.log('    - 正規化: (1, 0)')
        console.log('    - 両方が(1, 0)なので、bisectorも(1, 0)のはず')
        console.log('    - → n.nz = 0 になるはず')
        console.log('    - → pz = refZ + 0 * noseR = refZ = -114.793')
        console.log('    - → oz = pz - noseR = -114.793 - 0.4 = -115.193')
        console.log('    - これは現在の出力と一致！')
        console.log('  ')
        console.log('  ❌ 問題: 垂直線と水平arc接続では、法線がZ成分を持たない')
        console.log('  ❌ しかし期待値は Z-114.827 で、プロファイルZ-114.793より -0.034mm下')
        console.log('  ❌ さらに補正で -0.4mm 下がるので、合計 -0.434mm になるはず')
        console.log('  ❌ でも実際の誤差は -0.366mm...')
    })
})
