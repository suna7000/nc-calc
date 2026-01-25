import { describe, it, expect } from 'vitest'
import { CenterTrackCalculator, type Segment } from '../noseRCompensation'

describe('デバッグ：ノーズR補正の内部数値検証', () => {
    it('Tangent接続点での座標変換', () => {
        const noseR = 0.4
        const calculator = new CenterTrackCalculator(noseR, true, 3)

        // 45度テーパー線2つ（タンジェントに接続）
        const profile: Segment[] = [
            {
                type: 'line',
                startX: 46.207, startZ: -101.146,
                endX: 43.171, endZ: -104.182
            },
            {
                type: 'line',
                startX: 43.171, startZ: -104.182,
                endX: 42.0, endZ: -105.353
            }
        ]

        const result = calculator.calculate(profile)
        const seg = result[0]

        console.log(`Node 1 (Start): X${seg.compensatedStartX} Z${seg.compensatedStartZ}`)
        console.log(`Node 2 (Mid): X${seg.compensatedEndX} Z${seg.compensatedEndZ}`)

        // 期待値: X45.973 Z-101.829
        expect(seg.compensatedStartX).toBeCloseTo(45.973, 2)
    })
})
