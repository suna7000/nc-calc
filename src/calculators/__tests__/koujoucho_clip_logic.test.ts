import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { type MachineSettings } from '../../models/settings'

describe('Step R Intersection Logic (Correct Geometry)', () => {
    // 検証目標:
    // 「図面指示が接点Z50なら、本来の仮想コーナーは Z55 (50+R) である」
    // 「Z55を入力したとき、段差(X100)との交点(Z53)で正しくRが止まるか」
    // これにより、ユーザーは「仮想コーナー」を入力するだけで済む（物理的に正しい）。

    const settings: MachineSettings = {
        toolPost: 'rear',
        cuttingDirection: '-z',
        activeToolId: 't01',
        toolLibrary: [{
            id: 't01', name: 'Test', noseRadius: 0.8, toolTipNumber: 3, type: 'external', hand: 'right'
        }],
        noseRCompensation: { enabled: true, method: 'geometric', offsetNumber: 1, compensationDirection: 'auto' }
    }

    it('Clips R at intersection when Virtual Corner (Z55) is input', () => {
        // 目標: 始点Z50, 終点Z53 (交点)
        // 入力: 仮想コーナーZ = 55.0 (R始点Z50 + R5.0)

        const result = calculateShape({
            points: [
                { id: '1', x: 98, z: 0, corner: { type: 'none', size: 0 }, type: 'line' },
                { id: '2', x: 98, z: 55.0, corner: { type: 'sumi-r', size: 5.0 }, type: 'line' }, // Virtual Corner Input
                { id: '3', x: 100, z: 55.0, corner: { type: 'none', size: 0 }, type: 'line' }     // Step Wall
            ]
        } as any, settings)

        // R5セグメント
        const arc = result.segments.find(s => s.type === 'corner-r' && s.radius === 5.0)
        expect(arc).toBeDefined()
        if (!arc) return

        console.log(`Virtual Corner Input Result: StartZ=${arc.startZ}, EndZ=${arc.endZ}`)

        // 期待値
        // Start: 55.0 - tDist_in. 
        // 通常計算なら tDist_in = R = 5.0. -> Start Z50.0.
        expect(arc.startZ).toBeCloseTo(50.0, 3)
        // (tDist_in が自動縮小されていなければ5.0のはず)

        // End: 交点 Z53.0
        // もし "Step R" ロジック（交点計算）が効いていれば、Z53で止まるはず。
        // （以前のR0.8監査時の「強制展開」だと Z55まで行ってしまう可能性がある）
        expect(arc.endZ).toBeCloseTo(53.0, 3)
    })
})
