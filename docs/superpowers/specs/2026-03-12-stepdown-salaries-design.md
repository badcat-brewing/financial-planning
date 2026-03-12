# Stepdown Salaries Design Spec

## Goal

Add support for semi-retirement "stepdown" jobs — lower-paying positions a person takes after leaving their primary career. Each stepdown independently describes compensation, health insurance coverage, and optional retirement account contributions.

## Data Model

New top-level YAML key `stepdown_salaries` — an optional array. Omitting it entirely changes nothing.

```yaml
stepdown_salaries:
  - person: Frank          # matches people[].name
    start_age: 60          # when this job begins
    end_age: 63            # last year of this job (inclusive)
    take_home_income: 60000
    has_health_insurance: true
    hsa_contribution: 3000          # optional, default 0
    annual_401k_contribution: 5000  # optional, default 0
  - person: Frank
    start_age: 64
    end_age: 67
    take_home_income: 30000
    has_health_insurance: false
```

### Field Reference

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `person` | yes | string | Must match a `people[].name` exactly |
| `start_age` | yes | int | Age when this stepdown job begins |
| `end_age` | yes | int | Last year of this job (inclusive) |
| `take_home_income` | yes | number | Annual after-tax income (same semantics as `people[].take_home_income`) |
| `has_health_insurance` | yes | boolean | Whether the job provides health insurance |
| `hsa_contribution` | no | number | Annual HSA contribution. Default 0. |
| `annual_401k_contribution` | no | number | Annual 401k contribution from this job. No employer match assumed. Default 0. |

### Validation

- `person` must match an existing `people[].name`
- `end_age` must be >= `start_age` (single-year stepdowns are valid)
- Stepdowns where `start_age` < the person's retirement age are silently ignored at runtime (primary salary takes precedence)
- Multiple stepdowns for the same person are allowed (multiple part-time jobs, sequential gigs)

## Simulation Logic Changes

All changes are in `js/calculations.js`.

### 1. Salary Income

**Current behavior** (lines 740-747): `people.forEach` loop computes salary for non-retired people. `salaryIncome` is 0 for retired people.

**New behavior:** After the existing salary loop, add a second pass over retired people to check for active stepdowns. For each active stepdown, add its income to `salaryIncome`:

```
stepdown_start_year = person.birth_year + stepdown.start_age
stepdown_income = stepdown.take_home_income * (1 + annual_raise_rate) ^ (year - stepdown_start_year)
```

If multiple stepdowns overlap (two part-time jobs), sum both incomes. Stepdown income flows into `salaryIncome`, which feeds into `totalIncomeBeforeContrib` (line 761). This correctly increases the surplus available for manual contributions (Roth IRA, brokerage, savings) on line 777.

### 2. Health Insurance / Pre-Medicare

**Current behavior** (line 426): `retired && age < 65` triggers `pre_medicare_medical_monthly` costs.

**New behavior:** `retired && age < 65 && !hasStepdownInsurance(person, data, year)` triggers pre-Medicare costs. A person is "covered" if they have an active stepdown with `has_health_insurance: true`.

This means:
- Gap years between primary career and stepdown: pre-Medicare costs apply (if < 65)
- Stepdown with `has_health_insurance: false`: pre-Medicare costs still apply (if < 65)
- Stepdown with `has_health_insurance: true`: no pre-Medicare costs (insurance from employer)
- Age 65+: Medicare kicks in regardless

### 3. HSA and 401k Contributions

**Current behavior:** `getAnnualContribution()` (line 200) returns 0 when the account owner is retired. The contribution block in `simulateDrawdown` (lines 766-791) calls this function for payroll-deducted types (401k, HSA).

**New behavior:** Add a separate code path in `simulateDrawdown` for stepdown contributions, **after** the existing contribution passes. This avoids modifying `getAnnualContribution` (which correctly returns 0 for retired people in the general case):

```
// Pass 3: Stepdown contributions — retired people with active stepdowns
people.forEach(function(person) {
  if (!isPersonRetired(person, settings, year)) return;
  var stepdowns = getActiveStepdowns(person, data, year);
  var contributions = getStepdownContributions(stepdowns);
  if (contributions.hsa > 0) {
    // Route to first HSA account owned by this person
    ...
  }
  if (contributions.k401 > 0) {
    // Route to first 401k account owned by this person
    ...
  }
});
```

**Account routing:** For both HSA and 401k, route the contribution to the **first** account matching `account.owner === person.name && account.type === targetType`. In practice there's one per person, but this makes the behavior deterministic.

## Helper Functions

### `getActiveStepdowns(person, data, year)`

Returns an array of active stepdown entries for the given person and year. A stepdown is active when `person.birth_year + start_age <= year <= person.birth_year + end_age`.

Returns empty array if `data.stepdown_salaries` is absent.

### `hasStepdownInsurance(person, data, year)`

Returns `true` if any active stepdown for this person in this year has `has_health_insurance: true`.

### `getStepdownContributions(stepdowns)`

Takes the array from `getActiveStepdowns`. Returns `{ hsa: number, k401: number }` — the sum of HSA and 401k contributions across all active stepdowns.

## What Doesn't Change

- `isPersonRetired()` — still based on `retirement_age` (primary career only)
- `getAnnualContribution()` — untouched, still returns 0 for retired owners
- Social Security benefit calculations
- RMD logic
- Drawdown order (brokerage -> HSA -> 401k/trad IRA -> Roth)
- All existing pages work without `stepdown_salaries` present
- The `second_home` toggle and all sidebar controls

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No `stepdown_salaries` key in YAML | Everything works as before |
| Overlapping stepdowns for same person | Sum both incomes, insurance = true if either provides it |
| Stepdown `start_age` < `retirement_age` | Ignored — primary salary takes precedence during working years |
| Single-year stepdown (`start_age == end_age`) | Valid — one year of income |
| Gap years between primary and stepdown | No income, pre-Medicare costs if < 65 |
| Stepdown spans age 65 | Pre-Medicare logic only applies to years < 65 within the stepdown |
| `hsa_contribution` on a stepdown without `has_health_insurance` | Allowed — HSA contribution still applied |
| Person has no HSA/401k account but stepdown specifies contributions | Contributions silently ignored (no account to route to) |

## UI Impact

### Drawdown Page — Income Sources Timeline

Add rows for each stepdown in the Income Sources Timeline table. Use the existing column structure (Source, Person, Starts, Est. Annual Amount) with a date range in the Starts column:

```
Stepdown Salary | Frank | 2036–2039 (age 60–63) | $60,000
Stepdown Salary | Frank | 2040–2043 (age 64–67) | $30,000
```

### No New Page Required

This is a data-layer feature. The existing Projections, Drawdown, and Stress Test pages automatically reflect stepdown income through the simulation engine.
