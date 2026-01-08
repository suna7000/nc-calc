/**
 * ノーズR補正計算のユニットテスト
 * 
 * 教科書の計算式:
 *   fx = 2R(1 - tan(φ/2))   ただし φ = 90° - θ
 *   fz = R(1 - tan(θ/2))
 * 
 * テストケースは手計算で検証した期待値を使用
 */

import { describe, it, expect } from 'vitest'
import { calculateSmidManualShifts } from './noseRCompensation'

// 幾何学的アプローチの関数をインポート
// shape.ts内の関数はexportされていないので、個別にテスト用関数を作成

/**
 * 幾何学的アプローチの計算（shape.tsのcalculateLineNoseROffset相当）
 */
function calculateGeometricOffset(
    angleDeg: number,
    noseR: number,
    toolTipNumber: number = 3
): { fx: number, fz: number } {
    if (noseR <= 0) return { fx: 0, fz: 0 }

    const R = noseR
    const theta = angleDeg * (Math.PI / 180)

    // 仮想刃先点の位置（チップ番号による）
    let virtualTipX = 0, virtualTipZ = 0
    switch (toolTipNumber) {
        case 1: virtualTipX = 0; virtualTipZ = -R; break
        case 2: virtualTipX = R; virtualTipZ = -R; break
        case 3: virtualTipX = R; virtualTipZ = 0; break
        case 4: virtualTipX = R; virtualTipZ = R; break
        case 5: virtualTipX = 0; virtualTipZ = R; break
        case 6: virtualTipX = -R; virtualTipZ = R; break
        case 7: virtualTipX = -R; virtualTipZ = 0; break
        case 8: virtualTipX = -R; virtualTipZ = -R; break
        default: virtualTipX = R; virtualTipZ = 0; break
    }

    // 接点位置
    const contactX = R * Math.sin(theta)
    const contactZ = -R * Math.cos(theta)

    // 補正量
    const fx = (contactX - virtualTipX) * 2
    const fz = contactZ - virtualTipZ

    return {
        fx: Math.round(fx * 1000) / 1000,
        fz: Math.round(fz * 1000) / 1000
    }
}

/**
 * 教科書の計算式（tan半角形式）
 * fx = 2R(1 - tan(φ/2))   ただし φ = 90° - θ
 * fz = R(1 - tan(θ/2))
 */
function calculateTextbookFormula(
    angleDeg: number,
    noseR: number
): { fx: number, fz: number } {
    if (noseR <= 0) return { fx: 0, fz: 0 }

    const R = noseR
    const theta = angleDeg * (Math.PI / 180)
    const phi = (Math.PI / 2) - theta

    const fx = 2 * R * (1 - Math.tan(phi / 2))
    const fz = R * (1 - Math.tan(theta / 2))

    return {
        fx: Math.round(fx * 1000) / 1000,
        fz: Math.round(fz * 1000) / 1000
    }
}

describe('ノーズR補正計算', () => {

    describe('Peter Smid方式 (calculateSmidManualShifts)', () => {
        it('θ=0°（Z軸に平行）のとき', () => {
            const result = calculateSmidManualShifts(0, 0.4)
            // Smid方式: θ=0° → compAngle = 45° → tan(45°) = 1
            // deltaZ = R * tan(45°) = 0.4
            // deltaX = 2R * (1 - tan(45°)*tan(0°)) = 2R * (1 - 0) = 0.8
            expect(result.deltaX).toBe(0.8)
            expect(result.deltaZ).toBe(0.4)
        })

        it('θ=30°のとき、ノーズR=0.4mmで計算', () => {
            const result = calculateSmidManualShifts(30, 0.4)
            console.log('Smid θ=30°, R=0.4:', result)
        })

        it('θ=45°のとき、ノーズR=0.8mmで計算', () => {
            const result = calculateSmidManualShifts(45, 0.8)
            console.log('Smid θ=45°, R=0.8:', result)
        })
    })

    describe('幾何学的アプローチ（参考用）', () => {
        it('θ=0°（Z軸に平行）のとき', () => {
            const result = calculateGeometricOffset(0, 0.4, 3)
            // 幾何学的アプローチは参考値（教科書と異なる）
            console.log('Geometric θ=0°, R=0.4:', result)
        })

        it('θ=90°（端面加工）のとき', () => {
            const result = calculateGeometricOffset(90, 0.4, 3)
            console.log('Geometric θ=90°, R=0.4:', result)
        })
    })

    describe('教科書の計算式', () => {
        it('θ=0°のとき、fx=0, fz=R', () => {
            const result = calculateTextbookFormula(0, 0.4)
            // θ=0° → φ=90° → tan(45°)=1 → fx = 2R(1-1) = 0
            // θ=0° → tan(0)=0 → fz = R(1-0) = R = 0.4
            expect(result.fx).toBeCloseTo(0, 2)
            expect(result.fz).toBeCloseTo(0.4, 2)
        })

        it('θ=30°, R=0.4mmのとき、教科書の計算式で計算', () => {
            const result = calculateTextbookFormula(30, 0.4)
            // tan(30°) = 0.5774
            // tan(15°) = 0.2679
            // φ = 60°, tan(30°) = 0.5774
            // fx = 2 * 0.4 * (1 - tan(30°)) = 0.8 * (1 - 0.5774) = 0.338
            // fz = 0.4 * (1 - tan(15°)) = 0.4 * (1 - 0.2679) = 0.293
            console.log('教科書 θ=30°, R=0.4:', result)
            expect(result.fx).toBeCloseTo(0.338, 2)
            expect(result.fz).toBeCloseTo(0.293, 2)
        })

        it('θ=45°, R=0.4mmのとき', () => {
            const result = calculateTextbookFormula(45, 0.4)
            // φ = 45°, tan(22.5°) = 0.4142
            // fx = 2 * 0.4 * (1 - 0.4142) = 0.469
            // θ/2 = 22.5°
            // fz = 0.4 * (1 - 0.4142) = 0.234
            console.log('教科書 θ=45°, R=0.4:', result)
            expect(result.fx).toBeCloseTo(0.469, 2)
            expect(result.fz).toBeCloseTo(0.234, 2)
        })
    })

    describe('3つの方式の比較', () => {
        const testCases = [
            { theta: 0, R: 0.4 },
            { theta: 15, R: 0.4 },
            { theta: 30, R: 0.4 },
            { theta: 45, R: 0.4 },
            { theta: 60, R: 0.4 },
            { theta: 90, R: 0.4 },
        ]

        testCases.forEach(({ theta, R }) => {
            it(`θ=${theta}°, R=${R}mmで3つの方式を比較`, () => {
                const smid = calculateSmidManualShifts(theta, R)
                const geometric = calculateGeometricOffset(theta, R, 3)
                const textbook = calculateTextbookFormula(theta, R)

                console.log(`θ=${theta}°, R=${R}mm:`)
                console.log(`  Smid:      fx=${smid.deltaX}, fz=${smid.deltaZ}`)
                console.log(`  Geometric: fx=${geometric.fx}, fz=${geometric.fz}`)
                console.log(`  Textbook:  fx=${textbook.fx}, fz=${textbook.fz}`)
            })
        })
    })
})
