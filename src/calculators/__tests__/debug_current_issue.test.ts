import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'

/**
 * ユーザーが報告した問題を再現:
 * - 形状がおかしい
 * - Xは計算されていない
 * 
 * 入力データ（ユーザーのスクリーンショットから推測）:
 * Point 1: X46.5 Z0
 * Point 2: X46.5 Z-101 (角R 0.5)
 * Point 3: X42 Z-103.25 (隅R)
 * Point 4: X42 Z-118.85
 */
describe('ユーザー報告問題の再現', () => {

    it('補正座標テーブルを出力', () => {
        const shape = {
            points: [
                { id: '1', x: 46.5, z: 0, corner: { type: 'none' as const, size: 0 } },
                { id: '2', x: 46.5, z: -101, corner: { type: 'kaku-r' as const, size: 0.5 } },
                { id: '3', x: 42, z: -103.25, corner: { type: 'sumi-r' as const, size: 2 } },
                { id: '4', x: 42, z: -118.85, corner: { type: 'none' as const, size: 0 } },
            ]
        }

        const machineSettings = {
            toolPost: 'front' as const,
            cuttingDirection: '-z' as const,
            noseRCompensation: { enabled: true, method: 'geometric' as const },
            toolLibrary: [{ id: 'tool1', name: 'Test', noseRadius: 0.4, tipNumber: 3, chipShape: 'C', angle: 80 }],
            activeToolId: 'tool1',
            coordinateDisplay: { xAxis: 'diameter' as const }
        }

        const result = calculateShape(shape, machineSettings as any)

        console.log('\n========================================')
        console.log('ユーザー報告問題の再現テスト')
        console.log('========================================')
        console.log('\n入力データ:')
        shape.points.forEach((p, i) => {
            console.log(`  Point ${i + 1}: X${p.x} Z${p.z} ${p.corner.type} ${p.corner.size > 0 ? `R${p.corner.size}` : ''}`)
        })
        console.log(`  noseR: 0.4`)

        console.log('\n【計算結果テーブル】')
        console.log('NO | 種類 | 元X | 元Z | 補正X | 補正Z | 差X | 差Z')
        console.log('---|------|-----|-----|-------|-------|-----|-----')

        result.segments.forEach((seg, i) => {
            const origX = seg.endX
            const origZ = seg.endZ
            const compX = seg.compensated?.endX ?? origX
            const compZ = seg.compensated?.endZ ?? origZ
            const diffX = compX - origX
            const diffZ = compZ - origZ

            console.log(`${i + 1} | ${seg.type.padEnd(8)} | ${origX.toFixed(3)} | ${origZ.toFixed(3)} | ${compX.toFixed(3)} | ${compZ.toFixed(3)} | ${diffX.toFixed(3)} | ${diffZ.toFixed(3)}`)
        })

        console.log('\n【問題分析】')
        const hasXCompensation = result.segments.some(seg => {
            const origX = seg.endX
            const compX = seg.compensated?.endX ?? origX
            return Math.abs(compX - origX) > 0.001
        })
        console.log(`X座標補正が適用されている: ${hasXCompensation ? 'はい' : 'いいえ ← 問題！'}`)

        // 期待値との比較
        console.log('\n【手書き図面との比較】')
        console.log('手書き: φ45.97')
        const seg2 = result.segments[1] // 角Rのセグメント
        if (seg2?.compensated?.endX) {
            console.log(`計算結果: φ${seg2.compensated.endX.toFixed(3)}`)
            console.log(`差: ${(45.97 - seg2.compensated.endX).toFixed(3)}mm`)
        }

        expect(hasXCompensation).toBe(true)
    })

    it('calculateCornerが正しくnoseRを受け取っているか確認', () => {
        // calculateCorner単体テスト
        // 実際の形状を使って、noseRが渡されているか確認
        const shape = {
            points: [
                { id: '1', x: 46.5, z: 0, corner: { type: 'none' as const, size: 0 } },
                { id: '2', x: 46.5, z: -101, corner: { type: 'kaku-r' as const, size: 0.5 } },
                { id: '3', x: 42, z: -103.25, corner: { type: 'none' as const, size: 0 } },
            ]
        }

        // noseR無効
        const resultWithoutNoseR = calculateShape(shape, {
            noseRCompensation: { enabled: false, method: 'geometric' as const },
            toolLibrary: [{ id: 'tool1', name: 'Test', noseRadius: 0.4, tipNumber: 3, chipShape: 'C', angle: 80 }],
            activeToolId: 'tool1',
            coordinateDisplay: { xAxis: 'diameter' as const }
        } as any)

        // noseR有効
        const resultWithNoseR = calculateShape(shape, {
            noseRCompensation: { enabled: true, method: 'geometric' as const },
            toolLibrary: [{ id: 'tool1', name: 'Test', noseRadius: 0.4, tipNumber: 3, chipShape: 'C', angle: 80 }],
            activeToolId: 'tool1',
            coordinateDisplay: { xAxis: 'diameter' as const }
        } as any)

        console.log('\n========================================')
        console.log('noseR有効/無効の比較')
        console.log('========================================')

        const seg1NoNoseR = resultWithoutNoseR.segments[1]
        const seg1WithNoseR = resultWithNoseR.segments[1]

        console.log('\n角Rセグメント（補正無効）:')
        console.log(`  endX: ${seg1NoNoseR.endX}, endZ: ${seg1NoNoseR.endZ}`)
        console.log(`  adjustedRadius: ${(seg1NoNoseR as any).radius}`)

        console.log('\n角Rセグメント（補正有効）:')
        console.log(`  endX: ${seg1WithNoseR.endX}, endZ: ${seg1WithNoseR.endZ}`)
        console.log(`  adjustedRadius: ${(seg1WithNoseR as any).radius}`)

        console.log('\n差分:')
        console.log(`  endX差: ${seg1WithNoseR.endX - seg1NoNoseR.endX}`)
        console.log(`  endZ差: ${seg1WithNoseR.endZ - seg1NoNoseR.endZ}`)

        // noseR有効時は、Rが大きくなるので接点位置が変わるはず
        const radiusDiff = (seg1WithNoseR as any).radius - (seg1NoNoseR as any).radius
        console.log(`  radius差: ${radiusDiff}`)

        // 期待: noseR有効時のRadiusは無効時より0.4大きい（角Rの場合）
        expect(radiusDiff).toBeCloseTo(0.4, 2)
    })
})
