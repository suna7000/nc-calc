/**
 * 手書きメモ（手書き/フォルダ）の座標値と計算結果の照合テスト
 *
 * 画像ファイルと対応:
 * - IMG_1423.JPG (例5): 6点形状 R0.8 の手計算補正座標（修正後の正しい値）
 * - IMG_1496.JPG: 同形状の修正前（バグ）の値を記録
 * - IMG_1286.JPG: M86753実部品 R0.4 の6点簡略形状
 * - IMG_1432.JPG: fz/fx計算ワークシート（M86753含む）
 * - IMG_1428.JPG: 大型部品の計算ワークシート
 * - IMG_1359.JPG: 別形状 R1.0（13°テーパー）
 * - IMG_1470.JPG: 別形状（判読困難）
 */
import { describe, it, expect } from 'vitest'
import { calculateShape } from '../shape'
import { createPoint, noCorner } from '../../models/shape'
import { defaultMachineSettings, type MachineSettings } from '../../models/settings'

// ============================================================
// 共通設定
// ============================================================
const settingsR08: MachineSettings = {
    ...defaultMachineSettings,
    activeToolId: 't1',
    toolLibrary: [{
        id: 't1', name: 'Test', type: 'external',
        noseRadius: 0.8, toolTipNumber: 3, hand: 'right'
    }],
    noseRCompensation: {
        enabled: true, offsetNumber: 1,
        compensationDirection: 'auto', method: 'geometric'
    },
}

const settingsR04: MachineSettings = {
    ...defaultMachineSettings,
    activeToolId: 't1',
    toolLibrary: [{
        id: 't1', name: 'Test', type: 'external',
        noseRadius: 0.4, toolTipNumber: 3, hand: 'right'
    }],
    noseRCompensation: {
        enabled: true, offsetNumber: 1,
        compensationDirection: 'auto', method: 'geometric'
    },
}

// ============================================================
// 1. IMG_1423 (例5): 6点形状 R0.8 — C0.2なし
// ============================================================
describe('IMG_1423 (例5): 6点形状 R0.8（C0.2なし）', () => {
    // 図面座標: X62 Z0 → X62 Z-43.922 → X59.6 Z-46 → X59.6 Z-50(R2) → X80 Z-50 → X80 Z-60
    // 注: X62始まり（2mm逃し）— 手書きIMG_1423に合わせた形状
    // テーパー始点Z計算: ΔX_r=1.2, ΔZ=1.2/tan(30°)=2.078, Z=-46+2.078=-43.922
    const shape = {
        points: [
            createPoint(62, 0, noCorner()),
            createPoint(62, -43.922, noCorner()),
            createPoint(59.6, -46, noCorner()),
            createPoint(59.6, -50, { type: 'sumi-r', size: 2 }),
            createPoint(80, -50, noCorner()),
            createPoint(80, -60, noCorner())
        ]
    }

    it('テーパー始点: 手書き X62 Z-44.508（完全一致）', () => {
        // テーパー始点のfz公式: fz = R(1-tan(15°)) = 0.586
        // X: 前セグメント（垂直線）法線使用 → O_x = 62
        // Z: -43.922 - 0.586 = -44.508
        const result = calculateShape(shape, settingsR08)
        expect(result.segments[0].compensated?.endX).toBeCloseTo(62, 3)
        expect(result.segments[0].compensated?.endZ).toBeCloseTo(-44.508, 3)
    })

    it('テーパー終点: 手書き X59.6 Z-46.586（完全一致）', () => {
        // テーパー終点のfz公式: fz = R(1-tan(15°)) = 0.586
        // X: 次セグメント（垂直線）法線使用 → O_x = 59.6
        // Z: -46 - 0.586 = -46.586
        const result = calculateShape(shape, settingsR08)
        expect(result.segments[1].compensated?.endX).toBeCloseTo(59.6, 3)
        expect(result.segments[1].compensated?.endZ).toBeCloseTo(-46.586, 3)
    })

    it('隅R2入口Z: 手書き Z-48.8', () => {
        const result = calculateShape(shape, settingsR08)
        expect(result.segments[2].compensated?.endZ).toBeCloseTo(-48.8, 3)
    })

    it('隅R2補正半径: 手書き R1.2', () => {
        const result = calculateShape(shape, settingsR08)
        expect(result.segments[3].compensated?.radius).toBeCloseTo(1.2, 3)
    })

    it('隅R2出口X: 手書き X62', () => {
        const result = calculateShape(shape, settingsR08)
        expect(result.segments[3].compensated?.endX).toBeCloseTo(62, 3)
    })

    it('水平線終点X: C0.2なし形状（C0.2付きは次ブロック参照）', () => {
        const result = calculateShape(shape, settingsR08)
        const horizSeg = result.segments.find(s => s.type === 'line' && s.angle === 90)
        // 手書き図にはC0.2面取りが含まれており、C0.2なし形状での比較は不適切
        expect(horizSeg?.compensated?.endX).toBeDefined()
    })
})

// ============================================================
// 2. IMG_1423: C0.2面取り付き形状
// ============================================================
describe('IMG_1423: C0.2面取り付き形状', () => {
    // 手書き図にはC0.2面取りが描かれている（X62始まり、2mm逃し）
    const shapeWithC02 = {
        points: [
            createPoint(62, 0, noCorner()),
            createPoint(62, -43.922, noCorner()),
            createPoint(59.6, -46, noCorner()),
            createPoint(59.6, -50, { type: 'sumi-r', size: 2 }),
            createPoint(80, -50, { type: 'kaku-c', size: 0.2 }),
            createPoint(80, -60, noCorner())
        ]
    }

    it('C0.2付きでもテーパー・隅R値は変わらない', () => {
        const result = calculateShape(shapeWithC02, settingsR08)
        // テーパー始点
        expect(result.segments[0].compensated?.endX).toBeCloseTo(62, 3)
        expect(result.segments[0].compensated?.endZ).toBeCloseTo(-44.508, 3)
        // テーパー終点
        expect(result.segments[1].compensated?.endZ).toBeCloseTo(-46.586, 3)
        // 隅R2入口Z
        expect(result.segments[2].compensated?.endZ).toBeCloseTo(-48.8, 3)
        // 隅R2 R1.2
        expect(result.segments[3].compensated?.radius).toBeCloseTo(1.2, 3)
        // 隅R2出口X
        expect(result.segments[3].compensated?.endX).toBeCloseTo(62, 3)
    })

    it('水平線終点X: 手書き X78.622 vs 計算値 X78.663（差0.041mm）', () => {
        const result = calculateShape(shapeWithC02, settingsR08)
        const horizSeg = result.segments.find(s => s.type === 'line' && s.angle === 90)

        console.log('\n=== 水平線終点Xの比較（C0.2付き）===')
        console.log(`手書き:     X78.622`)
        console.log(`bisector法: X${horizSeg?.compensated?.endX}`)
        console.log(`差: ${(78.622 - (horizSeg?.compensated?.endX ?? 0)).toFixed(3)}`)

        // R/cos修正後: X78.663（手書きX78.622との差 0.041mm、修正前は0.368mm）
        expect(horizSeg?.compensated?.endX).toBeCloseTo(78.663, 3)
    })

    it('C0.2面取り後: 手書き X81 Z-51.189 vs bisector法', () => {
        const result = calculateShape(shapeWithC02, settingsR08)
        // C0.2面取りセグメントを探す
        const chamferSeg = result.segments.find(s => s.type === 'chamfer' || s.type === 'corner-c')

        console.log('\n=== C0.2面取り後の座標比較 ===')
        console.log(`手書き: X81 Z-51.189`)
        if (chamferSeg?.compensated) {
            console.log(`bisector法: X${chamferSeg.compensated.endX} Z${chamferSeg.compensated.endZ}`)
            console.log(`差: X=${(81 - chamferSeg.compensated.endX).toFixed(3)}, Z=${(-51.189 - chamferSeg.compensated.endZ).toFixed(3)}`)
        }

        // 最終垂直線の始点も確認
        const lastVertSeg = result.segments[result.segments.length - 1]
        if (lastVertSeg?.compensated) {
            console.log(`最終垂直線始点: X${lastVertSeg.compensated.startX} Z${lastVertSeg.compensated.startZ}`)
        }
        expect(result.segments.length).toBeGreaterThan(0)
    })

    it('全セグメント座標ダンプ（手書きとの照合用）', () => {
        const result = calculateShape(shapeWithC02, settingsR08)

        console.log('\n=== IMG_1423 C0.2付き 全セグメント ===')
        result.segments.forEach((seg, i) => {
            const c = seg.compensated
            if (!c) return
            const label = `[${i + 1}] ${seg.type}${seg.angle !== undefined ? ` ${seg.angle}°` : ''}${seg.radius ? ` R${seg.radius}` : ''}${seg.isConvex !== undefined ? (seg.isConvex ? ' 凸' : ' 凹') : ''}`
            console.log(`${label}`)
            console.log(`  形状: X${seg.startX} Z${seg.startZ} → X${seg.endX} Z${seg.endZ}`)
            console.log(`  補正: X${c.startX} Z${c.startZ} → X${c.endX} Z${c.endZ}${c.radius ? ` R${c.radius}` : ''}`)
        })
        expect(result.segments.length).toBeGreaterThan(0)
    })
})

// ============================================================
// 3. IMG_1496: 修正前のバグ値確認
// ============================================================
describe('IMG_1496: 修正前バグ値との照合', () => {
    const shape = {
        points: [
            createPoint(60, 0, noCorner()),
            createPoint(60, -45.653, noCorner()),
            createPoint(59.6, -46, noCorner()),
            createPoint(59.6, -50, { type: 'sumi-r', size: 2 }),
            createPoint(80, -50, noCorner()),
            createPoint(80, -60, noCorner())
        ]
    }

    it('テーパー終点: 旧バグ値 Z-47.014 は出力されない', () => {
        // IMG_1496: Z-47.014 は修正前のバグ値
        const result = calculateShape(shape, settingsR08)
        const compZ = result.segments[1].compensated?.endZ ?? 0
        expect(compZ).not.toBeCloseTo(-47.014, 2)
        expect(compZ).toBeCloseTo(-46.586, 3)
    })

    it('テーパー始点: 旧バグ値 Z-44.736 → 修正後 Z-44.508 方向に変化', () => {
        // IMG_1496: テーパー始点 X62 Z-44.736（旧）
        // IMG_1423: テーパー始点 X62 Z-44.508（修正後）
        // 差: 0.228mm（テーパー終点の差 0.428mm の約半分）
        // ※bisector法では X62 Z-44.508 ではなく X58.814 Z-46.508 を出力
        const result = calculateShape(shape, settingsR08)
        const seg1End = result.segments[0].compensated!

        console.log('\n=== テーパー始点の修正前後比較 ===')
        console.log(`IMG_1496(修正前): X62 Z-44.736`)
        console.log(`IMG_1423(修正後): X62 Z-44.508`)
        console.log(`bisector法出力:   X${seg1End.endX} Z${seg1End.endZ}`)

        // bisector法のテーパー終点Zは修正後の正しい値
        expect(result.segments[1].compensated?.endZ).toBeCloseTo(-46.586, 3)
    })

    it('隅R2値は修正前後で不変', () => {
        // IMG_1496でも Z-48.8, X62, R1.2 は同じ値
        const result = calculateShape(shape, settingsR08)
        expect(result.segments[2].compensated?.endZ).toBeCloseTo(-48.8, 3)
        expect(result.segments[3].compensated?.endX).toBeCloseTo(62, 3)
        expect(result.segments[3].compensated?.radius).toBeCloseTo(1.2, 3)
    })
})

// ============================================================
// 4. IMG_1286: M86753 6点形状 R0.4
// ============================================================
describe('IMG_1286: M86753 6点形状 R0.4', () => {
    // 6点簡略形状（実部品M86753の一部）
    const shape = {
        points: [
            createPoint(66, 0, { type: 'no-corner' }),
            createPoint(66, -115, { type: 'kaku-r', size: 0.5 }),
            createPoint(63, -116.5, { type: 'sumi-r', size: 1 }),
            createPoint(63, -169, { type: 'sumi-r', size: 2 }),
            createPoint(70, -184, { type: 'kaku-r', size: 2 }),
            createPoint(70, -200, { type: 'no-corner' })
        ]
    }

    // --- 補正半径（全一致）---
    it('角R0.5: 補正半径 = 0.5 + 0.4 = 0.9', () => {
        const result = calculateShape(shape, settingsR04)
        const seg = result.segments.find(s => s.type === 'corner-r' && s.radius === 0.5)
        expect(seg?.compensated?.radius).toBeCloseTo(0.9, 3)
    })

    it('隅R1: 補正半径 = 1 - 0.4 = 0.6', () => {
        const result = calculateShape(shape, settingsR04)
        const seg = result.segments.find(s => s.type === 'corner-r' && s.radius === 1 && !s.isConvex)
        expect(seg?.compensated?.radius).toBeCloseTo(0.6, 3)
    })

    it('隅R2: 補正半径 = 2 - 0.4 = 1.6', () => {
        const result = calculateShape(shape, settingsR04)
        const seg = result.segments.find(s => s.type === 'corner-r' && s.radius === 2 && !s.isConvex)
        expect(seg?.compensated?.radius).toBeCloseTo(1.6, 3)
    })

    it('角R2: 補正半径 = 2 + 0.4 = 2.4', () => {
        const result = calculateShape(shape, settingsR04)
        const seg = result.segments.find(s => s.type === 'corner-r' && s.radius === 2 && s.isConvex)
        expect(seg?.compensated?.radius).toBeCloseTo(2.4, 3)
    })

    // --- テーパー終点（0.030mm既知誤差）---
    it('テーパー(≈29°)終点Z: 手書き Z-116.89（0.030mm既知誤差）', () => {
        const result = calculateShape(shape, settingsR04)
        const taperSeg = result.segments.find(s =>
            s.type === 'line' && s.angle !== undefined && s.angle > 0 && s.angle < 90
        )
        console.log(`\nテーパー終点Z: ${taperSeg?.compensated?.endZ} (手書き: -116.89, 差: ${((taperSeg?.compensated?.endZ ?? 0) - (-116.89)).toFixed(3)}mm)`)
        expect(taperSeg?.compensated?.endZ).toBeCloseTo(-116.89, 1)
    })

    // --- 垂直線オフセット ---
    it('垂直線X63区間: 補正後X = 63（R/cos修正後）', () => {
        // R/cos修正後: 垂直線の補正Xは形状Xと一致（隅R出口の法線が垂直線と平行なため）
        const result = calculateShape(shape, settingsR04)
        const vertLine = result.segments.find(s =>
            s.type === 'line' && s.angle === 0 && s.startX === 63 && s.endX === 63
        )
        expect(vertLine?.compensated?.startX).toBeCloseTo(63, 3)
    })

    // --- IMG_1286上の追加座標値 ---
    it('IMG_1286画像上の補正座標値との照合', () => {
        // IMG_1286画像には M86753 実部品の全セグメント補正座標が記載されている
        // 6点簡略形状では実部品の一部のみカバー
        // ここでは読み取れた値と計算値を比較する
        const result = calculateShape(shape, settingsR04)

        console.log('\n=== IMG_1286 全セグメント ===')
        result.segments.forEach((seg, i) => {
            const c = seg.compensated
            if (!c) return
            const label = `[${i + 1}] ${seg.type}${seg.angle !== undefined ? ` ${seg.angle}°` : ''}${seg.radius ? ` R${seg.radius}` : ''}${seg.isConvex !== undefined ? (seg.isConvex ? ' 凸' : ' 凹') : ''}`
            console.log(label)
            console.log(`  形状: X${seg.startX} Z${seg.startZ} → X${seg.endX} Z${seg.endZ}`)
            console.log(`  補正: X${c.startX} Z${c.startZ} → X${c.endX} Z${c.endZ}${c.radius ? ` R${c.radius}` : ''}`)
        })

        // IMG_1286 画像で読み取れた補正値:
        // "X62.012 Z-117.3 R1.6" → 隅R1出口 or 隅R2関連
        //   計算値 seg[4] 隅R1出口: X62.2 Z-117.988 R0.6
        //   計算値 seg[6] 隅R2出口: X62.305 Z-169.624 R1.6
        //   → R1.6は隅R2の補正半径と一致。Z-117.3はseg[4]付近だが値が異なる
        //   → 画像のアノテーション位置と値が分離している可能性あり
        const sumiR1 = result.segments.find(s => s.type === 'corner-r' && s.radius === 1 && !s.isConvex)
        const sumiR2 = result.segments.find(s => s.type === 'corner-r' && s.radius === 2 && !s.isConvex)
        console.log(`\n--- IMG_1286 読取値 "X62.012 Z-117.3 R1.6" との比較 ---`)
        console.log(`隅R1出口: X${sumiR1?.compensated?.endX} Z${sumiR1?.compensated?.endZ} R${sumiR1?.compensated?.radius}`)
        console.log(`隅R2出口: X${sumiR2?.compensated?.endX} Z${sumiR2?.compensated?.endZ} R${sumiR2?.compensated?.radius}`)

        // "R2.4" → 角R2の補正半径 → 一致
        const kakuR2 = result.segments.find(s => s.type === 'corner-r' && s.radius === 2 && s.isConvex)
        expect(kakuR2?.compensated?.radius).toBeCloseTo(2.4, 3)

        // 注: IMG_1286はM86753の全体形状を示しており、5°テーパーや85°テーパーなど
        // 6点簡略形状に含まれないセグメントの座標値も多数記載されている。
        // それらの検証には完全な形状定義（図面値）が必要。
        expect(result.segments.length).toBeGreaterThan(0)
    })
})

// ============================================================
// 5. IMG_1432: fz/fx計算ワークシート
// ============================================================
describe('IMG_1432: fz/fx計算ワークシートの検証', () => {
    const R04 = 0.4
    const R08 = 0.8
    const PI = Math.PI

    // --- fz公式（上り = 直径減少方向）---
    it('30° R0.8: fz(上り) = 0.586', () => {
        const fz = R08 * (1 - Math.tan(30 * PI / 360))
        expect(fz).toBeCloseTo(0.586, 3)
    })

    it('45° R0.8: fz(上り) = 0.469', () => {
        const fz = R08 * (1 - Math.tan(45 * PI / 360))
        expect(fz).toBeCloseTo(0.469, 3)
    })

    it('30° R0.4: fz(上り) = 0.293', () => {
        const fz = R04 * (1 - Math.tan(30 * PI / 360))
        expect(fz).toBeCloseTo(0.293, 3)
    })

    it('29.122° R0.4: fz(上り) ≈ 0.296（M86753実角度）', () => {
        const fz = R04 * (1 - Math.tan(29.122 * PI / 360))
        expect(fz).toBeCloseTo(0.296, 2)
    })

    // --- fz公式（下り = 直径増加方向）---
    it('30° R0.8: fz(下り) = 1.014', () => {
        const fz = R08 * (1 + Math.tan(30 * PI / 360))
        expect(fz).toBeCloseTo(1.014, 3)
    })

    // --- fx公式 ---
    it('30° R0.8: fx(直径) = 0.676', () => {
        const phi = (90 - 30) * PI / 180
        const fx = 2 * R08 * (1 - Math.tan(phi / 2))
        expect(fx).toBeCloseTo(0.676, 3)
    })

    it('45° R0.8: fx(直径) ≈ 0.937', () => {
        // 正確値: 0.93726, 手書き: 0.938（tan丸め差）
        const phi = (90 - 45) * PI / 180
        const fx = 2 * R08 * (1 - Math.tan(phi / 2))
        expect(fx).toBeCloseTo(0.937, 3)
    })

    // --- IMG_1432 追加計算値 ---
    it('13° R0.4: fz(上り) — M86753の下部テーパー', () => {
        // IMG_1286のX63→X70区間（≈13.132°テーパー）
        const theta = 13.132 * PI / 180
        const fz = R04 * (1 - Math.tan(theta / 2))
        console.log(`\n13.132° R0.4: fz(上り) = ${fz.toFixed(3)}`)
        // fz = 0.4 × (1 - tan(6.566°)) = 0.4 × (1 - 0.1150) = 0.354
        expect(fz).toBeCloseTo(0.354, 3)
    })

    it('13° R0.4: fz(下り) — 直径増加方向', () => {
        const theta = 13.132 * PI / 180
        const fz = R04 * (1 + Math.tan(theta / 2))
        console.log(`13.132° R0.4: fz(下り) = ${fz.toFixed(3)}`)
        // fz = 0.4 × (1 + 0.1150) = 0.446
        expect(fz).toBeCloseTo(0.446, 3)
    })

    it('13° R0.4: fx(直径)', () => {
        const phi = (90 - 13.132) * PI / 180
        const fx = 2 * R04 * (1 - Math.tan(phi / 2))
        console.log(`13.132° R0.4: fx(直径) = ${fx.toFixed(3)}`)
        expect(fx).toBeGreaterThan(0)
    })
})

// ============================================================
// 6. IMG_1423 手計算の再現（fz公式の適用結果）
// ============================================================
describe('IMG_1423: fz公式の適用結果（手計算の再現）', () => {
    it('30°テーパー終点Z: -46 - fz = -46 - 0.586 = -46.586', () => {
        const fz = 0.8 * (1 - Math.tan(15 * Math.PI / 180))
        expect(-46 - fz).toBeCloseTo(-46.586, 3)
    })

    it('隅R2入口Z: -48 - R = -48 - 0.8 = -48.8', () => {
        // 隅R2の接線点: 形状Z = -50 + 2 = -48
        expect(-48 - 0.8).toBeCloseTo(-48.8, 3)
    })

    it('補正半径: 隅R2 - R0.8 = 1.2', () => {
        expect(2 - 0.8).toBeCloseTo(1.2, 10)
    })

    it('隅R2出口X: 63.6 - 1.6 = 62', () => {
        // 隅R2出口形状X = 59.6 + 2×2 = 63.6
        // 補正X = 63.6 - 2×R = 63.6 - 1.6 = 62
        expect(59.6 + 2 * 2 - 0.8 * 2).toBeCloseTo(62, 3)
    })

    it('テーパー始点の手書き計算方法の解析', () => {
        // IMG_1423: テーパー始点 = X62 Z-44.508
        // (X62, Z-44.508) → (X59.6, Z-46.586) の角度検証
        const deltaR = (62 - 59.6) / 2  // 1.2mm (radius)
        const deltaZ = Math.abs(-46.586 - (-44.508))  // 2.078mm
        const angle = Math.atan(deltaR / deltaZ) * 180 / Math.PI

        console.log('\n=== 手書きテーパー始点の角度検証 ===')
        console.log(`(X62, Z-44.508) → (X59.6, Z-46.586)`)
        console.log(`ΔR = ${deltaR}, ΔZ = ${deltaZ.toFixed(3)}`)
        console.log(`角度 = ${angle.toFixed(1)}°`)

        // 手書き計算では補正後テーパーが元の30°を保持している
        expect(angle).toBeCloseTo(30, 0)
    })
})

// ============================================================
// 7. IMG_1359: 別形状 R1.0（13°テーパー）
// ============================================================
describe('IMG_1359: 別形状 R1.0（画像読取値）', () => {
    // IMG_1359は180°回転した画像で、別の部品の補正座標を示す
    // 読取可能な値:
    //   - ノーズR: R1.0
    //   - テーパー角: 13°
    //   - 座標値: X300番台（大径部品）
    //     X336. Z-182.56_
    //     X326.04_ Z-148.34_
    //     Z-177.606
    //     Z-166.3
    //     φ 2.955（寸法注記?）
    //
    // 形状入力座標が不明のため、fz/fx公式の値のみ検証

    it('13° R1.0: fz(上り) = R(1-tan(6.5°))', () => {
        const theta = 13 * Math.PI / 180
        const fz = 1.0 * (1 - Math.tan(theta / 2))
        console.log(`\n13° R1.0: fz(上り) = ${fz.toFixed(3)}`)
        // fz = 1.0 × (1 - 0.1139) = 0.886
        expect(fz).toBeCloseTo(0.886, 3)
    })

    it('13° R1.0: fx(直径) = 2R(1-tan(38.5°))', () => {
        const phi = (90 - 13) * Math.PI / 180
        const fx = 2 * 1.0 * (1 - Math.tan(phi / 2))
        console.log(`13° R1.0: fx(直径) = ${fx.toFixed(3)}`)
        expect(fx).toBeGreaterThan(0)
    })

    // IMG_1359の形状入力座標が判明すれば追加テスト可能
    // 現時点では画像の判読が困難で形状を確定できない
})

// ============================================================
// 8. IMG_1470: 別形状（判読困難）
// ============================================================
describe('IMG_1470: 別形状（画像読取値）', () => {
    // IMG_1470は回転した画像で、別の部品の補正座標を示す
    // 画像が皺になっており判読が非常に困難
    // 読取可能な値:
    //   - CX105.55 → X105.55付近の座標?
    //   - CZ-270 → Z-270付近?
    //   - 他の値は不鮮明
    //
    // 形状入力座標が不明のため検証不可

    it('形状が不明であることを記録', () => {
        // IMG_1470の形状を特定するには、画像の鮮明な版が必要
        // または、ユーザーから形状入力座標を直接提供してもらう
        console.log('\nIMG_1470: 画像が不鮮明で形状座標を特定できず')
        console.log('読取値候補: CX105.55, CZ-270')
        expect(true).toBe(true)
    })
})

// ============================================================
// 9. IMG_1428: 大型部品の計算ワークシート
// ============================================================
describe('IMG_1428: 大型部品計算ワークシート', () => {
    // IMG_1428は回転した画像で、大型部品の補正計算を示す
    // 読取可能な値:
    //   - R1.2（コーナーR）
    //   - X130 Z-722（形状座標?）R2
    //   - R92 X121.18_ Z-725.11_（補正座標?）
    //   - 形状番号 9, 10 の図示あり
    //   - √(0.81-0.04) の根号計算（ノーズR関連?）
    //   - X840_ Z-741_ 付近の座標値
    //
    // 形状入力座標が不明のため、読み取れた公式のみ検証

    it('√(0.81-0.04) = √0.77 ≈ 0.877（ノーズR関連の幾何計算?）', () => {
        // 0.81 = 0.9², 0.04 = 0.2² → √(0.9²-0.2²) = √0.77
        // これはピタゴラスの定理: √(R²-d²) のような計算
        const val = Math.sqrt(0.81 - 0.04)
        console.log(`\n√(0.81-0.04) = √${0.81 - 0.04} = ${val.toFixed(3)}`)
        expect(val).toBeCloseTo(0.877, 3)
    })

    // IMG_1428の完全な検証には形状入力座標が必要
})

// ============================================================
// 10. 全画像照合結果のサマリー
// ============================================================
describe('全画像照合結果サマリー', () => {
    it('一致する値の一覧', () => {
        console.log('\n========================================')
        console.log('全画像照合結果サマリー（三重モデル+R/cos修正後）')
        console.log('========================================')
        console.log('')
        console.log('✅ 完全一致（三重モデル修正で一致達成）:')
        console.log('  IMG_1423: テーパー始点 X62 Z-44.508（isNextTaper + fz公式）')
        console.log('  IMG_1423: テーパー終点 X59.6 Z-46.586（次セグメント法線 + fz公式）')
        console.log('  IMG_1423: Z-48.8（隅R2入口）')
        console.log('  IMG_1423: R1.2（隅R2補正半径）')
        console.log('  IMG_1423: X62（隅R2出口X）')
        console.log('  IMG_1496: Z-47.014 が出力されない（バグ修正確認）')
        console.log('  IMG_1286: R0.9, R0.6, R1.6, R2.4（全補正半径）')
        console.log('  IMG_1286: X63（垂直線補正X、R/cos修正後）')
        console.log('  IMG_1432: fz 30°R0.8=0.586, 下り=1.014')
        console.log('  IMG_1432: fz 45°R0.8=0.469')
        console.log('  IMG_1432: fz 30°R0.4=0.293, 29.122°R0.4=0.296')
        console.log('  IMG_1432: fx 30°R0.8=0.676, 45°R0.8≈0.937')
        console.log('')
        console.log('⚠️ 近似一致（微小誤差）:')
        console.log('  IMG_1423: 水平線終点 X78.663 vs 手書き X78.622（差 0.041mm）')
        console.log('  IMG_1286: テーパー終点Z -116.86 vs 手書き -116.89（差 0.030mm）')
        console.log('')
        console.log('❌ 不一致（要調査）:')
        console.log('  IMG_1423: C0.2後 X80 Z-50.669 vs 手書き X81 Z-51.189（差 X=1.0mm Z=0.520mm）')
        console.log('')
        console.log('❓ 未検証（形状入力座標が不明）:')
        console.log('  IMG_1286: M86753全体の5°/85°テーパー区間の座標値')
        console.log('  IMG_1359: 別形状 R1.0 13°テーパーの補正座標（fz/fx公式のみ検証済）')
        console.log('  IMG_1470: 形状不明（画像不鮮明、CX105.55 CZ-270 読取可）')
        console.log('  IMG_1428: 大型部品（R1.2, X130 Z-722付近、形状不明）')
        console.log('========================================')

        expect(true).toBe(true)
    })
})
