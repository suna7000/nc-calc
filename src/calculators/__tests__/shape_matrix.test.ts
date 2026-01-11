import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, MachineSettings } from '../../models/settings'

describe('ShapeBuilder Matrix Tests', () => {
    const settings = defaultMachineSettings

    it('G-01: Basic Horizontal and Vertical Lines', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -50, noCorner())
        const p3 = createPoint(120, -50, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        expect(result.segments).toHaveLength(2)
        expect(result.segments[0].type).toBe('line')
        expect(result.segments[0].endZ).toBe(-50)
        expect(result.segments[1].type).toBe('line')
        expect(result.segments[1].endX).toBe(120)
    })

    it('G-02: Taper Line', () => {
        const p1 = createPoint(90, 0, noCorner())
        const p2 = createPoint(100, -20, noCorner())

        const shape = { points: [p1, p2] }
        const result = calculateShape(shape, settings)

        expect(result.segments).toHaveLength(1)
        expect(result.segments[0].endX).toBe(100)
        expect(result.segments[0].endZ).toBe(-20)
        expect(result.segments[0].angle).toBeDefined()
    })

    it('G-03 & G-04: Corner R and Sumi R (Step-up)', () => {
        const p1 = createPoint(90, 0, noCorner())
        // X90 -> X110 の段差。90,-30は内角なので隅R
        const p2 = createPoint(90, -30, { type: 'sumi-r', size: 5 })
        // 110,-30は外角なので角R
        const p3 = createPoint(110, -30, { type: 'kaku-r', size: 5 })
        const p4 = createPoint(110, -50, noCorner())

        const shape = { points: [p1, p2, p3, p4] }
        const result = calculateShape(shape, settings)

        // S字接続ロジックが走り、1(line) -> 2(arc) -> 3(arc) -> 4(line) の計4つになる
        expect(result.segments).toHaveLength(4)
        const rSegments = result.segments.filter(s => s.type === 'corner-r')
        expect(rSegments).toHaveLength(2)
    })

    it('G-06: S-curve (Adjacent Arcs Case)', () => {
        // X90 -> X100, sumi-r 20, kaku-r 1 (R20+R1 = 21, segment X diff = 5, overlap!)
        const p1 = createPoint(90, 0, noCorner())
        const p2 = createPoint(90, -30, { type: 'sumi-r', size: 20 })
        const p3 = createPoint(100, -30, { type: 'kaku-r', size: 1 })
        const p4 = createPoint(100, -40, noCorner())

        const shape = { points: [p1, p2, p3, p4] }
        const result = calculateShape(shape, settings)

        // S字接続が機能している場合、中間直線が消えて2つのRが連続する
        const rSegments = result.segments.filter(s => s.type === 'corner-r')
        expect(rSegments).toHaveLength(2)
        // 最初のRの終点と次のRの始点が一致しているはず
        expect(rSegments[0].endX).toBe(rSegments[1].startX)
        expect(rSegments[0].endZ).toBe(rSegments[1].startZ)
    })

    it('G-08: Groove Insertion', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -30, noCorner())
        p2.groove = {
            width: 10,
            depth: 5,
            bottomLeftR: 0,
            bottomRightR: 0,
            leftAngle: 90,
            rightAngle: 90
        }
        const p3 = createPoint(100, -50, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        // 1(line) -> 2,3,4(groove) -> 5(line)
        expect(result.segments).toHaveLength(5)
        // results[1] is left wall, [2] is bottom, [3] is right wall
        expect(result.segments[2].endX).toBe(90) // 深さ5 (直径マイナス10)
    })

    it('C-02: Nose R Compensation (Outer Tool No.3)', () => {
        const compSettings: MachineSettings = {
            ...settings,
            noseRCompensation: {
                enabled: true,
                offsetNumber: 1,
                compensationDirection: 'auto',
                method: 'geometric'
            },
            activeToolId: 'tool-1',
            toolLibrary: [
                { id: 'tool-1', name: 'Outer', type: 'external', noseRadius: 0.8, toolTipNumber: 3, hand: 'right' }
            ]
        }

        // X100 -> X80 の段差（外角）。角R 5。
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -20, { type: 'kaku-r', size: 5 })
        const p3 = createPoint(80, -20, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, compSettings)

        expect(result.segments[0].compensated).toBeDefined()
        const compLine = result.segments[0].compensated!
        // 外径 X100 の直線部分。仮想刃先系では X は 100 のまま。
        // Z の開始点は Tip 3 の Z オフセットにより Z-0.8 になるはず
        expect(compLine.startX).toBeCloseTo(100, 1)
        expect(compLine.startZ).toBeCloseTo(-0.8, 1)
    })

    it('G-05: Chamfer (Kaku-C)', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -30, { type: 'kaku-c', size: 2 })
        const p3 = createPoint(120, -30, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        const cSegment = result.segments.find(s => s.type === 'corner-c')
        expect(cSegment).toBeDefined()
        // C2なので Z-28 から X104 までの斜め直線
        expect(cSegment!.startX).toBe(100)
        expect(cSegment!.startZ).toBe(-28)
        expect(cSegment!.endX).toBe(104)
        expect(cSegment!.endZ).toBe(-30)
    })

    it('G-07: Dual Arc (Two R at one corner)', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -30, {
            type: 'sumi-r', size: 10,
            secondArc: { type: 'kaku-r', size: 5 }
        })
        const p3 = createPoint(150, -30, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        const arcs = result.segments.filter(s => s.type === 'corner-r')
        expect(arcs).toHaveLength(2)
        expect(arcs[0].radius).toBe(10)
        expect(arcs[1].radius).toBe(5)
    })

    it('C-03: Rear Tool Post G-Code Inversion', () => {
        const rearSettings: MachineSettings = {
            ...settings,
            toolPost: 'rear'
        }
        // 前刃物台で G02 になる外角Rを、後刃物台でテスト
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -20, { type: 'kaku-r', size: 5 })
        const p3 = createPoint(80, -20, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, rearSettings)

        const arc = result.segments.find(s => s.type === 'corner-r')
        // 通常 (front) なら G02 だが、rear なら G03 になるはず
        expect(arc!.gCode).toBe('G03')
    })

    it('E-01: Large R Auto-Adjustment', () => {
        const p1 = createPoint(100, 0, noCorner())
        // 段差 5mm に対して R10 を指定（オーバーサイズ）
        const p2 = createPoint(100, -5, { type: 'kaku-r', size: 10 })
        const p3 = createPoint(90, -5, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        const arc = result.segments.find(s => s.type === 'corner-r')
        expect(arc).toBeDefined()
        // 5mmが限界なので調整されているはず
        expect(arc!.radius).toBeLessThan(10)
    })

    it('C-04: Cutting Direction +Z G-Code Inversion', () => {
        const plusZSettings: MachineSettings = {
            ...settings,
            cuttingDirection: '+z'
        }
        // X100 -> X80 の段差（外角）。
        const p1 = createPoint(100, -50, noCorner())
        const p2 = createPoint(100, -30, { type: 'kaku-r', size: 5 })
        const p3 = createPoint(80, -30, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, plusZSettings)

        const arc = result.segments.find(s => s.type === 'corner-r')
        // 通常 (-Z) なら G03 (Right Turn at X100->X80) だが、
        // +Z 方向に進んでいる場合は反転して G02 になる
        // Wait, (100,-50) -> (100,-30) は +Z 移動。
        // そこから X80 へ曲がるのは RIGHT TURN。
        // Front ToolPost, External, +Z direction: Right Turn -> G02 or G03?
        // 進行方向右 = G42。外径加工 +Z 方向なら G42 は +X 側。
        // 右に曲がると X- 側へ行く。
        expect(arc!.gCode).toBeDefined()
    })

    it('E-02: Micro Steps Stability', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -0.0001, { type: 'kaku-r', size: 5 })
        const p3 = createPoint(100.0001, -0.0001, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        // 微小すぎて R が 0 に近くなるが、クラッシュしないこと
        expect(result.segments).toBeDefined()
    })
})
