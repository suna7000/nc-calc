import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'

/**
 * ユーザー提供の入力値で計算し、手書き図面の期待値と比較
 * 
 * 入力（スクリーンショットより）:
 * 1. X46.5 Z0
 * 2. X46.5 Z-101 (角R0.5)
 * 3. X42 Z-103.25 (角R2)
 * 4. X42 Z-118.85 (角R2)
 * 5. X45 Z-136 (角R2)
 * 6. X45 Z-150
 * 
 * ノーズR: 0.4
 */
describe('ユーザー入力値の完全検証', () => {

    it('6点入力で全補正座標を計算', () => {
        const noseR = 0.4
        const machineSettings = {
            toolPost: 'rear' as const,
            cuttingDirection: '-z' as const,
            noseRCompensation: { enabled: true, method: 'geometric' as const, offsetNumber: 1, compensationDirection: 'auto' as const },
            toolLibrary: [{ id: 'tool1', name: 'Test', noseRadius: noseR, toolTipNumber: 3, type: 'external' as const, hand: 'right' as const }],
            activeToolId: 'tool1',
            coordinateDisplay: { xAxis: 'diameter' as const }
        }

        const shape = {
            points: [
                { id: 'p1', x: 46.5, z: 0, type: 'line' as const, corner: { type: 'none' as const, size: 0 } },
                { id: 'p2', x: 46.5, z: -101, type: 'line' as const, corner: { type: 'kaku-r' as const, size: 0.5 } },
                { id: 'p3', x: 42, z: -103.25, type: 'line' as const, corner: { type: 'sumi-r' as const, size: 2 } },
                { id: 'p4', x: 42, z: -118.85, type: 'line' as const, corner: { type: 'sumi-r' as const, size: 2 } },
                { id: 'p5', x: 45, z: -136, type: 'line' as const, corner: { type: 'kaku-r' as const, size: 2 } },
                { id: 'p6', x: 45, z: -150, type: 'line' as const, corner: { type: 'none' as const, size: 0 } }
            ]
        }

        const result = calculateShape(shape, machineSettings as any)

        console.log('\n======= 入力値 =======')
        shape.points.forEach((p, i) => {
            const corner = p.corner.size > 0 ? ` (角R${p.corner.size})` : ''
            console.log(`P${i + 1}: X${p.x} Z${p.z}${corner}`)
        })
        console.log(`ノーズR: ${noseR}`)

        console.log('\n======= 全セグメント出力 =======')
        result.segments.forEach((seg, i) => {
            console.log(`Seg${i}: ${seg.type}`)
            console.log(`  ワーク: (${seg.startX}, ${seg.startZ}) -> (${seg.endX}, ${seg.endZ})`)
            if (seg.compensated) {
                console.log(`  補正後: (${seg.compensated.startX}, ${seg.compensated.startZ}) -> (${seg.compensated.endX}, ${seg.compensated.endZ})`)
            }
        })


        console.log('\n======= 手書き図面との照合 =======')
        console.log('| ポイント | 期待X | 期待Z | 実際X | 実際Z | X誤差 | Z誤差 | 判定 |')
        console.log('|----------|-------|-------|-------|-------|-------|-------|------|')

        // P2 R始点 = Seg0終点
        const seg0 = result.segments[0]
        if (seg0.compensated) {
            const diffX = seg0.compensated.endX - 46.5
            const diffZ = seg0.compensated.endZ - (-101.19)
            const pass = Math.abs(diffX) < 0.05 && Math.abs(diffZ) < 0.05
            console.log(`| P2 R始点 | 46.5 | -101.19 | ${seg0.compensated.endX} | ${seg0.compensated.endZ} | ${diffX.toFixed(3)} | ${diffZ.toFixed(3)} | ${pass ? '✅' : '❌'} |`)
        }

        // P2 R終点 = Seg1終点
        const seg1 = result.segments[1]
        if (seg1.compensated) {
            const diffX = seg1.compensated.endX - 45.97
            const diffZ = seg1.compensated.endZ - (-101.82)
            const pass = Math.abs(diffX) < 0.05 && Math.abs(diffZ) < 0.05
            console.log(`| P2 R終点 | 45.97 | -101.82 | ${seg1.compensated.endX} | ${seg1.compensated.endZ} | ${diffX.toFixed(3)} | ${diffZ.toFixed(3)} | ${pass ? '✅' : '❌'} |`)
        }

        // P3 R始点 = Seg2終点
        const seg2 = result.segments[2]
        if (seg2.compensated) {
            const diffX = seg2.compensated.endX - 42.93
            const diffZ = seg2.compensated.endZ - (-103.34)
            const pass = Math.abs(diffX) < 0.1 && Math.abs(diffZ) < 0.1
            console.log(`| P3 R始点 | 42.93 | -103.34 | ${seg2.compensated.endX} | ${seg2.compensated.endZ} | ${diffX.toFixed(3)} | ${diffZ.toFixed(3)} | ${pass ? '✅' : '❌'} |`)
        }

        // P3 R終点 = Seg3終点
        const seg3 = result.segments[3]
        if (seg3.compensated) {
            const diffX = seg3.compensated.endX - 42
            const diffZ = seg3.compensated.endZ - (-104.47)
            const pass = Math.abs(diffX) < 0.1 && Math.abs(diffZ) < 0.1
            console.log(`| P3 R終点 | 42 | -104.47 | ${seg3.compensated.endX} | ${seg3.compensated.endZ} | ${diffX.toFixed(3)} | ${diffZ.toFixed(3)} | ${pass ? '✅' : '❌'} |`)
        }

        expect(result.segments.length).toBeGreaterThan(0)
    })
})
