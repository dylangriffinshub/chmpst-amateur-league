/**
 * CMNewsGeneratorHelper
 * Generates AI-powered news headlines for completed matches.
 * Uses backend GPT (API key on server); on timeout/error falls back to template.
 * Saves results to Firebase.
 */

import CMFirebaseHelper from './CMFirebaseHelper';
import CMConstants from '../CMConstants';
import CMGlobal from '../CMGlobal';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, doc, setDoc, Timestamp } from '@react-native-firebase/firestore';
import firestore from '@react-native-firebase/firestore';

const BACKEND_HEADLINE_TIMEOUT_MS = 8000;
const BACKEND_HIGHLIGHT_TIMEOUT_MS = 12000;

/** Get auth token for backend API (Firebase or Apple Sign In). */
const getBackendAuthToken = async (): Promise<string | null> => {
  try {
    const firebaseUser = getAuth().currentUser;
    if (firebaseUser) {
      const token = await firebaseUser.getIdToken(true);
      return token || null;
    }
    const restApiAuth = (CMGlobal as any).restApiAuth;
    if (restApiAuth?.idToken) return restApiAuth.idToken;
    return null;
  } catch {
    return null;
  }
};

interface MatchData {
  id: string;
  leagueId: string;
  teamAId: string;
  teamBId: string;
  teamAScore: number;
  teamBScore: number;
  name: string;
  topScorePlayerId?: string;
  topScore?: number;
  seasonName?: string;
  isPlayoff?: boolean;
  playoffRound?: number;
}

interface TeamData {
  id: string;
  name: string;
  avatar?: string;
}

interface PlayerData {
  id: string;
  name: string;
  avatar?: string;
  points?: number;
}

interface NewsArticle {
  id: string;
  leagueId: string;
  matchId: string;
  title: string;
  subtitle?: string;
  type: 'league' | 'global'; // League-specific or all-leagues news
  createdAt: Timestamp;
      matchData: {
    teamAName: string;
    teamBName: string;
    scoreA: number;
    scoreB: number;
    topPlayerName?: string;
    topPlayerPoints?: number;
    teamAAvatar?: string;
    teamBAvatar?: string;
  };
}

/**
 * Request highlight article from backend (GPT on server). Returns null on timeout/error.
 */
const fetchHighlightArticleFromBackend = async (
  highlightType: 'champion' | 'topScorer' | 'intenseMatch',
  leagueName: string,
  seasonName: string | undefined,
  context: { [key: string]: any }
): Promise<{ title: string; subtitle?: string; body: string } | null> => {
  const token = await getBackendAuthToken();
  if (!token) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_HIGHLIGHT_TIMEOUT_MS);

  try {
    const baseUrl = CMConstants.api.baseUrl;
    const version = CMConstants.api.version;
    const res = await fetch(`${baseUrl}/api/${version}/news/generate-highlight-article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        highlightType,
        leagueName,
        seasonName: seasonName ?? undefined,
        context,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.title != null) {
      return {
        title: data.title,
        subtitle: data.subtitle,
        body: data.body ?? '',
      };
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
};

/**
 * Fallback template article when GPT is not available
 */
const generateTemplateHighlightArticle = (
  highlightType: 'champion' | 'topScorer' | 'intenseMatch',
  leagueName: string,
  seasonName: string | undefined,
  context: { [key: string]: any },
): { title: string; subtitle?: string; body: string } => {
  const seasonLabel = seasonName ? `Season "${seasonName}"` : 'this season';

  if (highlightType === 'champion') {
    const { teamName, record } = context;
    const title = `${teamName} Crowned Champions of ${leagueName}!`;
    const subtitle = `${teamName} finishes ${record} to lift the trophy.`;
    const body = `${teamName} have been officially crowned champions of ${leagueName} for ${seasonLabel}. After a long grind of games, they finished with a strong ${record} record and separated themselves from the rest of the field.\n\nFrom opening tip to the final buzzer, ${teamName} set the tone with tough defense, unselfish offense, and big-time performances when it mattered most. Opponents quickly realized that every possession against them had to be earned.\n\nThe title run also shows how competitive and organized the league has become. With tools like scheduling, stats, and live scores all inside the CHMPST app, fans and players can relive every key moment from this memorable championship season.\n\nCongratulations to ${teamName} and everyone involved in ${leagueName}. Tap into the CHMPST app to explore full box scores, player awards, and behind-the-scenes stories from this championship campaign.`;
    return { title, subtitle, body };
  }

  if (highlightType === 'topScorer') {
    const { playerName, teamName, pointsPerGame } = context;
    const title = `${playerName} Dominates as Scoring Leader`;
    const subtitle = `${playerName} averages ${pointsPerGame.toFixed(1)} PPG for ${teamName}.`;
    const body = `${playerName} turned ${seasonLabel} into a personal scoring clinic, leading ${leagueName} in points per game with an impressive ${pointsPerGame.toFixed(
      1,
    )} PPG.\n\nDefenses tried everything—double teams, traps, and physical play—but ${playerName} continued to find ways to score. Whether it was attacking the rim, knocking down jumpers, or creating off the dribble, the scoring threat was constant.\n\nFor ${teamName}, having a go-to option in crunch time made a huge difference, and fans inside the CHMPST app followed every big performance through live scores and postgame stats.\n\nIf you want to see how ${playerName} stacked up against the rest of the league, dive into the stats hub inside CHMPST and explore leaderboards, game logs, and more.`;
    return { title, subtitle, body };
  }

  const { teamAName, teamBName, scoreLine, margin } = context;
  const title = `${teamAName} vs ${teamBName}: Game of the Season`;
  const subtitle = `A thriller decided by just ${margin} points.`;
  const body = `Some games feel bigger the moment the ball goes up, and this matchup between ${teamAName} and ${teamBName} turned into exactly that. The contest finished ${scoreLine}, and every possession down the stretch felt like a season-defining play.\n\nMomentum swung back and forth as both teams traded runs, big shots, and clutch defensive stands. With the outcome hanging in the balance, fans in the gym and inside the CHMPST app were glued to every update.\n\nIn the end, the ${margin}-point margin hardly tells the full story of the heart, hustle, and emotion poured into this game. It’s the kind of battle that keeps players hungry and fans coming back week after week.\n\nRelive this instant classic in the CHMPST app, where you can revisit stats, play-by-play details, and more unforgettable matchups from ${leagueName}.`;
  return { title, subtitle, body };
};

/**
 * Public helper to generate an article for a season highlight (used from UI when tapping highlight cards).
 * Tries backend GPT first; on timeout/error uses template.
 */
const generateHighlightArticle = async (
  highlightType: 'champion' | 'topScorer' | 'intenseMatch',
  leagueName: string,
  seasonName: string | undefined,
  context: { [key: string]: any },
  _useGPT?: boolean,
  _gptApiKey?: string
): Promise<{ isSuccess: boolean; value?: { title: string; subtitle?: string; body: string }; error?: string }> => {
  try {
    const fromBackend = await fetchHighlightArticleFromBackend(
      highlightType,
      leagueName,
      seasonName,
      context
    );
    if (fromBackend) return { isSuccess: true, value: fromBackend };
    const tmpl = generateTemplateHighlightArticle(highlightType, leagueName, seasonName, context);
    return { isSuccess: true, value: tmpl };
  } catch (error: any) {
    console.error('[NewsGenerator] Error generating highlight article:', error);
    const fallback = generateTemplateHighlightArticle(highlightType, leagueName, seasonName, context);
    return { isSuccess: false, value: fallback, error: error.message || 'Failed to generate article' };
  }
};

/**
 * Template-based headline generation (no API needed)
 */
const generateTemplateHeadline = (
  teamAName: string,
  teamBName: string,
  scoreA: number,
  scoreB: number,
  topPlayerName?: string,
  topPlayerPoints?: number,
  isPlayoff?: boolean,
  playoffRound?: number
): { title: string; subtitle?: string } => {
  const winner = scoreA > scoreB ? teamAName : teamBName;
  const loser = scoreA > scoreB ? teamBName : teamAName;
  const winnerScore = scoreA > scoreB ? scoreA : scoreB;
  const loserScore = scoreA > scoreB ? scoreB : scoreA;
  const margin = winnerScore - loserScore;

  // Round name for playoffs
  const roundNames: { [key: number]: string } = {
    1: 'First Round',
    2: 'Quarter-Finals',
    3: 'Semi-Finals',
    4: 'Final',
  };
  const roundName = isPlayoff && playoffRound ? roundNames[playoffRound] || `Round ${playoffRound}` : null;

  // Headline templates based on game context
  const templates: string[] = [];

  // High-scoring game
  if (winnerScore >= 100) {
    templates.push(`${winner} Dominates ${loser} ${winnerScore}-${loserScore}`);
    templates.push(`${winner} Scores Century in Victory Over ${loser}`);
  }

  // Close game
  if (margin <= 5) {
    templates.push(`${winner} Edges Out ${loser} in Nail-Biter ${winnerScore}-${loserScore}`);
    templates.push(`${winner} Wins Thriller Against ${loser} ${winnerScore}-${loserScore}`);
  }

  // Blowout
  if (margin >= 20) {
    templates.push(`${winner} Crushes ${loser} ${winnerScore}-${loserScore}`);
    templates.push(`${winner} Routs ${loser} in Dominant Performance`);
  }

  // Playoff-specific
  if (isPlayoff && roundName) {
    templates.push(`${winner} Advances to Next Round After ${winnerScore}-${loserScore} Victory`);
    templates.push(`${winner} Defeats ${loser} ${winnerScore}-${loserScore} in ${roundName}`);
  }

  // Default
  if (templates.length === 0) {
    templates.push(`${winner} Defeats ${loser} ${winnerScore}-${loserScore}`);
    templates.push(`${winner} Takes Victory Over ${loser} ${winnerScore}-${loserScore}`);
  }

  // Randomly select a template
  const title = templates[Math.floor(Math.random() * templates.length)];

  // Generate subtitle if top player info available
  let subtitle: string | undefined;
  if (topPlayerName && topPlayerPoints !== undefined) {
    const playerTemplates = [
      `${topPlayerName} Scores ${topPlayerPoints} Points in MVP Performance!`,
      `${topPlayerName} Leads with ${topPlayerPoints} Points!`,
      `${topPlayerName} Drops ${topPlayerPoints} Points in Victory!`,
      `${topPlayerName} Puts Up ${topPlayerPoints} Points!`,
    ];
    subtitle = playerTemplates[Math.floor(Math.random() * playerTemplates.length)];
  }

  return { title, subtitle };
};

/**
 * Request headline from backend (GPT on server). Returns null on timeout/error.
 */
const fetchHeadlineFromBackend = async (
  teamAName: string,
  teamBName: string,
  scoreA: number,
  scoreB: number,
  topPlayerName?: string,
  topPlayerPoints?: number,
  isPlayoff?: boolean,
  playoffRound?: number
): Promise<{ title: string; subtitle?: string } | null> => {
  const token = await getBackendAuthToken();
  if (!token) {
    console.warn('[NewsGenerator] No auth token, skipping backend headline');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_HEADLINE_TIMEOUT_MS);

  try {
    const baseUrl = CMConstants.api.baseUrl;
    const version = CMConstants.api.version;
    const res = await fetch(`${baseUrl}/api/${version}/news/generate-headline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        teamAName,
        teamBName,
        scoreA,
        scoreB,
        topPlayerName: topPlayerName || undefined,
        topPlayerPoints: topPlayerPoints != null ? topPlayerPoints : undefined,
        isPlayoff,
        playoffRound,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 504) console.warn('[NewsGenerator] Backend headline timeout');
      else console.warn('[NewsGenerator] Backend headline error:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.success && data.title) {
      return { title: data.title, subtitle: data.subtitle };
    }
    return null;
  } catch (e) {
    clearTimeout(timeoutId);
    if ((e as any)?.name === 'AbortError') console.warn('[NewsGenerator] Backend headline timeout');
    else console.warn('[NewsGenerator] Backend headline request failed:', (e as any)?.message);
    return null;
  }
};

/**
 * Generate and save news article for a completed match.
 * Tries backend GPT first (short timeout); on failure uses template. Saves to Firebase.
 */
const generateAndSaveNews = async (
  match: MatchData,
  teamA: TeamData,
  teamB: TeamData,
  topPlayer?: PlayerData
): Promise<{ isSuccess: boolean; value?: NewsArticle; error?: string }> => {
  try {
    const db = getFirestore();

    // Try backend GPT first (quick timeout to avoid blocking user)
    let headline = await fetchHeadlineFromBackend(
      teamA.name,
      teamB.name,
      match.teamAScore ?? 0,
      match.teamBScore ?? 0,
      topPlayer?.name,
      topPlayer?.points ?? match.topScore ?? undefined,
      match.isPlayoff,
      match.playoffRound ?? undefined
    );
    if (!headline) {
      headline = generateTemplateHeadline(
        teamA.name,
        teamB.name,
        match.teamAScore ?? 0,
        match.teamBScore ?? 0,
        topPlayer?.name,
        topPlayer?.points ?? match.topScore,
        match.isPlayoff,
        match.playoffRound
      );
    }

    // Create news article for league-specific feed
    const leagueNewsId = CMFirebaseHelper.getNewDocumentId('news');
    const leagueNews: any = {
      id: leagueNewsId,
      leagueId: match.leagueId,
      matchId: match.id,
      title: headline.title,
      type: 'league',
      createdAt: Timestamp.now(),
      matchData: {
        teamAName: teamA.name,
        teamBName: teamB.name,
        scoreA: match.teamAScore || 0,
        scoreB: match.teamBScore || 0,
        teamAAvatar: teamA.avatar,
        teamBAvatar: teamB.avatar,
      },
    };

    // Only add optional fields if they have values (Firestore doesn't allow undefined)
    if (headline.subtitle) {
      leagueNews.subtitle = headline.subtitle;
    }
    if (topPlayer?.name) {
      leagueNews.matchData.topPlayerName = topPlayer.name;
    }
    if (topPlayer?.points !== undefined && topPlayer.points !== null) {
      leagueNews.matchData.topPlayerPoints = topPlayer.points;
    } else if (match.topScore !== undefined && match.topScore !== null) {
      leagueNews.matchData.topPlayerPoints = match.topScore;
    }
    if (match.seasonName) {
      leagueNews.matchData.seasonName = match.seasonName;
    }
    if (match.isPlayoff !== undefined) {
      leagueNews.matchData.isPlayoff = match.isPlayoff;
    }
    if (match.playoffRound !== undefined && match.playoffRound !== null) {
      leagueNews.matchData.playoffRound = match.playoffRound;
    }

    await setDoc(doc(collection(db, 'news'), leagueNewsId), leagueNews);

    // Create news article for global/all-leagues feed
    const globalNewsId = CMFirebaseHelper.getNewDocumentId('news');
    const globalNews: any = {
      ...leagueNews,
      id: globalNewsId,
      type: 'global',
    };

    await setDoc(doc(collection(db, 'news'), globalNewsId), globalNews);

    console.log('[NewsGenerator] News articles created:', { leagueNewsId, globalNewsId });

    return {
      isSuccess: true,
      value: leagueNews,
    };
  } catch (error: any) {
    console.error('[NewsGenerator] Error generating news:', error);
    return {
      isSuccess: false,
      error: error.message || 'Failed to generate news article',
    };
  }
};

/**
 * Main function to be called when a match is completed.
 * Uses backend GPT (if available) with template fallback; saves to Firebase.
 */
const onMatchCompleted = async (
  matchId: string,
  _useGPT?: boolean,
  _gptApiKey?: string
): Promise<{ isSuccess: boolean; value?: string; error?: string }> => {
  try {
    // Load match data
    const match = await new Promise<MatchData | null>((resolve) => {
      CMFirebaseHelper.getMatch(matchId, (response: { [name: string]: any }) => {
        if (response.isSuccess && response.value) {
          resolve(response.value);
        } else {
          resolve(null);
        }
      });
    });

    if (!match || match.status !== CMConstants.gameStatus.finished) {
      return { isSuccess: false, error: 'Match not found or not completed' };
    }

    // Load teams by ID using Firestore directly
    const [teamADoc, teamBDoc] = await Promise.all([
      firestore().collection('teams').doc(match.teamAId).get(),
      firestore().collection('teams').doc(match.teamBId).get(),
    ]);

    const teamA: TeamData | null = teamADoc.exists() 
      ? { id: teamADoc.id, ...teamADoc.data() } as TeamData
      : null;
    const teamB: TeamData | null = teamBDoc.exists()
      ? { id: teamBDoc.id, ...teamBDoc.data() } as TeamData
      : null;

    if (!teamA || !teamB) {
      return { isSuccess: false, error: 'Teams not found' };
    }

    // Load top player if available
    let topPlayer: PlayerData | undefined;
    if (match.topScorePlayerId) {
      topPlayer = await new Promise<PlayerData | undefined>((resolve) => {
        CMFirebaseHelper.getPlayer(match.topScorePlayerId!, (response: { [name: string]: any }) => {
          if (response.isSuccess && response.value) {
            resolve({
              id: response.value.id,
              name: response.value.name,
              avatar: response.value.avatar,
              points: match.topScore,
            });
          } else {
            resolve(undefined);
          }
        });
      });
    }

    // Generate and save news (backend GPT with template fallback, then save to Firebase)
    const result = await generateAndSaveNews(match, teamA, teamB, topPlayer);

    return {
      isSuccess: result.isSuccess,
      value: result.isSuccess ? 'News article generated successfully' : undefined,
      error: result.error,
    };
  } catch (error: any) {
    console.error('[NewsGenerator] Error in onMatchCompleted:', error);
    return {
      isSuccess: false,
      error: error.message || 'Failed to process match completion',
    };
  }
};

export default {
  generateTemplateHeadline,
  generateAndSaveNews,
  onMatchCompleted,
  generateHighlightArticle,
};
