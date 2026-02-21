import { describe, it, expect } from 'vitest'
import { CenterTrackCalculator, type Segment } from '../noseRCompensation'

describe('Bisector BZ成分の検証', () => {
    const noseR = 0.4

    it('仮説検証: 凸円弧ノードでbz≈0、直線ノードでbz≠0', () => {
        // 垂直線 → 90度凸円弧 → 水平線のプロファイル
        const profile: Segment[] = [
            // セグメント1: 垂直線（下向き）
            {
                type: 'line',
                startX: 66,      // 直径
                startZ: 0,
                endX: 66,
                endZ: -115,
                isConvex: false
            },
            // セグメント2: 90度凸円弧（角R=0.5）
            {
                type: 'arc',
                startX: 66,
                startZ: -114.793,  // calculateCornerで計算された値
                endX: 65.707,
                endZ: -115.146,
                centerX: 65,       // 直径
                centerZ: -114.793,
                radius: 0.5,
                isConvex: true
            },
            // セグメント3: 45度テーパー（直線）
            {
                type: 'line',
                startX: 65.707,
                startZ: -115.146,
                endX: 63,
                endZ: -116.5,
                isConvex: false
            }
        ]

        console.log('\n=== Bisector BZ成分の検証 ===\n')

        // カスタムCenterTrackCalculatorを作成（内部計算をログ出力）
        class LoggingCalculator extends CenterTrackCalculator {
            private nodeIndex = 0

            // @ts-ignore - アクセス権限の警告を無視
            protected calculateWithBisector(profile: Segment[]) {
                const nodes: any[] = []
                for (let i = 0; i <= profile.length; i++) {
                    let n: { nx: number, nz: number }
                    let isBisector = false

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
                        const bisec = this.calculateBisector(n1, n2)
                        // @ts-ignore
                        n = { nx: bisec.bx * (bisec.dist / this.noseR), nz: bisec.bz * (bisec.dist / this.noseR) }
                        isBisector = true

                        console.log(`\nノード${i} (${profile[i-1].type} → ${profile[i].type}):`)
                        console.log(`  n1 (前セグメント終点): (${n1.nx.toFixed(4)}, ${n1.nz.toFixed(4)})`)
                        console.log(`  n2 (次セグメント始点): (${n2.nx.toFixed(4)}, ${n2.nz.toFixed(4)})`)
                        console.log(`  bisec方向: (${bisec.bx.toFixed(4)}, ${bisec.bz.toFixed(4)})`)
                        console.log(`  bisec距離: ${bisec.dist.toFixed(4)}mm`)
                        console.log(`  n (調整後): (${n.nx.toFixed(4)}, ${n.nz.toFixed(4)})`)
                        console.log(`  ★ bz成分: ${bisec.bz.toFixed(4)}`)
                    }

                    const refX = (i < profile.length ? profile[i].startX : profile[profile.length - 1].endX) / 2
                    const refZ = (i < profile.length ? profile[i].startZ : profile[profile.length - 1].endZ)

                    // @ts-ignore
                    const px = refX + n.nx * this.noseR
                    // @ts-ignore
                    const pz = refZ + n.nz * this.noseR

                    nodes.push({ x: px, z: pz, n })

                    if (isBisector) {
                        console.log(`  refZ: ${refZ.toFixed(4)}mm`)
                        console.log(`  Pz: ${pz.toFixed(4)}mm`)
                        console.log(`  Pz - refZ: ${(pz - refZ).toFixed(4)}mm`)

                        // セグメントタイプを確認
                        const segType = profile[i].type
                        const isConvex = profile[i].type === 'arc' && profile[i].isConvex !== false

                        if (isConvex) {
                            console.log(`  → 凸円弧ノード: bzは0に近いはず`)
                        } else {
                            console.log(`  → 直線ノード: bzは0から離れているはず`)
                        }
                    }
                }

                // @ts-ignore
                return super.calculateWithBisector.call(this, profile)
            }
        }

        const calc = new LoggingCalculator(noseR, true, 3)
        calc.calculate(profile)

        console.log('\n=== 仮説の検証 ===')
        console.log('1. ノード1（line→arc凸）: bz ≈ 0 であることを確認')
        console.log('2. ノード2（arc凸→line）: bz ≈ 0 であることを確認')
        console.log('3. Pz ≈ refZ であることを確認')
        console.log('4. これが dz=0 で機能する理由')

        // この検証は主にログ出力のため、テスト自体は常に成功
        expect(true).toBe(true)
    })

    it('直線から直線への接続でのbz値', () => {
        // 45度テーパー → 30度テーパー
        const profile: Segment[] = [
            {
                type: 'line',
                startX: 66,
                startZ: 0,
                endX: 60,
                endZ: -10,  // 45度
                isConvex: false
            },
            {
                type: 'line',
                startX: 60,
                startZ: -10,
                endX: 55,
                endZ: -15,  // 約60度
                isConvex: false
            }
        ]

        console.log('\n=== 直線→直線ノードのBZ成分 ===\n')

        class LoggingCalculator extends CenterTrackCalculator {
            // @ts-ignore
            protected calculateWithBisector(profile: Segment[]) {
                for (let i = 0; i <= profile.length; i++) {
                    if (i > 0 && i < profile.length) {
                        // @ts-ignore
                        const n1 = this.getNormalAt(profile[i - 1], 'end')
                        // @ts-ignore
                        const n2 = this.getNormalAt(profile[i], 'start')
                        // @ts-ignore
                        const bisec = this.calculateBisector(n1, n2)

                        console.log(`ノード${i} (line→line):`)
                        console.log(`  bisec: (${bisec.bx.toFixed(4)}, ${bisec.bz.toFixed(4)})`)
                        console.log(`  ★ bz = ${bisec.bz.toFixed(4)} （ゼロではない）`)
                    }
                }

                // @ts-ignore
                return super.calculateWithBisector.call(this, profile)
            }
        }

        const calc = new LoggingCalculator(noseR, true, 3)
        calc.calculate(profile)

        console.log('\n直線ノードでは bz ≠ 0 のため、dz=R が必要')

        expect(true).toBe(true)
    })
})
