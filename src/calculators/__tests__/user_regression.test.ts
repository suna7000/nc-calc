import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

describe('User Regression Final: ユーザー報告の完全再現', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        toolPost: 'rear', // 画面は後刃物台
        activeToolId: 't1',
        toolLibrary: [{ id: 't1', name: 'Test', type: 'external', noseRadius: 0.4, toolTipNumber: 3, hand: 'right' }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto' as CompensationDirection,
            method: 'geometric'
        },
    }

    it('不具合再現: CompX 52.789 の発生確認', () => {
        // 画像1のテーブルをそのまま再現
        // 1. (Line) X46.5, Z-100.503
        // 2. (Arc) X45.6, Z-101.450, I-0.5, K0.0
        // 3. (Arc) X42.0, Z-105.240, I0.2, K-3.79



        // 実際のアプリでの「連続R」や「S字」がどう展開されているか
        // ユーザーが入力したのはおそらく：
        // P1(46.5, -100.5) 角R 0.5? 10R?
        // 画像1を見ると、Seg2(Arc)のIは-0.5。これは半径0.5のR。
        // Seg3(Arc)のKは-3.79。これは大きなRの一部。

        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(46.5, -100.503, { type: 'sumi-r', size: 0.5 }), // Seg2
                createPoint(42.0, -105.240, { type: 'kaku-r', size: 3.79 })  // Seg3
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('--- ユーザー再現監査レポート ---')
        result.segments.forEach(seg => {
            if (seg.compensated) {
                console.log(`NO ${seg.index} [${seg.type}]: OrigX=${seg.endX}, CompX=${seg.compensated.endX}`)
            }
        })

        // 画像1の「NO 2」は CompX 52.789。
        // これは OrigX 45.6 に対して 7.189mm もズレている。
        const seg2 = result.segments[1] // Seg2 (Arc)
        if (seg2 && seg2.compensated) {
            // もし 50を超えていればスパイク
            expect(seg2.compensated.endX).toBeLessThan(50.0)
        }
    })
})
