"""rigid transforms, signed distances to primitives, and the kinematic dof of a contact set"""
import numpy as np

EYE = np.eye(4)


def apply(T, x):
    return x @ T[:3, :3].T + T[:3, 3]


def rot(T, v):
    return v @ T[:3, :3].T


def inv(T):
    R, t = T[:3, :3], T[:3, 3]
    out = np.eye(4)
    out[:3, :3] = R.T
    out[:3, 3] = -R.T @ t
    return out


def loc_matrix(loc):
    tr = loc.Transformation()
    M = np.eye(4)
    for r in range(3):
        for c in range(4):
            M[r, c] = tr.Value(r + 1, c + 1)
    return M


def perp(a):
    """two unit vectors orthogonal to a"""
    h = np.array([1.0, 0, 0]) if abs(a[0]) < 0.9 else np.array([0, 1.0, 0])
    u = np.cross(a, h)
    u /= np.linalg.norm(u)
    return u, np.cross(a, u)


def signed_dist(s, x):
    """distance of points x from surface s, positive outside s's material"""
    if s.kind == "plane":
        return x @ s.n - s.d
    if s.kind == "cyl":
        w = x - s.origin
        rho = np.linalg.norm(w - np.outer(w @ s.axis, s.axis), axis=1)
        return s.sense * (rho - s.r)
    if s.kind == "cone":
        w = x - s.origin
        z = w @ s.axis
        rho = np.linalg.norm(w - np.outer(z, s.axis), axis=1)
        return s.sense * (rho * np.cos(s.alpha) - z * np.sin(s.alpha))
    if s.kind == "sphere":
        return s.sense * (np.linalg.norm(x - s.origin, axis=1) - s.r)
    raise ValueError(s.kind)


def kabsch(src, dst, w=None):
    """rotation R minimising sum |R src_i - dst_i|^2 over unit direction pairs"""
    src, dst = np.asarray(src), np.asarray(dst)
    w = np.ones(len(src)) if w is None else np.asarray(w)
    H = (src * w[:, None]).T @ dst
    U, S, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T)) or 1.0
    D = np.diag([1, 1, d])
    return Vt.T @ D @ U.T


def contact_rows(t, ref=np.zeros(3)):
    """screw-theory constraint rows (omega, v) a mated target surface imposes on the moving part.
    nullspace of the stacked rows = motions that keep every contact in place"""
    rows = []
    if t.kind == "plane":
        u1, u2 = perp(t.n)
        p = t.d * t.n - ref
        rows += [np.r_[u1, 0, 0, 0], np.r_[u2, 0, 0, 0], np.r_[np.cross(p, t.n), t.n]]
    elif t.kind in ("cyl", "cone"):
        u1, u2 = perp(t.axis)
        c = t.origin - ref
        rows += [np.r_[u1, 0, 0, 0], np.r_[u2, 0, 0, 0]]
        rows += [np.r_[np.cross(c, u), u] for u in (u1, u2)]
        if t.kind == "cone":
            rows.append(np.r_[np.cross(c, t.axis), t.axis])
    elif t.kind == "sphere":
        c = t.origin - ref
        rows += [np.r_[np.cross(c, e), e] for e in np.eye(3)]
    return rows


MOTION = {(0, 0): "fixed", (0, 1): "prismatic", (1, 0): "revolute", (1, 1): "cylindrical",
          (1, 2): "planar", (3, 0): "spherical"}


def dof(targets, ref=None):
    """returns (dof, label, free translation dirs, free rotation axes)"""
    if ref is None:
        ref = np.mean([t.pts.mean(axis=0) for t in targets], axis=0)
    J = np.array([r for t in targets for r in contact_rows(t, ref)])
    _, S, Vt = np.linalg.svd(J)
    rank = int((S > 1e-6 * max(S.max(), 1)).sum())
    N = Vt[rank:]                      # nullspace basis rows (omega, v)
    k = len(N)
    if k == 0:
        return 0, "fixed", [], []
    W = N[:, :3]
    _, sw, vw = np.linalg.svd(W)
    nrot = int((sw > 1e-6).sum())
    rot_axes = list(vw[:nrot])
    # pure translations: combinations with zero rotation
    if nrot:
        _, s2, v2 = np.linalg.svd(W.T)
        pure = v2[nrot:] if v2.shape[0] > nrot else np.zeros((0, k))
    else:
        pure = np.eye(k)
    trans = [p @ N[:, 3:] for p in pure]
    trans = [v / np.linalg.norm(v) for v in trans if np.linalg.norm(v) > 1e-9]
    label = MOTION.get((nrot, len(trans)), f"{k}dof")
    return k, label, trans, rot_axes
