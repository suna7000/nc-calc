import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings, type CompensationDirection } from '../../models/settings'

/**
 * NCプログラムに必要なポイント点を確認するテスト
 */
describe('NCプログラム必須ポイント確認', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        toolPost: 'front', // ブラウザのデフォルト
        activeToolId: 't1',
        toolLibrary: [{
            id: 't1',
            name: '外径仕上げ',
            type: 'external',
            noseRadius: 0.4,
            toolTipNumber: 3,
            hand: 'right'
        }],
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto' as CompensationDirection,
            method: 'geometric'
        },
    }

    it('全てのポイント点を確認', () => {
        const shape = {
            points: [
                createPoint(46.5, 0, noCorner()),              // P1: 始点
                createPoint(46.5, -101, { type: 'kaku-r', size: 0.5 }),  // P2: 角R0.5
                createPoint(42, -103.25, { type: 'sumi-r', size: 2 }),   // P3: 隅R2
                createPoint(42, -118.85, { type: 'sumi-r', size: 2 }),   // P4: 隅R2
                createPoint(45, -136, { type: 'kaku-r', size: 2 }),      // P5: 角R2
                createPoint(45, -150, noCorner())              // P6: 終点
            ]
        }

        const result = calculateShape(shape, settings)

        console.log('\n========================================')
        console.log('NCプログラムに必要なポイント点の確認')
        console.log('========================================\n')

        // 始点の確認
        const firstSeg = result.segments[0]
        console.log('【始点（加工開始位置）】')
        console.log(`  元座標: X${firstSeg.startX.toFixed(3)} Z${firstSeg.startZ.toFixed(3)}`)
        if (firstSeg.compensated?.startX !== undefined) {
            console.log(`  補正座標: X${firstSeg.compensated.startX.toFixed(3)} Z${firstSeg.compensated.startZ?.toFixed(3)}`)
        } else {
            console.log('  補正座標: ★未設定★')
        }

        console.log('\n【各セグメントの始点と終点】')
        result.segments.forEach((seg, i) => {
            console.log(`\nN${(i + 1) * 10} [${seg.type}]:`)
            console.log(`  始点(元): X${seg.startX.toFixed(3)} Z${seg.startZ.toFixed(3)}`)
            console.log(`  終点(元): X${seg.endX.toFixed(3)} Z${seg.endZ.toFixed(3)}`)

            if (seg.compensated) {
                const cs = seg.compensated
                console.log(`  始点(補正): X${cs.startX?.toFixed(3) ?? '未設定'} Z${cs.startZ?.toFixed(3) ?? '未設定'}`)
                console.log(`  終点(補正): X${cs.endX?.toFixed(3) ?? '未設定'} Z${cs.endZ?.toFixed(3) ?? '未設定'}`)
            }
        })

        console.log('\n【NCプログラムで出力すべきポイント】')
        console.log('1. G00 早送り: 始点近くへ位置決め')
        console.log('2. G42/G41 補正開始: 補正開始と同時に始点へ移動')
        console.log('3. 各セグメント終点: 形状加工')
        console.log('4. G40 補正解除')

        // 始点の補正座標が存在するか確認
        expect(firstSeg.compensated).toBeDefined()
        console.log('\n✅ 始点の補正座標が存在することを確認')
    })
})
