from __future__ import annotations

import numpy as np


class KalmanFilterXYAH:
    """
    Minimal Kalman filter for tracking bbox in (x, y, a, h) where:
      x,y: center
      a: aspect ratio w/h
      h: height

    State: [x, y, a, h, vx, vy, va, vh]
    This is the same parameterization used by many MOT baselines (SORT/DeepSORT/ByteTrack-style).
    """

    def __init__(self) -> None:
        self._ndim = 4
        self._dt = 1.0

        # Motion model
        self._F = np.eye(2 * self._ndim, dtype=np.float32)
        for i in range(self._ndim):
            self._F[i, self._ndim + i] = self._dt

        self._H = np.eye(self._ndim, 2 * self._ndim, dtype=np.float32)

        # Noise scales (tuned for stability, not perfection)
        self._std_pos = 1.0
        self._std_vel = 0.01

    def initiate(self, measurement: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        mean = np.zeros((2 * self._ndim,), dtype=np.float32)
        mean[: self._ndim] = measurement.astype(np.float32)

        std = np.array(
            [
                2 * self._std_pos,
                2 * self._std_pos,
                1e-2,
                2 * self._std_pos,
                10 * self._std_vel,
                10 * self._std_vel,
                1e-5,
                10 * self._std_vel,
            ],
            dtype=np.float32,
        )
        cov = np.diag(std**2)
        return mean, cov

    def predict(self, mean: np.ndarray, cov: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        q_std = np.array(
            [self._std_pos, self._std_pos, 1e-2, self._std_pos, self._std_vel, self._std_vel, 1e-5, self._std_vel],
            dtype=np.float32,
        )
        Q = np.diag(q_std**2)
        mean = self._F @ mean
        cov = self._F @ cov @ self._F.T + Q
        return mean, cov

    def update(self, mean: np.ndarray, cov: np.ndarray, measurement: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        r_std = np.array([self._std_pos, self._std_pos, 1e-2, self._std_pos], dtype=np.float32)
        R = np.diag(r_std**2)

        z = measurement.astype(np.float32)
        S = self._H @ cov @ self._H.T + R
        K = cov @ self._H.T @ np.linalg.inv(S)
        y = z - (self._H @ mean)
        mean = mean + K @ y
        cov = (np.eye(cov.shape[0], dtype=np.float32) - K @ self._H) @ cov
        return mean, cov

