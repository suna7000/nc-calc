import { describe, it, expect } from 'vitest'
import { CenterTrackCalculator, type Segment } from '../noseRCompensation'

describe('角R0.5の詳細診断', () => {
    it('垂直線→角R0.5接続の内部状態を確認', () => {
        const noseR = 0.4
        const toolType = 3

        // 形状: 垂直線 X66 Z0→Z-115、角R0.5 Z-115→下り線
        // 簡略化した2セグメント
        const profile: Segment[] = [
            {
                type: 'line',
                startX: 66,
                startZ: 0,
                endX: 66,
                endZ: -115,
                isConvex: false
            },
            {
                type: 'arc',
                startX: 66,
                startZ: -114.793,  // R0.5分上がる
                endX: 65.707,
                endZ: -115.146,
                centerX: 65,
                centerZ: -114.793,
                radius: 0.5,
                isConvex: true  // 凸円弧（角R）
            }
        ]

        console.log('\n=== 入力プロファイル ===')
        console.log('Seg0 (垂直線): X66 Z0 → X66 Z-115')
        console.log('Seg1 (角R0.5): X66 Z-114.793 → X65.707 Z-115.146')
        console.log('  center: X65 Z-114.793, radius: 0.5')
        console.log('  isConvex: true (凸円弧)')

        // CenterTrackCalculatorを拡張して内部状態を取得
        class DiagnosticCalculator extends CenterTrackCalculator {
            diagnose(profile: Segment[]) {
                const nodes: {
                    x: number,
                    z: number,
                    n: { nx: number, nz: number },
                    bisec?: { bx: number, bz: number, dist: number }
                }[] = []

                // ノード計算（calculateWithBisectorから抽出）
                for (let i = 0; i <= profile.length; i++) {
                    let n: { nx: number, nz: number }
                    let bisec: { bx: number, bz: number, dist: number } | undefined

                    if (i === 0) {
                        // @ts-ignore
                        n = this.getNormalAt(profile[0], 'start')
                        console.log(`\nノード${i} (始点):`)
                        console.log(`  法線: (${n.nx.toFixed(4)}, ${n.nz.toFixed(4)})`)
                    } else if (i === profile.length) {
                        // @ts-ignore
                        n = this.getNormalAt(profile[profile.length - 1], 'end')
                        console.log(`\nノード${i} (終点):`)
                        console.log(`  法線: (${n.nx.toFixed(4)}, ${n.nz.toFixed(4)})`)
                    } else {
                        // @ts-ignore
                        const n1 = this.getNormalAt(profile[i - 1], 'end')
                        // @ts-ignore
                        const n2 = this.getNormalAt(profile[i], 'start')
                        // @ts-ignore
                        bisec = this.calculateBisector(n1, n2)
                        n = { nx: bisec.bx * (bisec.dist / noseR), nz: bisec.bz * (bisec.dist / noseR) }

                        console.log(`\nノード${i} (接続点):`)
                        console.log(`  n1 (seg${i-1}終点): (${n1.nx.toFixed(4)}, ${n1.nz.toFixed(4)})`)
                        console.log(`  n2 (seg${i}始点): (${n2.nx.toFixed(4)}, ${n2.nz.toFixed(4)})`)
                        console.log(`  bisec: bx=${bisec.bx.toFixed(4)}, bz=${bisec.bz.toFixed(4)}, dist=${bisec.dist.toFixed(4)}`)
                        console.log(`  最終法線: (${n.nx.toFixed(4)}, ${n.nz.toFixed(4)})`)
                    }

                    const refX = (i < profile.length ? profile[i].startX : profile[profile.length - 1].endX) / 2
                    const refZ = (i < profile.length ? profile[i].startZ : profile[profile.length - 1].endZ)

                    const px = refX + n.nx * noseR
                    const pz = refZ + n.nz * noseR

                    console.log(`  ref: (${refX.toFixed(3)}, ${refZ.toFixed(3)})`)
                    console.log(`  P座標: (${(px*2).toFixed(3)}, ${pz.toFixed(3)})`)

                    nodes.push({ x: px, z: pz, n, bisec })
                }

                // 角R0.5 (seg1) の補正座標を計算
                console.log('\n=== 角R0.5の補正計算 ===')
                const seg = profile[1]
                const sNode = nodes[1]  // 接続点
                const eNode = nodes[2]  // 終点

                console.log(`\n始点ノード (接続点):`)
                console.log(`  P: (${(sNode.x*2).toFixed(3)}, ${sNode.z.toFixed(3)})`)
                console.log(`  bisec: ${sNode.bisec ? `bz=${sNode.bisec.bz.toFixed(6)}` : 'なし'}`)
                console.log(`  isConvex: ${seg.isConvex}`)

                // 実際の補正座標計算は calculate() 関数で実行される

                // 実際の計算も実行
                const result = this.calculate(profile)
                console.log(`\n実際の補正結果:`)
                console.log(`  始点: (${result[1].compensatedStartX.toFixed(3)}, ${result[1].compensatedStartZ.toFixed(3)})`)
                console.log(`  終点: (${result[1].compensatedEndX.toFixed(3)}, ${result[1].compensatedEndZ.toFixed(3)})`)

                return { nodes, result }
            }
        }

        const calc = new DiagnosticCalculator(noseR, true, toolType)
        const { nodes, result } = calc.diagnose(profile)

        console.log('\n=== 問題の特定 ===')
        console.log('角R0.5始点でのbz値を確認してください。')
        console.log('bz≈0なら、dz=0となり、期待値とズレる可能性があります。')

        expect(nodes.length).toBe(3)
    })
})
