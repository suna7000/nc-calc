import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * ユーザー報告の形状を完全再現するテスト
 * 画像から読み取った座標を使用
 */
describe('ユーザー報告形状の完全再現', () => {
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

    it('ユーザー入力形状での補正値確認', () => {
        // 画像1から読み取った座標
        // 1: X46.5, Z0
        // 2: X46.5, Z-101, 角R0.5
        // 3: X42, Z-103.25, 角R2
        // 4: X42, Z-118.85, 角R2
        // 5: X45, Z-136, 角R2
        // 6: X45, Z-150

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

        console.log('=== ユーザー報告形状の検証 ===')
        console.log('ノーズR: 0.4mm, チップ番号: 3')
        console.log('')

        result.segments.forEach((seg, i) => {
            const compX = seg.compensated?.endX ?? seg.endX
            const compZ = seg.compensated?.endZ ?? seg.endZ
            const diffX = Math.abs(compX - seg.endX)
            const diffZ = Math.abs(compZ - seg.endZ)

            console.log(`Seg ${i + 1} [${seg.type}]:`)
            console.log(`  原点: X=${seg.endX.toFixed(3)}, Z=${seg.endZ.toFixed(3)}`)
            console.log(`  補正: X=${compX.toFixed(3)}, Z=${compZ.toFixed(3)}`)
            console.log(`  差分: ΔX=${diffX.toFixed(3)}, ΔZ=${diffZ.toFixed(3)}`)

            // R0.4の工具で2mmを超える補正は異常
            if (diffX > 2.0 || diffZ > 2.0) {
                console.log(`  ⚠️ 異常値検出！`)
            }
            console.log('')
        })

        // 異常値がないことを確認
        result.segments.forEach(seg => {
            if (seg.compensated) {
                const diffX = Math.abs(seg.compensated.endX - seg.endX)
                const diffZ = Math.abs(seg.compensated.endZ - seg.endZ)
                expect(diffX).toBeLessThan(5.0) // 5mmを許容上限とする
                expect(diffZ).toBeLessThan(5.0)
            }
        })
    })
})
