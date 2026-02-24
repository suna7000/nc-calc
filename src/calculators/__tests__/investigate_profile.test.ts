import { describe, it } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

describe('プロファイル生成の詳細調査', () => {
    it('角R0.5のentry座標がどう計算されているか', () => {
        const settings: MachineSettings = {
            ...defaultMachineSettings,
            noseRCompensation: {
                enabled: false, // No compensation
                offsetNumber: 1,
                compensationDirection: 'auto',
                method: 'geometric'
            }
        }

        const shape = {
            points: [
                createPoint(66, 0, noCorner()),
                createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),  // 角R0.5
                createPoint(63, -116.5, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n=== calculateCorner計算の逆算 ===\n')
        console.log('入力点:')
        console.log('  P1: X66 Z0')
        console.log('  P2: X66 Z-115 (角R0.5)')
        console.log('  P3: X63 Z-116.5')

        console.log('\n幾何計算:')
        console.log('  u1 (P2→P1): (0, 1) 上向き')
        console.log('  u2 (P2→P3): (-1.5, -1.5)/2.121 = (-0.707, -0.707)')
        console.log('  内積: 0*(- 0.707) + 1*(-0.707) = -0.707')
        console.log('  角度: acos(-0.707) = 135°')
        console.log('  半角: 67.5°')
        console.log('  tDist = 0.5 / tan(67.5°) = 0.5 / 2.414 = 0.207mm')
        console.log('  Entry Z = P2.z + u1.z * tDist = -115 + 1 * 0.207 = -114.793 ✓')

        console.log('\nプロファイル出力:')
        const arc = result.segments.find(s => s.type === 'corner-r')
        if (arc) {
            console.log(`  Arc始点: X${arc.startX} Z${arc.startZ}`)
            console.log(`  Arc中心: X${arc.centerX} Z${arc.centerZ}`)
        }

        console.log('\n【結論】')
        console.log('プロファイルZ = -114.793 は calculateCorner が幾何的に正しく計算した値')
        console.log('期待補正値 = -114.827 (0.034mm下)')
        console.log('')
        console.log('0.034mmの由来は？')
        console.log('  - ノーズR 0.4mmに対して非常に小さい')
        console.log('  - 手書き計算方法が異なる？')
        console.log('  - または、プロファイル計算自体が微妙に異なる？')
    })
})
