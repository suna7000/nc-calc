import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('Debug arc compensation', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        activeToolId: 't1',
        toolLibrary: [{ id: 't1', name: 'Test', type: 'external', noseRadius: 0.8, toolTipNumber: 3, hand: 'right' }],
        noseRCompensation: { enabled: true, offsetNumber: 1, compensationDirection: 'auto', method: 'geometric' }
    }

    it('Debug: X110 Z0 -> X110 Z-726(隅R10) -> X130 Z-726(角R0.4) -> X130 Z-760', () => {
        const p1 = createPoint(110, 0, noCorner())
        const p2 = createPoint(110, -726, { type: 'sumi-r', size: 10 })
        const p3 = createPoint(130, -726, { type: 'kaku-r', size: 0.4 })
        const p4 = createPoint(130, -760, noCorner())
        
        const result = calculateShape({ points: [p1, p2, p3, p4] }, settings)
        
        console.log('\n=== Work Segments ===')
        result.segments.forEach((seg, i) => {
            console.log(`Seg ${i+1} [${seg.type}]: start=(${seg.startX}, ${seg.startZ}) end=(${seg.endX}, ${seg.endZ})`)
            if (seg.type === 'corner-r') {
                console.log(`  center=(${seg.centerX}, ${seg.centerZ}) R=${seg.radius} isConvex=${seg.isConvex} gCode=${seg.gCode}`)
            }
            if (seg.compensated) {
                console.log(`  compensated: start=(${seg.compensated.startX}, ${seg.compensated.startZ}) end=(${seg.compensated.endX}, ${seg.compensated.endZ})`)
                if (seg.type === 'corner-r') {
                    console.log(`  compensated: R=${seg.compensated.radius} I=${seg.compensated.i} K=${seg.compensated.k}`)
                }
            }
        })
        
        // Expected values from handwritten note:
        // 隅R10 arc: R9.2, end approx X127.692 Z-725.913 (but these are work arc end, not compensated)
        // 角R0.4 arc: R1.2, end at X130 Z-727.2
        
        const arcSegments = result.segments.filter(s => s.type === 'corner-r')
        console.log(`\nTotal arc segments: ${arcSegments.length}`)
        
        arcSegments.forEach((arc, i) => {
            console.log(`Arc ${i+1}: work_start=(${arc.startX}, ${arc.startZ}) work_end=(${arc.endX}, ${arc.endZ}) R=${arc.radius} isConvex=${arc.isConvex}`)
            if (arc.compensated) {
                console.log(`  prog_start=(${arc.compensated.startX}, ${arc.compensated.startZ}) prog_end=(${arc.compensated.endX}, ${arc.compensated.endZ}) R=${arc.compensated.radius} I=${arc.compensated.i} K=${arc.compensated.k}`)
            }
        })
        
        expect(result.segments.length).toBeGreaterThan(0)
    })
})
