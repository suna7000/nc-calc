import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * ユーザーの実際の入力データで検証
 * 図面座標：
 * 1. X60 Z0
 * 2. X60 Z-45.653
 * 3. X59.6 Z-46
 * 4. X59.6 Z-50（隅R2）
 * 5. X80 Z-50
 * 6. X80 Z-60
 */
describe('実際の図面データでの検証', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1',
            name: 'Test',
            type: 'external',
            noseRadius: 0.8,
            toolTipNumber: 3,
            hand: 'right'
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto',
            method: 'geometric'
        },
    }

    it('点2→点3のテーパー角度を計算', () => {
        const x2 = 60, z2 = -45.653
        const x3 = 59.6, z3 = -46

        const deltaR = (x2 - x3) / 2  // 半径変化
        const deltaZ = z3 - z2  // Z方向変化

        const angle = Math.atan(deltaR / Math.abs(deltaZ)) * 180 / Math.PI

        console.log('\n=== 点2→点3のテーパー解析 ===')
        console.log(`点2: X${x2} Z${z2}`)
        console.log(`点3: X${x3} Z${z3}`)
        console.log(`半径変化 ΔR: ${deltaR.toFixed(3)}mm`)
        console.log(`Z方向変化 ΔZ: ${deltaZ.toFixed(3)}mm`)
        console.log(`テーパー角度: ${angle.toFixed(2)}°`)

        // 30°テーパーか確認
        expect(angle).toBeCloseTo(30, 0)
    })

    it('30°テーパー（X60 Z-45.653開始）でのノーズR補正計算', () => {
        // 正しい30°テーパー: X60 Z-45.653 → X59.6 Z-46
        // 手書きメモのX62 Z-44.508は補正後の座標なので、このテストでは使用しない
        const shape = {
            points: [
                createPoint(60, -45.653, noCorner()),  // 30°テーパー開始点
                createPoint(59.6, -46, noCorner()),     // テーパー終点
                createPoint(59.6, -50, noCorner())      // 次の点
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 30°テーパーでの計算結果 ===')

        const seg1 = result.segments[0]

        console.log('\nセグメント1（X60 Z-45.653 → X59.6 Z-46）:')
        console.log(`  補正前: X${seg1.startX} Z${seg1.startZ} → X${seg1.endX} Z${seg1.endZ}`)
        console.log(`  補正後: X${seg1.compensated?.startX} Z${seg1.compensated?.startZ} → X${seg1.compensated?.endX} Z${seg1.compensated?.endZ}`)

        const compZ = seg1.compensated?.endZ ?? seg1.endZ

        console.log('\n=== 結果 ===')
        console.log(`アプリ出力（補正後）: Z${compZ.toFixed(3)}`)
        console.log(`手書き期待値: Z-46.586`)
        console.log(`誤差: ${(compZ - (-46.586)).toFixed(3)}mm`)

        // 教科書式の理論値
        const noseR = 0.8
        const theta = 30  // テーパー角度
        const fz = noseR * (1 - Math.tan((theta / 2) * Math.PI / 180))

        console.log('\n=== 理論値（教科書式）===')
        console.log(`fz = R × (1 - tan(θ/2)) = ${fz.toFixed(3)}mm`)
        console.log(`期待補正後Z = ${(-46 - fz).toFixed(3)}`)

        // 期待値との一致を検証
        expect(compZ).toBeCloseTo(-46.586, 3)
    })

    it('手書き計算方法の逆算', () => {
        // 手書き期待値から逆算
        const expectedZ = -46.586
        const inputZ = -46
        const correction = expectedZ - inputZ  // = -0.586

        const noseR = 0.8

        console.log('\n=== 手書き計算の逆算 ===')
        console.log(`補正前Z: ${inputZ}`)
        console.log(`補正後Z（期待値）: ${expectedZ}`)
        console.log(`補正量: ${correction.toFixed(3)}mm`)

        // この補正量を実現する角度は？
        // correction = R * tan(θ/2) * (何らかの係数)

        // 仮定1: correction = R * tan(θ/2) のみ
        const impliedAngle1 = 2 * Math.atan(Math.abs(correction) / noseR) * 180 / Math.PI
        console.log(`\n仮定1: 補正量 = R × tan(θ/2) の場合`)
        console.log(`  必要な角度: ${impliedAngle1.toFixed(2)}°`)

        // 仮定2: correction = fz / cos(30°) （何らかの投影）
        const fz30 = noseR * Math.tan(15 * Math.PI / 180)  // 30°の場合
        const factor = Math.abs(correction) / fz30
        console.log(`\n仮定2: 30°テーパーの fz = ${fz30.toFixed(3)}mm`)
        console.log(`  補正量 / fz = ${factor.toFixed(3)}`)
        console.log(`  （何らかの係数がかかっている？）`)
    })
})
