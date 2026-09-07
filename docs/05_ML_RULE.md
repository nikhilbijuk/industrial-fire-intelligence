# 05. ML RULE & VALIDATION DISCIPLINE

## 1. The Core ML Rule
- **First:** Build a transparent, deterministic baseline (Explainable Evidence Scorer).
- **Then:** Test classical tabular ML models **only if** sufficient independent ground-truth labels exist:
  - Logistic Regression
  - Random Forest
  - Gradient Boosting / XGBoost / LightGBM
- **Strictly Prohibited at Inception:** Do NOT start with CNNs, Transformers, or LLMs.

---

## 2. Anti-Leakage & Circularity Defense
- **The Golden Rule:** ML must be trained on **independently curated ground truth** (verified fire incident reports, pollution control boards, known refinery operational registries).
- **Zero Circularity:** Never create training labels using the same OSM proximity or FIRMS threshold rules that are subsequently fed as features into the model. That produces artificial 99% accuracy that collapses under external review.

---

## 3. The "Earn Its Place" Standard
ML only earns its place if it **meaningfully improves evaluation metrics** over the transparent heuristic baseline.
- If Baseline Accuracy = $84\%$ and LightGBM Accuracy = $85\%$, retain the transparent baseline for maximum explainability.
- If ML significantly reduces false industrial alarms without sacrificing recall, document the delta.

---

## 4. Evaluation Protocol
- **Geographic / Facility Holdout:** Never split observations randomly. If Jamnagar Refinery is in the training set, all Jamnagar events must be excluded from the test set. Train on northern facilities; test on southern/western facilities.
- **Temporal Holdout:** Train on earlier historical periods; evaluate on subsequent months.
- **Rigorous Confusion Matrix Metrics:**
  - Precision, Recall, F1-Score per class.
  - **False Industrial Alarms (Industrial False Positives):** This is the single most damaging failure mode for industrial disaster management and must be minimized.
