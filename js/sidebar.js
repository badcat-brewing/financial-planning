/**
 * sidebar.js
 * Renders the shared sidebar navigation on every page.
 */

var PAGES = [
  { href: 'index.html', label: 'Dashboard' },
  { href: 'contributions.html', label: 'Contributions' },
  { href: 'projections.html', label: 'Projections' },
  { href: 'milestones.html', label: 'Milestones' },
  { href: 'social-security.html', label: 'Social Security' },
  { href: 'rmds.html', label: 'RMDs' },
  { href: 'drawdown.html', label: 'Drawdown' },
];

var currentScenario = 'baseline';

/**
 * Extract the current page filename from the URL.
 */
function getCurrentPage() {
  var path = window.location.pathname;
  var filename = path.substring(path.lastIndexOf('/') + 1);
  // Default to index.html if at root
  if (!filename || filename === '') return 'index.html';
  return filename;
}

/**
 * Get the current scenario object from the data.
 */
function getScenario(data) {
  if (data && data.scenarios && data.scenarios[currentScenario]) {
    return data.scenarios[currentScenario];
  }
  return data.scenarios.baseline;
}

/**
 * Render the sidebar into the page.
 * Creates sidebar DOM, scenario selector, and navigation links.
 *
 * @param {Object} data - The parsed data object from data.yaml
 * @param {Function} renderCallback - Called when scenario changes, receives (data, scenario)
 */
var sidebarCollapsed = false;

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  var sidebar = document.querySelector('.sidebar');
  var main = document.querySelector('.main-content');
  var toggle = document.getElementById('sidebar-toggle');
  if (sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    main.classList.add('sidebar-collapsed');
    toggle.innerHTML = '&#9776;';
  } else {
    sidebar.classList.remove('collapsed');
    main.classList.remove('sidebar-collapsed');
    toggle.innerHTML = '&lsaquo;';
  }
}

function renderSidebar(data, renderCallback) {
  var currentPage = getCurrentPage();

  // Create sidebar element
  var sidebar = document.createElement('div');
  sidebar.className = 'sidebar';

  // Toggle button
  var toggle = document.createElement('button');
  toggle.id = 'sidebar-toggle';
  toggle.className = 'sidebar-toggle';
  toggle.innerHTML = '&lsaquo;';
  toggle.addEventListener('click', toggleSidebar);
  sidebar.appendChild(toggle);

  // Header
  var header = document.createElement('div');
  header.className = 'sidebar-header';
  header.innerHTML = '<h1>Finance Dashboard</h1><div class="subtitle">Personal Finance Planner</div>';
  sidebar.appendChild(header);

  // Navigation
  var nav = document.createElement('ul');
  nav.className = 'sidebar-nav';

  PAGES.forEach(function (page) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = page.href;
    a.textContent = page.label;
    if (page.href === currentPage) {
      a.className = 'active';
    }
    li.appendChild(a);
    nav.appendChild(li);
  });

  sidebar.appendChild(nav);

  // Scenario selector
  var scenarioDiv = document.createElement('div');
  scenarioDiv.className = 'sidebar-scenario';

  var label = document.createElement('label');
  label.setAttribute('for', 'scenario-select');
  label.textContent = 'Scenario';
  scenarioDiv.appendChild(label);

  var select = document.createElement('select');
  select.id = 'scenario-select';

  if (data && data.scenarios) {
    Object.keys(data.scenarios).forEach(function (key) {
      var option = document.createElement('option');
      option.value = key;
      option.textContent = data.scenarios[key].label || key;
      if (key === currentScenario) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  select.addEventListener('change', function () {
    currentScenario = this.value;
    if (renderCallback && data) {
      renderCallback(data, getScenario(data));
    }
  });

  scenarioDiv.appendChild(select);
  sidebar.appendChild(scenarioDiv);

  // Second home toggle
  var homeDiv = document.createElement('div');
  homeDiv.className = 'sidebar-scenario';

  var homeLabel = document.createElement('label');
  homeLabel.textContent = 'Second Home';
  homeDiv.appendChild(homeLabel);

  var homeToggleGroup = document.createElement('div');
  homeToggleGroup.className = 'toggle-group';
  homeToggleGroup.style.display = 'flex';
  homeToggleGroup.style.width = '100%';

  var btnHomeOn = document.createElement('button');
  btnHomeOn.className = 'toggle-btn' + (includeSecondHome ? ' active' : '');
  btnHomeOn.textContent = 'Include';
  btnHomeOn.style.flex = '1';

  var btnHomeOff = document.createElement('button');
  btnHomeOff.className = 'toggle-btn' + (includeSecondHome ? '' : ' active');
  btnHomeOff.textContent = 'Exclude';
  btnHomeOff.style.flex = '1';

  btnHomeOn.addEventListener('click', function () {
    if (includeSecondHome) return;
    includeSecondHome = true;
    btnHomeOn.classList.add('active');
    btnHomeOff.classList.remove('active');
    if (renderCallback && data) {
      renderCallback(data, getScenario(data));
    }
  });

  btnHomeOff.addEventListener('click', function () {
    if (!includeSecondHome) return;
    includeSecondHome = false;
    btnHomeOff.classList.add('active');
    btnHomeOn.classList.remove('active');
    if (renderCallback && data) {
      renderCallback(data, getScenario(data));
    }
  });

  homeToggleGroup.appendChild(btnHomeOn);
  homeToggleGroup.appendChild(btnHomeOff);
  homeDiv.appendChild(homeToggleGroup);
  sidebar.appendChild(homeDiv);

  // Dollar mode toggle (nominal vs today's dollars)
  var dollarDiv = document.createElement('div');
  dollarDiv.className = 'sidebar-scenario';
  dollarDiv.style.borderTop = 'none';
  dollarDiv.style.paddingTop = '0';

  var dollarLabel = document.createElement('label');
  dollarLabel.textContent = 'Dollar Display';
  dollarDiv.appendChild(dollarLabel);

  var toggleGroup = document.createElement('div');
  toggleGroup.className = 'toggle-group';
  toggleGroup.style.display = 'flex';
  toggleGroup.style.width = '100%';

  var btnNominal = document.createElement('button');
  btnNominal.className = 'toggle-btn' + (showRealDollars ? '' : ' active');
  btnNominal.textContent = 'Nominal $';
  btnNominal.style.flex = '1';

  var btnReal = document.createElement('button');
  btnReal.className = 'toggle-btn' + (showRealDollars ? ' active' : '');
  btnReal.textContent = "Today's $";
  btnReal.style.flex = '1';

  btnNominal.addEventListener('click', function () {
    if (!showRealDollars) return;
    showRealDollars = false;
    btnNominal.classList.add('active');
    btnReal.classList.remove('active');
    if (renderCallback && data) {
      renderCallback(data, getScenario(data));
    }
  });

  btnReal.addEventListener('click', function () {
    if (showRealDollars) return;
    showRealDollars = true;
    btnReal.classList.add('active');
    btnNominal.classList.remove('active');
    if (renderCallback && data) {
      renderCallback(data, getScenario(data));
    }
  });

  toggleGroup.appendChild(btnNominal);
  toggleGroup.appendChild(btnReal);
  dollarDiv.appendChild(toggleGroup);
  sidebar.appendChild(dollarDiv);

  // Insert sidebar into the page
  document.body.insertBefore(sidebar, document.body.firstChild);
}
