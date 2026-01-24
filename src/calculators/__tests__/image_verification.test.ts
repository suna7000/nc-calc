import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'

/**
 * 手書き図面（uploaded_image_1769172245709.jpg）の「全座標」検証
 * 
 * 図面から読み取れる頂点候補:
 * V1: X46.5 Z-101.0 (R0.5)
 * V2: X42.0 Z-103.807 (R2.0)
 * V3: X42.0 Z-119.163 (R2.0)
 * V4: X42.88 Z-131.88 (R2.0?)
 * V5: X45.0 Z-137.058 (R2.0)
 * 終点: X45.0 Z-149.208
 */
describe('手書き図面の全座標検証', () => {

    it('図面の全転記ポイントを検証', () => {
        const noseR = 0.4
        const machineSettings = {
            toolPost: 'rear' as const,
            cuttingDirection: '-z' as const,
            noseRCompensation: { enabled: true, method: 'geometric' as const, offsetNumber: 1, compensationDirection: 'auto' as const },
            toolLibrary: [{ id: 'tool1', name: 'Test', noseRadius: noseR, toolTipNumber: 3, type: 'external' as const, hand: 'right' as const }],
            activeToolId: 'tool1',
            diameterMode: true
        }

        const shape = {
            points: [
                { id: 'p1', x: 46.5, z: 0, corner: { type: 'none' as const, size: 0 } },
                { id: 'p2', x: 46.5, z: -101.0, corner: { type: 'kaku-r' as const, size: 0.5 } },
                { id: 'p3', x: 42.0, z: -103.807, corner: { type: 'sumi-r' as const, size: 2.0 } },
                { id: 'p4', x: 42.0, z: -119.163, corner: { type: 'sumi-r' as const, size: 2.0 } },
                { id: 'p5', x: 42.88, z: -131.88, corner: { type: 'kaku-r' as const, size: 2.0 } },
                { id: 'p6', x: 45.0, z: -137.058, corner: { type: 'kaku-r' as const, size: 2.0 } },
                { id: 'p7', x: 45.0, z: -149.208, corner: { type: 'none' as const, size: 0 } }
            ]
        }

        const result = calculateShape(shape, machineSettings as any)

        console.log('\n======= 全セグメント出力（全ポイント版） =======')
        result.segments.forEach((seg, i) => {
            console.log(`Seg${i}: ${seg.type} (${seg.startX}, ${seg.startZ}) -> (${seg.endX}, ${seg.endZ})`)
            if (seg.compensated) {
                console.log(`  Comp: (${seg.compensated.startX.toFixed(3)}, ${seg.compensated.startZ.toFixed(3)}) -> (${seg.compensated.endX.toFixed(3)}, ${seg.compensated.endZ.toFixed(3)})`)
            }
        })

        // 各主要ポイントのチェック
        const pointsToCheck = [
            { label: 'P2 R始点', x: 46.5, z: -101.19, segIdx: 1, useStart: true },
            { label: 'P2 R終点', x: 45.97, z: -101.82, segIdx: 1, useStart: false },
            { label: 'P3 R始点', x: 42.93, z: -103.34, segIdx: 3, useStart: true },
            { label: 'P3 R終点', x: 42.0, z: -104.47, segIdx: 3, useStart: false },
            { label: 'P4 R始点', x: 42.0, z: -119.163, segIdx: 5, useStart: true },
            { label: 'P4 R終点', x: 42.012, z: -119.33, segIdx: 5, useStart: false },
            { label: 'P5 R始点', x: 42.88, z: -131.88, segIdx: 7, useStart: true }, // 暫定
            { label: 'P6 R終点', x: 45.0, z: -137.058, segIdx: 9, useStart: false }
        ]

        console.log('\n======= 期待値照合結果 =======')
        pointsToCheck.forEach(item => {
            const seg = result.segments[item.segIdx]
            if (seg && seg.compensated) {
                const actX = item.useStart ? seg.compensated.startX : seg.compensated.endX
                const actZ = item.useStart ? seg.compensated.startZ : seg.compensated.endZ
                const diffX = actX - item.x
                const diffZ = actZ - item.z
                console.log(`${item.label}:`)
                console.log(`  期待: X${item.x.toFixed(3)} Z${item.z.toFixed(3)}`)
                console.log(`  実際: X${actX.toFixed(3)} Z${actZ.toFixed(3)}`)
                console.log(`  誤差: X${diffX.toFixed(3)} Z${diffZ.toFixed(3)} ${Math.abs(diffX) < 0.05 && Math.abs(diffZ) < 0.05 ? '✅' : '❌'}`)
            }
        })
    })
})
