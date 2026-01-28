import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'

/**
 * ユーザー図面の完全再現テスト
 * 
 * 入力:
 * P1: X85 Z0
 * P2: X85 Z-458 (隅R10) ← 凹R、下側
 * P3: X100 Z-458 (角R0.5) ← 凸R、上側
 * P4: X100 Z-470
 * 
 * ノーズR: 0.8
 * 
 * 期待値（手書き図面）:
 * - 隅R10の始点: X85, Z-449.118
 */
describe('隅R10 計算精度検証', () => {

    it('隅R10の開始Z座標が-449.118であること', () => {
        const noseR = 0.8
        const machineSettings = {
            toolPost: 'rear' as const,
            cuttingDirection: '-z' as const,
            noseRCompensation: {
                enabled: true,
                method: 'geometric' as const,
                offsetNumber: 1,
                compensationDirection: 'auto' as const
            },
            toolLibrary: [{
                id: 'tool1',
                name: 'R0.8',
                noseRadius: noseR,
                toolTipNumber: 3,
                type: 'external' as const,
                hand: 'right' as const,
                leadAngle: 95,
                backAngle: 5
            }],
            activeToolId: 'tool1',
            coordinateDisplay: { xAxis: 'diameter' as const }
        }

        const shape = {
            points: [
                { id: 'p1', x: 85, z: 0, corner: { type: 'none' as const, size: 0 } },
                { id: 'p2', x: 85, z: -458, corner: { type: 'sumi-r' as const, size: 10 } },  // 隅R10
                { id: 'p3', x: 100, z: -458, corner: { type: 'kaku-r' as const, size: 0.5 } }, // 角R0.5
                { id: 'p4', x: 100, z: -470, corner: { type: 'none' as const, size: 0 } }
            ]
        }

        const result = calculateShape(shape, machineSettings as any)

        console.log('\n======= 入力値 =======')
        shape.points.forEach((p, i) => {
            const corner = p.corner.size > 0 ? ` (${p.corner.type} ${p.corner.size})` : ''
            console.log(`P${i + 1}: X${p.x} Z${p.z}${corner}`)
        })
        console.log(`ノーズR: ${noseR}`)

        console.log('\n======= 全セグメント出力 =======')
        result.segments.forEach((seg, i) => {
            console.log(`Seg${i}: ${seg.type} ${seg.cornerType || ''}`)
            console.log(`  ワーク: X${seg.startX.toFixed(3)} Z${seg.startZ.toFixed(3)} -> X${seg.endX.toFixed(3)} Z${seg.endZ.toFixed(3)}`)
            if (seg.compensated) {
                console.log(`  補正後: X${seg.compensated.startX?.toFixed(3)} Z${seg.compensated.startZ?.toFixed(3)} -> X${seg.compensated.endX?.toFixed(3)} Z${seg.compensated.endZ?.toFixed(3)}`)
            }
            if (seg.radius) {
                console.log(`  R: ${seg.radius}, 補正R: ${seg.compensated?.radius}`)
            }
        })

        // 期待値との比較
        console.log('\n======= 期待値との比較 =======')

        // 隅R10の始点を探す (最初の直線の終点)
        const firstLine = result.segments.find(s => s.type === 'line')
        if (firstLine?.compensated) {
            const expectedZ = -449.118
            const actualZ = firstLine.compensated.endZ
            const diff = actualZ! - expectedZ
            console.log(`隅R10始点(直線終点):`)
            console.log(`  期待Z: ${expectedZ}`)
            console.log(`  実際Z: ${actualZ?.toFixed(3)}`)
            console.log(`  差異: ${(diff * 1000).toFixed(1)}μm`)

            // 0.015mm (15μm) 以内であること
            expect(Math.abs(diff)).toBeLessThan(0.015)
        }
    })
})
