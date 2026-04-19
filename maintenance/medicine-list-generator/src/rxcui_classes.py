# Hand-curated seed: generic ingredient name (lowercase) -> DrugClass.
#
# These cover the top ~80 pain medications with high confidence.
# Entries not in this map fall back to OpenFDA classification (--use-openfda)
# or are excluded from the catalog.
#
# Add / remove entries here when clinical guidance changes.
# RxNorm ingredient names are always lowercase — match exactly.

INGREDIENT_CLASSES: dict[str, str] = {
    # ── NSAIDs ────────────────────────────────────────────────────────────────
    "ibuprofen":                "NSAID",
    "naproxen":                 "NSAID",
    "diclofenac":               "NSAID",
    "celecoxib":                "NSAID",
    "meloxicam":                "NSAID",
    "indomethacin":             "NSAID",
    "ketorolac":                "NSAID",
    "piroxicam":                "NSAID",
    "aspirin":                  "NSAID",
    "sulindac":                 "NSAID",
    "nabumetone":               "NSAID",
    "etodolac":                 "NSAID",
    "oxaprozin":                "NSAID",
    "flurbiprofen":             "NSAID",
    "mefenamic acid":           "NSAID",
    "diflunisal":               "NSAID",
    "fenoprofen":               "NSAID",
    "ketoprofen":               "NSAID",
    "tolmetin":                 "NSAID",

    # ── Opioids ───────────────────────────────────────────────────────────────
    "tramadol":                 "Opioid",
    "oxycodone":                "Opioid",
    "hydrocodone":              "Opioid",
    "morphine":                 "Opioid",
    "codeine":                  "Opioid",
    "fentanyl":                 "Opioid",
    "buprenorphine":            "Opioid",
    "methadone":                "Opioid",
    "hydromorphone":            "Opioid",
    "oxymorphone":              "Opioid",
    "tapentadol":               "Opioid",
    "levorphanol":              "Opioid",
    "meperidine":               "Opioid",
    "nalbuphine":               "Opioid",
    "butorphanol":              "Opioid",
    "pentazocine":              "Opioid",

    # ── Muscle Relaxants ──────────────────────────────────────────────────────
    "cyclobenzaprine":          "Muscle Relaxant",
    "baclofen":                 "Muscle Relaxant",
    "methocarbamol":            "Muscle Relaxant",
    "tizanidine":               "Muscle Relaxant",
    "carisoprodol":             "Muscle Relaxant",
    "metaxalone":               "Muscle Relaxant",
    "orphenadrine":             "Muscle Relaxant",
    "chlorzoxazone":            "Muscle Relaxant",
    "dantrolene":               "Muscle Relaxant",

    # ── Anticonvulsants (used for neuropathic pain) ───────────────────────────
    "gabapentin":               "Anticonvulsant",
    "pregabalin":               "Anticonvulsant",
    "carbamazepine":            "Anticonvulsant",
    "lamotrigine":              "Anticonvulsant",
    "topiramate":               "Anticonvulsant",
    "valproic acid":            "Anticonvulsant",
    "oxcarbazepine":            "Anticonvulsant",
    "lacosamide":               "Anticonvulsant",

    # ── Adjuvants (antidepressants / SNRIs used off-label for pain) ───────────
    "amitriptyline":            "Adjuvant",
    "duloxetine":               "Adjuvant",
    "venlafaxine":              "Adjuvant",
    "nortriptyline":            "Adjuvant",
    "milnacipran":              "Adjuvant",
    "desipramine":              "Adjuvant",
    "imipramine":               "Adjuvant",
    "clomipramine":             "Adjuvant",

    # ── Other (common pain adjuncts that don't fit the above classes) ─────────
    "acetaminophen":            "Other",
    "lidocaine":                "Other",
    "capsaicin":                "Other",
    "prednisone":               "Other",
    "dexamethasone":            "Other",
    "methylprednisolone":       "Other",
    "hydroxychloroquine":       "Other",
    "methotrexate":             "Other",
    "folic acid":               "Other",
    "colchicine":               "Other",
    "allopurinol":              "Other",
    "probenecid":               "Other",
}

# ── OpenFDA fallback ──────────────────────────────────────────────────────────
# Used when --use-openfda is passed. Maps pharm_class strings from the drug
# label API to DrugClass values. Checked in order — first match wins.

PHARM_CLASS_KEYWORDS: dict[str, list[str]] = {
    "NSAID": [
        "nonsteroidal anti-inflammatory",
        "cyclooxygenase inhibitor",
        "cox-2 inhibitor",
        "salicylate",
    ],
    "Opioid": [
        "opioid",
        "opioid agonist",
        "mu opioid",
        "narcotic analgesic",
    ],
    "Muscle Relaxant": [
        "skeletal muscle relaxant",
        "muscle relaxant",
        "neuromuscular blocking",
    ],
    "Anticonvulsant": [
        "anticonvulsant",
        "antiepileptic",
        "voltage-gated calcium channel",
        "sodium channel blocker",
    ],
    "Adjuvant": [
        "serotonin and norepinephrine reuptake inhibitor",
        "tricyclic antidepressant",
        "norepinephrine reuptake inhibitor",
    ],
    "Other": [
        "analgesic",
        "antipyretic",
        "anti-inflammatory",
        "corticosteroid",
        "local anesthetic",
    ],
}
