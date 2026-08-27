/**
 * `sampleModuleExercise` below is seed content extracted verbatim from
 * `Modules Practice.html` by `scripts/extract-legacy-data.cjs` -- do not edit
 * it by hand. `defaultModuleExercises` itself now comes from
 * `resources/chen-english-course-full.json`, the full course content.
 */
import type { ModuleExercise } from "@/types/module"
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

/** Ids of the built-in modules, used to tell them apart from user-added ones. */
export const builtInModuleIds: readonly string[] = [
  "mod1_short_a",
  "mod2_short_o",
  "mod3_short_i",
  "rev_a_o_i",
  "mod4_short_e",
  "mod5_short_u",
  "rev_short_vowels",
  "mod6_blends_l",
  "mod7_blends_rs",
  "mod8_end_blends",
  "rev_blends",
  "mod9_sh",
  "mod10_ch",
  "mod11_th",
  "mod12_ck_ng",
  "rev_digraphs",
  "check1",
  "mod13_magic_e_a",
  "mod14_magic_e_i",
  "mod15_magic_e_ou",
  "rev_magic_e",
  "mod16_ee_ea",
  "mod17_ai_ay",
  "mod18_oa_ow",
  "rev_long_vowels",
  "mod19_soft_c_g",
  "mod20_ar_or",
  "mod21_er_ir_ur",
  "mod22_oo",
  "rev_c_g_r_oo",
  "mod23_word_parts",
  "mod24_heart_words",
  "check2",
]
