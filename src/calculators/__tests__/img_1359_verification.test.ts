/**
 * IMG_1359: 盗みR10深さ0.2 + ノーズR0.4 手書き検証テスト
 *
 * 形状: 端面 → 隅R2 → Z線 → 角R3 → ~12.68°テーパー → 盗み(R10, depth=0.2, 戻りX30)
 * 座標から算出したテーパー角度(12.68°)を使用。手書き計算は図面指定13°を使用したため
 * Point 4-6で差異あり。座標が正（12.68°が正確）、手書きの13°が近似値。
 */
import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('IMG_1359: 盗みR10深0.2 + ノーズR0.4 手書き検証', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,  // toolPost: 'rear'
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1', name: 'Test', type: 'external',
            noseRadius: 0.4, toolTipNumber: 3, hand: 'right'
        }],
        noseRCompensation: {
            enabled: true, offsetNumber: 1,
            compensationDirection: 'auto', method: 'geometric'
        },
    }

    // 盗み弧の戻りZ計算: 弧はX29.18→X30（逃しX30）
    // 中心: (X49.18, Z-178.3)  center_r=24.59
    // Δr = center_r - end_r = 24.59 - 15.0 = 9.59
    // ΔZ = √(R² - Δr²) = √(100 - 91.9681) = √8.0319 = 2.834
    const nusumiR = 10
    const dropX = 29.18  // 29.58 - 0.2*2
    const centerR = dropX / 2 + nusumiR  // 14.59 + 10 = 24.59
    const endR = 30 / 2  // 15.0
    const deltaZ = Math.sqrt(nusumiR * nusumiR - (centerR - endR) ** 2)
    const arcEndZ = -178.3 - deltaZ  // ≈ -181.134

    // 形状: 盗みを手動展開（弧の戻りX=30指定のため）
    const arcPoint = createPoint(30, arcEndZ, 'arc')
    arcPoint.arcRadius = nusumiR
    arcPoint.isConvex = false  // 凹R

    const shape = {
        points: [
            createPoint(40.6, -164.7, noCorner()),
            createPoint(32.1, -164.7, { type: 'sumi-r' as const, size: 2 }),
            createPoint(32.1, -172.7, { type: 'kaku-r' as const, size: 3 }),
            createPoint(29.58, -178.3, noCorner()),   // テーパ終点(座標から12.68°, 図面13°)
            createPoint(29.18, -178.3, noCorner()),   // 盗み落とし
            arcPoint,                                  // R10弧→X30戻り
        ]
    }

    it('全セグメント補正座標ダンプ（分析用）', () => {
        const result = calculateShape(shape, settings)

        console.log('\n=== IMG_1359 R0.4 補正座標 ===')
        console.log(`  弧終点Z(raw): ${arcEndZ.toFixed(4)}`)
        result.segments.forEach((seg, i) => {
            const rLabel = seg.radius ? ` R${seg.radius}` : ''
            const angle = seg.angle !== undefined ? ` ${seg.angle.toFixed(1)}°` : ''
            console.log(`  [${i}] ${seg.type}${rLabel}${angle}:`)
            console.log(`    形状: X${seg.startX} Z${seg.startZ} → X${seg.endX} Z${seg.endZ}`)
            if (seg.compensated) {
                console.log(`    補正: X${seg.compensated.startX} Z${seg.compensated.startZ} → X${seg.compensated.endX} Z${seg.compensated.endZ}`)
                if (seg.compensated.radius) {
                    console.log(`    補正R: ${seg.compensated.radius}`)
                }
            }
        })

        // セグメント構成の確認
        expect(result.segments.length).toBe(7)
        // [0] 端面, [1] 隅R2弧, [2] Z線, [3] 角R3弧, [4] テーパ, [5] 落とし, [6] R10弧
    })

    it('手書き値との照合', () => {
        const result = calculateShape(shape, settings)
        const seg = result.segments

        // === 手書き参照値（R0.4補正後 O座標） ===
        // 手書きは13°で計算。座標から算出した実角度は12.68°。
        // Point 4以降の差異は手書き側の角度近似に起因。

        // Point 1: 端面終点 → X35.3 Z-164.7 ✓ 端面法線修正で一致
        expect(seg[0].compensated?.endX).toBeCloseTo(35.3, 3)
        expect(seg[0].compensated?.endZ).toBeCloseTo(-164.7, 3)

        // Point 2: 隅R2弧終点 → X32.1 Z-167.1 R1.6
        // 凹弧出口はdz=noseRで一貫（旧concaveExitCorrectionは不要）
        // 手書き値-166.3との差0.8mm = 2×noseR（手書きの凹弧出口dz反転仮定が誤り）
        expect(seg[1].compensated?.endX).toBeCloseTo(32.1, 3)
        expect(seg[1].compensated?.endZ).toBeCloseTo(-167.1, 3)

        // Point 3: Z線終点（凹弧出口と連続するdz=noseR）
        expect(seg[2].compensated?.endX).toBeCloseTo(32.1, 3)
        expect(seg[2].compensated?.endZ).toBeCloseTo(-172.767, 2)

        // Point 4: 角R3弧終点（手書きとの差は13° vs 12.68°に起因）
        expect(seg[3].compensated?.endX).toBeCloseTo(31.935, 2) // 手書き31.929(13°使用)
        expect(seg[3].compensated?.endZ).toBeCloseTo(-173.513, 2)

        // Point 5: テーパー終点（座標準拠の12.68°で計算）
        expect(seg[4].compensated?.endX).toBeCloseTo(29.648, 2) // 手書き29.672(13°使用)
        expect(seg[4].compensated?.endZ).toBeCloseTo(-178.595, 1)

        // Point 6: 盗みR10弧終点
        expect(seg[6].compensated?.endX).toBeCloseTo(30.0, 3)
        expect(seg[6].compensated?.endZ).toBeCloseTo(-183.478, 1)
    })
})
