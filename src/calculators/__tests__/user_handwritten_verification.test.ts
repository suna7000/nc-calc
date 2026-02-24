import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('ユーザー手書き計算値の検証', () => {
    it('Point 3: X59.6 Z-46 (隅R2の前) → 期待値 Z-46.586', () => {
        const settings: MachineSettings = {
            ...defaultMachineSettings,
            activeToolId: 't1',
            toolLibrary: [{
                id: 't1',
                name: 'W形状',
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
            }
        }

        // ユーザーの実際の形状を再現
        // Point 1: X60 Z0
        // Point 2: X60 Z-20（隅R1）
        // Point 3: X59.6 Z-46（隅R2の前）← これをテスト
        // Point 4: X64 Z-67（隅R2あり）
        const shape = {
            points: [
                createPoint(60, 0, noCorner()),
                createPoint(60, -20, { type: 'sumi-r', size: 1 }),
                createPoint(59.6, -46, noCorner()),
                createPoint(64, -67, { type: 'sumi-r', size: 2 }),
                createPoint(64, -100, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== Point 3 (X59.6 Z-46) の補正結果 ===\n')

        // Point 3 の座標を含むセグメントを探す
        const segmentAtPoint3 = result.segments.find(s =>
            Math.abs(s.endX - 59.6) < 0.1 && Math.abs(s.endZ - (-46)) < 0.1
        )

        if (segmentAtPoint3?.compensated) {
            const actualZ = segmentAtPoint3.compensated.endZ
            const expectedZ = -46.586
            const error = actualZ - expectedZ

            console.log(`セグメント: ${segmentAtPoint3.type}`)
            console.log(`プログラム座標: X${segmentAtPoint3.endX.toFixed(3)} Z${segmentAtPoint3.endZ.toFixed(3)}`)
            console.log(`補正後座標: X${segmentAtPoint3.compensated.endX.toFixed(3)} Z${actualZ.toFixed(3)}`)
            console.log(`\n期待値（手書き計算）: Z${expectedZ.toFixed(3)}`)
            console.log(`実測値（アプリ出力）: Z${actualZ.toFixed(3)}`)
            console.log(`誤差: ${error.toFixed(3)}mm ${Math.abs(error) < 0.01 ? '✅ 合格' : '❌ 不合格'}`)

            if (Math.abs(error) > 0.01) {
                console.log(`\n❌ tan(θ/2)修正後も誤差が残っています`)
                console.log(`期待誤差: -0.428mm → 約0になる`)
                console.log(`実際の誤差: ${error.toFixed(3)}mm`)
            }
        } else {
            console.log('❌ Point 3 のセグメントが見つかりません')
        }

        console.log('\n=== 全セグメント一覧 ===\n')
        result.segments.forEach((seg, i) => {
            if (seg.compensated) {
                console.log(`Seg${i}: ${seg.type}`)
                console.log(`  終点: X${seg.endX.toFixed(3)} Z${seg.endZ.toFixed(3)}`)
                console.log(`  補正終点: X${seg.compensated.endX.toFixed(3)} Z${seg.compensated.endZ.toFixed(3)}`)
            }
        })
    })

    it('数式検証: tan(θ/2) vs 1/cos(θ/2)', () => {
        console.log('\n=== 数式比較 ===\n')

        const angles = [30, 45, 60, 90, 120]
        const R = 0.8

        console.log('角度θ | θ/2 | R*tan(θ/2) | R/cos(θ/2) | 誤差')
        console.log('------|-----|------------|------------|------')

        angles.forEach(theta => {
            const thetaRad = (theta * Math.PI) / 180
            const halfRad = thetaRad / 2

            const correctDist = R * Math.tan(halfRad)
            const wrongDist = R / Math.cos(halfRad)
            const error = wrongDist - correctDist

            console.log(
                `${theta.toString().padStart(3)}°  | ${(theta/2).toString().padStart(3)}° | ` +
                `${correctDist.toFixed(3).padStart(6)}mm | ` +
                `${wrongDist.toFixed(3).padStart(6)}mm | ` +
                `${error > 0 ? '+' : ''}${error.toFixed(3)}mm`
            )
        })

        console.log('\n90度接続での誤差 = 0.8 × (1.414 - 1.0) = 0.331mm')
        console.log('これがZ成分に投影されると約0.428mmの誤差になる')
    })
})
