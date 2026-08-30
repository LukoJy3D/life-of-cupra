# Life of Cupra

**Live site:** [lukojy3d.github.io/life-of-cupra](https://lukojy3d.github.io/life-of-cupra/)

Open running costs for Cupras people actually drive. Each car is a folder. The site shows the first car; averages can come later if more people contribute.

You do **not** own a leased car. A car page does not treat lease payments as depreciation. It shows sunk cash, €/month, €/km, mileage vs allowance, and a residual band.

## Contribute a car

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version:

```text
data/cars/<githubuser>-<model>-<year>/
  car.yaml      # identity + lease
  months.yaml   # one row per calendar month
```

Copy `data/cars/_template`, rename the folder so it matches `id`, set `example: false`, add months, open a PR. Yearly insurance sits on the month you paid it.

## Update an existing car

| What happened | Where |
| --- | --- |
| New month (lease, fuel, insurance, tires, km) | `data/cars/<id>/months.yaml` |
| Contract / spec change | `data/cars/<id>/car.yaml` |
| Market poll filters | [`data/market.yaml`](data/market.yaml) |

`npm run poll-market` reads public AutoScout24 search HTML for Formentor VZ 2.0 ~310 hp. Autoplius blocks datacenter fetches. Asking ≠ sold.

## How numbers are defined

**Home averages.** Mean of each live car’s all-in €/month and lease €/month. Median of cars that have €/km. Template folders (`_*`) and `example: true` are excluded.

**Sunk cash.** Upfront in the lease-start month + every monthly cost on or before today.

**All-in / month.** Sunk cash ÷ elapsed months (30.4375-day months).

**€/km.** Sunk cash ÷ (latest `odometer_km` − first). Needs at least two odometer months.

**Fuel L/100 km.** Sum of `fuel_litres` ÷ kilometres driven.

**Worth.** Monthly MY24 VZ 310 (pre-facelift) asking path in `data/market-history.yaml`, including the 2025 facelift effect, scaled to that car’s list price. Live AutoScout24 polls append new months and do not overwrite `source: backfill`. Residual band is from list price.

**What-if sliders.** Browser only. They do not rewrite YAML.

## Local

Needs **Node 22**. CI and the Markdown linter use that version.

```bash
npm install
npm run dev
npm run lint
```

Home is `/`. A car is `/#/cars/<id>`.

```bash
npm run build
npm run preview
```

CI sets `GITHUB_ACTIONS=true` so Pages uses base `/life-of-cupra/`. Enable **Settings → Pages → GitHub Actions**.
