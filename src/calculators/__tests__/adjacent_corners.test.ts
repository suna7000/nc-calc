import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * 隣接コーナー処理（連続R）のisConvex設定が正しいことを検証するテスト
 * 
 * 隣接コーナー処理が発動する条件:
 * - 連続する2点（p2, p3）の両方に R (sumi-r または kaku-r) がある
 * - 4点以上のデータがある
 */
describe('隣接コーナー処理のisConvex設定検証', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        toolPost: 'rear',
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1',
            name: '外径仕上げ',
            type: 'external',
            noseRadius: 0.4,
            toolTipNumber: 3,
            hand: 'right'
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto' as CompensationDirection,
            method: 'geometric'
        },
    }

    it('パターン1: 角R + 隅R 連続（元々のユーザー報告ケース）', () => {
        // 点2: 角R, 点3: 隅R の連続
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(100, -50, { type: 'kaku-r', size: 2 }),   // 角R (凸)
                createPoint(80, -60, { type: 'sumi-r', size: 2 }),     // 隅R (凹)
                createPoint(80, -100, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const rSegments = result.segments.filter(s => s.type === 'corner-r')

        // 2つのR円弧があるはず（隣接コーナー処理でarc1, arc2が生成）
        expect(rSegments.length).toBeGreaterThanOrEqual(2)

        // arc1 (角R) は isConvex: true
        const arc1 = rSegments[0]
        expect(arc1.isConvex).toBe(true)

        // arc2 (隅R) は isConvex: false
        const arc2 = rSegments[1]
        expect(arc2.isConvex).toBe(false)

        // 補正が正常範囲内であること
        if (arc1.compensated) {
            const dx = Math.abs(arc1.compensated.endX - arc1.endX)
            const dz = Math.abs(arc1.compensated.endZ - arc1.endZ)
            expect(dx).toBeLessThan(2.0)
            expect(dz).toBeLessThan(2.0)
        }
    })

    it('パターン2: 隅R + 隅R 連続（S字接続）', () => {
        // 両方とも隅R
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(100, -50, { type: 'sumi-r', size: 2 }),   // 隅R (凹)
                createPoint(80, -60, { type: 'sumi-r', size: 2 }),     // 隅R (凹)
                createPoint(80, -100, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const rSegments = result.segments.filter(s => s.type === 'corner-r')

        expect(rSegments.length).toBeGreaterThanOrEqual(2)

        // 両方とも isConvex: false
        rSegments.forEach(seg => {
            expect(seg.isConvex).toBe(false)
        })
    })

    it('パターン3: 角R + 角R 連続', () => {
        // 両方とも角R
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(100, -50, { type: 'kaku-r', size: 2 }),   // 角R (凸)
                createPoint(120, -60, { type: 'kaku-r', size: 2 }),    // 角R (凸)
                createPoint(120, -100, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const rSegments = result.segments.filter(s => s.type === 'corner-r')

        expect(rSegments.length).toBeGreaterThanOrEqual(2)

        // 両方とも isConvex: true
        rSegments.forEach(seg => {
            expect(seg.isConvex).toBe(true)
        })
    })

    it('パターン4: 隅R + 角R 連続', () => {
        // 点2: 隅R, 点3: 角R の連続
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(100, -50, { type: 'sumi-r', size: 2 }),   // 隅R (凹)
                createPoint(120, -60, { type: 'kaku-r', size: 2 }),    // 角R (凸)
                createPoint(120, -100, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const rSegments = result.segments.filter(s => s.type === 'corner-r')

        expect(rSegments.length).toBeGreaterThanOrEqual(2)

        // arc1 (隅R) は isConvex: false
        const arc1 = rSegments[0]
        expect(arc1.isConvex).toBe(false)

        // arc2 (角R) は isConvex: true
        const arc2 = rSegments[1]
        expect(arc2.isConvex).toBe(true)
    })

    it('全パターンで補正値が2mm未満であること', () => {
        // ユーザー報告の形状を丸ごと再テスト
        const shape = {
            points: [
                createPoint(46.5, 0, noCorner()),
                createPoint(46.5, -101, { type: 'kaku-r', size: 0.5 }),
                createPoint(42, -103.25, { type: 'sumi-r', size: 2 }),
                createPoint(42, -118.85, { type: 'sumi-r', size: 2 }),
                createPoint(45, -136, { type: 'kaku-r', size: 2 }),
                createPoint(45, -150, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        // すべてのセグメントで補正値が正常範囲
        result.segments.forEach((seg, i) => {
            if (seg.compensated) {
                const dx = Math.abs(seg.compensated.endX - seg.endX)
                const dz = Math.abs(seg.compensated.endZ - seg.endZ)
                expect(dx, `Segment ${i + 1} ΔX が異常`).toBeLessThan(2.0)
                expect(dz, `Segment ${i + 1} ΔZ が異常`).toBeLessThan(2.0)
            }
        })
    })
})
