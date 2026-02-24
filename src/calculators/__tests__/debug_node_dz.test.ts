import { describe, it } from 'vitest'
import { CenterTrackCalculator, type Segment } from '../noseRCompensation'

describe('ノードdzのデバッグ', () => {
    it('各ノードでのdz計算を確認', () => {
        const noseR = 0.4

        // compare_allの形状
        const profile: Segment[] = [
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
                startZ: -100.793,
                endX: 46.207,
                endZ: -101.146,
                centerX: 46,
                centerZ: -100.793,
                radius: 0.5,
                isConvex: true
            }
        ]

        class DiagnosticCalc extends CenterTrackCalculator {
            debugNodeDz(profile: Segment[]) {
                console.log('\n=== ノードdz計算のデバッグ ===\n')

                // ノード0（始点）
                console.log('ノード0（直線の始点）:')
                console.log(`  セグメント: line`)
                console.log(`  isConvex判定: seg.type='line' && seg.isConvex=false → false`)
                console.log(`  期待dz: noseR = 0.4mm（直線は常にオフセット必要）`)

                // ノード1（接続点）
                console.log('\nノード1（直線終点 = 角R始点）:')
                console.log(`  prevSeg: line (isConvex=false)`)
                console.log(`  nextSeg: arc (isConvex=true)`)
                console.log(`  hasConcaveArc = (false || false) = false`)
                console.log(`  calculateDzFromBisector(bisec, noseR, 3, !false=true)`)
                console.log(`  期待: bisec.bz=0なら → dz=0`)
                console.log(`  問題: 直線終点なのにdz=0では不足？`)

                // ノード2（終点）
                console.log('\nノード2（角Rの終点）:')
                console.log(`  セグメント: arc (isConvex=true)`)
                console.log(`  isConvex判定: true`)
                console.log(`  期待dz: 0（凸円弧は二重オフセット防止）`)
            }
        }

        const calc = new DiagnosticCalc(noseR, true, 3)
        calc.debugNodeDz(profile)

        const result = calc.calculate(profile)

        console.log('\n=== 実際の補正結果 ===')
        console.log(`Seg0（直線）終点: Z${result[0].compensatedEndZ.toFixed(3)}`)
        console.log(`期待値: Z-101.19`)
        console.log(`誤差: ${(result[0].compensatedEndZ - (-101.19)).toFixed(3)}mm`)

        console.log('\n=== 問題の仮説 ===')
        console.log('ノード1は「直線の終点」でもあり「角Rの始点」でもある。')
        console.log('hasConcaveArc=falseなので、isConvex=trueとして扱われる。')
        console.log('bisec.bz=0なので、dz=0が適用される。')
        console.log('しかし、直線の終点としてはdz=noseRが必要かもしれない。')
    })
})
