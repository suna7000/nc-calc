import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * advancedInfo（HP方式の補正量）を確認
 */
describe('advancedInfo確認', () => {
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

    it('HP方式（教科書式）の補正量を表示', () => {
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

        console.log('\n=== 各セグメントのadvancedInfo ===')
        result.segments.forEach((seg, idx) => {
            console.log(`\nセグメント${idx + 1} [${seg.type}]:`)
            console.log(`  元座標: (${seg.startX}, ${seg.startZ}) → (${seg.endX}, ${seg.endZ})`)
            if (seg.type === 'line' && 'angle' in seg) {
                console.log(`  角度: ${seg.angle}°`)
            }

            if (seg.advancedInfo) {
                console.log(`  advancedInfo:`)
                if (seg.advancedInfo.hpShiftZ !== undefined) {
                    console.log(`    hpShiftZ（教科書式）: ${seg.advancedInfo.hpShiftZ}`)
                }
                if (seg.advancedInfo.hpShiftX !== undefined) {
                    console.log(`    hpShiftX（教科書式）: ${seg.advancedInfo.hpShiftX}`)
                }
                if (seg.advancedInfo.manualShiftZ !== undefined) {
                    console.log(`    manualShiftZ（Smid式）: ${seg.advancedInfo.manualShiftZ}`)
                }
                if (seg.advancedInfo.manualShiftX !== undefined) {
                    console.log(`    manualShiftX（Smid式）: ${seg.advancedInfo.manualShiftX}`)
                }
            }

            if (seg.compensated) {
                console.log(`  補正後: (${seg.compensated.endX}, ${seg.compensated.endZ})`)
            }
        })

        // セグメント2（点2→点3）の詳細
        const seg2 = result.segments[1]
        console.log('\n=== セグメント2（点2→点3）の詳細分析 ===')
        console.log(`元座標終点: X${seg2.endX} Z${seg2.endZ}`)

        if (seg2.advancedInfo?.hpShiftZ) {
            const hpZ = seg2.endZ - seg2.advancedInfo.hpShiftZ
            console.log(`\nHP方式（教科書式）で補正した場合:`)
            console.log(`  補正量 hpShiftZ: ${seg2.advancedInfo.hpShiftZ}`)
            console.log(`  補正後Z = ${seg2.endZ} - ${seg2.advancedInfo.hpShiftZ} = ${hpZ}`)
            console.log(`  手書き期待値: -46.586`)
            console.log(`  誤差: ${(hpZ - (-46.586)).toFixed(3)}mm`)
        }

        const compZ = seg2.compensated?.endZ ?? seg2.endZ
        console.log(`\n現在の実装（bisector法）:`)
        console.log(`  補正後Z: ${compZ}`)
        console.log(`  手書き期待値: -46.586`)
        console.log(`  誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)
    })
})
