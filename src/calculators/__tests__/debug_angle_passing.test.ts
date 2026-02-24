import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('angle情報の伝達確認', () => {
    it('テーパー線のangleがnoseRCompensationに渡されているか', () => {
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
            }
        }

        // 簡単なテーパー形状
        // Point 1: X60 Z0 (垂直線の始点)
        // Point 2: X60 Z-20 (垂直線の終点、テーパーの始点)
        // Point 3: X59.6 Z-46 (30°テーパーの終点)
        const shape = {
            points: [
                createPoint(60, 0, noCorner()),
                createPoint(60, -20, noCorner()),
                createPoint(59.6, -46, noCorner()),
                createPoint(59.6, -100, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== セグメント一覧とangle情報 ===\n')

        result.segments.forEach((seg, i) => {
            console.log(`Seg${i}: ${seg.type}`)
            console.log(`  座標: X${seg.startX} Z${seg.startZ} → X${seg.endX} Z${seg.endZ}`)
            console.log(`  angle: ${seg.angle !== undefined ? seg.angle + '°' : 'なし'}`)

            if (seg.type === 'line' && seg.startX !== seg.endX && seg.startZ !== seg.endZ) {
                // 理論的なテーパー角度を計算
                const dz = seg.endZ - seg.startZ
                const dx = (seg.endX - seg.startX) / 2  // 半径ベース
                const theoreticalAngle = Math.atan2(Math.abs(dx), Math.abs(dz)) * (180 / Math.PI)
                console.log(`  理論角度: ${theoreticalAngle.toFixed(2)}°`)
            }

            if (seg.compensated) {
                console.log(`  補正後: X${seg.compensated.startX.toFixed(3)} Z${seg.compensated.startZ.toFixed(3)}`)
                console.log(`         → X${seg.compensated.endX.toFixed(3)} Z${seg.compensated.endZ.toFixed(3)}`)
            }
            console.log()
        })

        // Point 2→3 のテーパーセグメントを探す
        const taperSeg = result.segments.find(s =>
            s.type === 'line' &&
            Math.abs(s.startX - 60) < 0.1 &&
            Math.abs(s.startZ - (-20)) < 0.1 &&
            Math.abs(s.endX - 59.6) < 0.1 &&
            Math.abs(s.endZ - (-46)) < 0.1
        )

        if (taperSeg) {
            console.log('=== Point 2→3 テーパーセグメント ===')
            console.log(`angle: ${taperSeg.angle !== undefined ? taperSeg.angle + '°' : '❌ 未定義'}`)

            if (taperSeg.angle !== undefined) {
                console.log('✅ angle情報が正しく渡されています')

                // 期待されるfz計算
                const R = 0.8
                const thetaRad = (taperSeg.angle * Math.PI) / 180
                const factor = 1 + Math.tan(thetaRad / 2)
                const expectedFz = R * factor

                console.log(`\n期待される補正量計算:`)
                console.log(`  R = ${R}mm`)
                console.log(`  θ = ${taperSeg.angle}°`)
                console.log(`  fz = R × (1 + tan(θ/2))`)
                console.log(`     = ${R} × (1 + tan(${taperSeg.angle / 2}°))`)
                console.log(`     = ${R} × ${factor.toFixed(4)}`)
                console.log(`     = ${expectedFz.toFixed(3)}mm`)

                if (taperSeg.compensated) {
                    const actualFz = Math.abs(taperSeg.compensated.endZ - taperSeg.endZ)
                    console.log(`\n実際の補正量: ${actualFz.toFixed(3)}mm`)
                    console.log(`誤差: ${(actualFz - expectedFz).toFixed(3)}mm`)
                }
            } else {
                console.log('❌ angle情報が伝達されていません！')
                console.log('これがtan(θ/2)修正が効かない原因です。')
            }
        } else {
            console.log('❌ テーパーセグメントが見つかりません')
        }
    })
})
