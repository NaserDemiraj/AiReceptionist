/**
 * Lightweight language + sentiment heuristics for EN / Albanian (sq) / German (de).
 * The LLM handles actually *replying* in the right language; these heuristics
 * only tag the conversation row for filtering/analytics — so "good enough" beats
 * an extra model call on the free tier.
 */

const SQ_MARKERS = [
  "përshëndetje", "pershendetje", "faleminderit", "ju lutem", "dëshironi", "çmimi",
  "sa kushton", "a keni", "dua", "doja", "mund të", "është", "për", "një", "divan",
  "dhomë", "krevat", "tavolinë", "tavolina", "dollap", "ngjyrë", "gjendje", "porosi",
  "dërgesa", "sugjero", "sugjeroni", "dicka", "diçka", "kërkoj", "kerkoj", "më trego",
  "me trego", "tung", "mirëdita", "miredita", "dhomën", "dhoma", "shtëpi", "shtepi",
];

const DE_MARKERS = [
  "hallo", "guten", "danke", "bitte", "ich möchte", "haben sie", "wie viel",
  "kostet", "lieferung", "bestellen", "und", "nicht", "das ist", "können",
  "schrank", "bett", "tisch", "sofa", "stuhl", "preis", "verfügbar", "größe",
];

function countMatches(text: string, markers: string[]): number {
  let n = 0;
  // Multi-word phrases ("sa kushton", "ich möchte") are unambiguous — weight 2.
  for (const m of markers) if (text.includes(m)) n += m.includes(" ") ? 2 : 1;
  return n;
}

export function detectLanguage(text: string): "en" | "sq" | "de" {
  const t = text.toLowerCase();
  // Albanian-specific letters are a strong signal
  const sqScore = countMatches(t, SQ_MARKERS) + (/[ëç]/.test(t) ? 2 : 0);
  const deScore = countMatches(t, DE_MARKERS) + (/[äöüß]/.test(t) ? 2 : 0);
  if (sqScore >= 2 && sqScore >= deScore) return "sq";
  if (deScore >= 2) return "de";
  return "en";
}

const NEGATIVE_MARKERS = [
  // en
  "unacceptable", "terrible", "awful", "angry", "refund", "complaint", "worst",
  "disappointed", "scam", "never again", "late", "broken", "damaged",
  // sq
  "e papranueshme", "i zemëruar", "ankesë", "e thyer", "dëmtuar", "vonesë", "keq",
  // de
  "inakzeptabel", "schrecklich", "beschwerde", "wütend", "kaputt", "beschädigt",
  "verspätet", "enttäuscht", "rückerstattung",
];

const POSITIVE_MARKERS = [
  "thank", "great", "perfect", "awesome", "love", "faleminderit", "shumë mirë",
  "danke", "super", "toll", "perfekt", "😊", "🙏", "❤",
];

export function detectSentiment(text: string): "POSITIVE" | "NEUTRAL" | "NEGATIVE" {
  const t = text.toLowerCase();
  if (NEGATIVE_MARKERS.some((m) => t.includes(m))) return "NEGATIVE";
  if (POSITIVE_MARKERS.some((m) => t.includes(m))) return "POSITIVE";
  return "NEUTRAL";
}
