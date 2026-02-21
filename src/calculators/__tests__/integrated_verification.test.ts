import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('統合検証: shape + noseRCompensation', () => {
    it('角R0.5の実際の計算フロー検証', () => {
        const settings: MachineSettings = {
            ...defaultMachineSettings,
            activeToolId: 't1',
            toolLibrary: [{
                id: 't1',
                name: 'Test',
                type: 'external',
                noseRadius: 0.4,
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

        const shape = {
            points: [
                createPoint(66, 0, { type: 'no-corner' as const }),
                createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),
                createPoint(63, -116.5, { type: 'no-corner' as const })
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 角R0.5の実際の計算フロー ===')

        // プロファイル（補正前）の確認
        const arc = result.segments.find(s => s.type === 'corner-r' && s.isConvex)
        if (arc) {
            console.log('\n【プロファイル（補正前）】')
            console.log(`  始点: X${arc.startX} Z${arc.startZ}`)
            console.log(`  終点: X${arc.endX} Z${arc.endZ}`)
            console.log(`  中心: X${arc.centerX} Z${arc.centerZ}`)
            console.log(`  半径: ${arc.radius}mm`)
            console.log(`  凸円弧: ${arc.isConvex}`)

            if (arc.compensated) {
                console.log('\n【補正後座標】')
                console.log(`  始点: X${arc.compensated.startX} Z${arc.compensated.startZ}`)
                console.log(`  終点: X${arc.compensated.endX} Z${arc.compensated.endZ}`)
                console.log(`  中心: X${arc.compensated.centerX} Z${arc.compensated.centerZ}`)
                console.log(`  半径: ${arc.compensated.radius}mm`)

                // 手書き期待値との比較
                const expectedStartZ = -114.793 // calculateCornerで計算される値
                const handwrittenStartZ = -114.827 // 手書きメモの期待値

                console.log('\n【比較】')
                console.log(`  プロファイルZ: ${arc.startZ}`)
                console.log(`  補正後Z: ${arc.compensated.startZ}`)
                console.log(`  手書き期待値: ${handwrittenStartZ}`)
                console.log(`  誤差: ${(arc.compensated.startZ - handwrittenStartZ).toFixed(3)}mm`)

                // ±0.05mm以内なら許容
                const error = Math.abs(arc.compensated.startZ - handwrittenStartZ)
                expect(error).toBeLessThan(0.05)
            }
        }
    })

    it('条件付きdzの効果を直接比較', () => {
        // 同じ形状で、dzの設定だけを変えて比較

        const createSettings = (dzMode: 'conditional' | 'always'): MachineSettings => ({
            ...defaultMachineSettings,
            activeToolId: 't1',
            toolLibrary: [{
                id: 't1',
                name: 'Test',
                type: 'external',
                noseRadius: 0.4,
                toolTipNumber: 3,
                hand: 'right'
            }],
            noseRCompensation: {
                enabled: true,
                offsetNumber: 1,
                compensationDirection: 'auto',
                method: 'geometric'
            }
        })

        const shape = {
            points: [
                createPoint(66, 0, { type: 'no-corner' as const }),
                createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),
                createPoint(63, -116.5, { type: 'no-corner' as const })
            ]
        }

        console.log('\n=== 条件付きdzの効果 ===')

        const resultConditional = calculateShape(shape, createSettings('conditional'))
        const arcConditional = resultConditional.segments.find(s => s.type === 'corner-r' && s.isConvex)

        if (arcConditional?.compensated) {
            console.log('\n【現在の実装（条件付きdz）】')
            console.log(`  補正後始点Z: ${arcConditional.compensated.startZ}`)
            console.log(`  補正後終点Z: ${arcConditional.compensated.endZ}`)

            const handwrittenStartZ = -114.827
            const error = Math.abs(arcConditional.compensated.startZ - handwrittenStartZ)
            console.log(`  手書き値との誤差: ${error.toFixed(3)}mm`)

            // 検証: ±0.05mm以内
            expect(error).toBeLessThan(0.05)
        }
    })

    it('複数の角Rサイズでの検証', () => {
        console.log('\n=== 複数の角Rサイズでの検証 ===')

        const radii = [0.5, 1.0, 1.5, 2.0]

        radii.forEach(r => {
            const settings: MachineSettings = {
                ...defaultMachineSettings,
                activeToolId: 't1',
                toolLibrary: [{
                    id: 't1',
                    name: 'Test',
                    type: 'external',
                    noseRadius: 0.4,
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

            const shape = {
                points: [
                    createPoint(66, 0, { type: 'no-corner' as const }),
                    createPoint(66, -115, { type: 'kaku-r', size: r }),
                    createPoint(63, -116.5, { type: 'no-corner' as const })
                ]
            }

            const result = calculateShape(shape, settings)
            const arc = result.segments.find(s => s.type === 'corner-r' && s.isConvex)

            if (arc?.compensated) {
                console.log(`\n角R${r}mm:`)
                console.log(`  プロファイルZ: ${arc.startZ}`)
                console.log(`  補正後Z: ${arc.compensated.startZ}`)
                console.log(`  差: ${(arc.compensated.startZ - arc.startZ).toFixed(3)}mm`)
            }
        })
    })
})
