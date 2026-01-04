/**
 * Peter Smid 高度幾何計算モジュール
 * 項4: 高度な交点算出
 * 項5: 座標要素の逆算
 */

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * 始点、角度、および「終点X」または「移動量Z」から、欠落している座標値を算出。
 * (項5: 座標要素の逆算)
 */
export function calculateTaperElement(params: {
    startX: number;
    startZ: number;
    angleDeg: number;
    endX?: number;
    endZ?: number;
}): { endX: number; endZ: number; length: number } | null {
    const { startX, startZ, angleDeg, endX, endZ } = params;
    const rad = (angleDeg * Math.PI) / 180;

    // Xは直径値なので、計算には半径値 (x/2) を使用する
    const rsX = startX / 2;

    if (endX !== undefined && endZ === undefined) {
        // XからZを求める: dZ = dX / tan(angle)
        const reX = endX / 2;
        const dx = reX - rsX;
        if (Math.abs(Math.tan(rad)) < 1e-10) return null;
        const dz = dx / Math.tan(rad);
        const finalZ = startZ + dz;
        const length = Math.sqrt(dx * dx + dz * dz);
        return { endX, endZ: round3(finalZ), length: round3(length) };
    }
    else if (endZ !== undefined && endX === undefined) {
        // ZからXを求める: dX = dZ * tan(angle)
        const dz = endZ - startZ;
        const dx = dz * Math.tan(rad);
        const finalX = (rsX + dx) * 2;
        const length = Math.sqrt(dx * dx + dz * dz);
        return { endX: round3(finalX), endZ, length: round3(length) };
    }

    return null;
}

/**
 * 始点と終点の X, Z から、正確なテーパー角度（片角）を逆算。
 * (項5: 座標要素の逆算)
 */
export function calculateTaperAngle(x1: number, z1: number, x2: number, z2: number): number {
    const dx = (x2 - x1) / 2;
    const dz = z2 - z1;
    if (dz === 0) return dx > 0 ? 90 : -90;
    const rad = Math.atan2(dx, dz);
    return round3((rad * 180) / Math.PI);
}

/**
 * 始点・終点・半径 R から、円弧の中心座標 (Xc, Zc) を特定する。
 * (項4: 2点と半径からの中心特定)
 */
export function findArcCenter(
    p1: { x: number, z: number },
    p2: { x: number, z: number },
    radius: number,
    isLeftTurn: boolean,
    isLargeArc: boolean = false
): { xc: number, zc: number } | null {
    // 半径値での計算
    const x1 = p1.x / 2, z1 = p1.z;
    const x2 = p2.x / 2, z2 = p2.z;

    const dx = x2 - x1;
    const dz = z2 - z1;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);

    if (dist > 2 * radius || dist === 0) return null; // 半径が足りない、または同一点

    // 2点の中点
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;

    // 中点から中心までの距離 (ピタゴラス)
    const h = Math.sqrt(Math.max(0, radius * radius - distSq / 4));

    // 垂直ベクトルの算出
    // 方向の決定ロジック (左回り/右回り、および優弧/劣弧)
    let sign = (isLeftTurn ? 1 : -1) * (isLargeArc ? -1 : 1);

    const xc = midX + (sign * h * dz) / dist;
    const zc = midZ - (sign * h * dx) / dist;

    return { xc: round3(xc * 2), zc: round3(zc) };
}

/**
 * 直線（点1と角度）と円弧（中心と半径）の交点を算出。
 * (項4: 直線と円弧の交点)
 */
export function intersectLineCircle(
    lineP: { x: number, z: number },
    angleDeg: number,
    circleC: { x: number, z: number },
    radius: number
): { x: number, z: number }[] {
    const rad = (angleDeg * Math.PI) / 180;
    const x0 = lineP.x / 2, z0 = lineP.z;
    const xc = circleC.x / 2, zc = circleC.z;

    // 直線の媒介変数表示: z = z0 + t*cos(rad), x = x0 + t*sin(rad)
    // 円の式: (x - xc)^2 + (z - zc)^2 = R^2
    // ((x0 + t*sin) - xc)^2 + ((z0 + t*cos) - zc)^2 = R^2

    const dx = x0 - xc;
    const dz = z0 - zc;
    const s = Math.sin(rad);
    const c = Math.cos(rad);

    // At^2 + Bt + C = 0
    const A = s * s + c * c; // = 1
    const B = 2 * (dx * s + dz * c);
    const C = dx * dx + dz * dz - radius * radius;

    const det = B * B - 4 * A * C;
    if (det < 0) return [];

    const results: { x: number, z: number }[] = [];
    const tValues = det === 0 ? [-B / (2 * A)] : [(-B + Math.sqrt(det)) / (2 * A), (-B - Math.sqrt(det)) / (2 * A)];

    for (const t of tValues) {
        results.push({
            x: round3((x0 + t * s) * 2),
            z: round3(z0 + t * c)
        });
    }

    return results;
}
