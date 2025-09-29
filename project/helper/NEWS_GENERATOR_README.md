# News Headline Generator

This helper automatically generates engaging news headlines when a match is completed.

## Features

- **Generation:** The app calls the **backend** to generate headlines with GPT (OpenAI). The API key is stored only on the server. If the backend does not respond in time (8s) or returns an error, the app **falls back to a template** so news is always created quickly.
- **Storage:** Generated news (league + global) is saved to the Firebase `news` collection.
- **Two News Types:**
  1. **League-specific** – Shows in league detail pages
  2. **Global** – Shows in home screen "Latest News & Scores" section

## Usage

When a match status changes to "finished", call:

```typescript
import CMNewsGeneratorHelper from '../helper/CMNewsGeneratorHelper';

CMNewsGeneratorHelper.onMatchCompleted(matchId)
  .then(result => {
    if (result.isSuccess) {
      console.log('News generated:', result.value);
    } else {
      console.error('Error:', result.error);
    }
  });
```

No API key is passed from the app; the backend uses `OPENAI_API_KEY` from its environment.

## Integration Points

### 1. When Match Status Changes to "Finished"

**In CMEditMatchScreen.tsx** (when updating match status):
```typescript
// After successfully updating match to "finished"
if (updates.status === CMConstants.gameStatus.finished) {
  CMNewsGeneratorHelper.onMatchCompleted(matchId)
    .then(result => {
      if (result.isSuccess) {
        console.log('News article created for completed match');
      }
    });
}
```

**In CMScoreboardScreen.tsx** (when game ends):
```typescript
// After setting game status to finished
if (gameState.status === CMConstants.gameStatus.finished) {
  CMNewsGeneratorHelper.onMatchCompleted(match.id)
    .then(result => {
      // News will be generated automatically
    });
}
```

### 2. Displaying News

**For League-specific News:**
Query the `news` collection filtered by `leagueId` and `type: 'league'`:
```typescript
const newsQuery = query(
  collection(getFirestore(), 'news'),
  where('leagueId', '==', leagueId),
  where('type', '==', 'league'),
  orderBy('createdAt', 'desc'),
  limit(10)
);
```

**For Global News (Home Screen):**
Query the `news` collection filtered by `type: 'global'`:
```typescript
const globalNewsQuery = query(
  collection(getFirestore(), 'news'),
  where('type', '==', 'global'),
  orderBy('createdAt', 'desc'),
  limit(20)
);
```

## Headline Examples

### Template-based Examples:
- "Guerreros Defeats SGA 104-94"
- "Guerreros Dominates SGA 104-94" (high-scoring)
- "Guerreros Edges Out SGA 104-94 in Nail-Biter" (close game)
- "Mike Liander Scores 36 Points in MVP Performance!" (subtitle)

### Backend GPT (when available):
- More creative and varied headlines
- Better context awareness
- Falls back to template on timeout (8s) or error

## Backend Configuration

Set `OPENAI_API_KEY` in the backend `.env`. The app calls `POST /api/v1/news/generate-headline` (and `/generate-highlight-article` for season highlights) with auth; the backend uses GPT and returns the headline. If the backend is unavailable or times out, the app uses the template so news is always created.

## Firestore Structure

News articles are stored in the `news` collection:

```typescript
{
  id: string,
  leagueId: string,
  matchId: string,
  title: string,           // Main headline
  subtitle?: string,       // Optional player highlight
  type: 'league' | 'global',
  createdAt: Timestamp,
  matchData: {
    teamAName: string,
    teamBName: string,
    scoreA: number,
    scoreB: number,
    topPlayerName?: string,
    topPlayerPoints?: number
  }
}
```

## Notes

- News is generated automatically when match status becomes "finished"
- Both league and global news are created for each match
- Template-based generation is recommended for production (reliable, fast, free)
- GPT API is optional for enhanced creativity
- Headlines are saved to Firestore `news` collection
