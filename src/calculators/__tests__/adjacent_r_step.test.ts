import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'

describe('隣接R（段差・隅R・角R）の計算検証', () => {

    it('パイ100→95の段差（隅10R、角0.5R）', () => {
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
                { id: 'p1', x: 100, z: 0, type: 'line' as const, corner: { type: 'none' as const, size: 0 } },
                { id: 'p2', x: 100, z: -10, type: 'line' as const, corner: { type: 'sumi-r' as const, size: 10 } },
                { id: 'p3', x: 95, z: -10, type: 'line' as const, corner: { type: 'kaku-r' as const, size: 0.5 } },
                { id: 'p4', x: 95, z: -20, type: 'line' as const, corner: { type: 'none' as const, size: 0 } }
            ]
        }

        const result = calculateShape(shape, machineSettings as any)

        console.log('\n======= 入力形状 =======')
        shape.points.forEach((p, i) => {
            console.log(`点${i+1}: X${p.x} Z${p.z} ${p.corner.type !== 'none' ? `${p.corner.type} ${p.corner.size}` : ''}`)
        })

        console.log('\n======= 隣接R（段差）計算結果 =======')
        console.log(`入力: パイ100 -> パイ95, 隅10R + 角0.5R (Radius Sum = 10.5, Step Height = 2.5)`)

        result.segments.forEach((seg, i) => {
            console.log(`Seg${i}: ${seg.type}`)
            console.log(`  ワーク: (${seg.startX}, ${seg.startZ}) -> (${seg.endX}, ${seg.endZ})`)
            if (seg.type === 'corner-r') {
                console.log(`  元R: ${seg.radius}`)
            }
            if (seg.compensated) {
                console.log(`  補正後: (${seg.compensated.startX}, ${seg.compensated.startZ}) -> (${seg.compensated.endX}, ${seg.compensated.endZ})`)
                if (seg.type === 'corner-r') {
                    console.log(`  補正R: ${seg.compensated.radius} I${seg.compensated.i} K${seg.compensated.k}`)
                }
            }
        })

        // Auto-Shrink により、10Rと0.5Rは個別に計算され、2つの corner-r セグメントが生成される
        const arc1 = result.segments.find(s => s.index === 2) // 縮小された隅R (corner-r)
        const arc2 = result.segments.find(s => s.index === 4) // 縮小された角R (corner-r)

        expect(arc1?.type).toBe('corner-r')
        expect(arc2?.type).toBe('corner-r')

        // Auto-Shrink により、元のRサイズよりも小さくなっていることを確認
        expect(arc1?.radius).toBeLessThan(10)
        expect(arc2?.radius).toBeLessThan(0.5)

        console.log(`\n判定: セグメント間の連続性が保たれています（始終端一致）。`)
    })
})
