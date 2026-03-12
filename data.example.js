// Copy this file to data.js and fill in your own financial data.
// data.js is gitignored — your real numbers stay local.
//
// All fields shown below are supported. Required fields are marked [REQUIRED].
// Optional fields show their defaults in comments.

var RAW_YAML = `
# ──────────────────────────────────────────────
# HOUSEHOLD — People in the plan [REQUIRED]
# ──────────────────────────────────────────────
household:
  people:
    - name: Alex                          # [REQUIRED] Used to match retirement_age_<name> in settings
      birth_year: 1980                    # [REQUIRED]
      take_home_income: 120000            # [REQUIRED] Annual after-tax income while working
      social_security:
        fra_benefit_monthly: 3500         # [REQUIRED] Full retirement age monthly benefit (from ssa.gov)
        early_benefit_62: 2450            # [REQUIRED] Reduced benefit if claiming at 62
        delayed_benefit_70: 4340          # [REQUIRED] Enhanced benefit if delaying to 70
        claiming_age: 67                  # [REQUIRED] Age you plan to start collecting (62-70)

    - name: Jordan
      birth_year: 1985
      take_home_income: 65000
      social_security:
        fra_benefit_monthly: 2200
        early_benefit_62: 1540
        delayed_benefit_70: 2728
        claiming_age: 62

# ──────────────────────────────────────────────
# ACCOUNTS — All investment and savings accounts [REQUIRED]
# ──────────────────────────────────────────────
# Supported types: checking, savings, brokerage, 401k, traditional_ira, roth_ira, hsa
#
# Asset class defaults by type:
#   checking    → null (no growth)
#   savings     → savings
#   brokerage   → stock
#   401k        → stock
#   traditional_ira → stock
#   roth_ira    → stock
#   hsa         → stock
#
# Override with asset_class: bond (or stock/savings) on any account.

accounts:
  # Checking — liquid cash, no growth
  - name: "Primary Checking"
    type: checking
    balance: 8000

  # Savings — earns savings_growth rate
  - name: "Emergency Fund"
    type: savings
    balance: 25000
    annual_contribution: 6000             # Optional — additional annual deposits
    growth_rate: 0.04                     # Optional — overrides scenario savings_growth

  # 401k — employer retirement, contributions stop at retirement
  - name: "Alex's 401k"
    owner: Alex                           # [REQUIRED for retirement accounts] Matches a person name
    type: 401k
    balance: 250000
    annual_contribution: 23500            # Annual employee contribution
    employer_match: 5000                  # Optional — annual employer match amount (default: 0)
    growth_rate: 0.07                     # Optional — overrides scenario stock_growth

  # Traditional IRA — pre-tax, subject to RMDs at age 73/75
  - name: "Alex's Traditional IRA"
    owner: Alex
    type: traditional_ira
    balance: 150000
    annual_contribution: 0
    growth_rate: 0.07

  # Roth IRA — after-tax, no RMDs, last in drawdown waterfall
  - name: "Alex's Roth IRA"
    owner: Alex
    type: roth_ira
    balance: 45000
    annual_contribution: 7000
    growth_rate: 0.07

  # Brokerage — taxable investment account
  - name: "Joint Brokerage"
    type: brokerage
    balance: 80000
    annual_contribution: 12000
    growth_rate: 0.07

  # Bond account — override asset_class to get bond_growth rate
  - name: "Bond Fund"
    type: brokerage
    asset_class: bond                     # Overrides default stock → bond
    balance: 60000
    annual_contribution: 0
    growth_rate: 0.045                    # Optional — overrides scenario bond_growth

  # HSA — triple tax advantage, draws down medical expenses first
  - name: "Alex's HSA"
    owner: Alex
    type: hsa
    balance: 8000
    annual_contribution: 8300
    growth_rate: 0.06

# ──────────────────────────────────────────────
# HOME — Primary residence [REQUIRED]
# ──────────────────────────────────────────────
home:
  current_value: 400000                   # [REQUIRED]
  annual_appreciation: 0.03               # [REQUIRED] Annual home value growth rate
  annual_property_tax: 5000               # [REQUIRED]
  annual_insurance: 2000                  # [REQUIRED]

# ──────────────────────────────────────────────
# LIABILITIES — Mortgages and debts (optional)
# ──────────────────────────────────────────────
liabilities:
  - name: "Mortgage"
    type: mortgage                        # Currently only mortgage type is supported
    balance: 200000
    monthly_payment: 1500
    interest_rate: 0.065
    start_year: 2024
    term_years: 30

# ──────────────────────────────────────────────
# ANNUAL EXPENSES [REQUIRED]
# ──────────────────────────────────────────────
annual_expenses:
  living_expenses: 48000                  # [REQUIRED] Base annual living costs
  vacation: 6000                          # [REQUIRED] Annual vacation budget
  medical: 5000                           # [REQUIRED] Annual medical costs (working years, employer plan)
  pre_medicare_medical_monthly: 1200      # Monthly ACA/private insurance cost per person, age <65
  inflation_adjusted: true                # Whether expenses grow with inflation (default: true)
  retirement_spending_factor: 0.85        # Multiply living_expenses by this in retirement (default: 1.0)
  vacation_retirement_factor: 1.2         # Multiply vacation by this in retirement (default: 1.0)
  medical_retirement_factor: 1.5          # Multiply medical by this post-Medicare (default: 1.0)

# ──────────────────────────────────────────────
# RECURRING EXPENSES — Big-ticket items on a cycle (optional)
# ──────────────────────────────────────────────
recurring_expenses:
  - name: "Car replacement"
    amount: 40000                         # Cost in today's dollars
    frequency_years: 8                    # How often (years)
    next_occurrence: 2028                 # Next expected year
    inflation_adjusted: true              # Grow with inflation (default: true)
    retirement_amount: 25000              # Optional — different cost in retirement
    retirement_frequency_years: 10        # Optional — different frequency in retirement

  - name: "Home roof replacement"
    amount: 15000
    frequency_years: 20
    next_occurrence: 2040
    inflation_adjusted: true
    # No retirement override — same cost/frequency in retirement

  - name: "Car maintenance"
    amount: 2000
    frequency_years: 1
    next_occurrence: 2025
    inflation_adjusted: true
    retirement_amount: 1000
    retirement_frequency_years: 1

# ──────────────────────────────────────────────
# LUMP SUM EVENTS — One-time income or expenses (optional)
# ──────────────────────────────────────────────
# type: "income" (bonus, inheritance, windfall) or "expense" (purchase, gift)
lump_sum_events:
  - name: "Expected Inheritance"
    year: 2035
    amount: 200000
    type: income

  - name: "Kitchen Renovation"
    year: 2028
    amount: 50000
    type: expense

  - name: "Second Home Purchase"
    year: 2038
    amount: 400000
    type: expense

# ──────────────────────────────────────────────
# SECOND HOME — Ongoing costs if purchasing a second property (optional)
# ──────────────────────────────────────────────
# Toggle inclusion via the sidebar "Include/Exclude Second Home" control.
# The purchase itself should also appear as a lump_sum_event expense above.
second_home:
  purchase_year: 2038
  current_value: 400000
  annual_property_tax: 4000
  annual_insurance: 2500
  annual_maintenance: 5000
  annual_utilities: 3000
  annual_appreciation: 0.03

# ──────────────────────────────────────────────
# SCENARIOS [REQUIRED]
# ──────────────────────────────────────────────
# Define multiple scenarios with different growth/inflation assumptions.
# Selectable via the sidebar dropdown.
scenarios:
  baseline:
    label: "Baseline"
    stock_growth: 0.07                    # Annual return for stock-class accounts
    bond_growth: 0.04                     # Annual return for bond-class accounts
    savings_growth: 0.04                  # Annual return for savings accounts
    inflation: 0.03                       # Annual inflation rate
    ss_factor: 0.77                       # Social Security confidence factor (1.0 = full, 0.77 = 77% benefit)
  optimistic:
    label: "Optimistic"
    stock_growth: 0.10
    bond_growth: 0.05
    savings_growth: 0.05
    inflation: 0.025
    ss_factor: 1.0
  conservative:
    label: "Conservative"
    stock_growth: 0.04
    bond_growth: 0.03
    savings_growth: 0.03
    inflation: 0.035
    ss_factor: 0.50

# ──────────────────────────────────────────────
# SETTINGS [REQUIRED]
# ──────────────────────────────────────────────
settings:
  projection_end_age: 95                  # Age to project through (oldest person)
  retirement_age_alex: 60                 # Must match: retirement_age_<name in lowercase>
  retirement_age_jordan: 58
  annual_raise_rate: 0.025                # Annual salary increase while working
`;
