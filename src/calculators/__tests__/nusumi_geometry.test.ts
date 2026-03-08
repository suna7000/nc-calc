import { describe, it, expect } from 'vitest'
import { CenterTrackCalculator } from '../noseRCompensation'
import type { Segment } from '../noseRCompensation'

describe('Nusumi Geometry Verification (11deg Taper + 0.4mm Undercut + R10)', () => {
    // 形状パラメータ
    // 1. Φ100 Z0 -> Φ95 Z-12.861 (11度テーパー)
    // 2. Φ95 Z-12.861 -> Φ94.2 Z-12.861 (ぬすみ落とし)
    // 3. Φ94.2 Z-12.861 -> Φ100 Z(-12.861 - 2.8) (R10立ち上がり)

    const noseR = 0.4
    const toolType = 3 // 外径・前 (V_offset: +R, +R)
    const isExternal = true // 外径加工

    const profile: Segment[] = [
        {
            type: 'line',
            startX: 100, startZ: 0,
            endX: 95, endZ: -12.861,
            angle: 11  // 11度テーパー
        },
        {
            type: 'line',
            startX: 95, startZ: -12.861,
            endX: 94.2, endZ: -12.861,
            angle: 90  // 水平線（ぬすみ落とし）
        },
        {
            type: 'arc',
            startX: 94.2, startZ: -12.861,
            endX: 95, endZ: -12.861 - 2.8,
            centerX: 94.2 + 10 * 2, centerZ: -12.861, // 中心は内側(X+)
            radius: 10,
            isConvex: false // 凹R
        }
    ]

    const calculator = new CenterTrackCalculator(noseR, isExternal, toolType)

    it('should calculate verified accurate coordinates for all key points', () => {
        const result = calculator.calculate(profile)

        console.log('\n=== Nusumi Geometry 計算結果 ===')
        result.forEach((seg, i) => {
            console.log(`Seg${i}: (${seg.compensatedStartX}, ${seg.compensatedStartZ}) -> (${seg.compensatedEndX}, ${seg.compensatedEndZ})`)
        })

        // 1. 11度テーパーの終点 - テーパー→端面(90°)遷移はbisector法使用
        // bisector法: テーパー法線と端面法線の交点をP座標として計算
        expect(result[0].compensatedEndX).toBeCloseTo(94.817, 3)
        expect(result[0].compensatedEndZ).toBeCloseTo(-13.007, 3)

        // 2. ぬすみ落ちの終点 - 水平線とR10の接続
        // 内向き端面法線修正後: (0,-1)→(0,+1)でbisector方向が変更
        expect(result[1].compensatedEndX).toBeCloseTo(94.094, 3)
        expect(result[1].compensatedEndZ).toBeCloseTo(-12.861, 3)

        // 3. R10の終点 (プロファイル末端)
        expect(result[2].compensatedEndX).toBeCloseTo(94.992, 3)
        expect(result[2].compensatedEndZ).toBeCloseTo(-16.004, 3)
    })
})
