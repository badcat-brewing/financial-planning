/**
 * data-loader.js
 * Fetches data.yaml, parses with js-yaml, validates required fields,
 * applies defaults, and exposes loadData() and getGrowthRate().
 */

// Maps account types to their asset class for scenario-based growth lookup
const ACCOUNT_TYPE_ASSET_CLASS = {
  checking: null,
  savings: 'savings',
  brokerage: 'stock',
  '401k': 'stock',
  traditional_ira: 'stock',
  roth_ira: 'stock',
  hsa: 'stock',
};

// Maps asset classes to the corresponding key in a scenario object
const ASSET_CLASS_TO_SCENARIO_KEY = {
  stock: 'stock_growth',
  bond: 'bond_growth',
  savings: 'savings_growth',
};

/**
 * Fill in missing optional fields with sensible defaults.
 */
function applyDefaults(data) {
  // Account defaults
  if (data.accounts) {
    data.accounts.forEach(function (account) {
      if (account.growth_rate == null) account.growth_rate = 0;
      if (account.annual_contribution == null) account.annual_contribution = 0;
      if (account.employer_match == null) account.employer_match = 0;
    });
  }

  // Home defaults
  if (data.home) {
    if (data.home.annual_appreciation == null) data.home.annual_appreciation = 0.03;
  }

  // Liability defaults
  if (data.liabilities) {
    data.liabilities.forEach(function (liability) {
      if (liability.interest_rate == null) liability.interest_rate = 0;
    });
  }

  // Annual expenses defaults
  if (data.annual_expenses) {
    var exp = data.annual_expenses;
    if (exp.inflation_adjusted == null) exp.inflation_adjusted = true;
    if (exp.retirement_spending_factor == null) exp.retirement_spending_factor = 0.85;
    if (exp.vacation_retirement_factor == null) exp.vacation_retirement_factor = 1.0;
    if (exp.medical_retirement_factor == null) exp.medical_retirement_factor = 1.5;
  }

  // Recurring expenses defaults
  if (data.recurring_expenses) {
    data.recurring_expenses.forEach(function (item) {
      if (item.inflation_adjusted == null) item.inflation_adjusted = true;
    });
  }

  // Settings defaults
  if (!data.settings) data.settings = {};
  if (data.settings.projection_end_age == null) data.settings.projection_end_age = 95;
  // Default retirement age for any person without an explicit setting
  if (data.household && data.household.people) {
    data.household.people.forEach(function (person) {
      var key = 'retirement_age_' + person.name.toLowerCase();
      if (data.settings[key] == null) data.settings[key] = 65;
    });
  }

  return data;
}

/**
 * Validate that all required fields are present.
 * Returns an array of error strings (empty if valid).
 */
function validate(data) {
  var errors = [];

  if (!data) {
    errors.push('Data file is empty or failed to parse.');
    return errors;
  }

  if (!data.household || !data.household.people || data.household.people.length === 0) {
    errors.push('household.people is required and must contain at least one person.');
  } else {
    data.household.people.forEach(function (person, i) {
      if (!person.name) errors.push('household.people[' + i + '].name is required.');
      if (person.birth_year == null) errors.push('household.people[' + i + '].birth_year is required.');
    });
  }

  if (!data.accounts || data.accounts.length === 0) {
    errors.push('accounts is required and must contain at least one account.');
  } else {
    data.accounts.forEach(function (account, i) {
      if (!account.name) errors.push('accounts[' + i + '].name is required.');
      if (!account.type) errors.push('accounts[' + i + '].type is required.');
      if (account.balance == null) errors.push('accounts[' + i + '].balance is required.');
    });
  }

  if (!data.home) {
    errors.push('home section is required.');
  } else {
    if (data.home.current_value == null) errors.push('home.current_value is required.');
  }

  if (!data.annual_expenses) {
    errors.push('annual_expenses section is required.');
  } else {
    if (data.annual_expenses.living_expenses == null) errors.push('annual_expenses.living_expenses is required.');
  }

  if (!data.scenarios) {
    errors.push('scenarios section is required.');
  } else {
    if (!data.scenarios.baseline) errors.push('scenarios.baseline is required.');
  }

  return errors;
}

/**
 * Render validation errors into .main-content.
 */
function showErrors(errors) {
  var container = document.querySelector('.main-content');
  if (!container) {
    console.error('Cannot display errors: .main-content not found.');
    console.error(errors);
    return;
  }
  var html = '<div class="card" style="border-left-color: var(--accent-red);">';
  html += '<h2 style="color: var(--accent-red);">Data Validation Errors</h2>';
  html += '<ul>';
  errors.forEach(function (err) {
    html += '<li style="color: var(--text-secondary); margin-bottom: 8px;">' + err + '</li>';
  });
  html += '</ul>';
  html += '<p style="color: var(--text-muted); margin-top: 16px;">Please fix the errors in <code>data.yaml</code> and reload.</p>';
  html += '</div>';
  container.innerHTML = html;
}

/**
 * Get the growth rate for an account under a given scenario.
 * Uses the scenario rate for the account's asset class if available,
 * otherwise falls back to the account's own growth_rate.
 */
function getGrowthRate(account, scenario) {
  // Allow per-account asset_class override, fall back to type-based mapping
  var assetClass = account.asset_class || ACCOUNT_TYPE_ASSET_CLASS[account.type];
  if (assetClass && scenario) {
    var scenarioKey = ASSET_CLASS_TO_SCENARIO_KEY[assetClass];
    if (scenarioKey && scenario[scenarioKey] != null) {
      return scenario[scenarioKey];
    }
  }
  return account.growth_rate || 0;
}

/**
 * Parse RAW_YAML (from data.js), validate, apply defaults, and return the data object.
 */
function loadData() {
  try {
    var data = jsyaml.load(RAW_YAML);

    var errors = validate(data);
    if (errors.length > 0) {
      showErrors(errors);
      return null;
    }

    data = applyDefaults(data);
    return data;
  } catch (err) {
    showErrors(['Failed to load data: ' + err.message]);
    return null;
  }
}
