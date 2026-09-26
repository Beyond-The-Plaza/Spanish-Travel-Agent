/* SOURCE: Splash-draftv3-parrot.html */
export const modules = [
  { n:0, title:"Vocal Roots: Sound like Spanish", track:"Beginner", level:"A1", isM0:true, access:"free", students:"All students" },
  { n:1, title:"Who Are You?", track:"Beginner", level:"A1", isM1:true, access:"free", students:"All students",
    hook:"Spanish has two verbs for 'to be' — and choosing wrong makes you sound completely different.",
    c1:"Ser = permanent identity (who you are)", c2:"Estar = temporary state (how you feel)", c3:"Full pronoun conjugation for both verbs",
    v:["soy / eres / es","estoy / estás / está","somos / estamos","elegante · inteligente","cansado · feliz"],
    es:"Nosotros somos carismáticos pero no somos elegantes.", en:"We are charismatic but we are not elegant.",
    drill:"Ser or Estar? Complete: Yo ___ de Canadá. / Ella ___ cansada hoy.",
    culture:"Estoy cansado means you had a long day — not that you're a tired person. Your mood is always temporary in Spanish." },
  /* Step 1 of a paid multi-step module ships static (`preview`); steps 2+ come from the
     protected lesson function. `stepLabels` is static so locked dots and "1 of N" render offline. */
  { n:2, title:"Going Places", track:"Beginner", level:"A1–A2", students:"All students", access:"paid", slug:"m2-going-places",
    preview:"modules/preview/m2-going-places.html",
    stepLabels:["Overview · 1 of 6","IR · 2 of 6","Near future · 3 of 6","A + el = al · 4 of 6","Questions · 5 of 6","Practice · 6 of 6"] },
  { n:4, title:"A Day in the Life", track:"Beginner", level:"A2", students:"All students", access:"paid", slug:"m4-day-in-life" },
  { n:8, title:"Para vs Por", track:"Intermediate", level:"B1–B2", students:"Course members", access:"paid", slug:"m8-para-vs-por" },
  { n:12, title:"The Subjunctive", track:"Advanced", level:"B2", students:"Course members", access:"paid", slug:"m12-subjunctive" },
  { n:16, title:"Poetry, Song & Culture", track:"Advanced", level:"C1", students:"Course members", access:"paid", slug:"m16-poetry-song-culture" }
];

export const drillWords = ["la niña","el niño","la sandía","la ciudad","la grúa","el árbol","la toalla","la jaula","el aire"];

export const stepLabels = ["Vowels · 1 of 6","Consonants · 2 of 6","Tonic Syllable · 3 of 6","Accent Mark · 4 of 6","Diphthongs · 5 of 6","Practice · 6 of 6"];

export const m1StepLabels = ["Who Are You? · 1 of 7","Conjugation Base · 2 of 7","Ser · 3 of 7","Estar · 4 of 7","Ser vs Estar · 5 of 7","Going to be · 6 of 7","Practice · 7 of 7"];
