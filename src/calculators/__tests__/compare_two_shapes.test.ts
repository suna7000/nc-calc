import { describe, it } from 'vitest'
import { CenterTrackCalculator, type Segment } from '../noseRCompensation'

describe('2つの角R0.5形状の比較', () => {
    it('なぜ精度が異なるのか調査', () => {
        const noseR = 0.4

        // ケース1: compare_all (誤差-0.003mm、ほぼ完璧)
        const case1: Segment[] = [
            {
                type: 'line',
                startX: 46.5,
                startZ: 0,
                endX: 46.5,
                endZ: -101,
                isConvex: false
            },
            {
                type: 'arc',
                startX: 46.5,
                startZ: -100.793,  // プロファイル上の実際の始点
                endX: 46.207,
                endZ: -101.146,
                centerX: 46,
                centerZ: -100.793,
                radius: 0.5,
                isConvex: true
            }
        ]

        // ケース2: correct_compare (誤差+0.034mm)
        const case2: Segment[] = [
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
                startZ: -114.793,
                endX: 65.707,
                endZ: -115.146,
                centerX: 65,
                centerZ: -114.793,
                radius: 0.5,
                isConvex: true
            }
        ]

        class DiagnosticCalc extends CenterTrackCalculator {
            diagnoseNodes(profile: Segment[]) {
                const nodes: any[] = []
                for (let i = 0; i <= profile.length; i++) {
                    let n: { nx: number, nz: number }
                    let bisec: { bx: number, bz: number, dist: number } | undefined

                    if (i === 0) {
                        // @ts-ignore
                        n = this.getNormalAt(profile[0], 'start')
                    } else if (i === profile.length) {
                        // @ts-ignore
                        n = this.getNormalAt(profile[profile.length - 1], 'end')
                    } else {
                        // @ts-ignore
                        const n1 = this.getNormalAt(profile[i - 1], 'end')
                        // @ts-ignore
                        const n2 = this.getNormalAt(profile[i], 'start')
                        // @ts-ignore
                        bisec = this.calculateBisector(n1, n2)
                        n = { nx: bisec.bx * (bisec.dist / noseR), nz: bisec.bz * (bisec.dist / noseR) }
                    }

                    const refX = (i < profile.length ? profile[i].startX : profile[profile.length - 1].endX) / 2
                    const refZ = (i < profile.length ? profile[i].startZ : profile[profile.length - 1].endZ)
                    const px = refX + n.nx * noseR
                    const pz = refZ + n.nz * noseR

                    nodes.push({ refX, refZ, px: px * 2, pz, n, bisec })
                }
                return nodes
            }
        }

        console.log('\n=== ケース1: compare_all (誤差-0.003mm) ===')
        const calc1 = new DiagnosticCalc(noseR, true, 3)
        const nodes1 = calc1.diagnoseNodes(case1)
        console.log('ノード1 (接続点):')
        console.log(`  円弧center: (${case1[1].centerX}, ${case1[1].centerZ})`)
        console.log(`  円弧start:  (${case1[1].startX}, ${case1[1].startZ})`)
        console.log(`  ref: (${nodes1[1].refX.toFixed(3)}, ${nodes1[1].refZ.toFixed(3)})`)
        console.log(`  bisec.bz: ${nodes1[1].bisec?.bz.toFixed(6) ?? 'なし'}`)
        console.log(`  P: (${nodes1[1].px.toFixed(3)}, ${nodes1[1].pz.toFixed(3)})`)

        const result1 = calc1.calculate(case1)
        console.log(`  補正後: (${result1[1].compensatedStartX.toFixed(3)}, ${result1[1].compensatedStartZ.toFixed(3)})`)

        console.log('\n=== ケース2: correct_compare (誤差+0.034mm) ===')
        const calc2 = new DiagnosticCalc(noseR, true, 3)
        const nodes2 = calc2.diagnoseNodes(case2)
        console.log('ノード1 (接続点):')
        console.log(`  円弧center: (${case2[1].centerX}, ${case2[1].centerZ})`)
        console.log(`  円弧start:  (${case2[1].startX}, ${case2[1].startZ})`)
        console.log(`  ref: (${nodes2[1].refX.toFixed(3)}, ${nodes2[1].refZ.toFixed(3)})`)
        console.log(`  bisec.bz: ${nodes2[1].bisec?.bz.toFixed(6) ?? 'なし'}`)
        console.log(`  P: (${nodes2[1].px.toFixed(3)}, ${nodes2[1].pz.toFixed(3)})`)

        const result2 = calc2.calculate(case2)
        console.log(`  補正後: (${result2[1].compensatedStartX.toFixed(3)}, ${result2[1].compensatedStartZ.toFixed(3)})`)

        console.log('\n=== 比較 ===')
        console.log(`bisec.bz: ${nodes1[1].bisec?.bz.toFixed(6)} vs ${nodes2[1].bisec?.bz.toFixed(6)}`)
        console.log(`両方とも0に近い → 両方ともdz=0が適用される`)
        console.log(`しかし、ケース1は-0.003mm、ケース2は+0.034mmの誤差`)
        console.log(`→ 円弧の位置やサイズ以外の要因がある可能性`)
    })
})
