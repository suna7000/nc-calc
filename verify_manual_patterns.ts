import { calculateShape } from './src/calculators/shape'
import { createPoint, noCorner } from './src/models/shape'
import { defaultMachineSettings } from './src/models/settings'

function verify() {
    console.log("=== 計算エンジン自己疑義・高精度再監査案 ===")

    const settings = {
        ...defaultMachineSettings,
        noseRCompensation: { enabled: true, offsetNumber: 1, compensationDirection: 'auto', method: 'geometric' },
    }
    // 外径工具 (Tip 3, R0.8)
    settings.toolLibrary[0] = { id: 't1', name: 'Test', type: 'external', noseRadius: 0.8, toolTipNumber: 3, hand: 'right' }

    // --- 検証1: 45度テーパー (Docs 1節) ---
    // X100 Z0 -> X120 Z-10
    const p1 = createPoint(100, 0, noCorner())
    const p2 = createPoint(120, -10, noCorner())
    const result1 = calculateShape({ points: [p1, p2] }, settings)
    const comp1 = result1.segments[0].compensated!

    // 理論期待値: fz = R * tan(22.5) = 0.331
    // startZ=0 なので補正後 startZ = 0.331 (チップ番号3, 外部)
    console.log(`検証1 (45度テーパー Zシフト): 期待値 0.331 | 実装値 ${comp1.compensatedStartZ}`)
    if (Math.abs(comp1.compensatedStartZ - 0.331) < 0.002) {
        console.log("✅ PASS")
    } else {
        console.log("❌ FAIL: 理論値と不一致")
    }

    // --- 検証2: チップ番号 2 (内径) の物理的整合性 ---
    settings.toolLibrary[0] = { id: 't2', name: 'Boring', type: 'internal', noseRadius: 0.4, toolTipNumber: 2, hand: 'right' }
    // X40 Z0 -> X40 Z-10 (内径平坦面)
    const p3 = createPoint(40, 0, noCorner())
    const p4 = createPoint(40, -10, noCorner())
    const result2 = calculateShape({ points: [p3, p4] }, settings)
    const comp2 = result2.segments[0].compensated!

    // Tip 2 (ID Front): P = O + (-2R, +R) -> O = P + (2R, -R)
    // プログラム点(P)が(X40, Z0)なら、仮想刃先(O)は P + (0.8, -0.4) = (40.8, -0.4) ...?
    // いや、NC旋盤では ワーク形状(O)を通りたい。P を求めるのが補正。
    // 実装は oToP(ox, oz, noseR, toolType) を通る。
    // 期待: X40 Z0 (O) に対して P は X39.2 Z0.4 等 (内径なので中心寄り)
    console.log(`検証2 (Tip 2 内径シフト): O(40.0) -> P(${comp2.compensatedStartX})`)
    if (comp2.compensatedStartX < 40) {
        console.log("✅ PASS: 正しく内径側にオフセット")
    } else {
        console.log("❌ FAIL: オフセット方向が逆")
    }

    console.log("監査終了。")
}

verify()
