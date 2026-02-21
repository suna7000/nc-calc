import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings } from '../../models/settings'

describe('形状の幾何学的分析', () => {
    it('角度と接線距離の確認', () => {
        const shape = {
            points: [
                createPoint(66, 0, noCorner()),
                createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),
                createPoint(63, -116.5, { type: 'sumi-r', size: 1 }),
                createPoint(63, -169, { type: 'sumi-r', size: 2 }),
                createPoint(70, -184, { type: 'kaku-r', size: 2 }),
                createPoint(70, -200, noCorner())
            ]
        }

        console.log('\n=== 各コーナーの幾何情報 ===\n')

        // P1→P2→P3 (角R0.5)
        const p1 = shape.points[0], p2 = shape.points[1], p3 = shape.points[2]
        const v1 = { x: (p2.x - p1.x) / 2, z: p2.z - p1.z }
        const v2 = { x: (p3.x - p2.x) / 2, z: p3.z - p2.z }
        const l1 = Math.sqrt(v1.x * v1.x + v1.z * v1.z)
        const l2 = Math.sqrt(v2.x * v2.x + v2.z * v2.z)
        const u1 = { x: v1.x / l1, z: v1.z / l1 }
        const u2 = { x: v2.x / l2, z: v2.z / l2 }
        const dot = u1.x * u2.x + u1.z * u2.z
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI
        const half = angle / 2
        const tDist = 0.5 / Math.tan(half * Math.PI / 180)

        console.log('【角R0.5】at P2 (X66 Z-115)')
        console.log(`  入力方向 u1: (${u1.x.toFixed(3)}, ${u1.z.toFixed(3)})`)
        console.log(`  出力方向 u2: (${u2.x.toFixed(3)}, ${u2.z.toFixed(3)})`)
        console.log(`  コーナー角度: ${angle.toFixed(1)}°`)
        console.log(`  半角: ${half.toFixed(1)}°`)
        console.log(`  接線距離 tDist: ${tDist.toFixed(3)}mm`)
        console.log(`  セグメント長 l1=${l1.toFixed(2)}mm, l2=${l2.toFixed(2)}mm`)

        // P2→P3→P4 (隅R1)
        const p4 = shape.points[3]
        const v2b = { x: (p3.x - p2.x) / 2, z: p3.z - p2.z }
        const v3 = { x: (p4.x - p3.x) / 2, z: p4.z - p3.z }
        const l2b = Math.sqrt(v2b.x * v2b.x + v2b.z * v2b.z)
        const l3 = Math.sqrt(v3.x * v3.x + v3.z * v3.z)
        const u2b = { x: v2b.x / l2b, z: v2b.z / l2b }
        const u3 = { x: v3.x / l3, z: v3.z / l3 }
        const dot2 = u2b.x * u3.x + u2b.z * u3.z
        const angle2 = Math.acos(Math.max(-1, Math.min(1, dot2))) * 180 / Math.PI
        const half2 = angle2 / 2
        const tDist2 = 1.0 / Math.tan(half2 * Math.PI / 180)

        console.log('\n【隅R1】at P3 (X63 Z-116.5)')
        console.log(`  入力方向: (${u2b.x.toFixed(3)}, ${u2b.z.toFixed(3)})`)
        console.log(`  出力方向: (${u3.x.toFixed(3)}, ${u3.z.toFixed(3)})`)
        console.log(`  コーナー角度: ${angle2.toFixed(1)}°`)
        console.log(`  半角: ${half2.toFixed(1)}°`)
        console.log(`  接線距離 tDist: ${tDist2.toFixed(3)}mm`)
        console.log(`  セグメント長 l2=${l2b.toFixed(2)}mm, l3=${l3.toFixed(2)}mm`)

        console.log('\n=== 隣接コーナー判定 ===')
        const tSum = tDist + tDist2
        console.log(`  角R0.5 tDist: ${tDist.toFixed(3)}mm`)
        console.log(`  隅R1 tDist: ${tDist2.toFixed(3)}mm`)
        console.log(`  合計: ${tSum.toFixed(3)}mm`)
        console.log(`  セグメント長 l2: ${l2.toFixed(3)}mm`)
        console.log(`  重なり: ${tSum > l2 ? `YES (${(tSum - l2).toFixed(3)}mm)` : 'NO'}`)
    })
})
