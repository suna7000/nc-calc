import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * 刃物台位置と切削方向による補正の違いを検証
 */
describe('刃物台と切削方向の影響検証', () => {
    const baseSettings: MachineSettings = {
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

    it('後刃物台 + -Z切削（デフォルト）', () => {
        const settings: MachineSettings = {
            ...baseSettings,
            toolPost: 'rear',
            cuttingDirection: '-z',
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[1]
        const compZ = seg.compensated?.endZ ?? seg.endZ

        console.log('\n=== 後刃物台 + -Z切削 ===')
        console.log(`  入力: X59.6 Z-46`)
        console.log(`  補正後Z: ${compZ.toFixed(3)}`)
        console.log(`  手書き期待値: Z-46.586`)
        console.log(`  誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)
    })

    it('前刃物台 + -Z切削', () => {
        const settings: MachineSettings = {
            ...baseSettings,
            toolPost: 'front',
            cuttingDirection: '-z',
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[1]
        const compZ = seg.compensated?.endZ ?? seg.endZ

        console.log('\n=== 前刃物台 + -Z切削 ===')
        console.log(`  入力: X59.6 Z-46`)
        console.log(`  補正後Z: ${compZ.toFixed(3)}`)
        console.log(`  手書き期待値: Z-46.586`)
        console.log(`  誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)

        // 前刃物台の場合、符号が変わる可能性
        if (Math.abs(compZ - (-46.586)) < 0.1) {
            console.log(`  ✓ 前刃物台設定で期待値に近い！`)
        }
    })

    it('後刃物台 + +Z切削', () => {
        const settings: MachineSettings = {
            ...baseSettings,
            toolPost: 'rear',
            cuttingDirection: '+z',
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[1]
        const compZ = seg.compensated?.endZ ?? seg.endZ

        console.log('\n=== 後刃物台 + +Z切削 ===')
        console.log(`  入力: X59.6 Z-46`)
        console.log(`  補正後Z: ${compZ.toFixed(3)}`)
        console.log(`  手書き期待値: Z-46.586`)
        console.log(`  誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)

        // +Z切削の場合、符号が変わる可能性
        if (Math.abs(compZ - (-46.586)) < 0.1) {
            console.log(`  ✓ +Z切削設定で期待値に近い！`)
        }
    })

    it('前刃物台 + +Z切削', () => {
        const settings: MachineSettings = {
            ...baseSettings,
            toolPost: 'front',
            cuttingDirection: '+z',
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[1]
        const compZ = seg.compensated?.endZ ?? seg.endZ

        console.log('\n=== 前刃物台 + +Z切削 ===')
        console.log(`  入力: X59.6 Z-46`)
        console.log(`  補正後Z: ${compZ.toFixed(3)}`)
        console.log(`  手書き期待値: Z-46.586`)
        console.log(`  誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)

        if (Math.abs(compZ - (-46.586)) < 0.1) {
            console.log(`  ✓ 前刃物台+Z設定で期待値に近い！`)
        }
    })
})
