# CHMPST — Amateur League Manager

CHMPST is a React Native / Expo app for running amateur sports leagues: teams, rosters, schedules, playoffs, live scoreboards, and player stats, all in one place for coaches, officials, and players.

## Features

- **League & team management** — create leagues, manage settings, build and edit team rosters.
- **Player management** — rosters, player profiles, claims and invites, top player rankings.
- **Scheduling & playoffs** — auto-generate season schedules, track season history, run playoff brackets.
- **Live basketball scoreboard** — real-time score and game-clock tracking, quarter management, foul tracking, an interactive court for quick stat entry, and shot-chart analytics with filtering by team/quarter/shot type. See below for details.
- **Activity feed & news** — a generic activity feed plus an AI-assisted news generator for league updates.
- **Accounts & subscriptions** — login/registration, profile editing, and a paywall/subscription flow via StoreKit.
- **Firebase-backed** — auth, data, and Cloud Functions for backend logic.

## Tech stack

- React Native (Expo, EAS build/config)
- TypeScript
- Firebase (Auth, Firestore, Cloud Functions)
- Native iOS (Xcode project, Swift) and Android (Gradle) projects

## Project structure

```
project/
├── screens/       # App screens (home, league, team, player, match, scoreboard, settings, auth)
├── components/     # Reusable UI components (cells, modals, court view, tab bar, etc.)
├── dialog/         # Modal/dialog content
├── navigation/      # Navigation stacks and routing
├── helper/         # Firebase, auth, storage, permissions, subscriptions, news generation
├── model/          # Shared data models
├── styles/         # Shared style definitions
└── utils/          # General utilities
ios/                # Native iOS project
android/            # Native Android project
functions/          # Firebase Cloud Functions
```

## Getting started

```bash
# install dependencies
yarn install

# start Metro
npx expo start

# run on a platform
npx react-native run-ios
npx react-native run-android
```

Requires a Firebase project (`firebase.json`, `GoogleService-Info.plist`, `google-services.json`) and EAS project config (`eas.json`) for builds.

## Live scoreboard

The scoreboard feature covers full in-game management: home/visitor score tracking, a 10-minute quarter timer with play/pause, individual and team foul tracking, and automatic quarter progression. Player stats (points by shot type, rebounds, assists, blocks, turnovers, steals, fouls) are entered by tapping a player's jersey on an interactive court view. A shot-chart view visualizes attempts on the court with filtering by team, quarter, or shot type, and summarizes shooting performance. Data syncs to Firebase (`games`, `gameStats` collections) in real time.

## License

Proprietary — all rights reserved.
