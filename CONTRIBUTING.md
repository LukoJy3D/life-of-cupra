# Add your Cupra

The site is static. Your car becomes part of the home-page averages when the PR merges.

## 1. Copy the template

```bash
cp -r data/cars/_template data/cars/<githubuser>-<model>-<year>
```

Example: `data/cars/anna-born-2025`.

The folder name **must** match `id` in `car.yaml`.

## 2. Fill `car.yaml`

Owner, trim, engine, prices, lease dates, km/year, buyout. Set `example: false`.

## 3. Fill `months.yaml`

One object per calendar month. Every expense field is present; use `0` when nothing was paid.

```yaml
months:
  - month: 2025-03
    lease_eur: 412.10
    insurance_eur: 840
    fuel_eur: 95.20
    fuel_litres: 68.4
    tires_eur: 0
    maintenance_eur: 0
    other_eur: 0
    odometer_km: 14820
    remaining_eur: 28100
    note: kasko renewal
```

Rules:

- All entries are **monthly**. Yearly insurance goes on the month you paid it.
- Write every expense field. Use `0` when nothing was paid that month.
- `odometer_km` is the reading at month end. Needed for €/km and L/100 km.
- `lease_eur` is the bank total for that month (Euribor and all).

## 4. Open a pull request

`npm run lint` and `npm run build` should succeed. Do not add `_template` clones with `example: true` unless you are documenting the format.
