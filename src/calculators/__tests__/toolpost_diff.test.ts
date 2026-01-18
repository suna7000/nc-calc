import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * 刃物台設定による差異を確認するテスト
 */
describe('刃物台設定による差異', () => {
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

    it('後刃物台 (rear) での計算結果', () => {
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

        const result = calculateShape(shape, settings)
        const seg3 = result.segments[2]

        console.log('\n=== 後刃物台 (rear) ===')
        console.log(`N30: ${seg3.gCode} X${seg3.compensated?.endX?.toFixed(3)} Z${seg3.compensated?.endZ?.toFixed(3)} I${seg3.compensated?.i?.toFixed(3)} K${seg3.compensated?.k?.toFixed(3)}`)

        expect(seg3.gCode).toBe('G03')
    })

    it('前刃物台 (front) での計算結果', () => {
        const settings: MachineSettings = {
            ...defaultMachineSettings,
            toolPost: 'front',  // 前刃物台
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

        const result = calculateShape(shape, settings)
        const seg3 = result.segments[2]

        console.log('\n=== 前刃物台 (front) ===')
        console.log(`N30: ${seg3.gCode} X${seg3.compensated?.endX?.toFixed(3)} Z${seg3.compensated?.endZ?.toFixed(3)} I${seg3.compensated?.i?.toFixed(3)} K${seg3.compensated?.k?.toFixed(3)}`)

        // ブラウザで見られる結果と比較
        console.log('\n期待されるブラウザ結果: G02 X42.000 Z-105.640 I-0.179 K-2.991')
    })
})
