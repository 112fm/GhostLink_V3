import re
with open('src/modules/admin.js', 'r') as f: content = f.read()
content = re.sub(r"if \(document\.readyState === 'loading'\) \{\s*document\.addEventListener\('DOMContentLoaded', setupAdminDashboardEntry\);\s*\} else \{\s*setupAdminDashboardEntry\(\);\s*\}", r"setupAdminDashboardEntry();", content)
content = re.sub(r"if \(document\.readyState === 'loading'\) \{\s*document\.addEventListener\('DOMContentLoaded', \(\) => \{\s*if \(document\.getElementById\('admin-tab-users'\)\) \{\s*void initUsersTab\(\);\s*\}\s*\}\);\s*\} else \{\s*if \(document\.getElementById\('admin-tab-users'\)\) \{\s*void initUsersTab\(\);\s*\}\s*\}", r"", content)
content = re.sub(r"document\.addEventListener\('DOMContentLoaded', \(\) => \{\s*// Check if admin tab finance exists\s*if \(!document\.getElementById\('admin-tab-finance'\)\) return;\s*initFinanceTab\(\);\s*\}\);\s*function initFinanceTab\(\) \{", r"let financeTabInitialized = false;
function initFinanceTab() {
  if (financeTabInitialized) return renderFinanceTab();
  financeTabInitialized = true;", content)
content = re.sub(r"document\.addEventListener\('DOMContentLoaded', \(\) => \{\s*if \(!document\.getElementById\('admin-tab-system'\)\) return;\s*initSystemTab\(\);\s*\}\);\s*function initSystemTab\(\) \{", r"let systemTabInitialized = false;
function initSystemTab() {
  if (systemTabInitialized) return refreshSystemTab();
  systemTabInitialized = true;", content)
old_s = """      if (btn.dataset.tab === 'users') {
        if (typeof initUsersTab === 'function') void initUsersTab();
      } else if (btn.dataset.tab === 'partners') {
        if (typeof initPartnersTab === 'function') initPartnersTab();
      } else if (btn.dataset.tab === 'finance') {
        if (typeof renderFinanceTab === 'function') void renderFinanceTab();
      }"""
new_s = """      if (btn.dataset.tab === 'users') {
        if (typeof initUsersTab === 'function') void initUsersTab();
      } else if (btn.dataset.tab === 'partners') {
        if (typeof initPartnersTab === 'function') initPartnersTab();
      } else if (btn.dataset.tab === 'finance') {
        if (typeof initFinanceTab === 'function') void initFinanceTab();
      } else if (btn.dataset.tab === 'system') {
        if (typeof initSystemTab === 'function') void initSystemTab();
      }"""
content = content.replace(old_s, new_s)
with open('src/modules/admin.js', 'w') as f: f.write(content)
