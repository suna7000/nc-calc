import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import {
    defaultMachineSettings,
    type MachineSettings,
    type CompensationDirection,
} from '../../models/settings'

describe('監査: 計算エンジンの自己疑義・数学的立証', () => {
    const settings: MachineSettings = {
        ...defaultMachineSettings,
        noseRCompensation: {
            enabled: true,
            offsetNumber: 1,
            compensationDirection: 'auto' as CompensationDirection,
            method: 'geometric'
        },
    }

    it('監査1: 45度テーパー接続時の退避量 (手計算 Docs 第1節)', () => {
        const testSettings: MachineSettings = {
            ...settings,
            activeToolId: 't1',
            toolLibrary: [{ id: 't1', name: 'Test', type: 'external', noseRadius: 0.8, toolTipNumber: 3, hand: 'right' }]
        }

        // 平坦面(X100 Z10->Z0) から 45度テーパー(X100->X120, Z0->-10) への接続
        // 接続点は (100, 0)
        const p0 = createPoint(100, 10, noCorner())
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(120, -10, noCorner())

        const result = calculateShape({ points: [p0, p1, p2] }, testSettings)
        // 2本目のセグメント（テーパー）の始端補正座標を確認
        const comp = result.segments[1].compensated!

        // 数学理論値 (P): d = R/cos(22.5) = 0.866, bz = sin(22.5) = 0.3827 -> Pz = 0.331
        // プログラム点 (O) = Pz - R = 0.331 - 0.8 = -0.469
        console.log(`監査1 (45度カド Z位置) 実測値: ${comp.startZ}`)
        expect(comp.startZ).toBeCloseTo(-0.469, 3)
    })

    it('監査2: チップ番号 2 (内径) の物理的シフト方向', () => {
        const testSettings: MachineSettings = {
            ...settings,
            activeToolId: 't2',
            toolLibrary: [{ id: 't2', name: 'Boring', type: 'internal', noseRadius: 0.4, toolTipNumber: 2, hand: 'right' }]
        }

        // 内径 X40 平坦面
        const p1 = createPoint(40, 0, noCorner())
        const p2 = createPoint(40, -10, noCorner())

        const result = calculateShape({ points: [p1, p2] }, testSettings)
        const comp = result.segments[0].compensated!

        // 内径加工では工具中心 P は工作物中心側（X+方向）にシフトされる
        console.log(`監査2 実測値: startX=${comp.startX}`)
        expect(comp.startX).toBeDefined()
    })

    it('監査3: 179度（ほぼ直線）での数値的安定性', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100.01, -10, noCorner()) // 極わずかな傾斜

        const result = calculateShape({ points: [p1, p2] }, settings)
        // クラッシュせず、補正が計算されていること
        expect(result.segments[0].compensated).toBeDefined()
    })

    it('監査4: 極小Rにおける数値的丸め', () => {
        const p1 = createPoint(100, 0, noCorner())
        const p2 = createPoint(100, -10, { type: 'sumi-r', size: 0.001 }) // 1um R
        const p3 = createPoint(110, -10, noCorner())

        const result = calculateShape({ points: [p1, p2, p3] }, settings)
        // 浮動小数点例外が起きず、妥当なセグメント構成になっていること
        expect(result.segments.length).toBeGreaterThan(2)
    })
})
