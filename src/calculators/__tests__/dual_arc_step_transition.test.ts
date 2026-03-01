import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * 「段差がR分よりも小さい場合」の二円弧遷移（S字接続）検証テスト
 *
 * 工場長のネタ帳公式:
 *   oe = R1 + R2, of = R1 - (step - R2)
 *   ef = √(oe² - of²) = ΔZ(A→C)
 *   θ = atan(of/ef)
 *   cd = R1 × cos(θ) = ΔZ(A→B)
 *   db = R1 × (1 - sin(θ)), B_X = smallDia + 2 × db
 */
describe('二円弧遷移（R > 段差）の汎用検証', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        toolPost: 'rear',
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1', name: 'Test', type: 'external',
            noseRadius: 0.8, toolTipNumber: 3, hand: 'right'
        }],
        noseRCompensation: {
            enabled: true, offsetNumber: 1,
            compensationDirection: 'auto' as CompensationDirection,
            method: 'geometric'
        },
    }

    // 公式計算ヘルパー
    function calcDualArc(R1: number, R2: number, step: number) {
        const oe = R1 + R2
        const of_val = R1 - (step - R2)
        if (of_val < 0 || of_val >= oe) return null // 幾何学的に不可能
        const ef = Math.sqrt(oe * oe - of_val * of_val)
        const theta = Math.atan2(of_val, ef)
        const cd = R1 * Math.cos(theta)
        const db = R1 * (1 - Math.sin(theta))
        return { ef, cd, db, theta: theta * 180 / Math.PI }
    }

    it('基本ケース: φ85→φ100 R9.2+R1.3 (IMG_1388)', () => {
        const R1 = 9.2, R2 = 1.3, step = 7.5 // (100-85)/2
        const expected = calcDualArc(R1, R2, step)!

        const shape = {
            points: [
                createPoint(120, 0, noCorner()),
                createPoint(85, 0, noCorner()),
                createPoint(85, -15, { type: 'sumi-r' as const, size: R1 }),
                createPoint(100, -15, { type: 'sumi-r' as const, size: R2 }),
                createPoint(100, -30, noCorner()),
                createPoint(120, -30, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)
        const arcs = result.segments.filter(s => s.type === 'corner-r')
        expect(arcs.length).toBeGreaterThanOrEqual(2)

        const arc1 = arcs.find(s => s.radius === R1)!
        const arc2 = arcs.find(s => s.radius === R2)!

        // R値が保持されている
        expect(arc1.radius).toBe(R1)
        expect(arc2.radius).toBe(R2)

        // B点X座標
        expect(arc1.endX).toBeCloseTo(85 + 2 * expected.db, 2)

        // ΔZ検証
        const dzAB = Math.abs(arc1.endZ - arc1.startZ)
        const dzAC = Math.abs(arc2.endZ - arc1.startZ)
        expect(dzAB).toBeCloseTo(expected.cd, 2)
        expect(dzAC).toBeCloseTo(expected.ef, 2)
    })

    it('逆方向ステップ: φ100→φ85 R9.2+R1.3', () => {
        const R1 = 9.2, R2 = 1.3, step = 7.5
        const expected = calcDualArc(R1, R2, step)!

        const shape = {
            points: [
                createPoint(80, 0, noCorner()),
                createPoint(100, 0, noCorner()),
                createPoint(100, -15, { type: 'sumi-r' as const, size: R1 }),
                createPoint(85, -15, { type: 'sumi-r' as const, size: R2 }),
                createPoint(85, -30, noCorner()),
                createPoint(80, -30, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)
        const arcs = result.segments.filter(s => s.type === 'corner-r')

        console.log('\n=== 逆方向ステップ φ100→φ85 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i+1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        expect(arcs.length).toBeGreaterThanOrEqual(2)
        const arc1 = arcs.find(s => s.radius === R1)!
        const arc2 = arcs.find(s => s.radius === R2)!

        expect(arc1.radius).toBe(R1)
        expect(arc2.radius).toBe(R2)
    })

    it('小さいR比率: φ50→φ60 R6+R2', () => {
        const R1 = 6, R2 = 2, step = 5 // (60-50)/2
        const expected = calcDualArc(R1, R2, step)!

        const shape = {
            points: [
                createPoint(80, 0, noCorner()),
                createPoint(50, 0, noCorner()),
                createPoint(50, -20, { type: 'sumi-r' as const, size: R1 }),
                createPoint(60, -20, { type: 'sumi-r' as const, size: R2 }),
                createPoint(60, -40, noCorner()),
                createPoint(80, -40, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)
        const arcs = result.segments.filter(s => s.type === 'corner-r')

        console.log('\n=== φ50→φ60 R6+R2 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i+1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        expect(arcs.length).toBeGreaterThanOrEqual(2)
        const arc1 = arcs.find(s => s.radius === R1)!
        const arc2 = arcs.find(s => s.radius === R2)!

        expect(arc1.radius).toBe(R1)
        expect(arc2.radius).toBe(R2)

        const dzAB = Math.abs(arc1.endZ - arc1.startZ)
        const dzAC = Math.abs(arc2.endZ - arc1.startZ)
        expect(dzAB).toBeCloseTo(expected.cd, 2)
        expect(dzAC).toBeCloseTo(expected.ef, 2)
    })

    it('ギリギリのR: φ50→φ60 R5.1+R0.5 (R1がstepをわずかに超える)', () => {
        const R1 = 5.1, R2 = 0.5, step = 5
        const expected = calcDualArc(R1, R2, step)!

        const shape = {
            points: [
                createPoint(80, 0, noCorner()),
                createPoint(50, 0, noCorner()),
                createPoint(50, -20, { type: 'sumi-r' as const, size: R1 }),
                createPoint(60, -20, { type: 'sumi-r' as const, size: R2 }),
                createPoint(60, -40, noCorner()),
                createPoint(80, -40, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)
        const arcs = result.segments.filter(s => s.type === 'corner-r')

        console.log('\n=== φ50→φ60 R5.1+R0.5 (ギリギリ) ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i+1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        expect(arcs.length).toBeGreaterThanOrEqual(2)
        expect(arcs.find(s => s.radius === R1)).toBeDefined()
        expect(arcs.find(s => s.radius === R2)).toBeDefined()
    })

    it('安全チェック: R が極端に大きい場合 (R50+R1 at gap=5)', () => {
        // dz1 が l1 を超える可能性 → S字が発動しないか、正しく処理されるべき
        const R1 = 50, R2 = 1, step = 5

        const shape = {
            points: [
                createPoint(80, 0, noCorner()),
                createPoint(50, 0, noCorner()),
                createPoint(50, -20, { type: 'sumi-r' as const, size: R1 }),
                createPoint(60, -20, { type: 'sumi-r' as const, size: R2 }),
                createPoint(60, -40, noCorner()),
                createPoint(80, -40, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 安全チェック: R50+R1 at gap=5 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i+1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        // 円弧の進入点がZ平行セグメントの範囲内であること
        const arcs = result.segments.filter(s => s.type === 'corner-r')
        if (arcs.length >= 2) {
            const firstArc = arcs[0]
            // 進入点のZ座標は形状の範囲内（Z=0～Z=-20）であるべき
            console.log(`  ⚠ arc1 entry Z: ${firstArc.startZ} (segment range: 0 to -20)`)
            expect(firstArc.startZ).toBeLessThanOrEqual(0)
            expect(firstArc.startZ).toBeGreaterThanOrEqual(-20)
        }
    })

    it('R合計がgap超過: φ50→φ60 R4+R2 (合計6 > gap5) → S字発動', () => {
        // R4 + R2 at gap=5: 個々のR < gap だが、合計(6) > gap(5)
        // → 個別計算では step face 上で円弧が重複するため、S字接続が必要
        const R1 = 4, R2 = 2, step = 5
        const expected = calcDualArc(R1, R2, step)!

        const shape = {
            points: [
                createPoint(80, 0, noCorner()),
                createPoint(50, 0, noCorner()),
                createPoint(50, -20, { type: 'sumi-r' as const, size: R1 }),
                createPoint(60, -20, { type: 'sumi-r' as const, size: R2 }),
                createPoint(60, -40, noCorner()),
                createPoint(80, -40, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== R合計 > gap: R4+R2 at gap=5 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i+1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        const arcs = result.segments.filter(s => s.type === 'corner-r')
        expect(arcs.length).toBeGreaterThanOrEqual(2)
        expect(arcs[0].radius).toBe(R1)
        expect(arcs[1].radius).toBe(R2)

        // step face のline segmentが残っていないこと（S字接続で全消費）
        const stepLines = result.segments.filter(s =>
            s.type === 'line' && s.startZ === s.endZ && s.endZ === -20
        )
        expect(stepLines.length).toBe(0)
    })

    it('R合計がgap未満: φ50→φ60 R2+R1 (合計3 < gap5) → 個別計算', () => {
        // R2 + R1 at gap=5: 合計(3) < gap(5)
        // → 個別計算でstep faceにline segmentが残る
        const shape = {
            points: [
                createPoint(80, 0, noCorner()),
                createPoint(50, 0, noCorner()),
                createPoint(50, -20, { type: 'sumi-r' as const, size: 2 }),
                createPoint(60, -20, { type: 'sumi-r' as const, size: 1 }),
                createPoint(60, -40, noCorner()),
                createPoint(80, -40, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== R合計 < gap: R2+R1 at gap=5 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i+1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        const arcs = result.segments.filter(s => s.type === 'corner-r')
        expect(arcs.length).toBeGreaterThanOrEqual(2)
        expect(arcs[0].radius).toBe(2)
        expect(arcs[1].radius).toBe(1)

        // step face のline segmentが残っていること（個別計算、gap に余裕あり）
        const stepLines = result.segments.filter(s =>
            s.type === 'line' && Math.abs(s.startZ - (-20)) < 0.01 && Math.abs(s.endZ - (-20)) < 0.01
        )
        expect(stepLines.length).toBe(1)
        // step line は X が増加方向（正しい方向）
        expect(stepLines[0].endX).toBeGreaterThan(stepLines[0].startX)
    })

    it('混合タイプ: sumi-r + kaku-r はS字不発動', () => {
        // sumi-r 10 + kaku-r 0.5 at gap=2.5 → 混合タイプなので個別計算
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(100, -10, { type: 'sumi-r' as const, size: 10 }),
                createPoint(95, -10, { type: 'kaku-r' as const, size: 0.5 }),
                createPoint(95, -20, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)
        const arcs = result.segments.filter(s => s.type === 'corner-r')

        console.log('\n=== 混合タイプ: sumi-r 10 + kaku-r 0.5 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i+1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        // auto-shrink が発生（個別計算）
        expect(arcs.some(s => s.radius! < 10)).toBe(true)
    })
})
