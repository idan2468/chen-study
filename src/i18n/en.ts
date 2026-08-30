import type { he } from "./he"

/**
 * English UI strings.
 *
 * Typed as a structural match for `he`, so adding a key to the Hebrew catalogue
 * without translating it here is a compile error rather than a silent fallback.
 *
 * Note the arrows: `←`/`→` are kept pointing the same *visual* way as the
 * Hebrew labels because the keyboard shortcuts are not mirrored either -- left
 * is always previous. See `useFlashcardKeys`.
 */
type Messages = {
  [Section in keyof typeof he]: Record<keyof (typeof he)[Section], string>
}

export const en: Messages = {
  common: {
    home: "Home",
    dyslexiaFont: "Readable font",
    dyslexiaFontTooltip: "Dyslexia-friendly font",
    dayMode: "Light mode",
    nightMode: "Dark mode",
    syncDevices: "Sync via link",
    switchToEnglish: "English",
    switchToHebrew: "עברית",
    languageTooltip: "Change interface language",
    cancel: "Cancel",
    delete: "Delete",
    reset: "Reset",
    close: "Close",
    stop: "Stop",
    previous: "← Previous",
    next: "Next →",
    flipHint: "Click to flip the card",
    flipHintTap: "Tap to flip the card",
    cardAriaLabel: "Flashcard - click to flip",
    cardAriaLabelTap: "Flashcard - tap to flip",
    speakWord: "Read the word {{word}} aloud",
    stopSpeaking: "Stop reading: {{label}}",
    deleteItem: "Delete {{name}}",
    voiceSettings: "Voice settings",
    settingsMenu: "Settings",
    connectGoogle: "Connect Google",
    googleConnected: "{{email}} · Disconnect",
    googleConnectError: "Could not connect Google account. Try again.",
    googleReconnectNeeded: "Google connection lost. Reconnect to keep syncing.",
    restoringSync: "Restoring your synced progress...",
    googleSyncError: "Could not sync your progress to Google Drive.",
    googleSyncSuccess: "Synced with Google Drive",
    syncNowLabel: "Sync now",
    reconnectLabel: "Tap to reconnect",
  },

  hub: {
    title: "📚 Interactive English Practice Hub",
    subtitle: "Choose a practice app to start learning",
    footer: "Interactive English practice • Works on desktop and mobile",
    unseenTitle: "English Reading Practice (Unseen)",
    unseenDescription:
      "Interactive reading passages with text-to-speech, word highlighting, multiple-choice questions, vocabulary cards and a dyslexia-friendly mode.",
    unseenCta: "Open Unseen practice ➔",
    modulesTitle: "Module Practice Flashcards",
    modulesDescription:
      "Vowel-marked practice sets by module (A, O, I vowels), personal progress tracking, word read-aloud, removable tabs and accessibility options.",
    modulesCta: "Open module flashcards ➔",
  },

  sync: {
    title: "Sync between devices",
    description:
      "Copy the link and open it on the other device. All your progress, modules and exercises will move across.",
    linkLabel: "Sync link",
    copyLink: "Copy link",
    copied: "Link copied",
    importedTitle: "Data synced",
    importedMessage: "Imported {{count}} items from the other device.",
  },

  json: {
    loadTemplate: "Load a sample template",
    copyContent: "Copy content",
    copied: "Copied",
    contentLabel: "JSON content",
    loadAndAdd: "Load and add",
    viewDebugInfo: "View debug info",
    debugInfoTitle: "Debug info",
    copyDebugInfo: "Copy debug info",
  },

  modules: {
    fallbackTitle: "Module practice",
    noModules: "No modules available",
    moduleMeta: "{{tabName}} • {{count}} words",
    ruleTitle: "The rule",
    speakRule: "Read the rule aloud",
    statKnown: "Got it",
    statUnknown: "Needs practice",
    statPending: "Unmarked",
    filterOn: "Showing: needs practice",
    filterOff: "Filter: needs practice",
    resetModule: "Reset module",
    markKnown: "Got it",
    markUnknown: "Needs practice",
    allDone: "🎉 Well done! No cards left to show.",
    shortcutsLabel: "Keyboard shortcuts:",
    shortcuts:
      " [space] flip | [arrows] navigate | [S] read aloud | [1] got it | [2] needs practice",
    selectModule: "Choose a module",
    deleteModule: "Delete the current module",
    deleteTitle: "Delete module",
    deleteBody:
      'Delete the module "{{name}}"? Progress on the words themselves is kept.',
    cannotDeleteTitle: "Cannot delete",
    cannotDeleteBody: "At least one module must remain.",
    resetTitle: "Reset progress",
    resetBody: 'Reset progress for every word in the module "{{name}}"?',
    jsonSectionTitle: "Add your own modules (JSON)",
    jsonInstructions:
      "Paste a module JSON object here, or an array of several modules. The cards field is required; id and tabName are filled in automatically if missing.",
    jsonAdded: "Added {{count}} modules successfully.",
    missedReviewButton: "Practice missed words ({{count}})",
    missedReviewTitle: "Practice missed words",
    missedReviewSubtitle: "{{count}} words left from every module",
    backToModules: "Back to modules",
    moduleCompleteAllKnown: "🎉 Every word in this module is known!",
    moduleCompletePartial:
      "✅ You've gone through every word in this module. {{count}} still need practice",
  },

  unseen: {
    fallbackTitle: "Reading practice",
    noExercise: "No exercise loaded.",
    tabReading: "Reading & questions",
    tabFlashcards: "Vocabulary cards",
    tabJson: "Load an exercise",
    selectExercise: "Choose an exercise from the library",
    deleteExercise: "Delete the current exercise",
    deleteTitle: "Delete exercise",
    deleteBody: 'Delete the exercise "{{name}}"?',
    cannotDeleteTitle: "Cannot delete",
    cannotDeleteBody: "At least one exercise must remain in the library.",
    playAll: "Read the whole passage",
    playAllLabel: "Read the whole passage aloud",
    readingHint:
      "💡 Click a word to hear it • Double-click to highlight it • Emphasised words also appear in the vocabulary cards",
    readingHintTap:
      "💡 Tap a word to hear it • Double-tap to highlight it • Emphasised words also appear in the vocabulary cards",
    usageHint:
      "New here? Start with the Vocabulary cards to learn the key words, then move on to Reading & questions.",
    paragraphPlay: "Read from paragraph {{number}} onwards",
    speakQuestion: "Read the question and answers aloud",
    speakOption: "Read option {{number}} aloud",
    answerCorrect: "Well done! Correct answer ✓",
    answerIncorrect:
      "Not quite. Try again, or listen to the passage once more.",
    statVocab: "Words in cards",
    statKnown: "Known",
    statUnknown: "Not known",
    markKnown: "Known",
    markUnknown: "Not known",
    resetMarks: "Reset marks",
    resetTitle: "Reset progress",
    resetBody: "Reset the marks on every vocabulary card in this exercise?",
    noFlashcards: "This exercise has no vocabulary cards.",
    jsonInstructions:
      "Paste an exercise JSON object here. Required fields: paragraphs, questions, flashcards. The exercise id is generated automatically.",
    jsonLoaded: "Added {{count}} exercises to the library.",
  },

  speech: {
    title: "Speech settings",
    systemVoiceLabel: "Voice",
    tabEnglish: "English",
    tabHebrew: "Hebrew",
    systemVoiceHint:
      "Browsers default to a basic voice. On a Mac you can download enhanced voices in System Settings.",
    bestAvailable: "Best available",
    test: "Play a sample",
    speechRate: "Reading speed: {{rate}}x",
    speechRateLabel: "Reading speed",
  },

  importErrors: {
    invalidJson: "The JSON is not valid. Check the brackets and commas.",
    moduleInvalidShape:
      "This module doesn't match the expected structure. Copy the debug info below for help fixing it.",
    exerciseInvalidShape:
      "The exercise doesn't match the expected structure. Copy the debug info below for help fixing it.",
  },
}
