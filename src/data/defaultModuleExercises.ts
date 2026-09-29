/**
 * `sampleModuleExercise` below was originally extracted verbatim from
 * `Modules Practice.html`. `defaultModuleExercises` comes from
 * `resources/chen-english-course-full.json`, the full course content.
 */
import type { ModuleExercise } from "@/types/moduleExercise"
import moduleExercisesData from "@resources/chen-english-course-full.json"

/** The full built-in phonics course. */
export const defaultModuleExercises: ModuleExercise[] = moduleExercisesData

/** Prefilled into the JSON loader's textarea as a starting point. */
export const sampleModuleExercise: ModuleExercise = {
  id: "mod_sample_e",
  tabName: "מודול (E)",
  title: "מודול דוגמה: תנועת E קצרה (Short E)",
  rule: '<div class="rule-section"><b>הסבר וחוקיות:</b> כשהאות <b>E</b> מופיעה באמצע מילה קצרה, היא מקבלת צליל "אֶה" קצר (סגול).</div>\n<div class="rule-section"><b>סימון הניקוד:</b> נסמן את הצליל הזה תמיד עם <b>סגול ( ֶ )</b>.</div>',
  cards: [
    {
      en: "RED",
      he: "רֶד",
      meaning: "אדום",
    },
    {
      en: "BED",
      he: "בֶּד",
      meaning: "מיטה",
    },
    {
      en: "PEN",
      he: "פֶּן",
      meaning: "עט",
    },
    {
      en: "TEN",
      he: "תֶּן",
      meaning: "עשר",
    },
    {
      en: "NET",
      he: "נֶת",
      meaning: "רשת",
    },
    {
      en: "PET",
      he: "פֶּט",
      meaning: "חיית מחמד",
    },
    {
      en: "LEG",
      he: "לֶג",
      meaning: "רגל",
    },
    {
      en: "HEN",
      he: "הֶן",
      meaning: "תרנגולת",
    },
  ],
}
