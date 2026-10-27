# Daymark

Daymark is an offline-first habit and routine tracker built with React Native and Expo. It lets users define recurring items, record daily completion or numeric progress, review reports, and keep data on the device.

## Features

- Today, Reports, Items, and Settings sections.
- Daily and weekday schedules.
- Custom selected-day schedules.
- Done/not-done, quantity, and duration tracking.
- Configurable targets and units such as `8 times` or `20 minutes`.
- Create, edit, archive, restore, reorder, and permanently delete items.
- Categories, icons, and colors for items.
- Light, dark, and system themes.
- Day, week, month, quarter, half-year, and year reports.
- Completion-rate charts, item comparison, and a 28-day heatmap.
- Historical check-in editing.
- Check-in notes.
- Local JSON export/import.
- Local Android daily reminders at 8:00 AM.
- Clear local data control and privacy messaging.
- App icon, Android adaptive icon, and splash screen branding.

## Privacy and storage

Daymark is local-first. SQLite is the source of truth for items, check-ins, settings, and migrations. The app does not require an account or network connection for its core experience.

JSON export is explicit and local. Cloud backup is intentionally deferred for v1.

## Tech stack

- Expo SDK 58
- React Native JavaScript
- React 19
- Expo SQLite
- NativeWind and Tailwind CSS
- Lucide React Native
- Expo Notifications for Android local reminders
- Jest with Babel-based tests

## Project structure

```text
App.js                 Main application and screens
src/analytics.js       Schedules, completion rules, reports, streaks
src/storage.js         SQLite schema, migrations, load/save repository
tests/                 Analytics and storage tests
assets/                Logo and splash assets
app.json               Expo branding and native configuration
eas.json               Development, preview, and production build profiles
web/                   Static landing page and Android download slot
```

## Setup

Install dependencies:

```bash
npm install
```

Start Expo with a clean Metro cache:

```bash
npx expo start -c
```

Run the web build:

```bash
npm run web
```

Run tests:

```bash
npm test
```

## Android reminders

Expo Go may not provide the native notification module required by the app. Use an Android development build for reminders:

```bash
npx expo run:android
```

The reminder is local and scheduled for 8:00 AM. Remote push notifications are not part of v1.

## Production builds

The app uses the identifiers `com.daymark.app` for Android and iOS. Review these identifiers before publishing if the application will use a different ownership or package namespace.

Build profiles are defined in [eas.json](./eas.json):

- `development`: development client for native-module testing.
- `preview`: internal distribution build.
- `production`: release build profile.

The remaining release work is signing, device smoke testing, store metadata, and a final privacy-policy URL.

## Database migrations

The SQLite schema is versioned with `PRAGMA user_version`.

- Version 2: normalized `items` and `check_ins` tables from the original JSON snapshot.
- Version 3: categories, icons, colors, and ordering.
- Version 4: tracking type, target, and unit fields.

Existing local data is migrated when the app starts. The UI talks to `loadState()` and `saveState()` rather than issuing SQL directly.

## Validation

The current validation commands are:

```bash
npm test
npx expo export --platform web
npx expo config --type public
```

The test suite covers weekday boundaries, quantity/duration completion, streaks, report completion, item normalization, and persistence defaults.

## Known follow-up work

The remaining release work is signed Android smoke testing, store metadata, and final privacy-policy publishing details.

## Landing page

The static landing page is in [web/index.html](./web/index.html) with styles in [web/styles.css](./web/styles.css). It uses the project logo and includes an Android download link. Before publishing, place the signed release at `web/daymark.apk`.
