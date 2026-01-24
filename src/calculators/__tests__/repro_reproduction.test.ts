import { expect, test, describe } from 'vitest'
import { calculateShape } from '../shape'
import { createEmptyShape, createPoint } from '../../models/shape'
import { defaultMachineSettings } from '../../models/settings'

describe('calculateShape reproduction', () => {
    test('should calculate 7 points from user diagram without crashing', () => {
        const shape = createEmptyShape()
        shape.points = [
            createPoint(46.5, 0, { type: 'none', size: 0 }),
            createPoint(46.5, -101.0, { type: 'kaku-r', size: 0.5 }),
            createPoint(42.0, -103.25, { type: 'sumi-r', size: 1.2 }),
            createPoint(42.0, -119.163, { type: 'sumi-r', size: 1.2 }),
            createPoint(42.88, -131.88, { type: 'kaku-r', size: 2.0 }),
            createPoint(45.0, -137.058, { type: 'kaku-r', size: 2.0 }),
            createPoint(45.0, -149.208, { type: 'none', size: 0 })
        ]

        const settings = { ...defaultMachineSettings }
        settings.noseRCompensation.enabled = true
        settings.activeToolId = 'tool-1' // Default tool usually exists in test environment or we need to mock it
        settings.toolLibrary = [{
            id: 'tool-1',
            name: 'Test Tool',
            type: 'external' as const,
            noseRadius: 0.4,
            toolTipNumber: 3,
            hand: 'right' as const
        }]

        const result = calculateShape(shape, settings)

        expect(result.segments.length).toBeGreaterThan(0)
        result.segments.forEach(seg => {
            expect(seg.startX).not.toBeNaN()
            expect(seg.endX).not.toBeNaN()
            expect(seg.startZ).not.toBeNaN()
            expect(seg.endZ).not.toBeNaN()
            if (settings.noseRCompensation.enabled) {
                expect(seg.compensated).toBeDefined()
                expect(seg.compensated?.startX).not.toBeNaN()
                expect(seg.compensated?.endX).not.toBeNaN()
            }
        })
    })
})
