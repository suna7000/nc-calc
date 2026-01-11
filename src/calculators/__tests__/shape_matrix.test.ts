import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner, type Point } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('ShapeBuilder Master Matrix Tests', () => {
    const settings = defaultMachineSettings

    // --- 幾何学的基本パターン (G-01 〜 G-08) ---
    it('G-01: Basic Horizontal and Vertical Lines', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -50, noCorner())
        const p3 = createPoint(120, -50, noCorner())
        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)
        expect(result.segments).toHaveLength(2)
    })

    it('G-06: S-curve (Adjacent Arcs Case)', () => {
        const p1 = createPoint(90, 0, noCorner())
        const p2 = createPoint(90, -30, { type: 'sumi-r', size: 20 })
        const p3 = createPoint(100, -30, { type: 'kaku-r', size: 1 })
        const p4 = createPoint(100, -40, noCorner())
        const shape = { points: [p1, p2, p3, p4] }
        const result = calculateShape(shape, settings)
        const rSegments = result.segments.filter(s => s.type === 'corner-r')
        expect(rSegments).toHaveLength(2)
        expect(rSegments[0].endX).toBeCloseTo(rSegments[1].startX, 3)
        expect(rSegments[0].endZ).toBeCloseTo(rSegments[1].startZ, 3)
    })

    // --- 拡張幾何パターン (G-09 〜 G-12) ---
    it('G-09: Taper to Taper smooth R connection', () => {
        // テーパー1 (X80 -> X100, Z0 -> Z-20) 
        // テーパー2 (X100 -> X120, Z-20 -> Z-30) <- Zの勾配を変えて角度を付ける
        const p1 = createPoint(80, 0, noCorner())
        const p2 = createPoint(100, -20, { type: 'sumi-r', size: 5 })
        const p3 = createPoint(120, -30, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        const arc = result.segments.find(s => s.type === 'corner-r')
        expect(arc).toBeDefined()
        // 接点計算が正しければ、半径は5のままであるはず（干渉しなければ）
        expect(arc!.radius).toBe(5)
    })

    it('G-10: Multi-layer continuous R (R1 -> R2 -> R3)', () => {
        const p1 = createPoint(50, 0, noCorner())
        const p2 = createPoint(50, -10, { type: 'sumi-r', size: 5 })
        const p3 = createPoint(70, -10, { type: 'kaku-r', size: 2 })
        const p4 = createPoint(70, -20, { type: 'sumi-r', size: 3 })
        const p5 = createPoint(90, -20, noCorner())

        const shape = { points: [p1, p2, p3, p4, p5] }
        const result = calculateShape(shape, settings)

        const rCount = result.segments.filter(s => s.type === 'corner-r').length
        expect(rCount).toBe(3)
    })

    // --- 補正・環境パターン (C-04 〜 C-07) ---
    it('C-04: Validate all Tip Numbers (1-8)', () => {
        const tipNumbers = [1, 2, 3, 4, 5, 6, 7, 8] as const
        tipNumbers.forEach(tip => {
            const compSettings: MachineSettings = {
                ...settings,
                noseRCompensation: { enabled: true, offsetNumber: 1, compensationDirection: 'auto', method: 'geometric' },
                activeToolId: 't-test',
                toolLibrary: [{ id: 't-test', name: 'Test', type: 'external', noseRadius: 0.8, toolTipNumber: tip, hand: 'right' }]
            }
            const p1 = createPoint(100, 0, noCorner())
            const p2 = createPoint(100, -10, noCorner())
            const shape = { points: [p1, p2] }
            const result = calculateShape(shape, compSettings)
            expect(result.segments[0].compensated).toBeDefined()
        })
    })

    it('C-05: Internal Machining Compensation (Tip 2)', () => {
        const internalSettings: MachineSettings = {
            ...settings,
            noseRCompensation: { enabled: true, offsetNumber: 1, compensationDirection: 'auto', method: 'geometric' },
            activeToolId: 't-internal',
            toolLibrary: [{ id: 't-internal', name: 'Boring', type: 'internal', noseRadius: 0.4, toolTipNumber: 2, hand: 'right' }]
        }
        // 内径 X40 -> X50 の段差
        const p1 = createPoint(40, 0, noCorner())
        const p2 = createPoint(40, -10, { type: 'sumi-r', size: 2 })
        const p3 = createPoint(50, -10, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, internalSettings)

        expect(result.segments[0].compensated).toBeDefined()
        // プログラム座標（仮想刃先）は、補正後もワーク形状 X40 に一致するはず
        const compLine = result.segments[0].compensated!
        expect(compLine.startX).toBe(40)
    })

    // --- 異常系・エッジケース (E-03 〜 E-04) ---
    it('E-03: Three points on the same line', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -10, noCorner())
        const p3 = createPoint(100, -20, noCorner())

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        // 直線として処理されていること
        expect(result.segments.length).toBeGreaterThanOrEqual(2)
        expect(result.segments.every(s => s.type === 'line')).toBe(true)
    })

    it('E-04: Backward motion (Z increase)', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -20, noCorner())
        const p3 = createPoint(110, -10, noCorner()) // Zが-20から-10に戻る（食い込み）

        const shape = { points: [p1, p2, p3] }
        const result = calculateShape(shape, settings)

        expect(result.segments).toBeDefined()
        expect(result.segments[1].endZ).toBe(-10)
    })

    // --- 加速度的な検証追加 (G-11, G-12, C-06, C-07) ---
    it('G-11: Zigzag shape validation', () => {
        // X減少 -> X増加の繰り返し
        const points = [
            createPoint(100, 0, noCorner()),
            createPoint(80, -10, { type: 'sumi-r', size: 2 }),
            createPoint(100, -20, { type: 'kaku-r', size: 2 }),
            createPoint(80, -30, noCorner())
        ]
        const result = calculateShape({ points }, settings)
        expect(result.segments.length).toBeGreaterThan(4)
        expect(result.segments.some(s => s.type === 'corner-r')).toBe(true)
    })

    it('G-12: Groove with angled walls', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -10, noCorner())
        p2.groove = { depth: 5, width: 10, leftAngle: 120, rightAngle: 120 }
        const p3 = createPoint(100, -30, noCorner())

        const result = calculateShape({ points: [p1, p2, p3] }, settings)
        const lines = result.segments.filter(s => s.type === 'line')
        // 通常の溝(3本) + 前後のアプローチ
        expect(lines.length).toBeGreaterThanOrEqual(3)
        // 斜め壁のチェック
        expect(lines.some(l => l.angle === 120)).toBe(true)
    })

    it('C-06: Face Machining Compensation (Tip 7/5)', () => {
        const faceSettings: MachineSettings = {
            ...settings,
            noseRCompensation: { enabled: true, offsetNumber: 1, compensationDirection: 'auto', method: 'geometric' },
            activeToolId: 't-face',
            toolLibrary: [{ id: 't-face', name: 'Face', type: 'external', noseRadius: 0.8, toolTipNumber: 7, hand: 'right' }]
        }
        // 端面 X100 -> X0
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(0, 0, noCorner())

        const result = calculateShape({ points: [p1, p2] }, faceSettings)
        expect(result.segments[0].compensated).toBeDefined()
        // Tip 7 (Z+) の場合、プログラム座標は Z=0 になるはず
        expect(result.segments[0].compensated!.startZ).toBe(0)
    })

    it('C-07: Placeholder for Interference Check (Future)', () => {
        // 現在の calculateShape には干渉警告ロジックがまだ無いため、
        // 将来的な実装を見越して、矛盾する入力を与えてもクラッシュしないことを確認
        // 例: ホルダ角度 93度で 95度のテーパー
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(120, -5, noCorner()) // 急なテーパー

        const result = calculateShape({ points: [p1, p2] }, settings)
        expect(result.segments).toBeDefined()
    })
})
