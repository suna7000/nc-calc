import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

/**
 * 幾何学的オフセット交点法の検証
 * 各角度での法線垂直オフセット（単一セグメント）値と実装値を比較
 * 注: 接合点のあるプロファイルでは R/cos(θ/2) の交点法が使用される
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

        // 幾何学的交点法（単一セグメント→端点垂直オフセット）
        // 法線: n = (0.866, -0.499), 工具中心 = 端点 + R*n
        // プログラム = pToO(工具中心) = 工具中心 - (2R, R)
        const expectedX = 59.386  // 59.6 + 2*0.866*0.8 - 1.6
        const expectedZ = -47.199 // -46 + (-0.499)*0.8 - 0.8

        console.log('\n=== 30°下りテーパー（X減少）===')
        console.log(`実装値 X = ${compX.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)

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

        // 幾何学的交点法（単一セグメント→端点垂直オフセット）
        // 法線: n = (0.707, 0.707), 工具中心 = 端点 + R*n
        const expectedX = 119.531  // 120 + 2*0.707*0.8 - 1.6
        const expectedZ = -10.234  // -10 + 0.707*0.8 - 0.8

        console.log('\n=== 45°上りテーパー（X増加）===')
        console.log(`実装値 X = ${compX.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)

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

        // 幾何学的交点法（単一セグメント→端点垂直オフセット）
        // 法線: n = (0.500, 0.866), 工具中心 = 端点 + R*n
        const expectedX = 109.2   // 110 + 2*0.500*0.8 - 1.6
        const expectedZ = -2.994  // -2.887 + 0.866*0.8 - 0.8

        console.log('\n=== 60°テーパー ===')
        console.log(`実装値 X = ${compX.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)

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

        // 幾何学的交点法（単一セグメント→端点垂直オフセット）
        // 法線: n = (0.866, -0.499), 工具中心 = 端点 + R*n
        const expectedX = 99.386  // 99.6 + 2*0.866*0.8 - 1.6
        const expectedZ = -1.546  // -0.347 + (-0.499)*0.8 - 0.8

        console.log('\n=== 下りテーパー30° ===')
        console.log(`実装値 X = ${compX.toFixed(3)}`)
        console.log(`実装値 Z = ${compZ.toFixed(3)}`)

        expect(compZ).toBeCloseTo(expectedZ, 2)  // 0.01mm精度
        expect(compX).toBeCloseTo(expectedX, 2)  // 0.01mm精度
    })
})
