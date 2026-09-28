# Data sources and methodology

Temperies presents derived weekly mean temperature fields for the historical year 2025. This document records the source products, processing choices, attribution, and interpretation limits for the checked-in dataset under `public/data/2025`.

## Copernicus ERA5 land-air field

- **Product:** [ERA5 post-processed daily statistics on single levels](https://cds.climate.copernicus.eu/datasets/derived-era5-single-levels-daily-statistics)
- **Dataset DOI:** [10.24381/cds.4991cf48](https://doi.org/10.24381/cds.4991cf48)
- **Variable:** 2 m temperature
- **Request:** daily mean, 1-hourly sampling, UTC+00:00, reanalysis product type
- **Coverage used:** January 1–December 31, 2025
- **Role in Temperies:** air temperature for cells outside the invariant OISST ocean support footprint
- **Licence:** the Climate Data Store catalogue identifies this product under a CC BY licence. Users should consult the current catalogue entry and attribution guidance before redistributing source or derived data.

The CDS daily-statistics service calculates the daily aggregation during retrieval. Temperies combines those daily means into its displayed periods and bilinearly samples the source grid onto the canonical 0.25° cell centers with periodic longitude handling.

## NOAA OISST ocean field

- **Product:** [NOAA 0.25° Daily Optimum Interpolation Sea Surface Temperature, Version 2.1](https://www.ncei.noaa.gov/products/optimum-interpolation-sst)
- **Dataset DOI:** [10.25921/RE9P-PT57](https://doi.org/10.25921/RE9P-PT57)
- **Variable:** sea-surface temperature
- **Coverage used:** January 1–December 31, 2025
- **Role in Temperies:** sea-surface temperature and the invariant ocean support footprint

Suggested dataset citation:

> Zhang, Huai-Min. (2020): NOAA 0.25-degree Daily Optimum Interpolation Sea Surface Temperature (OISST), Version 2.1. 2025 subset. NOAA National Centers for Environmental Information. https://doi.org/10.25921/RE9P-PT57.

OISST is a gridded analysis combining bias-adjusted satellite and in-situ inputs, with spatial interpolation used to produce a completed field. Temperies reorders its native 0.25° cell centers without spatial resampling. The pipeline rejects a daily file if its valid-data footprint differs from the reference footprint.

## Borders and coastlines

Temperies obtains 1:110m country and land topology from the [`world-atlas`](https://www.npmjs.com/package/world-atlas) package, derived from [Natural Earth](https://www.naturalearthdata.com/). Natural Earth states that its raster and vector map data are in the public domain. The overlay is visual context only and does not determine whether a climate cell uses ERA5 or OISST.

## Temporal aggregation

The year is divided into 52 consecutive periods:

- Weeks 1–51 contain seven daily fields.
- The final period, December 24–31, contains eight daily fields so all 365 days are represented exactly once.
- There are no temporal gaps or overlaps.

The LOW and HIGH controls identify spatial extrema in the selected period's weekly mean field. When one is selected, it follows the corresponding extreme as the period or display layer changes. These values are not instantaneous observed weather records.

## Spatial grid and projection

- Grid: 1440 columns × 720 rows
- Resolution: 0.25° × 0.25°
- Cell centers: 89.875°N to 89.875°S and 179.875°W to 179.875°E
- Row order: north to south
- Column order: west to east
- Raster layout: equirectangular, or regular latitude–longitude/Plate Carrée
- Display: canonical UV coordinates sample the same raster in both the 3D globe and the native 2:1 Plate Carrée map; the vertex shader morphs between corresponding sphere and plane positions without raster resampling or another data request
- Vector overlays: coastlines and borders use matching sphere and Plate Carrée positions; segments crossing the antimeridian are split so they do not draw across the map

The flat view maps longitude linearly from −180° to +180° and latitude linearly from −90° to +90°. Equal angular cells do not have equal physical area, and Plate Carrée visually enlarges high latitudes. Histogram populations and displayed-surface percentages therefore use cosine-of-latitude area weighting in both views. Changing views affects presentation only; it does not alter values, cell identity, aggregation, or scientific scope.

## Composite interpretation

The Composite layer places two different physical variables into one geographic view:

- ERA5 2 m air temperature over the air-routed surface;
- OISST sea-surface temperature over supported ocean cells.

It is useful for visual exploration, but it is not a single homogeneous measurement product. Temperies does not present these values as direct point observations, temperature anomalies, climate normals, forecasts, or evidence of attribution.

## Color scales

Both selectable palettes map the fixed −80 °C to +60 °C display domain and are applied identically to the raster and coordinated legend. Changing the palette updates only the color lookup; it does not reload, transform, or alter the climate fields.

The default blue–green–vermillion divergence places green at 21.08 °C. That reference is the median of the checked-in 2025 composite weekly-mean fields, calculated with cosine-of-latitude cell-area weighting and weighting each period by its number of days. It describes this particular composite dataset and is not a temperature anomaly baseline, climatological normal, biological comfort threshold, or physical phase boundary. The original sequential palette is retained as an alternative continuous cold-to-hot encoding.

## Processing and reproducibility

The acquisition and processing scripts are under `scripts/real_data`. The complete workflow is documented in [`docs/real-data-pipeline.md`](docs/real-data-pipeline.md). Original NetCDF downloads and full local validation artifacts are intentionally excluded because of their size. A compact checked-in record of coverage, counts, and checksums is available in [`docs/data-provenance-2025.md`](docs/data-provenance-2025.md).

The source products and their terms remain authoritative. This document records the project's use of those products; it is not legal advice and does not replace their licences, use agreements, or citation guidance.
