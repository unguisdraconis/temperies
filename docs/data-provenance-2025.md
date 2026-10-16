# 2025 dataset provenance record

This is the compact, checked-in summary of the complete local validation report produced by `scripts/real_data/process_year.py`. The original NetCDF downloads, 80 KB source checksum inventory, and full validation workspace remain intentionally ignored.

## Coverage

| Item | Validated value |
| --- | ---: |
| Calendar days | 365 |
| Weekly periods | 52 |
| Seven-day periods | 51 |
| Final eight-day period | 1 |
| Temporal gaps | 0 |
| Temporal overlaps | 0 |
| Cells per raster | 1,036,800 |
| Temperature rasters | 104 |
| Encoded raster bytes | 215,654,400 |

## Source acquisition

| Item | Validated value |
| --- | ---: |
| ERA5 monthly NetCDF files | 12 |
| OISST daily NetCDF files | 365 |
| Total source files | 377 |
| Total source bytes | 1,489,151,145 |

The complete local source inventory had SHA-256:

```text
dd8493a7dd9b54c25f509244eb68128aba68ea32a76688cd47cafd678585ed18
```

## Surface-routing mask

| Item | Validated value |
| --- | ---: |
| OISST-routed ocean cells | 691,150 |
| ERA5-routed air cells | 345,650 |
| Days with invariant footprint | 365 |
| Mask bytes | 1,036,800 |

Published `public/data/2025/surface-mask.bin` SHA-256:

```text
d1360206510bc9fc9b381ca1196c40a7d5ebc363010480a0891d8ae256d65284
```

Published `public/data/2025/manifest.json` SHA-256:

```text
4debb4cddee12031d14a5574104ee50c4f9a4dd1ebd0bf2310f0e1cc9eea3bea
```

## Geographic-name index

The hover and pinned-selection card uses a separate offline index aligned to
the same canonical grid. The generator combines `world-atlas` country topology
with Natural Earth v5.1.2 lakes, marine regions, island polygons, island groups,
and island label points. Natural Earth acquisition is pinned to revision
`f1890d9f152c896d250a77557a5751a93d494776`, and each downloaded GeoJSON file is
verified against the SHA-256 recorded in the generated manifest.

| Item | Validated value |
| --- | ---: |
| Grid cells | 1,036,800 |
| Named land-routed cells | 345,650 |
| Named ocean-routed cells | 691,150 |
| Unknown cells | 0 |
| Place records | 1,658 |
| Index bytes | 2,073,600 |
| Manifest bytes | 185,006 |

Published `public/data/geography/cells.bin` SHA-256:

```text
ec78142b0f2d2dab8859f043efbfa4d3c16d3883baf937daf733021c0be3130c
```

Published `public/data/geography/manifest.json` SHA-256:

```text
dc9681c0660a775e2b3a9794ce4a02ed51d068246c460100576090b12f5430a6
```

The names describe grid-cell centers and inherit the source datasets'
generalization and boundary limitations. They do not constitute an independent
boundary dataset or a position on disputed territory.

## Validation boundary

The climate processor verified complete daily coverage, stable OISST support, exact output byte lengths, grid orientation, missing-value handling, and an SHA-256 hash for every published temperature raster. The geography generator separately verifies its pinned inputs, exact grid length, valid place IDs, and complete named-cell coverage through the checked-in test suite. The source inventory and full per-frame climate hash list remain in the ignored local validation workspace and can be regenerated from the acquisition and processing scripts.

This record demonstrates what the pipeline checked for this build. It is not an independent scientific validation of ERA5 or OISST and does not replace the source providers' uncertainty and quality documentation.
