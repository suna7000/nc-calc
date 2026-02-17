import { describe, it, expect } from 'vitest'
import { CenterTrackCalculator, type Segment } from '../noseRCompensation'

describe('法線計算の幾何監査', () => {
    it('45度テーパー（外径・減少方向）での法線と補正座標の検証', () => {
        const noseR = 0.4
        const calculator = new CenterTrackCalculator(noseR, true, 3)

        const profile: Segment[] = [
            {
                type: 'line',
                startX: 46.5, startZ: 0,
                endX: 46.5, endZ: -101.193
            },
            {
                type: 'line',
                startX: 46.5, startZ: -101.193,
                endX: 43.171, endZ: -102.664 // Taper
            },
            {
                type: 'line',
                startX: 43.171, startZ: -102.664,
                endX: 42.0, endZ: -104.078 // Taper continue or endpoint
            }
        ]

        const result = calculator.calculate(profile)
        const seg = result[1] // 真ん中のテーパー

        const shiftX_end = seg.compensatedEndX - seg.endX
        const shiftZ_end = seg.compensatedEndZ - seg.endZ

        console.log(`P3終点Xシフト: ${shiftX_end.toFixed(3)} Zシフト: ${shiftZ_end.toFixed(3)}`)
        console.log(`P3終点プログラム座標: X${seg.compensatedEndX} Z${seg.compensatedEndZ}`)

        // 幾何学的交点法: 2つのテーパー接合点でのXシフト
        // テーパーが続く場合、接合点の補正X < ワークX（わずかにマイナス）
        expect(shiftX_end).toBeCloseTo(-0.132, 2)
    })
})
