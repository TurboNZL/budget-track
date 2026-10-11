# BudgetTrack

A personal budgeting app that runs entirely in your browser: accounts, subscriptions, debts, interest, taxes, a history timeline and a lot of graphs. There is no server and no account. **Your data never leaves your device**; it is stored in `localStorage` and in `.db` files (JSON) you export yourself.

Built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui and Recharts.

## Features

- **Accounts** – add and edit transactions in popups (income, deposit, spend, transfer between accounts), categories, search, sortable columns (the undated "unaccounted" amounts sort with everything else), undo on delete. Set an account's current balance and optionally **lock** it.
- **Subscriptions** – recurring payments from daily to every 2 years (or custom), yours, someone else's, or a loan with a person, with per-item rounding.
- **Debts** – money you owe and money owed to you, repayment history, and loans taken off your income automatically (an NZ student loan preset: 12% above $24,128 a year). Mark a debt as **stale** when it is no longer a concern: it stays on record but leaves the totals and graphs.
- **Interest** – account interest rules and an interest / RWT calculator. Defaults to monthly; switch to yearly in Settings.
- **Taxes** – tax rules for interest (e.g. RWT) and income.
- **History** – a timeline that overlays subscription payments, interest, tax and loan deductions on an account's transactions with a running balance.
- **Graphs** – filter by account. Category and spending breakdowns, income vs spending, net saved per month, category trends, weekday spending, balance per account, balance projection, subscription costs, debt by person, debt progress and payoff projection. Charts follow the selected UI style.
- **Settings** – exchange rates, default RWT, interest basis (monthly / yearly), appearance, wallpaper, people and categories.

### Appearance

33 colour themes (plus "System") and 10 UI styles, in any combination, with a framed live preview:

- UI styles: Default, GTK 4 (Adwaita), KDE Breeze, Windows 11, Windows 10, Windows 7 (Aero), Windows XP (Luna), Windows 98, macOS and Material 3.
- Platform colour themes (Adwaita, Breeze, Windows 11 / 10 / 7 / XP / 98, macOS, Material You, plus a darkened Windows 7) pair with their matching style, and "Use matching colours" applies the right one.

The logo and favicon follow the chosen theme and style. Free fonts are bundled (Inter, Cantarell, Noto Sans, Open Sans, DejaVu Sans, Roboto); Segoe UI, Tahoma and the system UI font are used when installed. The styles imitate the *look* of these platforms with original CSS; no vendor assets are included, and all names belong to their owners.

## Privacy

- No analytics, no network requests for your data, no API keys, no backend.
- Anything you enter lives in your browser's `localStorage`. Clearing site data removes it, so export a `.db` file for backups.
- `.db` exports contain your financial data. Keep them out of public repositories.

## Development

```sh
pnpm install
pnpm dev      # http://localhost:8080
pnpm build    # production build in dist/
pnpm lint
```

## Deploying to GitHub Pages

Set Settings → Pages → Source to "GitHub Actions"; `.github/workflows/deploy.yml` builds and deploys on push to `main`. The app uses a hash router and relative asset paths, so it works under any repo sub-path.

## Contributing

Issues and pull requests are welcome. Please never attach a real `.db` export; make a small fake one instead.

## License

[MIT](LICENSE)
