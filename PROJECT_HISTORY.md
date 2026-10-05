# EgyMeds Project History / AI Context

> Persistent project context for future ChatGPT/Codex/Gemini sessions. Read this file before changing code or database structure.
> Do not store passwords, auth tokens, private API keys, or personal account identifiers here.

## 1. Project
Project name: **EgyMeds**

Goal: Egyptian medicines database + Android app + web admin panel backed by Supabase.

Current database size: about **24,700 commercial products**.

Repositories:
- App: `Ahmedbadr44/Egydrugs`
- Admin: `Ahmedbadr44/egydrugs-admin`

Branches:
- `Egydrugs/main` = original Kotlin app; keep app code unchanged.
- `Egydrugs/react-native` = current React Native development.
- `egydrugs-admin/main` = admin panel.

## 2. Non-negotiable decisions
- Keep the original Kotlin app on `main` unchanged at code level.
- React Native changes go to `react-native`.
- App name is **EgyMeds**.
- Preserve the current simple UI unless the user explicitly requests a redesign.
- Supabase is the single source of truth.
- Keep the current high-quality search engine; do not replace it with generic weak matching.
- Uses are related to the **active ingredient**, not entered repeatedly for every commercial product.
- Each active ingredient has two Uses groups:
  1. Medical Uses
  2. Cosmetic Uses
- The commercial product has a `product_type`.
- `MEDICINE` products display Medical Uses.
- `COSMETIC` products display Cosmetic Uses.
- Do not copy therapeutic Uses into cosmetics merely because the ingredient is the same.
- The user wants to review the database in batches of **1,000 medicines per day**.

## 3. Supabase
Project ref:
`lfxdgtbsmomafyaolndh`

### public.drugs
Important columns:
- `id` bigint identity primary key
- `commercial_name_en` text
- `commercial_name_ar` text
- `scientific_name` text
- `manufacturer` text
- `drug_class` text
- `route` text
- `price_egp` numeric
- `dosage` text
- `updated_at` timestamptz
- `product_type` text

Allowed `product_type` values:
- `MEDICINE`
- `COSMETIC`
- `SUPPLEMENT`
- `MEDICAL_DEVICE`
- `OTHER`

All existing products were intentionally left unclassified when `product_type` was added. Do not mass-classify without review.

### public.drug_medical_info
Primary key: `drug_id`

Includes:
- `uses` jsonb array
- `dosages` jsonb array
- `side_effects` jsonb array
- `warnings` jsonb array
- image/source fields
- confidence/source fields
- `updated_at`

Use this table for product-specific medical information only when needed. The main shared Uses workflow is the active-ingredient table.

### public.active_ingredient_medical_info
Primary key: `ingredient_key`

Important columns:
- `ingredient_key`
- `display_name`
- `medical_uses` jsonb array
- `cosmetic_uses` jsonb array
- `dosage` jsonb array
- `side_effects` jsonb array
- `contraindications` jsonb array
- `source_url`
- `source_name`
- `updated_at`

Current intended model:
```
Active Ingredient
├── medical_uses
└── cosmetic_uses

Product
└── product_type -> chooses which group is displayed
```

## 4. Medical Uses model
Example:
```
Urea
Medical Uses:
- ...

Cosmetic Uses:
- ...
```

Then:
```
Product A = MEDICINE -> Medical Uses
Product B = COSMETIC -> Cosmetic Uses
```

This avoids duplicating the same Uses across hundreds of commercial products and prevents a cosmetic from inheriting medical indications.

The user explicitly does **not** want to type Uses manually for every product.

Preferred future workflow:
1. Group products by active ingredient.
2. Generate/collect Uses using trusted medical sources and/or AI assistance.
3. Save Medical Uses and Cosmetic Uses at ingredient level.
4. Review/approve.
5. App displays the correct group by product type.

AI-generated medical data should be treated as a proposal until reviewed/source-validated.

## 5. Database security / RLS
RLS exists on main public tables and admin write access is protected.

Known policy pattern:
- Anyone can read drugs / medical info.
- Admins can insert/update/delete.
- Admin status is checked through `drug_admins` and `private.is_drug_admin()`.

Important unresolved security issue:
`public.drugs_backup_before_manual_cleanup_20261004` has RLS disabled. Supabase security advisor marks this critical because the table can be exposed through the Supabase client.

Suggested remediation:
```sql
ALTER TABLE "public"."drugs_backup_before_manual_cleanup_20261004"
ENABLE ROW LEVEL SECURITY;
```

Do **not** apply this blindly: policies should be decided first so the backup does not become inaccessible.

Known backup/audit tables:
- `drugs_backup_20261004`
- `drugs_backup_before_arabic_20261004`
- `drugs_backup_before_manual_cleanup_20261004`
- `drug_data_audit_20261004`

`drug_data_audit_20261004` supports:
- drug_id
- field_name
- current_value
- proposed_value
- confidence
- source
- status: pending / approved / rejected / applied
- notes
- timestamps

This audit table is a good foundation for future AI proposal/review workflows.

## 6. Database review/update history
Work completed includes:
- Arabic commercial-name cleanup/corrections.
- English commercial-name updates where supplied.
- Company/classification/route normalization work.
- Price updates for reviewed batches.
- Duplicate/suspicious-data review planning.
- First **1,000 medicines** treated as reviewed.
- Next planned review batch starts around **ID 1015**.
- Planned cadence: **1,000 medicines/day**.

Important batch history:
- Early batches were updated in Supabase.
- Spreadsheet batch 413-614 was used for Arabic names and prices.
- 615-814 was updated in Supabase.
- 815-1014 was updated in Supabase.
- Do not assume AI-generated Arabic names are user-approved unless they came from an explicit correction sheet or later manual review.

## 7. Admin panel
Repo:
`Ahmedbadr44/egydrugs-admin`

Published URL:
`https://ahmedbadr44.github.io/egydrugs-admin/`

Current UI/workflow:
- Drug management.
- Active ingredient management.
- Database table with 100 products/page.
- Horizontal scrolling table.
- Sticky ID.
- Price scrolls normally.
- Working edit/save controls.
- Login diagnostics improved.
- Manufacturer and drug-class autocomplete/datalists.
- Route field uses a limited-value input/select workflow.
- Price retained.
- Dosage remains in DB.
- Product type is editable in the drug editor.

Current drug editor:
- English name
- Arabic name
- Active ingredient
- Company
- Drug classification
- Dosage form/route
- Price
- Product type

Current active-ingredient editor:
- Display name
- Medical Uses
- Cosmetic Uses
- Dosage
- Side effects
- Contraindications
- Medical source URL
- Medical source name

Uses are entered one English item per line.

The old concept of entering Uses inside every drug was removed from the current design.

## 8. React Native app
Repo:
`Ahmedbadr44/Egydrugs`
Branch:
`react-native`

Stack:
- Expo SDK 57
- React Native 0.86
- React 19.2.3
- Supabase JS 2.x
- react-native-webview

Current app:
- Name: **EgyMeds**
- Supabase-connected.
- Brand search.
- Active ingredient search.
- Drug cards with English name, Arabic name, ingredient, company, price.
- Drug details.
- Equivalent medicines.
- In-app image search using WebView.
- Current simple UI should be preserved.

Medical Uses behavior:
- Product type MEDICINE -> fetch `medical_uses`
- Product type COSMETIC -> fetch `cosmetic_uses`
- Uses are shown in the drug detail screen.
- Unknown/unsupported product types do not blindly choose a use group.

## 9. Search engine
Current files:
- `src/search/drugSearch.ts`
- `src/search/useDrugSearch.ts`

The current search engine replaced an earlier Kotlin-port implementation because the user wanted the newer supplied engine.

Required behavior:
### Brand
- One Brand option.
- English query searches English commercial name.
- Arabic query searches Arabic commercial name.
- Auto-detect query language.

### Active ingredient
- English only.
- Searches active ingredient field.

### Missing letters
- A space represents a gap of one or more unknown letters.
- Example: `ag stin` can match `AGARSTIN`.
- The engine also allows one forgotten letter automatically.

### Similar pronunciation
English:
- p/b
- f/ph/v
- c/k/q
- z/s
- j/g
- doubled letters

Arabic:
- ك/ق
- س/ص/ث/ز/ذ/ظ
- ت/ط
- د/ض
- ب/پ
- ف/ڤ
- ج/گ
- alef/hamza variants
- ة/ه
- ى/ي
- tashkeel/tatweel normalization

The engine builds phonetic keys once and uses regex-based matching.

Known spot checks:
- `agarstn` -> AGARSTIN
- `ag stin` -> AGARSTIN
- `ajar badova` -> AJAR PADOVA 10 SACHETS
- Arabic equivalent phonetic query -> AGARSTIN
- Arabic in ingredient mode -> English-only notice
- SQL pattern generation tests

Do not replace this with a simple `ilike` search unless explicitly requested.

## 10. Equivalents
File:
`src/equivalents.js`

Current rules:
- All equivalents shown by default.
- Same normalized active ingredient.
- Optional filters:
  - Same Route
  - Same Concentration
- No dosage-form filter.
- Both filters OFF by default.
- Sorted mainly by price descending, then name.
- If selected product and another product have known different product types, they are not treated as equivalents.
- Unknown product types remain visible until classification is complete.

Ingredient normalization removes strengths/salts/parentheses conservatively to create a core ingredient key.

## 11. Image search
Current detail screen includes an image-search button.
- Opens a WebView inside the app.
- Search uses English product name + manufacturer.
- Does not intentionally send the user to the external browser.

The DB already contains image/source fields in `drug_medical_info`.
Bulk image population has not yet been completed.

## 12. Cosmetics
Current DB has many product names that look cosmetic-like, but name keywords alone are not enough for reliable classification.

Earlier inspection showed:
- Very few rows with literal COSMETIC in drug_class.
- Many names contain shampoo/lotion/cream/gel/serum/sunscreen/soap-like words.
- These should not automatically be classified as cosmetics solely from those words.

Official Egyptian cosmetics sources such as EDA/Egycosm were discussed, but integration has not been completed.

## 13. Program rename
The React Native app was renamed to **EgyMeds**:
- Expo app name = EgyMeds
- slug = egymeds
- npm/package name = egymeds
- Android package ID remains `com.egydrugs.app`

## 14. Local development
User's local Windows project folder:
`C:\Users\DR_Ah\Desktop\Egydrugs-react-native`

Normal update/start:
```bat
cd /d C:\Users\DR_Ah\Desktop\Egydrugs-react-native
git pull origin react-native
npx expo start
```

Cache reset only when needed:
```bat
npx expo start -c
```

`npm install` is needed after dependency changes, not after every code-only change.

## 15. CI/build history
React Native CI was created and a build-check run previously succeeded.

The workflow later added an EAS Android APK build step. Do not claim EAS success without a current successful GitHub Actions run.

Earlier successful CI commit:
`0df9861630017d61e0d08cab35f45afd48ca94b1`

A later EAS workflow change was around:
`8ed11409d555f2b5c6d9e29f007019714d876f4f`

## 16. Recent architecture commits
Supabase migrations:
- `add_drug_product_type`
- `split_ingredient_uses_by_product_type`
- `update_medical_stats_for_split_uses`

Admin recent commits:
- `97f926d403c281567fd59e28766617b29a400754`
- `c477be3dea19b8806efa813ab33358b5036ab019`
- `9253984d35adaf2be4ebdcfe8be825f27ed27455`
- `b643f084bf5ed6ed4b9223666ecc6267f5c1659e`
- `eea14d728aba0facfc9cd22433fbdc1838759c58`
- `24d94a750fed6f5b6d1d0039a03cc214a9b2548c`

React Native recent commits:
- `500d4327c884eacc9241db19d928621fcf8cae18`
- `0e87efedf65fc822a4d4bbfaf6f68322fd3669f5`
- `a5f517ecf55f653357bcd1a25d0b5ec10328e58d`

## 17. Important current medical-data decision
The final intended architecture is:

```
Active Ingredient
├── Medical Uses
└── Cosmetic Uses

Commercial Product
├── product_type
└── displays one of the two use groups
```

This is the authoritative project decision for the Uses feature.

## 18. Future priorities
1. Continue reviewing 1,000 products/day.
2. Classify products into product types carefully.
3. Populate Medical Uses and Cosmetic Uses per active ingredient.
4. Build AI/source-assisted proposal + approval workflow rather than manual per-product entry.
5. Later extend the same architecture to dosage, side effects, and contraindications.
6. Keep the initial EgyMeds visual design stable.

## 19. Rules for future AI sessions
Before changing anything:
- Read this file.
- Inspect current files and branch; do not trust old snippets blindly.
- Never modify Kotlin app code on `main`.
- React Native changes go to `react-native`.
- Inspect Supabase schema/RLS before DB changes.
- Preserve the current search engine.
- Preserve the current simple UI.
- Avoid unnecessary redesigns.
- Avoid destructive SQL unless explicitly requested and verified.
- Never store credentials in project history.

## 20. 2026-10-05 — Active ingredient Uses routing
- Confirmed the central active-ingredient model with two separate fields:
  - medical_uses
  - cosmetic_uses
- Added a visible **المواد الفعالة / Active Ingredients** section to the admin panel.
- The section supports searching ingredients, showing product counts, opening an ingredient editor, and saving its centralized information.
- The ingredient editor keeps Medical Uses and Cosmetic Uses as separate English line-based fields.
- Updated public.drug_medical_effective so uses is selected automatically from:
  - medical_uses when product_type = MEDICINE
  - cosmetic_uses when product_type = COSMETIC
  - empty uses for other/unclassified product types
- Verified the routing on Paracetamol in a transaction:
  - MEDICINE -> Medical Uses
  - COSMETIC -> Cosmetic Uses
- The test transaction was rolled back so product classification was not changed during verification.