import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('正しい比較：手書きメモ vs アプリ', () => {
    it('NC座標の正確な比較', () => {
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
                createPoint(66, 0, noCorner()),
                createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),
                createPoint(63, -116.5, { type: 'sumi-r', size: 1 }),
                createPoint(63, -169, { type: 'sumi-r', size: 2 }),
                createPoint(70, -184, { type: 'kaku-r', size: 2 }),
                createPoint(70, -200, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== 全セグメント出力 ===\n')
        result.segments.forEach((seg, i) => {
            console.log(`Seg${i}: ${seg.type}`)
            if (seg.compensated) {
                console.log(`  補正始点: X${seg.compensated.startX.toFixed(3)} Z${seg.compensated.startZ.toFixed(3)}`)
                console.log(`  補正終点: X${seg.compensated.endX.toFixed(3)} Z${seg.compensated.endZ.toFixed(3)}`)
            }
        })

        console.log('\n=== NC座標の詳細比較 ===\n')

        // 角R0.5の前の直線セグメント
        const lineBefore = result.segments.find(s => s.type === 'line' && s.endZ === -115)
        if (lineBefore?.compensated) {
            console.log('【角R0.5の前の直線】')
            console.log(`  補正終点: X${lineBefore.compensated.endX.toFixed(3)} Z${lineBefore.compensated.endZ.toFixed(3)}`)
        }

        // 角R0.5 (arc 1)
        const arc1 = result.segments.find(s => s.type === 'corner-r' && s.isConvex && s.radius === 0.5)
        if (arc1?.compensated) {
            console.log('【角R0.5】')
            console.log('  始点: 期待 X66.000 Z-114.827')
            console.log(`       実測 X${arc1.compensated.startX.toFixed(3)} Z${arc1.compensated.startZ.toFixed(3)}`)
            console.log(`       誤差 ΔZ=${(arc1.compensated.startZ - (-114.827)).toFixed(3)}mm ❌`)
            
            console.log('  終点: 期待 X65.472 Z-115.463')
            console.log(`       実測 X${arc1.compensated.endX.toFixed(3)} Z${arc1.compensated.endZ.toFixed(3)}`)
            console.log(`       誤差 ΔX=${(arc1.compensated.endX - 65.472).toFixed(3)}mm ΔZ=${(arc1.compensated.endZ - (-115.463)).toFixed(3)}mm ❌`)
        }

        // 隅R1 (arc 2)
        const arc2 = result.segments.find(s => s.type === 'corner-r' && !s.isConvex && s.radius === 1)
        if (arc2?.compensated) {
            console.log('\n【隅R1】')
            console.log('  始点: 期待 X63.351 Z-116.925')
            console.log(`       実測 X${arc2.compensated.startX.toFixed(3)} Z${arc2.compensated.startZ.toFixed(3)}`)
            console.log(`       誤差 ΔX=${(arc2.compensated.startX - 63.351).toFixed(3)}mm ΔZ=${(arc2.compensated.startZ - (-116.925)).toFixed(3)}mm`)
            
            console.log('  終点: 期待 X63.000 Z-117.349')
            console.log(`       実測 X${arc2.compensated.endX.toFixed(3)} Z${arc2.compensated.endZ.toFixed(3)}`)
            console.log(`       誤差 ΔZ=${(arc2.compensated.endZ - (-117.349)).toFixed(3)}mm`)
        }

        // 隅R2 (arc 3)
        const arc3 = result.segments.find(s => s.type === 'corner-r' && !s.isConvex && s.radius === 2)
        if (arc3?.compensated) {
            console.log('\n【隅R2】')
            console.log('  始点: 期待 X63.000 Z-169.169')
            console.log(`       実測 X${arc3.compensated.startX.toFixed(3)} Z${arc3.compensated.startZ.toFixed(3)}`)
            console.log(`       誤差 ΔZ=${(arc3.compensated.startZ - (-169.169)).toFixed(3)}mm ✅`)
            
            console.log('  終点: 期待 X63.083 Z-169.532')
            console.log(`       実測 X${arc3.compensated.endX.toFixed(3)} Z${arc3.compensated.endZ.toFixed(3)}`)
            console.log(`       誤差 ΔX=${(arc3.compensated.endX - 63.083).toFixed(3)}mm ΔZ=${(arc3.compensated.endZ - (-169.532)).toFixed(3)}mm ✅`)
        }

        // 角R2 (arc 4)
        const arc4 = result.segments.filter(s => s.type === 'corner-r' && s.isConvex).find(s => s.radius === 2)
        if (arc4?.compensated) {
            console.log('\n【角R2】')
            console.log('  始点: 期待 X69.876 Z-184.085')
            console.log(`       実測 X${arc4.compensated.startX.toFixed(3)} Z${arc4.compensated.startZ.toFixed(3)}`)
            console.log(`       誤差 ΔX=${(arc4.compensated.startX - 69.876).toFixed(3)}mm ✅`)
            
            console.log('  終点: 期待 X70.000 Z-184.629')
            console.log(`       実測 X${arc4.compensated.endX.toFixed(3)} Z${arc4.compensated.endZ.toFixed(3)}`)
            console.log(`       誤差 ΔZ=${(arc4.compensated.endZ - (-184.629)).toFixed(3)}mm ✅`)
        }

        console.log('\n=== 問題まとめ ===')
        console.log('❌ 角R0.5: Z方向に約-0.366mm (≈ -noseR) の系統的誤差')
        console.log('❌ 隅R1: Z方向に約+0.035mm の誤差')
        console.log('✅ 隅R2: 誤差ほぼなし')
        console.log('✅ 角R2: 誤差ほぼなし')
    })
})
