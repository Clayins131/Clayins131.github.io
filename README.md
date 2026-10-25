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

The starting curves are **illustrative**, not current or historical market data. Links to central banks and statistical agencies support independent macro research. Replace the inputs with an appropriate **zero-coupon curve**, not a par-yield curve, when using external rate data.

### Model conventions

- Zero rates use annual-effective compounding and linear interpolation across curve nodes.
- Bond settlement is on a coupon boundary, with no accrued interest. Cash flows are discounted using the zero curve.
- Curve shocks change discount rates; the exercise is an instantaneous repricing scenario, not a forecast of holding-period returns.
- Cross-market results use local curves and local currency. The model excludes FX, credit spreads and carry forecasts.
- Macro notes express a research thesis; they do not automatically infer rate changes or select an optimal investment.

The site uses plain HTML, CSS and JavaScript and can be served by any static web server. Run the numerical engine checks with Node.js:

```sh
node --test tests/rates-engine.test.cjs
```
