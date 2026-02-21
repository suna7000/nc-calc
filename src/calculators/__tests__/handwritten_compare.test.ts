import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('手書きメモとの詳細比較', () => {
    it('全ポイントの座標比較', () => {
        const settings: MachineSettings = {
            ...defaultMachineSettings,
            activeToolId: 't1',
            toolLibrary: [{
                id: 't1',
                name: 'Test',
                type: 'external',
                noseRadius: 0.4,
                toolTipNumber: 3,
                hand: 'right'
            }],
            noseRCompensation: {
                enabled: true,
                offsetNumber: 1,
                compensationDirection: 'auto',
                method: 'geometric'
            }
        }

        const shape = {
            points: [
                createPoint(66, 0, noCorner()),
                createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),
                createPoint(63, -116.5, { type: 'sumi-r', size: 1 }),
                createPoint(63, -169, { type: 'sumi-r', size: 2 }),
                createPoint(70, -184, { type: 'kaku-r', size: 2 }),
                createPoint(70, -200, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        // 手書き期待値
        const expected = [
            { no: 1, x: 66, z: -114.827 },
            { no: 2, x: 65.472, z: -115.463 },
            { no: 3, x: 63.351, z: -116.925 },
            { no: 4, x: 63, z: -117.349 },
            { no: 5, x: 63, z: -169.169 },
            { no: 6, x: 63.083, z: -169.532 },
            { no: 7, x: 69.876, z: -184.085 },
            { no: 8, x: 70, z: -184.629 }
        ]

        // アプリ実測値（補正後の座標を抽出）
        const actual: Array<{x: number, z: number}> = []
        result.segments.forEach(seg => {
            if (seg.compensated) {
                // 始点は最初のセグメントのみ
                if (actual.length === 0) {
                    actual.push({ x: seg.compensated.startX, z: seg.compensated.startZ })
                }
                // 終点は全セグメント
                actual.push({ x: seg.compensated.endX, z: seg.compensated.endZ })
            }
        })

        console.log('\n=== 手書きメモ vs アプリ出力 ===')
        console.log('No. | 期待X    期待Z       | 実測X    実測Z       | ΔX      ΔZ')
        console.log('----+---------------------+---------------------+------------------')
        
        expected.forEach((exp, i) => {
            const act = actual[i]
            const dx = act ? (act.x - exp.x) : 0
            const dz = act ? (act.z - exp.z) : 0
            const xMatch = Math.abs(dx) < 0.01 ? '✅' : '❌'
            const zMatch = Math.abs(dz) < 0.01 ? '✅' : '❌'
            
            console.log(
                `${exp.no}   | X${exp.x.toFixed(3)} Z${exp.z.toFixed(3)} | ` +
                `X${act?.x.toFixed(3)} Z${act?.z.toFixed(3)} | ` +
                `${dx.toFixed(3)} ${dz.toFixed(3)} ${xMatch}${zMatch}`
            )
        })

        console.log('\n=== 問題のあるポイント ===')
        expected.forEach((exp, i) => {
            const act = actual[i]
            const dx = Math.abs(act.x - exp.x)
            const dz = Math.abs(act.z - exp.z)
            if (dx > 0.01 || dz > 0.01) {
                console.log(`\nポイント${exp.no}: 誤差あり`)
                console.log(`  期待: X${exp.x} Z${exp.z}`)
                console.log(`  実測: X${act.x.toFixed(3)} Z${act.z.toFixed(3)}`)
                console.log(`  誤差: ΔX=${dx.toFixed(3)}mm ΔZ=${dz.toFixed(3)}mm`)
            }
        })
    })
})
