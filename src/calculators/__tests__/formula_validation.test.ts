import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * 教科書式の数学的検証
 * 各角度での理論値と実装値を比較
 */
describe('教科書式の数学的検証', () => {
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

    it('垂直線（θ=0°）の検証', () => {
        // 垂直線: X100 Z0→-10
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(100, -10, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[0]
        const compZ = seg.compensated?.endZ ?? seg.endZ

        // 理論値計算
        const theta = 0
        const fz = 0.8 * (1 - Math.tan(theta / 2))
        const expectedZ = -10 - fz

        console.log('\n=== 垂直線（θ=0°）===')
        console.log(`理論 fz = R × (1 - tan(0°)) = ${fz.toFixed(3)}mm`)
        console.log(`期待値 Z = -10 - ${fz.toFixed(3)} = ${expectedZ.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)
        console.log(`誤差: ${(compZ - expectedZ).toFixed(6)}mm`)

        expect(compZ).toBeCloseTo(expectedZ, 3)
    })

    it('30°下りテーパーの検証（X減少）', () => {
        // 30°テーパー: X60 Z-45.653→X59.6 Z-46
        // 注: X座標が60→59.6と減少しているため、これは下りテーパー
        const shape = {
            points: [
                createPoint(60, -45.653, noCorner()),
                createPoint(59.6, -46, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[0]
        const compX = seg.compensated?.endX ?? seg.endX
        const compZ = seg.compensated?.endZ ?? seg.endZ

        // 理論値計算
        const theta = 30 * Math.PI / 180
        const phi = Math.PI / 2 - theta
        const fz = 0.8 * (1 - Math.tan(theta / 2))
        const fx = 2 * 0.8 * (1 - Math.tan(phi / 2))

        // 下りテーパー（dxが負、X減少）なので X + fx
        const expectedX = 59.6 + fx
        const expectedZ = -46 - fz

        console.log('\n=== 30°下りテーパー（X減少）===')
        console.log(`θ = 30°, φ = 60°`)
        console.log(`理論 fz = R × (1 - tan(15°)) = ${fz.toFixed(3)}mm`)
        console.log(`理論 fx = 2R × (1 - tan(30°)) = ${fx.toFixed(3)}mm`)
        console.log(`期待値 X = 59.6 + ${fx.toFixed(3)} = ${expectedX.toFixed(3)}（下りなのでX+fx）`)
        console.log(`期待値 Z = -46 - ${fz.toFixed(3)} = ${expectedZ.toFixed(3)}`)
        console.log(`実装値 X = ${compX.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)
        console.log(`誤差 X: ${(compX - expectedX).toFixed(6)}mm`)
        console.log(`誤差 Z: ${(compZ - expectedZ).toFixed(6)}mm`)

        expect(compZ).toBeCloseTo(expectedZ, 2)  // 0.01mm精度
        expect(compX).toBeCloseTo(expectedX, 2)  // 0.01mm精度
    })

    it('45°上りテーパーの検証（X増加）', () => {
        // 45°テーパー: tan(45°) = 1.0なので、ΔX半径 = ΔZ
        // X100 Z0→X120 Z-10 (ΔX直径20, ΔX半径10, ΔZ10)
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(120, -10, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[0]
        const compX = seg.compensated?.endX ?? seg.endX
        const compZ = seg.compensated?.endZ ?? seg.endZ

        // 理論値計算
        const theta = 45 * Math.PI / 180
        const phi = Math.PI / 2 - theta
        const fz = 0.8 * (1 - Math.tan(theta / 2))
        const fx = 2 * 0.8 * (1 - Math.tan(phi / 2))

        // 上りテーパー（dxが正、X増加）なので X - fx
        const expectedX = 120 - fx
        const expectedZ = -10 - fz

        console.log('\n=== 45°上りテーパー（X増加）===')
        console.log(`θ = 45°, φ = 45°`)
        console.log(`理論 fz = R × (1 - tan(22.5°)) = ${fz.toFixed(3)}mm`)
        console.log(`理論 fx = 2R × (1 - tan(22.5°)) = ${fx.toFixed(3)}mm`)
        console.log(`期待値 X = 120 - ${fx.toFixed(3)} = ${expectedX.toFixed(3)}（上りなのでX-fx）`)
        console.log(`期待値 Z = -10 - ${fz.toFixed(3)} = ${expectedZ.toFixed(3)}`)
        console.log(`実装値 X = ${compX.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)
        console.log(`誤差 X: ${(compX - expectedX).toFixed(6)}mm`)
        console.log(`誤差 Z: ${(compZ - expectedZ).toFixed(6)}mm`)

        expect(compZ).toBeCloseTo(expectedZ, 2)  // 0.01mm精度
        expect(compX).toBeCloseTo(expectedX, 2)  // 0.01mm精度
    })

    it('60°テーパーの検証', () => {
        // 60°テーパー: tan(60°) = 1.732
        // ΔX = 10（半径5）, ΔZ = 5/tan(60°) = 2.887
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(110, -2.887, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[0]
        const compX = seg.compensated?.endX ?? seg.endX
        const compZ = seg.compensated?.endZ ?? seg.endZ

        // 理論値計算
        const theta = 60 * Math.PI / 180
        const phi = Math.PI / 2 - theta
        const fz = 0.8 * (1 - Math.tan(theta / 2))
        const fx = 2 * 0.8 * (1 - Math.tan(phi / 2))

        const expectedX = 110 - fx
        const expectedZ = -2.887 - fz

        console.log('\n=== 60°テーパー ===')
        console.log(`θ = 60°, φ = 30°`)
        console.log(`理論 fz = R × (1 - tan(30°)) = ${fz.toFixed(3)}mm`)
        console.log(`理論 fx = 2R × (1 - tan(15°)) = ${fx.toFixed(3)}mm`)
        console.log(`期待値 X = 110 - ${fx.toFixed(3)} = ${expectedX.toFixed(3)}`)
        console.log(`期待値 Z = -2.887 - ${fz.toFixed(3)} = ${expectedZ.toFixed(3)}`)
        console.log(`実装値 X = ${compX.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)
        console.log(`誤差 X: ${(compX - expectedX).toFixed(6)}mm`)
        console.log(`誤差 Z: ${(compZ - expectedZ).toFixed(6)}mm`)

        expect(compZ).toBeCloseTo(expectedZ, 2)  // 0.01mm精度
        expect(compX).toBeCloseTo(expectedX, 2)  // 0.01mm精度
    })

    it('下りテーパーの検証（-Z方向、X減少）', () => {
        // 下りテーパー30°: X100 Z0→X99.6 Z-0.347
        const shape = {
            points: [
                createPoint(100, 0, noCorner()),
                createPoint(99.6, -0.347, noCorner())
            ]
        }

        const result = calculateShape(shape, settings)
        const seg = result.segments[0]
        const compX = seg.compensated?.endX ?? seg.endX
        const compZ = seg.compensated?.endZ ?? seg.endZ

        // 理論値計算
        const theta = 30 * Math.PI / 180
        const phi = Math.PI / 2 - theta
        const fz = 0.8 * (1 - Math.tan(theta / 2))
        const fx = 2 * 0.8 * (1 - Math.tan(phi / 2))

        // 下りテーパー（dxが負）なので X + fx
        const expectedX = 99.6 + fx
        const expectedZ = -0.347 - fz

        console.log('\n=== 下りテーパー30° ===')
        console.log(`下りテーパー（X減少）`)
        console.log(`理論 fz = ${fz.toFixed(3)}mm`)
        console.log(`理論 fx = ${fx.toFixed(3)}mm`)
        console.log(`期待値 X = 99.6 + ${fx.toFixed(3)} = ${expectedX.toFixed(3)}（下りなのでX+fx）`)
        console.log(`期待値 Z = -0.347 - ${fz.toFixed(3)} = ${expectedZ.toFixed(3)}`)
        console.log(`実装値 X = ${compX.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)
        console.log(`誤差 X: ${(compX - expectedX).toFixed(6)}mm`)
        console.log(`誤差 Z: ${(compZ - expectedZ).toFixed(6)}mm`)

        expect(compZ).toBeCloseTo(expectedZ, 2)  // 0.01mm精度
        expect(compX).toBeCloseTo(expectedX, 2)  // 0.01mm精度
    })
})
