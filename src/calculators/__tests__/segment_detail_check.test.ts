import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * 各セグメントの詳細を確認
 */
describe('セグメント詳細確認', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1',
            name: 'Test',
            type: 'external',
            noseRadius: 0.8,
            toolTipNumber: 3,
            hand: 'right'
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        },
    }

    it('全セグメントの座標を詳細表示', () => {
        const shape = {
            points: [
                createPoint(60, 0, noCorner()),
                createPoint(60, -45.653, noCorner()),
                createPoint(59.6, -46, noCorner()),
                createPoint(59.6, -50, { type: 'sumi-r', size: 2 }),
                createPoint(80, -50, noCorner()),
                createPoint(80, -60, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 全セグメント詳細 ===')
        result.segments.forEach((seg, idx) => {
            console.log(`\nセグメント${idx + 1} [${seg.type}]:`)
            console.log(`  元座標: (${seg.startX}, ${seg.startZ}) → (${seg.endX}, ${seg.endZ})`)
            if (seg.compensated) {
                console.log(`  補正後: (${seg.compensated.startX}, ${seg.compensated.startZ}) → (${seg.compensated.endX}, ${seg.compensated.endZ})`)
            }
            if (seg.type === 'corner-r') {
                console.log(`  半径: ${seg.radius}`)
            }
        })

        console.log('\n=== 点3（X59.6 Z-46）に関連する座標 ===')
        console.log(`セグメント2の終点（点2→点3）: ${result.segments[1].compensated?.endZ ?? result.segments[1].endZ}`)
        console.log(`セグメント3の開始点（点3→点4入口）: ${result.segments[2].compensated?.startZ ?? result.segments[2].startZ}`)

        if (result.segments[3]) {
            console.log(`セグメント4の開始点（隅R入口）: ${result.segments[3].compensated?.startZ ?? result.segments[3].startZ}`)
        }

        console.log('\n手書き期待値: Z-46.586')
        console.log(`最も近い値はどれ？`)
    })
})
