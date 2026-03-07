import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner, nusumi } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * 盗み（ヌスミ）コーナー処理のテスト
 *
 * 盗みの幾何学:
 *   1. 垂直落とし（X方向に depth 分ドロップ）
 *   2. R弧戻り（凹R で元の径に戻る）
 *   ΔZ = √(R² - (R - depth)²)
 */
describe('盗み（ヌスミ）コーナー処理', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        toolPost: 'rear',
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1', name: 'Test', type: 'external',
            noseRadius: 0.4, toolTipNumber: 3, hand: 'right'
        }],
        noseRCompensation: {
            enabled: true, offsetNumber: 1,
            compensationDirection: 'auto' as CompensationDirection,
            method: 'geometric'
        },
    }

    it('基本: 13°テーパー先端にR10深さ0.2の盗み（IMG_1359パターン）', () => {
        const shape = {
            points: [
                createPoint(40.6, -164.7, noCorner()),
                createPoint(32.1, -164.7, { type: 'sumi-r' as const, size: 2 }),
                createPoint(32.1, -172.7, { type: 'kaku-r' as const, size: 3 }),
                createPoint(29.58, -178.3, nusumi(10, 0.2)),
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== IMG_1359: 13°テーパー + 盗みR10 深0.2 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i + 1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
            if (seg.compensated) {
                console.log(`    補正: X${seg.compensated.startX}→X${seg.compensated.endX} Z${seg.compensated.startZ}→Z${seg.compensated.endZ}`)
            }
        })

        // 盗み展開により、落とし線 + 円弧が生成されるはず
        const lines = result.segments.filter(s => s.type === 'line')
        const arcs = result.segments.filter(s => s.type === 'corner-r')

        // 少なくとも1つの落とし線セグメントがある
        // 盗みの落とし: X29.58 → X29.18 (depth=0.2, diameter change=0.4)
        const dropLine = result.segments.find(s =>
            s.type === 'line' &&
            Math.abs(s.startX - 29.58) < 0.01 &&
            Math.abs(s.endX - 29.18) < 0.01
        )
        expect(dropLine).toBeDefined()
        if (dropLine) {
            // Z座標は変わらない（垂直落とし）
            expect(dropLine.startZ).toBeCloseTo(dropLine.endZ, 3)
        }

        // R10の凹弧: X29.18 → X29.58, Z方向に ΔZ=sqrt(100 - 96.04) = 1.99mm
        const nusumiArc = result.segments.find(s =>
            s.type === 'corner-r' &&
            Math.abs(s.radius! - 10) < 0.1
        )
        expect(nusumiArc).toBeDefined()
        if (nusumiArc) {
            expect(nusumiArc.startX).toBeCloseTo(29.18, 2)
            expect(nusumiArc.endX).toBeCloseTo(29.58, 2)
            const deltaZ = Math.abs(nusumiArc.endZ - nusumiArc.startZ)
            const expectedDeltaZ = Math.sqrt(100 - Math.pow(10 - 0.2, 2))
            expect(deltaZ).toBeCloseTo(expectedDeltaZ, 2)  // ≈1.99mm
        }
    })

    it('直角コーナー + 盗みR5 深さ0.3', () => {
        // Z方向直線 → X方向段差 の角に盗み
        const shape = {
            points: [
                createPoint(60, 0, noCorner()),
                createPoint(60, -20, nusumi(5, 0.3)),
                createPoint(50, -20, noCorner()),
                createPoint(50, -40, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 直角コーナー + 盗みR5 深0.3 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i + 1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        // 盗み落とし: X60 → X59.4 (depth=0.3 × 2 = 0.6 diameter)
        const dropLine = result.segments.find(s =>
            s.type === 'line' &&
            Math.abs(s.endX - 59.4) < 0.01
        )
        expect(dropLine).toBeDefined()

        // R5の凹弧
        const nusumiArc = result.segments.find(s =>
            s.type === 'corner-r' &&
            Math.abs(s.radius! - 5) < 0.1
        )
        expect(nusumiArc).toBeDefined()
        if (nusumiArc) {
            // 戻り: X59.4 → X60
            expect(nusumiArc.startX).toBeCloseTo(59.4, 2)
            expect(nusumiArc.endX).toBeCloseTo(60, 2)
            const deltaZ = Math.abs(nusumiArc.endZ - nusumiArc.startZ)
            const expectedDeltaZ = Math.sqrt(25 - Math.pow(5 - 0.3, 2))
            expect(deltaZ).toBeCloseTo(expectedDeltaZ, 2)  // ≈1.72mm
        }
    })

    it('R <= depth の場合は盗み無効（フォールバック）', () => {
        // R=0.5, depth=0.5 → R <= depth → 円弧が成立しない
        const shape = {
            points: [
                createPoint(60, 0, noCorner()),
                createPoint(60, -20, nusumi(0.5, 0.5)),
                createPoint(50, -20, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)

        // 盗みは無効化され、通常の角処理なしとして扱われる
        // R10の弧は生成されない
        const nusumiArc = result.segments.find(s =>
            s.type === 'corner-r' && s.radius === 0.5
        )
        expect(nusumiArc).toBeUndefined()
    })

    it('nusumi_geometry.test.ts と同等: 11°テーパー + 0.4mm深さ + R10', () => {
        // 既存の nusumi_geometry.test.ts のパターンを盗みコーナーで再現
        // Φ100 Z0 → Φ95 Z-12.861（11°テーパー）→ 盗みR10深さ0.4
        const shape = {
            points: [
                createPoint(120, 0, noCorner()),
                createPoint(100, 0, noCorner()),
                createPoint(95, -12.861, nusumi(10, 0.4)),
                createPoint(95, -20, noCorner()),
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 11°テーパー + 盗みR10 深0.4 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i + 1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        // 盗み落とし: X95 → X94.2 (depth=0.4 × 2 = 0.8)
        const dropLine = result.segments.find(s =>
            s.type === 'line' &&
            Math.abs(s.endX - 94.2) < 0.01
        )
        expect(dropLine).toBeDefined()

        // R10の凹弧: ΔZ = sqrt(100 - (10-0.4)²) = sqrt(100 - 92.16) = sqrt(7.84) = 2.8
        const nusumiArc = result.segments.find(s =>
            s.type === 'corner-r' &&
            Math.abs(s.radius! - 10) < 0.1
        )
        expect(nusumiArc).toBeDefined()
        if (nusumiArc) {
            const deltaZ = Math.abs(nusumiArc.endZ - nusumiArc.startZ)
            expect(deltaZ).toBeCloseTo(2.8, 2)
        }
    })

    it('形状末尾の盗み（後続セグメントなし）', () => {
        // 盗みが最後の点 → 展開後の弧が形状の終端になる
        const shape = {
            points: [
                createPoint(50, 0, noCorner()),
                createPoint(50, -30, nusumi(8, 0.15)),
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 末尾盗み R8 深0.15 ===')
        result.segments.forEach((seg, i) => {
            const label = `[${i + 1}] ${seg.type}${seg.radius ? ` R${seg.radius}` : ''}`
            console.log(`  ${label}: X${seg.startX}→X${seg.endX} Z${seg.startZ}→Z${seg.endZ}`)
        })

        // 展開されたセグメントがある
        expect(result.segments.length).toBeGreaterThanOrEqual(2)

        // 落とし線
        const dropLine = result.segments.find(s =>
            s.type === 'line' &&
            Math.abs(s.endX - (50 - 0.15 * 2)) < 0.01
        )
        expect(dropLine).toBeDefined()
    })
})
