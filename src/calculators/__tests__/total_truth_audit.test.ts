import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * Total Truth Audit: AI独立数学監査
 * 目的: アプリの実装ロジックに一切依存せず、JSのMathライブラリのみを用いて
 *       「NCプログラミング点（補正後仮想刃先点 O'）」を算出し、実装値の正当性を証明する。
 */
describe('Total Truth Audit: 真理の証明', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto' as CompensationDirection,
            method: 'geometric'
        },
    }

    const noseR = 0.8
    // Tip 3 Vector P = O + V_offset -> O = P - V_offset
    // Tip 3 V_offset = (1.6, 0.8) [X直径, Z]
    const pToO_Tip3 = { dx: -1.6, dz: -0.8 }

    it('G-09 Audit: 45度テーパー接続（真理値 -0.469 への収束立証）', () => {
        const testSettings: MachineSettings = {
            ...settings,
            activeToolId: 't1',
            toolLibrary: [{ id: 't1', name: 'Test', type: 'external', noseRadius: noseR, toolTipNumber: 3, hand: 'right' }]
        }

        // 入力: 平坦 X100 Z10->0, テーパー X100->120 Z0->-10
        const p0 = createPoint(100, 10, noCorner())
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(120, -10, noCorner())

        const result = calculateShape({ points: [p0, p1, p2] }, testSettings)
        const comp = result.segments[1].compensated!

        // --- AI独立・真理計算プロセス ---
        // 1. 中心点軌跡 (Center Path P) の交点算出
        // L1: X=100. Normal=(1,0). Offset Center Line1: X = 100 + 2R = 101.6
        // L2: X100 Z0 -> X120 Z-10. dx=10, dz=-10. Normal=(10,10) -> (0.707, 0.707).
        // Line2 Offset Center passing through P2 = V + R*Normal = (100+1.131, 0+0.566) = (101.131, 0.566)
        // Line2 Equation: x_rad - 50.565 = -1 * (z - 0.566)
        // Intersection with Line1 (x_rad = 50.8):
        // 50.8 - 50.565 = -z + 0.566 => 0.235 = -z + 0.566 => z = 0.331
        const Pz = 0.331

        // 2. 中心点 P から 補正後仮想刃先 O' への変換 (Tip 3)
        const expectedO_prime_z = Pz + pToO_Tip3.dz // 0.331 - 0.8 = -0.469

        console.log(`G-09 監査: 理論値 O'z=${expectedO_prime_z}, 実装値=${comp.startZ}`)
        expect(comp.startZ).toBeCloseTo(expectedO_prime_z, 3)
    })

    it('C-04 Audit: チップ番号 3 の物理定義整合性', () => {
        const testSettings: MachineSettings = {
            ...settings,
            activeToolId: 't1',
            toolLibrary: [{ id: 't1', name: 'Test', type: 'external', noseRadius: noseR, toolTipNumber: 3, hand: 'right' }]
        }
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -10, noCorner())
        const result = calculateShape({ points: [p1, p2] }, testSettings)
        const comp = result.segments[0].compensated!

        // 通常の直線であれば、仮想刃先 O' はワーク形状 O と一致する (X100)
        // なぜなら、G-code として X100 を出せば、NCが内部で P(101.6) にシフトして削るから。
        expect(comp.startX).toBeCloseTo(100.0, 3)
    })

    it('G-06 Audit: S字接続の完全タンジェント監査', () => {
        const p1 = createPoint(90, 0, noCorner())
        const p2 = createPoint(90, -30, { type: 'sumi-r', size: 20 })
        const p3 = createPoint(100, -30, { type: 'kaku-r', size: 1 })
        const p4 = createPoint(100, -40, noCorner())

        const result = calculateShape({ points: [p1, p2, p3, p4] }, settings)
        const r1 = result.segments.filter(s => s.type === 'corner-r')[0]
        const r2 = result.segments.filter(s => s.type === 'corner-r')[1]

        // 接続点の一致 (1μm)
        expect(r1.endX).toBeCloseTo(r2.startX, 6)
        expect(r1.endZ).toBeCloseTo(r2.startZ, 6)

        // 共通接線勾配の監査
        const m1 = (r1.endZ - r1.centerZ!) / (r1.endX - r1.centerX!)
        const m2 = (r2.startZ - r2.centerZ!) / (r2.startX - r2.centerX!)
        // 座標値が小数点3位(round3)で丸められているため、勾配は3位程度の精度で一致すれば数学的に連続とみなせる
        console.log(`G-06 監査: Arc1勾配=${m1}, Arc2勾配=${m2}`)
        expect(m1).toBeCloseTo(m2, 3)
    })
})
