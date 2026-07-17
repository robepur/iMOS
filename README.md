# 22Vets Sales Rep Commission Calculator

Executive financial planning application for evaluating the profitability of hiring an individual salaried Sales Representative.

## Purpose

This standalone client-side application supports leadership decision-making by answering:

1. How much revenue is required before a Sales Representative becomes profitable.
2. When commission begins.
3. How much Gross Profit the company retains.
4. What the Sales Representative's Annual OTE is.
5. Whether the scenario is financially sustainable.

## Application profile

- Fully offline capable (no backend, no APIs, no external libraries).
- Desktop-first executive command-center interface with ARGUS Tactical branding.
- Not a spreadsheet UI.
- Real-time formatting and live calculations.

## Business logic

### Constants

- Administration Fee Rate = **5%**
- Burden Multiplier = **1.30**

### Core formulas

- **Gross Profit** = Revenue x Gross Margin
- **Administration Fee** = Gross Profit x 5%
- **Adjusted Gross Profit (AGP)** = Gross Profit - Administration Fee
- **Annual Burden** = Salary x 1.30
- **Commission Eligibility**: commission is paid only when **AGP > Annual Burden**
- **Commission Eligible AGP** = AGP − Annual Burden
- **Sales Commission** = Commission Eligible AGP x Commission %
- **Annual OTE** = Salary + Commission
- **Company Retained GP** = AGP - Annual Burden - Commission
- **Retained GP %** = Company Retained GP ÷ Gross Profit
- **Break Even Revenue** = Annual Burden ÷ (Gross Margin × 95%)

## Files

- `index.html` - single-page application shell and executive layout.
- `styles.css` - ARGUS Tactical visual system and responsive layout.
- `app.js` - input formatting, calculation engine, dashboard rendering, CSV export, and print.
- `README.md` - project documentation.
- `LICENSE` - open-source license.
- `logo.png` - official 22Vets logo used in the header.

## Deployment (GitHub Pages)

Expected publish URL:

`https://<github-username>.github.io/<repository-name>/`

Enable GitHub Pages from:

1. **Repository Settings**
2. **Pages**
3. **Build and deployment → Source**
4. Select **Deploy from a branch**
5. Select branch **main** and folder **/(root)**

## Version

**1.0.0**

## License

Released under the **MIT License**. See `LICENSE`.
