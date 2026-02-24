import { describe, it } from 'vitest'

describe('接線角度の計算', () => {
    it('角R0.5の始点での接線方向', () => {
        // Arc: 始点 X66 Z-114.793, 中心 X65 Z-114.793
        const startX = 66 / 2  // radius
        const startZ = -114.793
        const centerX = 65 / 2 // radius
        const centerZ = -114.793

        // 半径ベクトル (中心→始点)
        const rx = startX - centerX
        const rz = startZ - centerZ
        console.log(`\n半径ベクトル: (${rx}, ${rz})`)

        // 接線ベクトル (半径を90°回転)
        // For CCW arc: tangent = (-rz, rx)
        // For CW arc: tangent = (rz, -rx)
        const tx = -rz  // CCW assumption
        const tz = rx
        console.log(`接線ベクトル: (${tx}, ${tz})`)

        // 接線角度 (水平からの角度)
        const angle = Math.atan2(tz, tx) * 180 / Math.PI
        console.log(`接線角度: ${angle.toFixed(1)}°`)

        console.log(`\n【結論】`)
        if (Math.abs(tz) < 0.01) {
            console.log(`接線はほぼ水平 (Z成分 ≈ 0)`)
            console.log(`→ HP公式: hpZ = R * (1 - tan(θ/2))`)
            console.log(`   θ = 90° (水平) → θ/2 = 45°`)
            console.log(`   hpZ = 0.4 * (1 - tan(45°)) = 0.4 * (1 - 1.0) = 0mm`)
            console.log(``)
            console.log(`現在のpToO: oz = pz - 0.4 (固定)`)
            console.log(`正しい式: oz = pz - 0.0 (水平の場合)`)
            console.log(``)
            console.log(`誤差: -0.4 - 0.0 = -0.4mm ❌`)
        } else {
            console.log(`接線は傾いている (Z成分 = ${tz.toFixed(3)})`)
        }
    })
})
