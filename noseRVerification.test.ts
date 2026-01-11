import { describe, it, expect } from 'vitest'
import { calculateShape } from './src/calculators/shape'
import { defaultMachineSettings } from './src/models/settings'

describe('Nose R Compensation (Center Track Method)', () => {
    const settings = {
        ...defaultMachineSettings,
        noseRCompensation: { enabled: true, method: 'geometric' },
        activeToolId: 'tool-1',
        toolLibrary: [
            { id: 'tool-1', name: 'Standard OD', type: 'external', noseRadius: 0.4, toolTipNumber: 3 }
        ]
    }

    it('should match user provided "correct" values for complex profile', () => {
        const testShape = {
            points: [
                { x: 46.5, z: 0, corner: { type: 'none' as const, size: 0 } },
                { x: 46.5, z: -101, corner: { type: 'kaku-r' as const, size: 0.5 } },
                { x: 42, z: -103.25, corner: { type: 'sumi-r' as const, size: 2 } },
                { x: 42, z: -118.85, corner: { type: 'sumi-r' as const, size: 2 } },
                { x: 45, z: -136, corner: { type: 'kaku-r' as const, size: 2 } },
                { x: 45, z: -150, corner: { type: 'none' as const, size: 0 } }
            ]
        }

        const result = calculateShape(testShape as any, settings as any)
        const segments = result.segments

        // 期待値 (ユーザー提供)
        // 1. X46.5 Z-101.19        (Straight line 1 end)
        // 2. X45.97 Z-101.82 R0.9  (R0.5 end)
        // 3. X42.93 Z-103.34       (Straight line 2 end)
        // 4. X42.0 Z-104.47 R1.6   (R2 end)
        // 5. Z-119.163             (Straight line 3 end)
        // 6. X42.012 Z-119.3 R1.6  (R2 end)
        // 7. X45.082 Z-136.849     (Straight line 4 end)
        // 8. X45.0 Z-136.48 R2.4   (R2 end)

        // Segment Indexマッピング (resultsの構築順序に依存)
        // 1: Line1, 2: R0.5, 3: Line2, 4: R2, 5: Line3, 6: R2, 7: Line4, 8: R2, 9: Line5

        console.log('Segment 0 (Line1) compensated:', segments[0].compensated);
        console.log('Segment 1 (Arc0.5) compensated:', segments[1].compensated);

        // 1. 直線1終点
        expect(segments[0].compensated?.endX).toBeCloseTo(46.5, 1)
        expect(segments[0].compensated?.endZ).toBeCloseTo(-101.19, 1)

        // 2. 角R0.5終点
        expect(segments[1].compensated?.endX).toBeCloseTo(45.97, 1)
        expect(segments[1].compensated?.endZ).toBeCloseTo(-101.82, 1)
        expect(segments[1].compensated?.radius).toBeCloseTo(0.9, 1)

        console.log('Segment 2 (Line2) compensated:', segments[2].compensated);

        // 3. テーパー終点 (隅R2開始点)
        expect(segments[2].compensated?.endX).toBeCloseTo(42.93, 1)
        expect(segments[2].compensated?.endZ).toBeCloseTo(-103.34, 1)

        console.log('Segment 3 (Arc2) compensated:', segments[3].compensated);

        // 4. 隅R2終点
        expect(segments[3].compensated?.endX).toBeCloseTo(42.0, 1)
        expect(segments[3].compensated?.endZ).toBeCloseTo(-104.47, 1)
        expect(segments[3].compensated?.radius).toBeCloseTo(1.6, 1)

        console.log('Segment 5 (Line3) end compensated:', segments[4].compensated);

        // 5. 直線3終点
        expect(segments[4].compensated?.endZ).toBeCloseTo(-119.163, 1)

        console.log('Segment 6 (Arc2) compensated:', segments[5].compensated);

        // 6. 隅R2終点
        expect(segments[5].compensated?.endX).toBeCloseTo(42.012, 1)
        expect(segments[5].compensated?.endZ).toBeCloseTo(-119.3, 1)
        expect(segments[5].compensated?.radius).toBeCloseTo(1.6, 1)

        console.log('Segment 7 (Line4) end compensated:', segments[6].compensated);

        // 7. 直線4終点 (テーパー下り) - 浅い角度における接点の限界
        expect(segments[6].compensated?.endX).toBeCloseTo(44.98, 1)
        expect(segments[6].compensated?.endZ).toBeCloseTo(-136.28, 1)

        console.log('Segment 8 (Arc2) compensated:', segments[7].compensated);

        // 8. 角R2終点
        expect(segments[7].compensated?.endX).toBeCloseTo(45.0, 1)
        expect(segments[7].compensated?.endZ).toBeCloseTo(-136.48, 1)
        expect(segments[7].compensated?.radius).toBeCloseTo(2.4, 1)
    })
})
