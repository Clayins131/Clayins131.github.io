# Clay Liang 梁珂玮

**Management & Data Science · Global Macro · Fixed Income**

I am a BSc Management & Data Science student at the Technical University of Munich. Previously, I studied Artificial Intelligence & Data Science at Leiden University.

I use data and models to study macroeconomic fundamentals, interest rates and risk. My research interests connect growth, inflation and monetary policy with fixed-income markets, with an emphasis on explicit assumptions and transparent scenario analysis.

[Website](https://tuixue.nl) · [Fin Tools](https://tuixue.nl/fintools/) · [Projects](https://tuixue.nl/projects/) · [Writing](https://tuixue.nl/blog/) · [LinkedIn](https://www.linkedin.com/in/clayins131) · [Email](mailto:claysps@outlook.com)

## Current interests

- global macro fundamentals and monetary policy
- fixed income, yield curves and quantitative risk
- portfolio analytics and valuation
- technology consulting and data-driven transformation

## Selected work

- **[Global Macro & Rates Lab](https://tuixue.nl/fintools/macro-rates.html):** connect a macro thesis to editable zero curves, bond valuation, curve shocks and key-rate risk across five markets.
- **[Financial Data & Scenario Tools](https://tuixue.nl/fintools/):** live market data, DCF valuation, FX, inflation, return and scenario tools with transparent assumptions.
- **[ASML Valuation Tracker](https://tuixue.nl/fintools/asml.html):** compares live market price with an independently modelled DCF range.
- **[Video Annotation Tool](https://github.com/Clayins131/video-annotator):** lightweight workflow for timestamped labels and CSV export.
- **[Offline Music Recommendation](https://github.com/Clayins131/Offline-Music-Recommendation-System):** offline ML pipeline combining speech, sentiment and content-based recommendation.
- **[csvtool](https://github.com/Clayins131/csvtool):** C++ parser built for large CSV files that were inefficient to process in Python.

## Experience

- **Airbus Tianjin Final Assembly** - Data Analytics Intern
- **Lenovo** - Data Science Intern / Intern Project Lead
- **Tsinghua University** - AI Research Assistant

## Tools

`Python` · `SQL` · `Excel` · `Power BI` · `Tableau` · `Pandas` · `Databricks` · `Spark` · `PyTorch` · `JavaScript`

## Global Macro & Rates Lab

Open `/fintools/macro-rates.html`, choose the US, euro area, UK, Japan or China, and edit the zero-curve inputs. Record a view on growth, inflation, policy and risks; then apply a parallel shift, steepening or belly shock. The tool reprices a fixed-rate bond and reports duration, convexity, DV01 and key-rate DV01. Export a scenario CSV and research memo to retain the assumptions behind the calculation.

### Free official data

| Data | Coverage | Source and frequency |
| --- | --- | --- |
| Real GDP growth | All five markets | World Bank Indicators API; annual real growth |
| CPI inflation | All five markets | BIS consumer prices API; monthly, year-on-year |
| Policy-rate series | All five markets | BIS API; daily observations, country-specific definitions |
| Model zero curve | Euro area | ECB AAA sovereign Svensson curve; TARGET business days |
| Research zero curve | US | Federal Reserve GSW staff research; daily observations, normally published weekly |
| Other zero curves | UK, Japan, China | Illustrative or user-entered; no automated zero-curve feed connected |

China uses the **1-year LPR**, not an overnight target. Euro-area policy observations use the ECB deposit facility series. Annual GDP is structural context, not a current-quarter nowcast. Series have different release calendars and may be revised.

ECB and Fed continuously compounded zero rates are converted to annual effective with 100 * expm1(z / 100). The US 6M node is extrapolated from published Svensson parameters, not a Treasury bill quote. The GSW curve is a staff research product, not an official statistical release. An ECB curve is accepted only when all seven nodes share a date.

The browser requests World Bank, BIS and ECB data when opened or refreshed. Fed data is collected by scripts/refresh-market-data.mjs because its endpoint does not support cross-origin browser requests. The committed data/macro-snapshot.json supplies a dated fallback. Failed sources retain their previous verified values with a cached warning; missing data is never coerced to zero. API refreshes preserve edited curves and research notes.

The GitHub Actions workflow .github/workflows/refresh-macro-data.yml refreshes snapshots at 06:45 UTC on weekdays, then runs tests and deploys Pages. Scheduled runs can be delayed by GitHub. It also supports manual dispatch and runs when the adapter or workflow changes. No paid API, key or browser-side secret is required.

Source URLs, observation dates, retrieval timestamps and curve transformations are available in the page and JSON export; memo and scenario CSV exports retain provenance. Research views, shocks and hypothetical bond terms remain user inputs. Duration, convexity, DV01 and P&L are calculated locally.

Primary documentation: [World Bank](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api), [BIS API](https://stats.bis.org/api-doc/v2/), [ECB curve methodology](https://www.ecb.europa.eu/stats/financial_markets_and_interest_rates/euro_area_yield_curves/html/index.en.html), [Federal Reserve GSW](https://www.federalreserve.gov/data/nominal-yield-curve.htm).

To collect a new snapshot manually (Node.js 22+, network required), run: node scripts/refresh-market-data.mjs

### Model conventions

- Zero rates use annual-effective compounding and linear interpolation across curve nodes.
- Bond settlement is on a coupon boundary, with no accrued interest. Cash flows are discounted using the zero curve.
- Curve shocks change discount rates; the exercise is an instantaneous repricing scenario, not a forecast of holding-period returns.
- Cross-market results use local curves and local currency. The model excludes FX, credit spreads and carry forecasts.
- Macro notes express a research thesis; they do not automatically infer rate changes or select an optimal investment.

The site uses plain HTML, CSS and JavaScript and can be served by any static web server. Run the numerical engine checks with Node.js:

```sh
node --test tests/*.test.cjs
```
