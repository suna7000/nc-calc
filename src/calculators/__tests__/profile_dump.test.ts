import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('プロファイル座標のダンプ', () => {
    it('shape.tsが生成する実際の座標を確認', () => {
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
                enabled: false, // まずは補正なしでプロファイルだけ確認
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

        console.log('\n=== プロファイル座標（補正前）===\n')
        result.segments.forEach((seg, i) => {
            console.log(`セグメント${i + 1}: ${seg.type}`)
            console.log(`  始点: X${seg.startX} Z${seg.startZ}`)
            console.log(`  終点: X${seg.endX} Z${seg.endZ}`)
            if (seg.type === 'corner-r') {
                console.log(`  半径: R${seg.radius}`)
                console.log(`  中心: X${seg.centerX} Z${seg.centerZ}`)
                console.log(`  I/K: I${seg.i} K${seg.k}`)
                console.log(`  凸: ${seg.isConvex}`)
            }
            console.log('')
        })
    })
})
