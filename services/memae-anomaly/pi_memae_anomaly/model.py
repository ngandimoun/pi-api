from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F


class MemAE(nn.Module):
    """
    Minimal MemAE-style autoencoder baseline for anomaly scoring.

    This is NOT a full reproduction (which is dataset/site sensitive),
    but it provides a stable, testable inference boundary for the MVP:
    - encode -> bottleneck -> decode
    - anomaly score based on reconstruction error
    """

    def __init__(self, in_channels: int = 3, latent_dim: int = 128) -> None:
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 32, 4, 2, 1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 64, 4, 2, 1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 128, 4, 2, 1),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((1, 1)),
        )
        self.fc = nn.Linear(128, latent_dim)
        self.fc2 = nn.Linear(latent_dim, 128)
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(128, 64, 4, 2, 1),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(64, 32, 4, 2, 1),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(32, in_channels, 4, 2, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        z = self.encoder(x).flatten(1)
        z = self.fc(z)
        h = self.fc2(z).view(-1, 128, 1, 1)
        recon = self.decoder(h)
        return recon, z


def anomaly_score(x: torch.Tensor, recon: torch.Tensor) -> torch.Tensor:
    # Mean squared error per batch element
    if recon.shape != x.shape:
        recon = F.interpolate(recon, size=x.shape[-2:], mode="bilinear", align_corners=False)
    return torch.mean((x - recon) ** 2, dim=(1, 2, 3))

