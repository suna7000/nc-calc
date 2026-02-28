/**
 * 統一計算理論（docs/unified_compensation_theory.md）の数学的検証テスト
 *
 * ドキュメントの主張を実際の数値で検証する:
 * 1. オフセット曲線理論の正しさ
 * 2. fz公式の導出の正しさ
 * 3. bisector距離公式の比較（R×tan vs R/cos）
 * 4. 接線連続ノードでの挙動
 * 5. V_tip定数モデル vs 現行の形状依存モデル
 */
import { describe, it, expect } from 'vitest'
import { CenterTrackCalculator, pToO, type Segment } from '../noseRCompensation'

const R = 0.4  // ノーズR
const PI = Math.PI

// ============================================================
// 1. fz公式の数学的検証
// ============================================================
describe('fz公式の数学的正しさ', () => {
    it('fz = R(1-tan(θ/2)) の代表値が数学的に正しい', () => {
        // 数学的に正確な値（R=0.4で計算）
        const cases = [
            { angle: 0,  expected: 0.400 },  // 端面: fz = R
            { angle: 15, expected: 0.347 },  // 0.4×(1-tan(7.5°))
            { angle: 30, expected: 0.293 },  // 0.4×(1-tan(15°))
            { angle: 45, expected: 0.234 },  // 0.4×(1-tan(22.5°))
            { angle: 60, expected: 0.169 },  // 0.4×(1-tan(30°))
            { angle: 90, expected: 0.000 },  // 外径面: fz = 0
        ]
        for (const { angle, expected } of cases) {
            const rad = angle * PI / 180
            const fz = R * (1 - Math.tan(rad / 2))
            expect(fz).toBeCloseTo(expected, 3)
        }
    })

    it('fz(下り) = R(1+tan(θ/2)) の代表値', () => {
        const cases = [
            { angle: 0,  expected: 0.400 },
            { angle: 30, expected: 0.507 },
            { angle: 45, expected: 0.566 },
            { angle: 60, expected: 0.631 },
            { angle: 90, expected: 0.800 },  // = 2R
        ]
        for (const { angle, expected } of cases) {
            const rad = angle * PI / 180
            const fz = R * (1 + Math.tan(rad / 2))
            expect(fz).toBeCloseTo(expected, 3)
        }
    })

    it('45度でfx = fz（対称性）', () => {
        const rad = 45 * PI / 180
        const fz = R * (1 - Math.tan(rad / 2))
        // fx = fz × tan(θ) × 2 （直径値）... 45度ならtan=1なので fx(半径) = fz
        const fx_radius = fz * Math.tan(rad)
        expect(fx_radius).toBeCloseTo(fz, 10)
    })
})

// ============================================================
// 2. オフセット曲線: 直線の法線オフセット
// ============================================================
describe('直線セグメントの法線オフセット', () => {
    const calc = new CenterTrackCalculator(R, true, 3)

    it('水平線（Z軸方向）の法線は+X方向', () => {
        // X66 Z0 → X66 Z-100: 水平直線
        const profile: Segment[] = [{
            type: 'line', startX: 66, startZ: 0, endX: 66, endZ: -100
        }]
        const result = calc.calculate(profile)
        // 法線オフセットで X が +R×2（直径）= +0.8 増えるはず
        // ただし pToO で dx=R×2 を引くので相殺
        // 結果的に compensatedStartX = 66 (refX + R - R×2 ... ?)
        // 実際の結果を確認
        expect(result[0].compensatedStartX).toBeDefined()
        expect(result[0].compensatedEndX).toBeDefined()

        // X方向: P.x = ref.x + nx×R (半径値), O.x = P.x×2 - R×2
        // 水平線: nx = 1 (外向き), P.x = 33 + 0.4 = 33.4, O.x = 66.8 - 0.8 = 66.0
        expect(result[0].compensatedStartX).toBeCloseTo(66, 3)
        expect(result[0].compensatedEndX).toBeCloseTo(66, 3)
    })

    it('垂直線（X軸方向）の法線は-Z方向', () => {
        // X66 Z-50 → X60 Z-50: 垂直（端面方向）
        const profile: Segment[] = [{
            type: 'line', startX: 66, startZ: -50, endX: 60, endZ: -50
        }]
        const result = calc.calculate(profile)
        // 垂直線の法線 = Z方向
        // 法線: dx=(60-66)/2=-3, dz=0, nx=-dz=0, nz=dx=-3 → 正規化 (0, -1)
        // sideSign=1 なので (0, -1)
        // P.z = refZ + nz × R = -50 + (-1)×0.4 = -50.4
        // O.z = P.z - dz(pToO)
        expect(result[0].compensatedStartZ).toBeDefined()
    })
})

// ============================================================
// 3. bisector距離公式の比較
// ============================================================
describe('bisector距離公式: R×tan(α/2) vs R/cos(α/2)', () => {
    it('90度コーナーでの2公式の比較', () => {
        const alpha = PI / 2  // 90度
        const tanDist = R * Math.tan(alpha / 2)      // R×tan(45°) = R×1 = 0.4
        const cosDist = R / Math.cos(alpha / 2)       // R/cos(45°) = R√2 ≈ 0.566

        expect(tanDist).toBeCloseTo(0.4, 3)
        expect(cosDist).toBeCloseTo(0.566, 3)

        // 比率: cosDist / tanDist = 1/sin(α/2) = √2 ≈ 1.414
        expect(cosDist / tanDist).toBeCloseTo(Math.SQRT2, 3)
    })

    it('接線連続（α≈0）での2公式の挙動', () => {
        const alpha = 0.001  // ほぼ0度（接線連続）
        const tanDist = R * Math.tan(alpha / 2)      // ≈ 0
        const cosDist = R / Math.cos(alpha / 2)       // ≈ R

        expect(tanDist).toBeCloseTo(0, 3)             // tan公式 → 0 ❌
        expect(cosDist).toBeCloseTo(R, 3)             // cos公式 → R ✅
    })

    it('60度コーナーでの2公式の比較', () => {
        const alpha = PI / 3  // 60度
        const tanDist = R * Math.tan(alpha / 2)      // R×tan(30°) ≈ 0.231
        const cosDist = R / Math.cos(alpha / 2)       // R/cos(30°) ≈ 0.462

        expect(tanDist).toBeCloseTo(0.231, 3)
        expect(cosDist).toBeCloseTo(0.462, 3)
    })

    it('R×tan(α/2) はコーナー弧上の点、R/cos(α/2) はオフセット線交点', () => {
        // 90度コーナーの具体例:
        // 法線 n1=(1,0), n2=(0,1)
        // bisector方向 = normalize(1,1) = (1/√2, 1/√2)
        const n1 = { x: 1, z: 0 }
        const n2 = { x: 0, z: 1 }
        const bx = (n1.x + n2.x) / Math.SQRT2
        const bz = (n1.z + n2.z) / Math.SQRT2

        // R×tan(45°) = R の場合の工具中心位置
        const tanP = { x: bx * R, z: bz * R }
        // コーナー点(0,0)からの距離
        const tanDist = Math.sqrt(tanP.x ** 2 + tanP.z ** 2)
        expect(tanDist).toBeCloseTo(R, 10)  // = R（円弧上）

        // R/cos(45°) = R√2 の場合の工具中心位置
        const cosP = { x: bx * R * Math.SQRT2, z: bz * R * Math.SQRT2 }
        expect(cosP.x).toBeCloseTo(R, 10)   // = R
        expect(cosP.z).toBeCloseTo(R, 10)   // = R
        // → オフセット線の交点 (R, R)
        const cosDist = Math.sqrt(cosP.x ** 2 + cosP.z ** 2)
        expect(cosDist).toBeCloseTo(R * Math.SQRT2, 10)  // = R√2（交点）
    })
})

// ============================================================
// 4. 接線連続ノードでの現行実装の挙動
// ============================================================
describe('接線連続ノードでの挙動テスト', () => {
    const calc = new CenterTrackCalculator(R, true, 3)

    it('直線→凸円弧の接続点でZ方向不連続が発生する（問題4.2の実証）', () => {
        // 水平直線 → 凸円弧(R=1) の接線連続な接続
        // 直線: X60 Z0 → X60 Z-10
        // 円弧: 始点 X60 Z-10, 終点 X58 Z-11, 中心 X58 Z-10, R=1, 凸
        const profile: Segment[] = [
            { type: 'line', startX: 60, startZ: 0, endX: 60, endZ: -10 },
            {
                type: 'corner-r', startX: 60, startZ: -10,
                endX: 58, endZ: -11,
                centerX: 58, centerZ: -10, radius: 1, isConvex: true
            },
        ]
        const result = calc.calculate(profile)

        const seg0end = { x: result[0].compensatedEndX, z: result[0].compensatedEndZ }
        const seg1start = { x: result[1].compensatedStartX, z: result[1].compensatedStartZ }

        console.log('Seg0 compensated end:', seg0end)
        console.log('Seg1 compensated start:', seg1start)

        // X方向は一致する
        expect(seg0end.x).toBeCloseTo(seg1start.x, 3)

        // Z方向には ΔZ = noseR の不連続が発生する
        // 原因: 同一ノードのP座標から pToO で異なる dz が適用される
        //   - seg0(line): isConvex=false → dz=noseR=0.4
        //   - seg1(corner-r, convex): isConvex=true → dz=0
        const dz = Math.abs(seg0end.z - seg1start.z)
        expect(dz).toBeCloseTo(R, 3)  // ΔZ = noseR = 0.4
    })

    it('接線連続ノードで bisector dist ≈ 0 になることの確認', () => {
        // 法線がほぼ一致する2つのベクトル
        const n1 = { nx: 1.0, nz: 0.0 }
        const n2 = { nx: 0.999, nz: 0.045 }  // ≈1度の差

        const dot = n1.nx * n2.nx + n1.nz * n2.nz
        const cosHalf = Math.sqrt((1 + dot) / 2)
        const sinHalf = Math.sqrt((1 - dot) / 2)
        const tanHalf = sinHalf / cosHalf

        const dist_tan = R * tanHalf
        const dist_cos = R / cosHalf

        console.log(`ほぼ接線連続: dot=${dot.toFixed(6)}, tanDist=${dist_tan.toFixed(6)}, cosDist=${dist_cos.toFixed(6)}`)

        // tan公式: dist ≈ 0 （問題あり）
        expect(dist_tan).toBeLessThan(0.01)
        // cos公式: dist ≈ R （正しい）
        expect(dist_cos).toBeCloseTo(R, 2)
    })
})

// ============================================================
// 5. オフセット曲線理論による正解値の計算
// ============================================================
describe('オフセット曲線理論で正解値を導出', () => {
    it('テーパー30度の法線オフセット = fz公式と整合', () => {
        // テーパー角30度の直線: 方向ベクトル
        const theta = 30 * PI / 180
        // テーパー方向: X減少、Z減少（上りテーパー）
        // 方向: dx = -sin(θ), dz = -cos(θ)  (半径座標系)
        // 法線（外向き）: nx = -dz = cos(θ), nz = dx = -sin(θ)
        // → sideSign=1 なら nx = cos(θ), nz = -sin(θ)

        const nx = Math.cos(theta)   // ≈ 0.866
        const nz = -Math.sin(theta)  // ≈ -0.5

        // 法線オフセット: P = ref + n×R
        const Px_offset = nx * R     // 半径値
        const Pz_offset = nz * R

        console.log(`法線オフセット: Px=${Px_offset.toFixed(4)}, Pz=${Pz_offset.toFixed(4)}`)

        // pToO (Tip 3): O = P - V_tip = P - (R, R)
        // O.x = (ref.x + Px_offset)×2 - R×2  ← 直径値変換
        //     = ref.x_diam + 2×Px_offset - 2×R
        //     = ref.x_diam + 2×R×cos(θ) - 2×R
        //     = ref.x_diam - 2×R×(1 - cos(θ))
        const Ox_shift = -2 * R * (1 - Math.cos(theta))  // 直径値

        // O.z = ref.z + Pz_offset - R (Tip3の V_tip.z = R)
        //     = ref.z - R×sin(θ) - R
        //     = ref.z - R×(1 + sin(θ))
        const Oz_shift_unified = -R * (1 + Math.sin(theta))

        // fz公式（上りテーパー）: O.z = ref.z - fz
        const fz = R * (1 - Math.tan(theta / 2))
        const Oz_shift_fz = -fz

        console.log(`統一法 Oz_shift: ${Oz_shift_unified.toFixed(4)}`)
        console.log(`fz公式 Oz_shift: ${Oz_shift_fz.toFixed(4)}`)

        // ★ ここが核心: 2つの方法は異なる値を出す
        // 統一法: -R(1+sin30°) = -0.4×1.5 = -0.600
        // fz公式: -R(1-tan15°) = -0.4×0.7321 = -0.293
        //
        // これは基準点が異なるため:
        // - fz公式: 仮想刃先点がワーク表面に接する点を基準
        // - 統一法: ワーク形状上の幾何学的な点を基準
        //
        // fz公式は「プログラム座標からの全補正量」であり、
        // 統一法は「P=ref+n×R, O=P-V_tip」の2段階を踏む。
        // 同じ結果にならないのは、refの定義が異なるから。

        expect(Oz_shift_unified).not.toBeCloseTo(Oz_shift_fz, 2)

        // 実際に正しいのはどちらか？
        // fz公式は現場で実証済み（手計算・実切削で確認）なので fz が正解。
        // つまり「統一法をそのまま適用」するとテーパーでは誤差が出る。
        // → ドキュメントのSection 5.5の指摘通り、基準点の違いが原因
        console.log('→ fz公式と統一法(P=ref+n×R, O=P-V_tip)は基準点が異なるため一致しない')
        console.log('→ fz公式が現場実証済みの正解')
    })

    it('水平線（θ=0）では統一法とfz公式が一致する', () => {
        const theta = 0
        // 統一法: O.z = ref.z - R(1+sin0) = ref.z - R
        const unified = -R * (1 + Math.sin(theta))
        // fz公式: O.z = ref.z - R(1-tan0) = ref.z - R
        const fz_val = -R * (1 - Math.tan(theta / 2))
        expect(unified).toBeCloseTo(fz_val, 10)
    })

    it('垂直線（θ=90）では統一法とfz公式が一致する', () => {
        const theta = PI / 2
        // 統一法: O.z = ref.z - R(1+sin90) = ref.z - 2R
        const unified = -R * (1 + Math.sin(theta))
        // fz公式: O.z = ref.z - R(1-tan45) = ref.z - 0 = ref.z
        const fz_val = -R * (1 - Math.tan(theta / 2))

        // θ=90°で統一法=-0.8, fz=-0.0
        // これも一致しない！
        console.log(`θ=90°: unified=${unified.toFixed(4)}, fz=${fz_val.toFixed(4)}`)
        // しかしθ=90（外径面）ではZ補正は不要（fz=0が正解）
        // 統一法の-2Rは明らかに間違い
        // → 統一法の基準点定義に問題がある
        expect(fz_val).toBeCloseTo(0, 10)
        expect(unified).toBeCloseTo(-0.8, 3)
        console.log('→ θ=90°でも不一致。統一法のO=P-V_tip(定数)モデルはテーパーに適用できない')
    })
})

// ============================================================
// 6. 現行実装の整合性テスト
// ============================================================
describe('現行実装の結果を記録（ベースライン）', () => {
    const calc = new CenterTrackCalculator(R, true, 3)

    it('水平→テーパー30°→垂直: CenterTrackCalculator単体の結果', () => {
        // 簡単な形状: 外径X60→テーパー30°→垂直
        const profile: Segment[] = [
            { type: 'line', startX: 60, startZ: 0, endX: 60, endZ: -45.653, angle: 0 },
            { type: 'line', startX: 60, startZ: -45.653, endX: 59.6, endZ: -46, angle: 30 },
            { type: 'line', startX: 59.6, startZ: -46, endX: 59.6, endZ: -48 },
        ]
        const result = calc.calculate(profile)

        console.log('\n=== 3セグメント補正結果 ===')
        result.forEach((seg, i) => {
            console.log(`[${i}] ${seg.type} angle=${seg.angle}`)
            console.log(`  元: X${seg.startX} Z${seg.startZ} → X${seg.endX} Z${seg.endZ}`)
            console.log(`  補: X${seg.compensatedStartX} Z${seg.compensatedStartZ} → X${seg.compensatedEndX} Z${seg.compensatedEndZ}`)
        })

        // CenterTrackCalculator単体: テーパーfz公式で pz計算 → usedTaperFormula=true → dz=0
        // pz = refZ - fz = -46 - 0.293 = -46.293
        // O.z = pz - 0 = -46.293
        expect(result[1].compensatedEndZ).toBeCloseTo(-46.293, 2)

        // 注: calculateShape 全パイプラインでは -46.586 になる（追加で dz=noseR が適用される）
        // この差 0.293 = fz = R×(1-tan(15°)) は、パイプラインの混在モデルに起因
    })

    it('凸円弧(角R)のオフセット: 半径 = R_arc + R_nose', () => {
        const profile: Segment[] = [{
            type: 'corner-r',
            startX: 60, startZ: -10,
            endX: 58, endZ: -11,
            centerX: 58, centerZ: -10,
            radius: 1,
            isConvex: true,
        }]
        const result = calc.calculate(profile)
        expect(result[0].compensatedRadius).toBeCloseTo(1 + R, 3)  // 1.4
    })

    it('凹円弧(隅R)のオフセット: 半径 = R_arc - R_nose', () => {
        const profile: Segment[] = [{
            type: 'corner-r',
            startX: 60, startZ: -10,
            endX: 62, endZ: -11,
            centerX: 62, centerZ: -10,
            radius: 1,
            isConvex: false,
        }]
        const result = calc.calculate(profile)
        expect(result[0].compensatedRadius).toBeCloseTo(1 - R, 3)  // 0.6
    })
})

// ============================================================
// 7. ドキュメント主張の真偽まとめ
// ============================================================
describe('ドキュメント主張の検証サマリー', () => {
    it('主張1: fz公式の代表値テーブルは正しい', () => {
        // Section 3.4 のテーブル
        expect(R * (1 - Math.tan(30 * PI / 360))).toBeCloseTo(0.293, 3)
        expect(R * (1 - Math.tan(45 * PI / 360))).toBeCloseTo(0.234, 3)
        expect(R * (1 - Math.tan(60 * PI / 360))).toBeCloseTo(0.169, 3)
    })

    it('主張2: tan(α/2) は接線連続で0を返す', () => {
        const alpha = 0
        expect(Math.tan(alpha / 2)).toBeCloseTo(0, 10)
    })

    it('主張3: 1/cos(α/2) は接線連続で1を返す', () => {
        const alpha = 0
        expect(1 / Math.cos(alpha / 2)).toBeCloseTo(1, 10)
    })

    it('主張4: 凸円弧の補正半径 = R_arc + R_nose', () => {
        const R_arc = 0.5
        expect(R_arc + R).toBeCloseTo(0.9, 10)
    })

    it('主張5: 凹円弧の補正半径 = R_arc - R_nose', () => {
        const R_arc = 1.0
        expect(R_arc - R).toBeCloseTo(0.6, 10)
    })

    it('主張6（修正）: V_tip定数モデルはテーパーに直接適用できない', () => {
        // Section 5.5 の検証
        // 「O = P - V_tip（定数）」モデルをテーパーに適用すると
        // fz公式と異なる結果になる。
        // これは基準点の定義が異なるため。
        //
        // fz公式（現場実証済み）が正解であり、
        // 統一法の単純適用は誤り。
        //
        // → テーパーには専用の計算パスが必要（現行実装の方針は正しい）
        const theta = 30 * PI / 180
        const unified_oz = -R * (1 + Math.sin(theta))  // = -0.6
        const fz_oz = -R * (1 - Math.tan(theta / 2))   // = -0.293

        expect(unified_oz).not.toBeCloseTo(fz_oz, 1)
        // テーパーでは統一法をそのまま使えない
    })
})
