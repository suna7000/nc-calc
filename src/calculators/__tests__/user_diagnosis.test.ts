import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * NCプログラム出力との整合性を検証するテスト
 */
describe('NCプログラム出力整合性検証', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        toolPost: 'rear',
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1',
            name: '外径仕上げ',
            type: 'external',
            noseRadius: 0.4,
            toolTipNumber: 3,
            hand: 'right'
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto' as CompensationDirection,
            method: 'geometric'
        },
    }

    it('formatNCLine相当のロジックを検証', () => {
        const shape = {
            points: [
                createPoint(46.5, 0, noCorner()),
                createPoint(46.5, -101, { type: 'kaku-r', size: 0.5 }),
                createPoint(42, -103.25, { type: 'sumi-r', size: 2 }),
                createPoint(42, -118.85, { type: 'sumi-r', size: 2 }),
                createPoint(45, -136, { type: 'kaku-r', size: 2 }),
                createPoint(45, -150, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== NCプログラム出力シミュレーション ===\n')

        result.segments.forEach((seg, i) => {
            // formatNCLine相当のロジック
            const endX = seg.compensated?.endX ?? seg.endX
            const endZ = seg.compensated?.endZ ?? seg.endZ
            const compensatedI = seg.compensated?.i
            const compensatedK = seg.compensated?.k
            const origI = seg.i
            const origK = seg.k
            const finalI = compensatedI ?? origI
            const finalK = compensatedK ?? origK
            const gCode = seg.gCode || (seg.type === 'corner-r' ? 'G03' : 'G01')

            console.log(`N${(i + 1) * 10} [${seg.type}]:`)
            console.log(`  gCode: ${gCode}`)
            console.log(`  原点X/Z: ${seg.endX.toFixed(3)} / ${seg.endZ.toFixed(3)}`)
            console.log(`  補正X/Z: ${endX.toFixed(3)} / ${endZ.toFixed(3)}`)
            console.log(`  原点I/K: ${origI?.toFixed(3) ?? 'undefined'} / ${origK?.toFixed(3) ?? 'undefined'}`)
            console.log(`  補正I/K: ${compensatedI?.toFixed(3) ?? 'undefined'} / ${compensatedK?.toFixed(3) ?? 'undefined'}`)
            console.log(`  最終I/K (NCプログラムに出力): ${finalI?.toFixed(3) ?? '-'} / ${finalK?.toFixed(3) ?? '-'}`)

            if (seg.type === 'corner-r' && compensatedI === undefined) {
                console.log(`  ⚠️ 警告: 補正I/Kがundefined！原点値が使われる`)
            }
            console.log('')
        })

        // Segment 3 (隅R) の検証
        const seg3 = result.segments[2]
        console.log('*** Segment 3 (隅R) の検証 ***')
        console.log(`  isConvex: ${seg3.isConvex}`)
        console.log(`  gCode: ${seg3.gCode}`)
        console.log(`  seg.compensated?.i: ${seg3.compensated?.i}`)
        console.log(`  seg.compensated?.k: ${seg3.compensated?.k}`)

        // 補正I/Kが設定されていることを確認
        expect(seg3.compensated?.i).toBeDefined()
        expect(seg3.compensated?.k).toBeDefined()
    })
})
