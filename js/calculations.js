/**
 * calculations.js
 * ALL financial math lives here. Functions are globally available (no modules).
 */

var CURRENT_YEAR = new Date().getFullYear();

// IRS Uniform Lifetime Table for RMD calculations (ages 72-100)
var UNIFORM_LIFETIME_TABLE = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7,
  77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4,
  82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
  87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5,
  92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
  97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
};

// Catch-up contribution limits by account type
var CATCHUP_LIMITS = {
  '401k': { age: 50, amount: 7500 },
  traditional_ira: { age: 50, amount: 1000 },
  roth_ira: { age: 50, amount: 1000 },
  hsa: { age: 55, amount: 1000 },
};

// 2025 Federal tax brackets — Married Filing Jointly (base year dollars)
var TAX_BRACKETS_MFJ_BASE = [
  { rate: 0.10, upTo: 23850 },
  { rate: 0.12, upTo: 96950 },
  { rate: 0.22, upTo: 206700 },
  { rate: 0.24, upTo: 394600 },
  { rate: 0.32, upTo: 501050 },
  { rate: 0.35, upTo: 751600 },
  { rate: 0.37, upTo: Infinity },
];
var TAX_BASE_YEAR = 2025;
var STANDARD_DEDUCTION_MFJ_BASE = 30000;
// SS taxability thresholds (MFJ) — NOT inflation adjusted (frozen since 1993)
var SS_TAX_THRESHOLD_LOW = 32000;
var SS_TAX_THRESHOLD_HIGH = 44000;

// Preset stress test scenarios — historical and custom
// recoveryStrength: 0 = no elevated recovery (permanent hit), 100 = full V-shape catch-up
var STRESS_SCENARIOS = {
  '2008_crisis': {
    label: '2008 Financial Crisis',
    stockDrop: 0.55,
    bondDrop: -0.05,
    recoveryYears: 5,
    recoveryStrength: 0,
    color: '#ef5350',
  },
  'covid_2020': {
    label: 'COVID-19 Crash',
    stockDrop: 0.34,
    bondDrop: 0.0,
    recoveryYears: 0.4,
    recoveryStrength: 0,
    color: '#ffa726',
  },
  'dotcom_2000': {
    label: 'Dot-Com Bust',
    stockDrop: 0.49,
    bondDrop: 0.05,
    recoveryYears: 7,
    recoveryStrength: 0,
    color: '#4fc3f7',
  },
  'custom': {
    label: 'Custom',
    stockDrop: 0.30,
    bondDrop: 0.0,
    recoveryYears: 3,
    recoveryStrength: 0,
    color: '#7c4dff',
  },
};

/**
 * Calculate the taxable portion of Social Security benefits.
 * Uses the IRS provisional income formula (MFJ thresholds).
 * otherIncome = all other taxable income (RMDs, withdrawals, etc.)
 */
function getTaxableSS(ssIncome, otherIncome) {
  if (ssIncome <= 0) return 0;
  // Provisional income = other income + 50% of SS
  var provisional = otherIncome + ssIncome * 0.5;
  if (provisional <= SS_TAX_THRESHOLD_LOW) return 0;
  if (provisional <= SS_TAX_THRESHOLD_HIGH) {
    // Up to 50% of SS is taxable
    return Math.min(ssIncome * 0.5, (provisional - SS_TAX_THRESHOLD_LOW) * 0.5);
  }
  // Up to 85% of SS is taxable
  var base = Math.min(ssIncome * 0.5, (SS_TAX_THRESHOLD_HIGH - SS_TAX_THRESHOLD_LOW) * 0.5);
  var extra = (provisional - SS_TAX_THRESHOLD_HIGH) * 0.85;
  return Math.min(ssIncome * 0.85, base + extra);
}

/**
 * Calculate federal income tax for a given taxable income.
 * Brackets are inflation-adjusted from the base year.
 */
function calculateFederalTax(taxableIncome, year, inflationRate) {
  if (taxableIncome <= 0) return 0;
  var yearsFromBase = year - TAX_BASE_YEAR;
  var inflationMult = Math.pow(1 + inflationRate, yearsFromBase);

  var tax = 0;
  var prev = 0;
  for (var i = 0; i < TAX_BRACKETS_MFJ_BASE.length; i++) {
    var bracket = TAX_BRACKETS_MFJ_BASE[i];
    var limit = bracket.upTo === Infinity ? Infinity : bracket.upTo * inflationMult;
    var bracketIncome = Math.min(taxableIncome, limit) - prev;
    if (bracketIncome <= 0) break;
    tax += bracketIncome * bracket.rate;
    prev = limit;
  }
  return tax;
}

/**
 * Calculate total retirement tax for a year.
 * Returns the federal tax owed on retirement income sources.
 * ssIncome: Social Security benefits received
 * rmdIncome: RMD distributions (fully taxable)
 * taxableWithdrawals: withdrawals from 401k/traditional IRA (fully taxable)
 */
function calculateRetirementTax(ssIncome, rmdIncome, taxableWithdrawals, year, inflationRate) {
  var yearsFromBase = year - TAX_BASE_YEAR;
  var inflationMult = Math.pow(1 + inflationRate, yearsFromBase);
  var standardDeduction = STANDARD_DEDUCTION_MFJ_BASE * inflationMult;

  // Other taxable income (non-SS)
  var otherTaxable = rmdIncome + taxableWithdrawals;
  // SS taxable portion
  var taxableSS = getTaxableSS(ssIncome, otherTaxable);
  // AGI
  var agi = otherTaxable + taxableSS;
  // Taxable income after standard deduction
  var taxableIncome = Math.max(0, agi - standardDeduction);

  return calculateFederalTax(taxableIncome, year, inflationRate);
}

/**
 * Get a person's age in a given year.
 */
function getPersonAge(person, year) {
  return year - person.birth_year;
}

/**
 * Get the age at which RMDs must begin.
 * Born >= 1960: age 75. Otherwise: age 73.
 */
function getRmdStartAge(person) {
  return person.birth_year >= 1960 ? 75 : 73;
}

/**
 * Get the retirement age for a person from settings.
 */
function getRetirementAge(person, settings) {
  var key = 'retirement_age_' + person.name.toLowerCase();
  return settings[key] || 65;
}

/**
 * Get the retirement year for a person.
 */
function getRetirementYear(person, settings) {
  return person.birth_year + getRetirementAge(person, settings);
}

/**
 * Determine whether a person is retired in a given year.
 */
function isPersonRetired(person, settings, year) {
  return year >= getRetirementYear(person, settings);
}

/**
 * Calculate annual contribution for an account in a given year,
 * including catch-up contributions where applicable.
 * Returns 0 if the owner is retired.
 */
function getAnnualContribution(account, year, people, settings) {
  // No contributions to checking accounts
  if (account.type === 'checking') return 0;

  // Find the owner
  var owner = null;
  if (account.owner) {
    owner = people.find(function (p) { return p.name === account.owner; });
  }

  // If owner is retired, no more contributions
  // If no owner, stop when everyone is retired
  if (owner) {
    if (isPersonRetired(owner, settings, year)) return 0;
  } else {
    var allRetired = people.every(function (p) { return isPersonRetired(p, settings, year); });
    if (allRetired) return 0;
  }

  var base = account.annual_contribution || 0;
  var match = account.employer_match || 0;

  // Add catch-up contributions if applicable (only if account has a base contribution)
  var catchup = CATCHUP_LIMITS[account.type];
  if (catchup && owner && base > 0) {
    var age = getPersonAge(owner, year);
    if (age >= catchup.age) {
      base += catchup.amount;
    }
  }

  return base + match;
}

/**
 * Project an account balance year-by-year.
 * Returns an array of { year, balance } objects.
 */
function projectAccount(account, scenario, people, settings, endYear, data) {
  var results = [];
  var balance = account.balance;
  var startYear = CURRENT_YEAR;

  for (var year = startYear; year <= endYear; year++) {
    if (year === startYear) {
      results.push({ year: year, balance: balance });
      continue;
    }

    var growthRate = getGrowthRate(account, scenario);
    var contribution = getAnnualContribution(account, year, people, settings);

    balance = balance * (1 + growthRate) + contribution;

    // HSA pays annual medical expenses
    if (account.type === 'hsa' && data && data.annual_expenses) {
      var inflationRate = scenario ? scenario.inflation || 0.03 : 0.03;
      var allRetired = people.every(function (p) { return isPersonRetired(p, settings, year); });
      var expenses = getAnnualExpenses(data.annual_expenses, year, inflationRate, allRetired, people, settings);
      var medicalDraw = Math.min(expenses.medical, balance);
      balance -= medicalDraw;
    }

    if (balance < 0) balance = 0;

    results.push({ year: year, balance: balance });
  }

  return results;
}

/**
 * Project mortgage amortization schedule.
 * Returns array of { year, balance, principalPaid, interestPaid, payment }.
 */
function projectMortgage(liability, endYear) {
  var results = [];
  var balance = liability.balance;
  var monthlyRate = liability.interest_rate / 12;
  var monthlyPayment = liability.monthly_payment;
  var startYear = CURRENT_YEAR;

  for (var year = startYear; year <= endYear; year++) {
    if (year === startYear) {
      results.push({
        year: year,
        balance: balance,
        principalPaid: 0,
        interestPaid: 0,
        payment: 0,
      });
      continue;
    }

    var yearPrincipal = 0;
    var yearInterest = 0;
    var yearPayment = 0;

    for (var month = 0; month < 12; month++) {
      if (balance <= 0) break;

      var interestPayment = balance * monthlyRate;
      var principalPayment = Math.min(monthlyPayment - interestPayment, balance);

      if (principalPayment < 0) principalPayment = 0;

      balance -= principalPayment;
      yearPrincipal += principalPayment;
      yearInterest += interestPayment;
      yearPayment += monthlyPayment;
    }

    if (balance < 0) balance = 0;

    results.push({
      year: year,
      balance: balance,
      principalPaid: yearPrincipal,
      interestPaid: yearInterest,
      payment: yearPayment,
    });
  }

  return results;
}

/**
 * Find the actual payoff year from a mortgage projection.
 */
function getMortgagePayoffYear(mortgageProjection) {
  if (!mortgageProjection) return null;
  for (var i = 1; i < mortgageProjection.length; i++) {
    if (mortgageProjection[i].balance <= 0) return mortgageProjection[i].year;
  }
  return null;
}

/**
 * Project home equity over time.
 * Returns array of { year, homeValue, mortgageBalance, equity }.
 */
function projectHomeEquity(home, mortgageProjection, endYear) {
  var results = [];
  var homeValue = home.current_value;
  var startYear = CURRENT_YEAR;

  for (var year = startYear; year <= endYear; year++) {
    if (year > startYear) {
      homeValue = homeValue * (1 + home.annual_appreciation);
    }

    var mortgageEntry = mortgageProjection.find(function (m) { return m.year === year; });
    var mortgageBalance = mortgageEntry ? mortgageEntry.balance : 0;

    results.push({
      year: year,
      homeValue: homeValue,
      mortgageBalance: mortgageBalance,
      equity: homeValue - mortgageBalance,
    });
  }

  return results;
}

/**
 * Calculate recurring expenses for a given year.
 * Returns total of all recurring expenses that hit in this year.
 */
function getRecurringExpenses(recurringExpenses, year, inflationRate, anyRetired) {
  if (!recurringExpenses) return 0;

  var total = 0;
  recurringExpenses.forEach(function (item) {
    // Check end_year if specified
    if (item.end_year && year > item.end_year) return;

    // Use retirement overrides once anyone is retired
    var amount = item.amount;
    var freq = item.frequency_years;
    if (anyRetired && item.retirement_amount != null) {
      amount = item.retirement_amount;
    }
    if (anyRetired && item.retirement_frequency_years != null) {
      freq = item.retirement_frequency_years;
    }

    // Check if this expense occurs in this year
    if (year >= item.next_occurrence) {
      var yearsSinceFirst = year - item.next_occurrence;
      if (yearsSinceFirst % freq === 0) {
        if (item.inflation_adjusted) {
          var yearsFromNow = year - CURRENT_YEAR;
          amount = amount * Math.pow(1 + inflationRate, yearsFromNow);
        }
        total += amount;
      }
    }
  });

  return total;
}

/**
 * Calculate annual expenses for a given year.
 * Returns { living, vacation, medical, preMedicareMedical, total }.
 *
 * Medical phases per person:
 *   Working (employer insurance): base medical share
 *   Retired, pre-Medicare (<65): pre_medicare_medical per person
 *   65+ (Medicare): base medical × retirement factor per person
 */
function getAnnualExpenses(annualExpenses, year, inflationRate, isRetired, people, settings) {
  var yearsFromNow = year - CURRENT_YEAR;
  var inflationMultiplier = annualExpenses.inflation_adjusted
    ? Math.pow(1 + inflationRate, yearsFromNow)
    : 1;

  var living = annualExpenses.living_expenses * inflationMultiplier;
  var vacation = annualExpenses.vacation * inflationMultiplier;
  var preMedicareMedical = 0;

  // Retirement adjustments to living/vacation
  if (isRetired) {
    living *= annualExpenses.retirement_spending_factor;
    vacation *= annualExpenses.vacation_retirement_factor;
  }

  // Medical: compute per-person based on their individual status
  var medical = 0;
  var totalPeople = people ? people.length : 1;
  var baseMedicalPerPerson = annualExpenses.medical * inflationMultiplier / totalPeople;
  var hasPreMedicare = false;

  if (people && settings) {
    people.forEach(function(person) {
      var age = getPersonAge(person, year);
      var retired = isPersonRetired(person, settings, year);

      if (retired && age < 65 && annualExpenses.pre_medicare_medical_monthly) {
        // Retired, pre-Medicare: full out-of-pocket per person
        var perPersonMonthly = annualExpenses.pre_medicare_medical_monthly / totalPeople;
        var cost = perPersonMonthly * 12 * inflationMultiplier;
        preMedicareMedical += cost;
        medical += cost;
        hasPreMedicare = true;
      } else if (retired && age >= 65) {
        // On Medicare: base medical × retirement factor
        medical += baseMedicalPerPerson * annualExpenses.medical_retirement_factor;
      } else {
        // Working: employer covers most, just base share
        medical += baseMedicalPerPerson;
      }
    });
  } else {
    medical = annualExpenses.medical * inflationMultiplier;
    if (isRetired) medical *= annualExpenses.medical_retirement_factor;
  }

  return {
    living: living,
    vacation: vacation,
    medical: medical,
    preMedicareMedical: preMedicareMedical,
    total: living + vacation + medical,
  };
}

/**
 * Get Social Security benefit for a person in a given year.
 * Returns 0 if person hasn't reached claiming age yet.
 * Benefit is inflation-adjusted from current year.
 */
function getSocialSecurityBenefit(person, year, inflationRate, ssFactor) {
  if (!person.social_security) return 0;

  var age = getPersonAge(person, year);
  var claimingAge = person.social_security.claiming_age;

  if (age < claimingAge) return 0;

  // Determine the monthly benefit based on claiming age
  var monthlyBenefit;
  if (claimingAge <= 62) {
    monthlyBenefit = person.social_security.early_benefit_62;
  } else if (claimingAge >= 70) {
    monthlyBenefit = person.social_security.delayed_benefit_70;
  } else {
    monthlyBenefit = person.social_security.fra_benefit_monthly;
  }

  // Apply COLA (inflation adjustment) from current year
  var yearsFromNow = year - CURRENT_YEAR;
  var adjustedMonthly = monthlyBenefit * Math.pow(1 + inflationRate, yearsFromNow);

  // Apply SS confidence factor (e.g. 0.77 = expect 77% of promised benefits)
  var factor = (typeof ssFactor === 'number') ? ssFactor : 1.0;

  return adjustedMonthly * 12 * factor;
}

/**
 * Calculate Required Minimum Distribution.
 */
function calculateRmd(balance, age) {
  var divisor = UNIFORM_LIFETIME_TABLE[age];
  if (!divisor) {
    // For ages beyond the table, use the last value
    if (age > 100) divisor = 6.4;
    else return 0;
  }
  return balance / divisor;
}

/**
 * Check if an account type is subject to RMDs.
 */
function isRmdAccount(type) {
  return type === '401k' || type === 'traditional_ira';
}

/**
 * Apply stress events to account balances for a given simulation year.
 * Called inside simulateDrawdown's yearly loop after normal growth.
 */
function applyStressEvents(accountBalances, accounts, year, stressEvents, firstRetirementYear, scenario) {
  if (!stressEvents || stressEvents.length === 0) return null;

  var growthOverrides = null;

  stressEvents.forEach(function(event) {
    var stressYear = firstRetirementYear + event.yearOffset;
    var se = event.scenario;

    // Apply the drop in the stress year
    if (year === stressYear) {
      accounts.forEach(function(account) {
        var assetClass = account.asset_class || ACCOUNT_TYPE_ASSET_CLASS[account.type];
        if (assetClass === 'stock') {
          accountBalances[account.name] *= (1 - se.stockDrop);
        } else if (assetClass === 'bond') {
          accountBalances[account.name] *= (1 - se.bondDrop);
        }
        // savings and checking: unaffected
      });
    }

    // Sub-annual recovery: apply partial recovery in the same year as the drop
    if (year === stressYear && se.recoveryYears < 1) {
      var recoveryFraction = se.recoveryYears; // e.g. 0.4 for COVID
      accounts.forEach(function(account) {
        var assetClass = account.asset_class || ACCOUNT_TYPE_ASSET_CLASS[account.type];
        if (assetClass === 'stock') {
          var effectiveDrop = se.stockDrop * (1 - recoveryFraction);
          var droppedBalance = accountBalances[account.name];
          accountBalances[account.name] = droppedBalance * (1 - effectiveDrop) / (1 - se.stockDrop);
        }
      });
      // No multi-year recovery needed
      return;
    }

    // Multi-year recovery: override growth rates during recovery window
    // recoveryStrength 0 = normal growth (permanent hit), 100 = full catch-up to baseline
    var recoveryEndYear = stressYear + Math.ceil(se.recoveryYears);
    if (year > stressYear && year <= recoveryEndYear && se.recoveryYears >= 1) {
      var strength = (se.recoveryStrength || 0) / 100;
      if (strength > 0) {
        if (!growthOverrides) growthOverrides = {};
        var baseGrowth = scenario.stock_growth;
        var N = Math.ceil(se.recoveryYears);
        // Full catch-up rate: r = (1+g) * (1/(1-drop))^(1/N) - 1
        var fullRecoveryRate = (1 + baseGrowth) * Math.pow(1 / (1 - se.stockDrop), 1 / N) - 1;
        // Blend between baseline growth and full catch-up based on strength
        var recoveryRate = baseGrowth + strength * (fullRecoveryRate - baseGrowth);
        accounts.forEach(function(account) {
          var assetClass = account.asset_class || ACCOUNT_TYPE_ASSET_CLASS[account.type];
          if (assetClass === 'stock') {
            var existing = growthOverrides[account.name];
            if (!existing || recoveryRate > existing) {
              growthOverrides[account.name] = recoveryRate;
            }
          }
        });
      }
    }
  });

  return growthOverrides;
}

/**
 * Full drawdown simulation.
 * Simulates year-by-year spending from accounts in retirement.
 * Drawdown order: brokerage -> HSA (medical only) -> 401k/trad IRA -> Roth
 *
 * Returns { yearlyResults, sustainable, depletionYear, totalRemainingAtEnd }
 */
function simulateDrawdown(data, scenario, stressEvents) {
  var settings = data.settings;
  var people = data.household.people;
  var inflationRate = scenario.inflation;

  // Find the oldest person to determine projection end
  var oldestPerson = people.reduce(function (oldest, p) {
    return p.birth_year < oldest.birth_year ? p : oldest;
  }, people[0]);
  var endYear = oldestPerson.birth_year + settings.projection_end_age;

  // Create mutable account balances
  var accountBalances = {};
  data.accounts.forEach(function (account) {
    accountBalances[account.name] = account.balance;
  });

  // Project mortgage
  var mortgageProjection = null;
  if (data.liabilities && data.liabilities.length > 0) {
    mortgageProjection = projectMortgage(data.liabilities[0], endYear);
  }

  var yearlyResults = [];
  var sustainable = true;
  var depletionYear = null;
  var prevGrowthOverrides = null;

  for (var year = CURRENT_YEAR; year <= endYear; year++) {
    // Determine if each person is retired
    var allRetired = people.every(function (p) {
      return isPersonRetired(p, settings, year);
    });
    var anyRetired = people.some(function (p) {
      return isPersonRetired(p, settings, year);
    });

    // Grow accounts (no contributions yet — need to check surplus first)
    if (year > CURRENT_YEAR) {
      data.accounts.forEach(function (account) {
        var balance = accountBalances[account.name];
        var growthRate = (prevGrowthOverrides && prevGrowthOverrides[account.name] != null)
          ? prevGrowthOverrides[account.name]
          : getGrowthRate(account, scenario);
        accountBalances[account.name] = balance * (1 + growthRate);
      });
    }

    // Apply stress events (drops and recovery growth overrides)
    var growthOverrides = null;
    if (stressEvents && stressEvents.length > 0) {
      var firstRetirementYear = people.reduce(function(earliest, p) {
        var ry = getRetirementYear(p, settings);
        return ry < earliest ? ry : earliest;
      }, Infinity);
      growthOverrides = applyStressEvents(accountBalances, data.accounts, year, stressEvents, firstRetirementYear, scenario);
    }

    // Calculate income
    var ssIncome = 0;
    people.forEach(function (person) {
      ssIncome += getSocialSecurityBenefit(person, year, inflationRate, scenario.ss_factor);
    });

    // Calculate RMDs (forced withdrawals from tax-deferred accounts)
    var totalRmd = 0;
    var rmdDetails = []; // per-account RMD info for RMD page
    data.accounts.forEach(function (account) {
      if (isRmdAccount(account.type) && account.owner) {
        var owner = people.find(function (p) { return p.name === account.owner; });
        if (owner) {
          var age = getPersonAge(owner, year);
          var rmdStartAge = getRmdStartAge(owner);
          if (age >= rmdStartAge) {
            var preBalance = accountBalances[account.name];
            var rmd = calculateRmd(preBalance, age);
            var divisor = UNIFORM_LIFETIME_TABLE[age] || 6.4;
            totalRmd += rmd;
            accountBalances[account.name] -= rmd;
            if (accountBalances[account.name] < 0) accountBalances[account.name] = 0;
            rmdDetails.push({
              accountName: account.name,
              owner: owner.name,
              age: age,
              preBalance: preBalance,
              divisor: divisor,
              rmd: rmd,
            });
          }
        }
      }
    });

    // Calculate expenses
    var expenses = getAnnualExpenses(data.annual_expenses, year, inflationRate, allRetired, people, settings);
    var recurring = getRecurringExpenses(data.recurring_expenses, year, inflationRate, anyRetired);

    // HSA pays annual medical expenses first
    var hsaMedicalPaid = 0;
    data.accounts.forEach(function (account) {
      if (account.type === 'hsa') {
        var draw = Math.min(expenses.medical, accountBalances[account.name]);
        accountBalances[account.name] -= draw;
        hsaMedicalPaid += draw;
      }
    });
    var totalExpenses = expenses.total - hsaMedicalPaid + recurring;

    // Housing costs: mortgage while active, then property tax + insurance after payoff
    var mortgagePayment = 0;
    var housingCost = 0;
    if (mortgageProjection) {
      var mortgageEntry = mortgageProjection.find(function (m) { return m.year === year; });
      if (mortgageEntry) mortgagePayment = mortgageEntry.payment;
    }
    // Property tax + insurance are always owed, regardless of mortgage status
    if (data.home) {
      var yearsFromNow = year - CURRENT_YEAR;
      var inflationMult = Math.pow(1 + inflationRate, yearsFromNow);
      housingCost = ((data.home.annual_property_tax || 0) + (data.home.annual_insurance || 0)) * inflationMult;
    }
    // Add mortgage P&I on top
    if (mortgagePayment > 0) {
      housingCost += mortgagePayment;
    }
    totalExpenses += housingCost;

    // Second home ongoing costs (after purchase year)
    var secondHomeCost = 0;
    if (includeSecondHome && data.second_home && year >= data.second_home.purchase_year) {
      var yearsFromNow = year - CURRENT_YEAR;
      var inflationMult = Math.pow(1 + inflationRate, yearsFromNow);
      secondHomeCost = ((data.second_home.annual_property_tax || 0)
        + (data.second_home.annual_insurance || 0)
        + (data.second_home.annual_maintenance || 0)
        + (data.second_home.annual_utilities || 0)) * inflationMult;
      totalExpenses += secondHomeCost;
    }

    // Lump sum events
    var lumpSumEvents = [];
    if (data.lump_sum_events) {
      data.lump_sum_events.forEach(function (event) {
        if (event.year === year) {
          // Skip second home purchase if toggle is off
          if (!includeSecondHome && event.name === 'Second Home') return;
          lumpSumEvents.push(event);
          if (event.type === 'expense') {
            totalExpenses += Math.abs(event.amount);
          }
        }
      });
    }

    // Salary income — each person's take-home until they retire, with annual raises
    var salaryIncome = 0;
    var raiseRate = (data.settings && data.settings.annual_raise_rate != null) ? data.settings.annual_raise_rate : 0.025;
    people.forEach(function (person) {
      if (!isPersonRetired(person, settings, year)) {
        var yearsWorked = year - CURRENT_YEAR;
        salaryIncome += (person.take_home_income || 0) * Math.pow(1 + raiseRate, yearsWorked);
      }
    });

    // Lump sum income
    var lumpSumIncome = 0;
    lumpSumEvents.forEach(function (event) {
      if (event.type === 'income') {
        lumpSumIncome += event.amount;
      }
    });

    // Add contributions in two passes:
    // 1. Payroll deductions (401k, HSA) — always add, already funded by gross pay
    //    (take_home_income is AFTER these deductions, so adding them is not double-counting)
    // 2. Manual contributions (Roth IRA, brokerage, savings) — cap at take-home surplus
    var totalIncomeBeforeContrib = salaryIncome + ssIncome + totalRmd + lumpSumIncome;
    var totalContributions = 0;
    var PAYROLL_DEDUCTED_TYPES = { '401k': true, 'hsa': true };

    if (year > CURRENT_YEAR) {
      // Pass 1: Payroll deductions — unconditional (owner must still be working)
      data.accounts.forEach(function (account) {
        if (!PAYROLL_DEDUCTED_TYPES[account.type]) return;
        var contribution = getAnnualContribution(account, year, people, settings);
        if (contribution > 0) {
          accountBalances[account.name] += contribution;
          totalContributions += contribution;
        }
      });

      // Pass 2: Manual contributions — cap at take-home surplus after expenses
      var surplus = totalIncomeBeforeContrib - totalExpenses;
      if (surplus > 0) {
        var manualContributions = 0;
        data.accounts.forEach(function (account) {
          if (PAYROLL_DEDUCTED_TYPES[account.type]) return;
          var contribution = getAnnualContribution(account, year, people, settings);
          var actual = Math.min(contribution, surplus - manualContributions);
          if (actual > 0) {
            accountBalances[account.name] += actual;
            totalContributions += actual;
            manualContributions += actual;
          }
        });
      }
    }

    // Net need after all income and contributions
    var totalIncome = totalIncomeBeforeContrib;
    var livingExpenses = totalExpenses; // preserve pre-tax living costs
    var netNeed = totalExpenses + totalContributions - totalIncome;

    var withdrawals = {};
    var remaining = netNeed > 0 ? netNeed : 0;

    // --- Drawdown waterfall ---
    // Withdraws the requested amount from accounts in priority order.
    // Called multiple times (expenses, then tax iterations); withdrawals accumulate.
    function drawdownAmount(amount) {
      if (amount <= 0) return 0;
      var rem = amount;
      // 1. Brokerage accounts first (not taxable in simplified model)
      rem = withdrawFromType('brokerage', rem, accountBalances, data.accounts, withdrawals);
      // 2. HSA for medical expenses only (cap at remaining medical need)
      if (rem > 0) {
        var hsaAlreadyUsed = withdrawals.hsa || 0;
        var medicalCap = Math.max(0, expenses.medical - hsaAlreadyUsed);
        var hsaAmount = Math.min(medicalCap, rem);
        if (hsaAmount > 0) {
          var hsaShortfall = withdrawFromType('hsa', hsaAmount, accountBalances, data.accounts, withdrawals);
          var hsaPaid = hsaAmount - hsaShortfall;
          rem -= hsaPaid;
        }
      }
      // 3. 401k and Traditional IRA (fully taxable)
      if (rem > 0) rem = withdrawFromType('401k', rem, accountBalances, data.accounts, withdrawals);
      if (rem > 0) rem = withdrawFromType('traditional_ira', rem, accountBalances, data.accounts, withdrawals);
      // 4. Savings and checking (after-tax, low growth — spend before Roth)
      if (rem > 0) rem = withdrawFromType('savings', rem, accountBalances, data.accounts, withdrawals);
      if (rem > 0) rem = withdrawFromType('checking', rem, accountBalances, data.accounts, withdrawals);
      // 5. Roth IRA (tax-free, highest growth — absolute last resort)
      if (rem > 0) rem = withdrawFromType('roth_ira', rem, accountBalances, data.accounts, withdrawals);
      return rem;
    }

    // Initial drawdown for living expenses
    remaining = drawdownAmount(remaining);

    // --- Tax calculation (any retirement withdrawals) ---
    // During working years, salary taxes are embedded in take_home_income.
    // Once anyone retires, compute tax on retirement income sources
    // (SS + RMDs + taxable withdrawals). Salary taxes are already paid,
    // so we only tax retirement-specific income here.
    // Iterate: withdraw more to cover tax, which may create more tax.
    var taxOwed = 0;
    if (anyRetired) {
      var prevTax = 0;
      for (var taxIter = 0; taxIter < 5; taxIter++) {
        var taxableWithdrawals = (withdrawals['401k'] || 0) + (withdrawals.traditional_ira || 0);
        taxOwed = calculateRetirementTax(ssIncome, totalRmd, taxableWithdrawals, year, inflationRate);
        var additionalNeeded = taxOwed - prevTax;
        if (additionalNeeded < 1) break; // converged (within $1)
        remaining = drawdownAmount(additionalNeeded);
        prevTax = taxOwed;
      }
    }

    // Check for depletion
    if (remaining > 0 && !depletionYear) {
      depletionYear = year;
      sustainable = false;
    }

    // Calculate total remaining
    var totalRemaining = 0;
    data.accounts.forEach(function (account) {
      totalRemaining += accountBalances[account.name];
    });

    yearlyResults.push({
      year: year,
      totalExpenses: livingExpenses, // living costs only (no tax)
      taxOwed: taxOwed,
      totalCost: livingExpenses + taxOwed, // expenses + taxes combined
      medicalExpense: expenses.medical,
      preMedicare: expenses.preMedicareMedical > 0,
      hsaMedicalPaid: hsaMedicalPaid,
      ssIncome: ssIncome,
      rmdIncome: totalRmd,
      salaryIncome: salaryIncome,
      lumpSumEvents: lumpSumEvents,
      totalIncome: totalIncome,
      totalContributions: totalContributions,
      netNeed: netNeed,
      withdrawals: withdrawals,
      shortfall: remaining,
      totalRemaining: totalRemaining,
      accountBalances: Object.assign({}, accountBalances),
      allRetired: allRetired,
      anyRetired: anyRetired,
      secondHomeCost: secondHomeCost,
      rmdDetails: rmdDetails,
    });
    prevGrowthOverrides = growthOverrides;
  }

  var totalRemainingAtEnd = 0;
  data.accounts.forEach(function (account) {
    totalRemainingAtEnd += accountBalances[account.name];
  });

  return {
    yearlyResults: yearlyResults,
    sustainable: sustainable,
    depletionYear: depletionYear,
    totalRemainingAtEnd: totalRemainingAtEnd,
  };
}

/**
 * Run baseline and stressed simulations side-by-side.
 * Returns { baseline, stressed } each with { yearlyResults, sustainable, depletionYear, totalRemainingAtEnd }.
 */
function simulateWithStress(data, scenario, stressEvents, retirementOverrides) {
  // Create a copy of data with overridden retirement ages
  var settingsOverride = Object.assign({}, data.settings);
  if (retirementOverrides) {
    data.household.people.forEach(function(p) {
      var key = 'retirement_age_' + p.name.toLowerCase();
      if (retirementOverrides[p.name.toLowerCase()] !== undefined) {
        settingsOverride[key] = retirementOverrides[p.name.toLowerCase()];
      }
    });
  }
  var dataCopy = Object.assign({}, data, { settings: settingsOverride });

  var baseline = simulateDrawdown(dataCopy, scenario);
  var stressed = simulateDrawdown(dataCopy, scenario, stressEvents);

  return { baseline: baseline, stressed: stressed };
}

/**
 * Helper: withdraw from accounts of a given type.
 * Returns remaining amount still needed.
 */
function withdrawFromType(type, amount, accountBalances, accounts, withdrawals) {
  var remaining = amount;
  accounts.forEach(function (account) {
    if (account.type === type && remaining > 0) {
      var available = accountBalances[account.name];
      var withdrawal = Math.min(available, remaining);
      accountBalances[account.name] -= withdrawal;
      remaining -= withdrawal;
      if (!withdrawals[type]) withdrawals[type] = 0;
      withdrawals[type] += withdrawal;
    }
  });
  return remaining;
}

/**
 * Generate milestone events sorted by year.
 * Returns array of { year, label, type } objects.
 */
function generateMilestones(data) {
  var milestones = [];
  var people = data.household.people;
  var settings = data.settings;

  people.forEach(function (person) {
    // Age 50 — catch-up contributions
    var year50 = person.birth_year + 50;
    if (year50 >= CURRENT_YEAR) {
      milestones.push({
        year: year50,
        label: person.name + ' turns 50 — catch-up contributions eligible',
        type: 'retirement',
      });
    }

    // Age 55 — HSA catch-up
    var year55 = person.birth_year + 55;
    if (year55 >= CURRENT_YEAR) {
      milestones.push({
        year: year55,
        label: person.name + ' turns 55 — HSA catch-up eligible',
        type: 'retirement',
      });
    }

    // Age 59.5 — penalty-free withdrawals
    var year59 = person.birth_year + 59;
    milestones.push({
      year: year59,
      label: person.name + ' turns 59½ — penalty-free retirement withdrawals',
      type: 'retirement',
    });

    // Retirement
    var retireYear = getRetirementYear(person, settings);
    milestones.push({
      year: retireYear,
      label: person.name + ' retires (age ' + getRetirementAge(person, settings) + ')',
      type: 'retirement',
    });

    // Social Security claiming
    if (person.social_security) {
      var ssYear = person.birth_year + person.social_security.claiming_age;
      milestones.push({
        year: ssYear,
        label: person.name + ' starts Social Security (age ' + person.social_security.claiming_age + ')',
        type: 'income',
      });
    }

    // RMD start
    var rmdAge = getRmdStartAge(person);
    var rmdYear = person.birth_year + rmdAge;
    milestones.push({
      year: rmdYear,
      label: person.name + ' RMDs begin (age ' + rmdAge + ')',
      type: 'tax',
    });

    // Age milestones
    [62, 65, 70, 80, 90].forEach(function (age) {
      var ageYear = person.birth_year + age;
      if (ageYear > CURRENT_YEAR) {
        milestones.push({
          year: ageYear,
          label: person.name + ' turns ' + age,
          type: 'age',
        });
      }
    });
  });

  // Mortgage payoff (use actual amortization, not nominal term)
  if (data.liabilities) {
    data.liabilities.forEach(function (liability) {
      if (liability.type === 'mortgage') {
        var mortProj = projectMortgage(liability, CURRENT_YEAR + 40);
        var payoffYear = getMortgagePayoffYear(mortProj);
        if (payoffYear) {
          milestones.push({
            year: payoffYear,
            label: 'Mortgage paid off',
            type: 'debt',
          });
        }
      }
    });
  }

  // Recurring expenses
  if (data.recurring_expenses) {
    data.recurring_expenses.forEach(function (item) {
      var oldestPerson = people.reduce(function (oldest, p) {
        return p.birth_year < oldest.birth_year ? p : oldest;
      }, people[0]);
      var maxYear = oldestPerson.birth_year + settings.projection_end_age;

      var year = item.next_occurrence;
      while (year <= maxYear) {
        milestones.push({
          year: year,
          label: item.name + ' ($' + item.amount.toLocaleString() + ')',
          type: 'expense',
        });
        year += item.frequency_years;
      }
    });
  }

  // Sort by year
  milestones.sort(function (a, b) { return a.year - b.year; });

  return milestones;
}

/**
 * Categorize accounts into groups with totals.
 * Physical assets reflect home equity (value minus mortgage), not full home value.
 * Net worth = liquidTotal + retirementTotal + homeEquity
 */
function categorizeAccounts(data) {
  var liquid = [];
  var retirement = [];

  data.accounts.forEach(function (account) {
    switch (account.type) {
      case 'checking':
      case 'savings':
      case 'brokerage':
        liquid.push(account);
        break;
      case '401k':
      case 'traditional_ira':
      case 'roth_ira':
      case 'hsa':
        retirement.push(account);
        break;
    }
  });

  var liquidTotal = liquid.reduce(function (sum, a) { return sum + a.balance; }, 0);
  var retirementTotal = retirement.reduce(function (sum, a) { return sum + a.balance; }, 0);

  var homeValue = data.home ? data.home.current_value : 0;

  var liabilityTotal = 0;
  var liabilities = data.liabilities || [];
  liabilities.forEach(function (l) { liabilityTotal += l.balance; });

  var homeEquity = homeValue - liabilityTotal;
  var netWorth = liquidTotal + retirementTotal + homeEquity;

  return {
    liquid: liquid,
    retirement: retirement,
    physical: [{ name: 'Home', balance: homeValue }],
    liabilities: liabilities,
    liquidTotal: liquidTotal,
    retirementTotal: retirementTotal,
    homeValue: homeValue,
    homeEquity: homeEquity,
    liabilityTotal: liabilityTotal,
    netWorth: netWorth,
  };
}
