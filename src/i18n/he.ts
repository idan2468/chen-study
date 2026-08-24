/**
 * Hebrew UI strings -- the default locale, and the source of truth for the key
 * shape (`en.ts` is typed against this, so a missing translation is a compile
 * error).
 *
 * Scope: **UI chrome only**. The learning content is deliberately absent --
 * module `rule` HTML, nikud transliterations, Hebrew glosses and question titles
 * come from the exercise data, because that is the material being taught rather
 * than interface text.
 */
export const he = {
  common: {
    home: "דף הבית",
    dyslexiaFont: "גופן נגיש",
    dyslexiaFontTooltip: "גופן מותאם לדיסלקציה",
    dayMode: "מצב יום",
    nightMode: "מצב לילה",
    syncDevices: "סנכרון בעזרת קישור",
    switchToEnglish: "English",
    switchToHebrew: "עברית",
    languageTooltip: "החלפת שפת הממשק",
    cancel: "ביטול",
    delete: "מחיקה",
    reset: "איפוס",
    close: "סגירה",
    stop: "עצירה",
    previous: "← הקודם",
    next: "הבא →",
    flipHint: "לחיצה להיפוך הכרטיסייה",
    cardAriaLabel: "כרטיסייה - לחיצה להיפוך",
    speakWord: "הקראת המילה {{word}}",
    stopSpeaking: "עצירת ההקראה: {{label}}",
    deleteItem: "מחיקת {{name}}",
    voiceSettings: "הגדרות קול",
    settingsMenu: "הגדרות",
    connectGoogle: "חיבור לחשבון Google",
    googleConnected: "{{email}} · התנתקות",
    googleConnectError: "החיבור לחשבון Google נכשל. נסו שוב.",
    restoringSync: "משחזר את ההתקדמות המסונכרנת...",
    googleSyncError: "הסנכרון עם Google Drive נכשל.",
    googleSyncSuccess: "הסנכרון עם Google Drive הושלם",
    syncNowLabel: "סנכרון עכשיו",
    reconnectLabel: "הקישו להתחברות מחדש",
  },

  hub: {
    title: "📚 מרכז תרגול אנגלית אינטראקטיבי",
    subtitle: "בחרו את אפליקציית התרגול הרצויה להתחלת הלמידה",
    footer: "תרגול אנגלית אינטראקטיבי • מותאם למחשב ולסלולר",
    unseenTitle: "תרגול קריאה באנגלית (Unseen)",
    unseenDescription:
      "קטעי קריאה אינטראקטיביים עם הקראה בקול (T2S), מרקור מילים, שאלות אמריקאיות, כרטיסיות מילים ומצב נגישות לדיסלקציה.",
    unseenCta: "פתיחת תרגול Unseen ➔",
    modulesTitle: "כרטיסיות תרגול מודולים",
    modulesDescription:
      "ערכות תרגול מנוקדות לפי מודולים (תנועות A, O, I), מעקב והתקדמות אישית, הקראת מילים, אפשרות למחיקת טאבים ונגישות.",
    modulesCta: "פתיחת כרטיסיות מודולים ➔",
  },

  sync: {
    title: "סנכרון בין מכשירים",
    description:
      "העתיקו את הקישור ופתחו אותו במכשיר האחר. כל ההתקדמות, המודולים והתרגילים שלכם יעברו לשם.",
    linkLabel: "קישור סנכרון",
    copyLink: "העתקת הקישור",
    copied: "הקישור הועתק ✓",
    importedTitle: "הנתונים סונכרנו",
    importedMessage: "יובאו {{count}} פריטי מידע מהמכשיר האחר.",
  },

  json: {
    loadTemplate: "📋 טעינת תבנית לדוגמה",
    copyContent: "העתקת התוכן",
    copied: "הועתק ✓",
    contentLabel: "תוכן JSON",
    loadAndAdd: "➕ טעינה והוספה",
  },

  modules: {
    fallbackTitle: "תרגול מודולים",
    noModules: "אין מודולים זמינים",
    moduleMeta: "{{tabName}} • {{count}} מילים",
    ruleTitle: "הכלל",
    statKnown: "הצלחתי",
    statUnknown: "צריכה תרגול",
    statPending: "לא סומנו",
    filterOn: "מציג: לא נכונות",
    filterOff: "סינון: לא נכונות",
    resetModule: "איפוס המודול",
    markKnown: "✔ הצלחתי",
    markUnknown: "✖ צריכה תרגול",
    allDone: "🎉 כל הכבוד! אין כרטיסיות להצגה.",
    shortcutsLabel: "קיצורי מקלדת:",
    shortcuts:
      " [רווח] הפיכה | [חצים] מעבר | [S] הקראה | [1] הצלחתי | [2] צריכה תרגול",
    deleteTitle: "מחיקת מודול",
    deleteBody: 'למחוק את המודול "{{name}}"? ההתקדמות על המילים עצמן תישמר.',
    cannotDeleteTitle: "לא ניתן למחוק",
    cannotDeleteBody: "חייב להישאר לפחות מודול אחד.",
    resetTitle: "איפוס התקדמות",
    resetBody: 'לאפס את ההתקדמות של כל המילים במודול "{{name}}"?',
    jsonSectionTitle: "⚙️ הוספת מודולים משלכם (JSON)",
    jsonInstructions:
      "הדביקו כאן אובייקט JSON של מודול, או מערך של כמה מודולים. שדה cards הוא חובה; id ו-tabName יושלמו אוטומטית אם חסרים.",
    jsonAdded: "נוספו {{count}} מודולים בהצלחה.",
    missedReviewButton: "🔁 תרגול מילים שטעיתי ({{count}})",
    missedReviewTitle: "תרגול מילים שטעיתי",
    missedReviewSubtitle: "נשארו {{count}} מילים מכל המודולים",
    backToModules: "🔙 חזרה למודולים",
    moduleCompleteAllKnown: "🎉 כל המילים במודול הזה ידועות!",
    moduleCompletePartial:
      "✅ עברתם על כל המילים במודול הזה. {{count}} עדיין דורשות תרגול",
  },

  unseen: {
    fallbackTitle: "תרגול קריאה",
    noExercise: "לא נטען תרגיל.",
    tabReading: "📖 קריאה ושאלות",
    tabFlashcards: "🗂️ כרטיסיות מילים",
    tabJson: "⚙️ טעינת תרגיל",
    selectExercise: "בחירת תרגיל מהספרייה",
    deleteExercise: "מחיקת התרגיל הנוכחי",
    deleteTitle: "מחיקת תרגיל",
    deleteBody: 'למחוק את התרגיל "{{name}}"?',
    cannotDeleteTitle: "לא ניתן למחוק",
    cannotDeleteBody: "חייב להישאר לפחות תרגיל אחד בספרייה.",
    playAll: "הקראת הקטע כולו",
    playAllLabel: "הקראת כל הקטע",
    readingHint:
      "💡 לחיצה על מילה תשמיע אותה • לחיצה כפולה תסמן אותה בצבע • מילים מודגשות מופיעות גם בכרטיסיות",
    paragraphPlay: "הקראה מהפסקה {{number}} והלאה",
    speakQuestion: "הקראת השאלה והתשובות",
    speakOption: "הקראת אפשרות {{number}}",
    answerCorrect: "כל הכבוד! תשובה נכונה ✓",
    answerIncorrect: "לא מדויק. נסו שוב או האזינו לקטע פעם נוספת.",
    statVocab: "מילים בכרטיסיות",
    statKnown: "מכירה",
    statUnknown: "לא מכירה",
    markKnown: "✔ מכירה",
    markUnknown: "✖ לא מכירה",
    resetMarks: "איפוס הסימונים",
    resetTitle: "איפוס התקדמות",
    resetBody: "לאפס את הסימונים של כל כרטיסיות המילים בתרגיל הזה?",
    noFlashcards: "אין כרטיסיות מילים בתרגיל הזה.",
    jsonInstructions:
      "הדביקו כאן אובייקט JSON של תרגיל. שדות החובה: paragraphs, questions, flashcards. מזהה התרגיל נוצר אוטומטית.",
    jsonLoaded: "התרגיל נטען ונוסף לספרייה בהצלחה.",
  },

  speech: {
    title: "הגדרות הקראה",
    systemVoiceLabel: "קול לאנגלית",
    systemVoiceHint:
      "הדפדפן בוחר כברירת מחדל קול בסיסי. במק אפשר להוריד קולות משופרים בהגדרות המערכת.",
    bestAvailable: "הקול הטוב ביותר שזמין",
    test: "השמעת דוגמה",
    speechRate: "מהירות ההקראה: {{rate}}x",
    speechRateLabel: "מהירות ההקראה",
  },

  /** Validation failures from the JSON importers. */
  importErrors: {
    invalidJson: "ה-JSON אינו תקין. בדקו סוגריים ופסיקים.",
    noModules: "לא נמצאו מודולים לטעינה.",
    moduleBadShape: "מודול {{position}}: מבנה לא תקין.",
    moduleMissingCards: 'מודול {{position}}: חסרה רשימת קלפים ("cards").',
    moduleMissingCardWord:
      'מודול {{position}}, קלף {{cardPosition}}: חסרה המילה באנגלית ("en").',
    exerciseNotObject: "יש להדביק אובייקט JSON אחד של תרגיל.",
    exerciseMissingParagraphs: 'חסר שדה "paragraphs" (מערך של פסקאות טקסט).',
    exerciseMissingQuestions: 'חסר שדה "questions".',
    exerciseMissingFlashcards: 'חסר שדה "flashcards".',
    questionMissingOptions:
      'שאלה {{position}}: חסרה רשימת אפשרויות ("options").',
    questionNoCorrectAnswer: "שאלה {{position}}: אין אף אפשרות מסומנת כנכונה.",
  },
} as const
