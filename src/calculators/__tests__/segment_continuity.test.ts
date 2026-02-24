import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('セグメント連続性の検証', () => {
    it('連続するセグメントの終点と始点が一致するか', () => {
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
                createPoint(63, -116.5, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== セグメント連続性チェック ===\n')

        for (let i = 0; i < result.segments.length - 1; i++) {
            const curr = result.segments[i]
            const next = result.segments[i + 1]

            if (curr.compensated && next.compensated) {
                const endX = curr.compensated.endX
                const endZ = curr.compensated.endZ
                const nextStartX = next.compensated.startX
                const nextStartZ = next.compensated.startZ

                const deltaX = Math.abs(endX - nextStartX)
                const deltaZ = Math.abs(endZ - nextStartZ)

                console.log(`Seg${i} → Seg${i+1}:`)
                console.log(`  Seg${i}終点: (${endX.toFixed(3)}, ${endZ.toFixed(3)})`)
                console.log(`  Seg${i+1}始点: (${nextStartX.toFixed(3)}, ${nextStartZ.toFixed(3)})`)
                console.log(`  差: ΔX=${deltaX.toFixed(3)}, ΔZ=${deltaZ.toFixed(3)}`)

                if (deltaX > 0.001 || deltaZ > 0.001) {
                    console.log(`  ❌ 不連続！`)
                } else {
                    console.log(`  ✅ 連続`)
                }
                console.log()
            }
        }

        console.log('=== 根本原因の調査 ===')
        console.log('連続性が保たれていない場合、pToO関数での')
        console.log('オフセット計算に問題がある可能性があります。')
        console.log('特に、直線と角Rの接続点での処理を確認してください。')
    })
})
